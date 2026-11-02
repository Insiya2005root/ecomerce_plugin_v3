"use strict";
const InventoryService_1 = require("../services/InventoryService");
const StoreSettings_1 = require("../services/StoreSettings");
const TENANT = 'default_tenant';
const isObjectId = (id) => typeof id === 'string' && /^[a-f0-9]{24}$/i.test(id);
function escapeRegex(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
function sendError(res, e) {
    if (e instanceof InventoryService_1.InventoryError)
        return res.status(e.status).json({ success: false, message: e.message });
    if (e?.name === 'ValidationError' || e?.name === 'CastError')
        return res.status(400).json({ success: false, message: e.message });
    return res.status(500).json({ success: false, message: e.message });
}
const actor = (req) => ({ by: (0, StoreSettings_1.currentUser)(req)?.email || undefined });
/** Location names by id, with the pre-location bucket shown as "Unassigned". */
async function locationNames() {
    const Location = require('../models/Location').getModel();
    const rows = await Location.find({ tenantId: TENANT }, { name: 1 }).lean();
    return new Map([[InventoryService_1.UNASSIGNED_LOCATION, 'Unassigned'], ...rows.map((l) => [String(l._id), l.name])]);
}
/** Product name, image, status and variant label for a set of items. */
async function productInfo(items) {
    const mongoose = require('mongoose');
    const Product = require('../models/Product').getModel();
    const ids = [...new Set(items.map((i) => i.productId))].filter(isObjectId).map((id) => new mongoose.Types.ObjectId(id));
    const products = await Product.collection.find({ _id: { $in: ids } }, { projection: { name: 1, status: 1, images: { $slice: 1 }, variants: 1 } }).toArray();
    const byId = new Map(products.map((p) => [String(p._id), p]));
    return (item) => {
        const p = byId.get(item.productId);
        const v = item.variantId ? (p?.variants || []).find((x) => String(x._id) === item.variantId) : null;
        return {
            productName: p?.name ?? item.title,
            productStatus: p?.status ?? null,
            image: p?.images?.[0] ?? null,
            variantLabel: v ? [v.size, v.color].filter(Boolean).join(' / ') || 'Variant' : null,
            productExists: Boolean(p),
        };
    };
}
const ATTRIBUTE_NUMBERS = ['weight', 'length', 'width', 'height'];
const ATTRIBUTE_TEXT = ['hsCode', 'midCode', 'originCountry', 'material', 'unit'];
module.exports = (app) => {
    // ---------------------------------------------------------------- List
    app.get('/inventory', async (req, res) => {
        try {
            await InventoryService_1.InventoryService.syncAllThrottled();
            const Item = InventoryService_1.InventoryService.Item();
            const levelsCollection = InventoryService_1.InventoryService.Level().collection.collectionName;
            const { search, locationId, stock, productId, sort, order: dir, page, limit } = req.query;
            const pageNum = Number(page) >= 1 ? Math.floor(Number(page)) : 1;
            const limitNum = Number(limit) >= 1 ? Math.min(100, Math.floor(Number(limit))) : 20;
            const { lowStockThreshold } = await (0, StoreSettings_1.getStoreSettings)();
            const match = { tenantId: TENANT };
            if (typeof productId === 'string' && productId)
                match.productId = productId;
            if (typeof search === 'string' && search.trim()) {
                const pattern = new RegExp(escapeRegex(search.trim()), 'i');
                match.$or = [{ title: pattern }, { sku: pattern }];
            }
            const atLocation = typeof locationId === 'string' && locationId ? locationId : null;
            const stockFilter = stock === 'out' ? { available: { $lte: 0 }, trackInventory: { $ne: false } }
                : stock === 'low' ? { available: { $gt: 0, $lte: lowStockThreshold }, trackInventory: { $ne: false } }
                    : stock === 'in' ? { available: { $gt: 0 } }
                        : stock === 'reserved' ? { reserved: { $gt: 0 } }
                            : null;
            const sortField = { title: 'title', stocked: 'stocked', available: 'available', reserved: 'reserved', updatedAt: 'updatedAt' }[sort] || 'title';
            const sortDir = dir === 'desc' ? -1 : 1;
            const [result] = await Item.aggregate([
                { $match: match },
                { $addFields: { idStr: { $toString: '$_id' } } },
                { $lookup: { from: levelsCollection, localField: 'idStr', foreignField: 'itemId', as: 'levels' } },
                ...(atLocation ? [{ $addFields: { levels: { $filter: { input: '$levels', cond: { $eq: ['$$this.locationId', atLocation] } } } } }, { $match: { 'levels.0': { $exists: true } } }] : []),
                {
                    $addFields: {
                        stocked: { $sum: '$levels.stocked' },
                        reserved: { $sum: '$levels.reserved' },
                        incoming: { $sum: '$levels.incoming' },
                        locations: { $size: '$levels' },
                    },
                },
                { $addFields: { available: { $subtract: ['$stocked', '$reserved'] } } },
                {
                    $facet: {
                        rows: [
                            ...(stockFilter ? [{ $match: stockFilter }] : []),
                            { $sort: { [sortField]: sortDir, _id: 1 } },
                            { $skip: (pageNum - 1) * limitNum },
                            { $limit: limitNum },
                            // The bulk stock editor needs each location's numbers; the list only needs totals.
                            req.query.includeLevels === '1'
                                ? { $project: { idStr: 0, 'levels._id': 0, 'levels.tenantId': 0, 'levels.itemId': 0, 'levels.createdAt': 0, 'levels.updatedAt': 0, 'levels.__v': 0 } }
                                : { $project: { levels: 0, idStr: 0 } },
                        ],
                        total: [...(stockFilter ? [{ $match: stockFilter }] : []), { $count: 'n' }],
                        summary: [
                            {
                                $group: {
                                    _id: null,
                                    items: { $sum: 1 },
                                    outOfStock: { $sum: { $cond: [{ $and: [{ $lte: ['$available', 0] }, { $ne: ['$trackInventory', false] }] }, 1, 0] } },
                                    lowStock: { $sum: { $cond: [{ $and: [{ $gt: ['$available', 0] }, { $lte: ['$available', lowStockThreshold] }, { $ne: ['$trackInventory', false] }] }, 1, 0] } },
                                    reservedUnits: { $sum: '$reserved' },
                                    stockedUnits: { $sum: '$stocked' },
                                },
                            },
                        ],
                    },
                },
            ]);
            const rows = result?.rows || [];
            const info = await productInfo(rows);
            res.json({
                success: true,
                items: rows.map((r) => ({ ...r, ...info(r) })),
                total: result?.total?.[0]?.n || 0,
                page: pageNum,
                limit: limitNum,
                lowStockThreshold,
                summary: result?.summary?.[0] ? { ...result.summary[0], _id: undefined } : { items: 0, outOfStock: 0, lowStock: 0, reservedUnits: 0, stockedUnits: 0 },
            });
        }
        catch (e) {
            sendError(res, e);
        }
    });
    // ---------------------------------------------------------------- Reservations (before /inventory/:id)
    app.get('/reservations', async (req, res) => {
        try {
            const Reservation = InventoryService_1.InventoryService.Reservation();
            const { search, locationId, kind, page, limit } = req.query;
            const pageNum = Number(page) >= 1 ? Math.floor(Number(page)) : 1;
            const limitNum = Number(limit) >= 1 ? Math.min(100, Math.floor(Number(limit))) : 20;
            const filter = { tenantId: TENANT };
            if (typeof locationId === 'string' && locationId)
                filter.locationId = locationId;
            if (kind === 'order')
                filter.orderId = { $exists: true, $ne: null };
            if (kind === 'manual')
                filter.$or = [{ orderId: { $exists: false } }, { orderId: null }];
            if (typeof search === 'string' && search.trim()) {
                const pattern = new RegExp(escapeRegex(search.trim()), 'i');
                const items = await InventoryService_1.InventoryService.Item().find({ tenantId: TENANT, $or: [{ title: pattern }, { sku: pattern }] }, { _id: 1 }).lean();
                filter.$and = [{ $or: [{ itemId: { $in: items.map((i) => String(i._id)) } }, { description: pattern }] }];
            }
            const [rows, total] = await Promise.all([
                Reservation.find(filter).sort({ createdAt: -1 }).skip((pageNum - 1) * limitNum).limit(limitNum).lean(),
                Reservation.countDocuments(filter),
            ]);
            const items = await InventoryService_1.InventoryService.Item().find({ _id: { $in: rows.map((r) => r.itemId).filter(isObjectId) } }).lean();
            const itemById = new Map(items.map((i) => [String(i._id), i]));
            const names = await locationNames();
            const Order = require('../models/Order').getModel();
            const mongoose = require('mongoose');
            const orderIds = rows.map((r) => r.orderId).filter(isObjectId).map((id) => new mongoose.Types.ObjectId(id));
            const orders = await Order.collection.find({ _id: { $in: orderIds } }, { projection: { orderNumber: 1 } }).toArray();
            const orderNo = new Map(orders.map((o) => [String(o._id), o.orderNumber]));
            res.json({
                success: true,
                reservations: rows.map((r) => ({
                    ...r,
                    itemTitle: itemById.get(r.itemId)?.title ?? 'Deleted item',
                    sku: itemById.get(r.itemId)?.sku ?? null,
                    locationName: names.get(r.locationId) ?? 'Deleted location',
                    orderNumber: r.orderId ? orderNo.get(r.orderId) ?? null : null,
                })),
                total,
                page: pageNum,
                limit: limitNum,
            });
        }
        catch (e) {
            sendError(res, e);
        }
    });
    app.post('/reservations', async (req, res) => {
        try {
            res.json({ success: true, reservation: await InventoryService_1.InventoryService.createReservation(req.body || {}, actor(req)) });
        }
        catch (e) {
            sendError(res, e);
        }
    });
    app.put('/reservations/:id', async (req, res) => {
        try {
            res.json({ success: true, reservation: await InventoryService_1.InventoryService.updateReservation(req.params.id, req.body || {}, actor(req)) });
        }
        catch (e) {
            sendError(res, e);
        }
    });
    app.delete('/reservations/:id', async (req, res) => {
        try {
            await InventoryService_1.InventoryService.deleteReservation(req.params.id, actor(req));
            res.json({ success: true });
        }
        catch (e) {
            sendError(res, e);
        }
    });
    // ---------------------------------------------------------------- Bulk stock edit
    app.post('/inventory/bulk', async (req, res) => {
        try {
            const updates = Array.isArray(req.body?.updates) ? req.body.updates : [];
            if (!updates.length)
                return res.status(400).json({ success: false, message: 'Nothing to update.' });
            if (updates.length > 500)
                return res.status(400).json({ success: false, message: 'Update at most 500 stock levels at a time.' });
            const errors = [];
            let updated = 0;
            for (const u of updates) {
                try {
                    await InventoryService_1.InventoryService.adjust(String(u.itemId), { locationId: String(u.locationId), stocked: u.stocked, incoming: u.incoming, reason: 'Bulk edit' }, actor(req));
                    updated++;
                }
                catch (err) {
                    errors.push({ itemId: String(u.itemId), locationId: String(u.locationId), message: err.message });
                }
            }
            res.status(errors.length && !updated ? 400 : 200).json({ success: errors.length === 0, updated, errors, message: errors[0]?.message });
        }
        catch (e) {
            sendError(res, e);
        }
    });
    // ---------------------------------------------------------------- One item
    app.get('/inventory/:id', async (req, res) => {
        try {
            const item = await InventoryService_1.InventoryService.getItemOrThrow(req.params.id);
            const itemId = String(item._id);
            const [levels, reservations, movements, names] = await Promise.all([
                InventoryService_1.InventoryService.Level().find({ itemId }).lean(),
                InventoryService_1.InventoryService.Reservation().find({ itemId }).sort({ createdAt: -1 }).lean(),
                InventoryService_1.InventoryService.Movement().find({ itemId }).sort({ createdAt: -1 }).limit(50).lean(),
                locationNames(),
            ]);
            const Order = require('../models/Order').getModel();
            const mongoose = require('mongoose');
            const orderIds = [...reservations, ...movements].map((r) => r.orderId).filter(isObjectId).map((id) => new mongoose.Types.ObjectId(id));
            const orders = await Order.collection.find({ _id: { $in: orderIds } }, { projection: { orderNumber: 1 } }).toArray();
            const orderNo = new Map(orders.map((o) => [String(o._id), o.orderNumber]));
            const info = (await productInfo([item]))(item);
            const totals = levels.reduce((t, l) => ({ stocked: t.stocked + l.stocked, reserved: t.reserved + l.reserved, incoming: t.incoming + l.incoming }), { stocked: 0, reserved: 0, incoming: 0 });
            res.json({
                success: true,
                item: {
                    ...item,
                    ...info,
                    ...totals,
                    available: totals.stocked - totals.reserved,
                    levels: levels
                        .map((l) => ({ ...l, locationName: names.get(l.locationId) ?? 'Deleted location', available: l.stocked - l.reserved }))
                        .sort((a, b) => a.locationName.localeCompare(b.locationName)),
                    reservations: reservations.map((r) => ({ ...r, locationName: names.get(r.locationId) ?? 'Deleted location', orderNumber: r.orderId ? orderNo.get(r.orderId) ?? null : null })),
                    movements: movements.map((m) => ({ ...m, locationName: m.locationId ? names.get(m.locationId) ?? 'Deleted location' : null, orderNumber: m.orderNumber || (m.orderId ? orderNo.get(m.orderId) ?? null : null) })),
                },
            });
        }
        catch (e) {
            sendError(res, e);
        }
    });
    app.put('/inventory/:id', async (req, res) => {
        try {
            const item = await InventoryService_1.InventoryService.getItemOrThrow(req.params.id);
            const body = req.body || {};
            const set = {};
            const unset = {};
            const errors = {};
            for (const k of ['requiresShipping', 'trackInventory', 'allowBackorder'])
                if (body[k] !== undefined)
                    set[k] = body[k] === true;
            for (const k of ATTRIBUTE_NUMBERS) {
                if (body[k] === undefined)
                    continue;
                if (body[k] === '' || body[k] === null)
                    unset[k] = '';
                else if (!Number.isFinite(Number(body[k])) || Number(body[k]) < 0)
                    errors[k] = 'Enter a number of 0 or more.';
                else
                    set[k] = Number(body[k]);
            }
            for (const k of ATTRIBUTE_TEXT) {
                if (body[k] === undefined)
                    continue;
                const v = String(body[k] ?? '').trim().slice(0, 80);
                if (v)
                    set[k] = v;
                else
                    unset[k] = '';
            }
            if (Object.keys(errors).length)
                return res.status(400).json({ success: false, message: Object.values(errors)[0], errors });
            await InventoryService_1.InventoryService.Item().updateOne({ _id: item._id }, { ...(Object.keys(set).length ? { $set: set } : {}), ...(Object.keys(unset).length ? { $unset: unset } : {}) });
            res.json({ success: true, item: await InventoryService_1.InventoryService.Item().findById(item._id).lean() });
        }
        catch (e) {
            sendError(res, e);
        }
    });
    app.post('/inventory/:id/adjust', async (req, res) => {
        try {
            res.json({ success: true, level: await InventoryService_1.InventoryService.adjust(req.params.id, req.body || {}, actor(req)) });
        }
        catch (e) {
            sendError(res, e);
        }
    });
    app.put('/inventory/:id/locations', async (req, res) => {
        try {
            const ids = Array.isArray(req.body?.locationIds) ? req.body.locationIds.map(String) : null;
            if (!ids)
                return res.status(400).json({ success: false, message: 'Choose the locations for this item.' });
            await InventoryService_1.InventoryService.setLocations(req.params.id, [...new Set(ids)]);
            res.json({ success: true });
        }
        catch (e) {
            sendError(res, e);
        }
    });
};
