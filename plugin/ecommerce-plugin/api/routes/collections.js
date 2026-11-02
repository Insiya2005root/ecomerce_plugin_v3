"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
const mongoose_1 = __importDefault(require("mongoose"));
const TENANT = 'default_tenant';
function escapeRegex(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
function sendError(res, error) {
    if (error?.code === 11000) {
        return res.status(409).json({ success: false, message: 'A collection with this handle already exists.', field: 'handle' });
    }
    if (error?.name === 'ValidationError') {
        const messages = Object.values(error.errors || {}).map((e) => e.message);
        return res.status(400).json({ success: false, message: messages.join(' ') || error.message });
    }
    if (error?.name === 'CastError') {
        return res.status(400).json({ success: false, message: `Invalid value for ${error.path}.` });
    }
    return res.status(500).json({ success: false, message: error.message });
}
function pickCollectionFields(body) {
    const { slugifyHandle } = require('../models/Collection');
    const fields = {};
    if (body.title !== undefined)
        fields.title = String(body.title).trim();
    if (body.handle !== undefined)
        fields.handle = slugifyHandle(body.handle) || (body.title ? slugifyHandle(body.title) : '');
    if (body.description !== undefined)
        fields.description = String(body.description);
    return fields;
}
async function productCounts(ids) {
    const Product = require('../models/Product').getModel();
    const rows = await Product.aggregate([
        { $match: { tenantId: TENANT, collectionId: { $in: ids } } },
        { $group: { _id: '$collectionId', count: { $sum: 1 } } },
    ]);
    return new Map(rows.map((r) => [String(r._id), r.count]));
}
const toObjectIds = (ids) => (Array.isArray(ids) ? ids : [])
    .map((id) => String(id))
    .filter((id) => mongoose_1.default.Types.ObjectId.isValid(id) && id.length === 24)
    .map((id) => new mongoose_1.default.Types.ObjectId(id));
module.exports = (app) => {
    app.get('/collections', async (req, res) => {
        try {
            const Collection = require('../models/Collection').getModel();
            const { search, page = '1', limit = '50' } = req.query;
            const query = { tenantId: TENANT };
            if (typeof search === 'string' && search.trim()) {
                const pattern = escapeRegex(search.trim());
                query.$or = [{ title: { $regex: pattern, $options: 'i' } }, { handle: { $regex: pattern, $options: 'i' } }];
            }
            const pageNum = Number(page) >= 1 ? Math.floor(Number(page)) : 1;
            const limitNum = Number(limit) >= 1 ? Math.min(500, Math.floor(Number(limit))) : 50;
            const [collections, total] = await Promise.all([
                Collection.find(query)
                    .collation({ locale: 'en', strength: 2 })
                    .sort({ title: 1, _id: 1 })
                    .skip((pageNum - 1) * limitNum)
                    .limit(limitNum)
                    .lean(),
                Collection.countDocuments(query),
            ]);
            const counts = await productCounts(collections.map((c) => c._id));
            res.json({
                success: true,
                collections: collections.map((c) => ({ ...c, productCount: counts.get(String(c._id)) || 0 })),
                total,
                page: pageNum,
                limit: limitNum,
            });
        }
        catch (error) {
            sendError(res, error);
        }
    });
    app.get('/collections/:id', async (req, res) => {
        try {
            const Collection = require('../models/Collection').getModel();
            const collection = await Collection.findOne({ _id: req.params.id, tenantId: TENANT }).lean();
            if (!collection)
                return res.status(404).json({ success: false, message: 'Collection not found.' });
            const counts = await productCounts([collection._id]);
            res.json({ success: true, collection: { ...collection, productCount: counts.get(String(collection._id)) || 0 } });
        }
        catch (error) {
            sendError(res, error);
        }
    });
    app.post('/collections', async (req, res) => {
        try {
            const Collection = require('../models/Collection').getModel();
            const fields = pickCollectionFields(req.body || {});
            if (!fields.title)
                return res.status(400).json({ success: false, message: 'Title is required.', field: 'title' });
            const created = await new Collection({ ...fields, tenantId: TENANT }).save();
            res.json({ success: true, collection: { ...created.toObject(), productCount: 0 } });
        }
        catch (error) {
            sendError(res, error);
        }
    });
    app.put('/collections/:id', async (req, res) => {
        try {
            const Collection = require('../models/Collection').getModel();
            const fields = pickCollectionFields(req.body || {});
            if ('title' in fields && !fields.title) {
                return res.status(400).json({ success: false, message: 'Title is required.', field: 'title' });
            }
            if ('handle' in fields && !fields.handle)
                delete fields.handle;
            const updated = await Collection.findOneAndUpdate({ _id: req.params.id, tenantId: TENANT }, { $set: fields }, { new: true, runValidators: true }).lean();
            if (!updated)
                return res.status(404).json({ success: false, message: 'Collection not found.' });
            const counts = await productCounts([updated._id]);
            res.json({ success: true, collection: { ...updated, productCount: counts.get(String(updated._id)) || 0 } });
        }
        catch (error) {
            sendError(res, error);
        }
    });
    // Products are detached (not deleted) when their collection is removed.
    app.delete('/collections/:id', async (req, res) => {
        try {
            const Collection = require('../models/Collection').getModel();
            const Product = require('../models/Product').getModel();
            const collection = await Collection.findOne({ _id: req.params.id, tenantId: TENANT }).lean();
            if (!collection)
                return res.status(404).json({ success: false, message: 'Collection not found.' });
            const detached = await Product.updateMany({ tenantId: TENANT, collectionId: collection._id }, { $unset: { collectionId: 1 } });
            await Collection.deleteOne({ _id: collection._id });
            res.json({ success: true, detachedProducts: detached.modifiedCount || 0 });
        }
        catch (error) {
            sendError(res, error);
        }
    });
    // Add products to / remove products from a collection. A product moves out of any previous collection.
    app.post('/collections/:id/products', async (req, res) => {
        try {
            const Collection = require('../models/Collection').getModel();
            const Product = require('../models/Product').getModel();
            const collection = await Collection.findOne({ _id: req.params.id, tenantId: TENANT }).lean();
            if (!collection)
                return res.status(404).json({ success: false, message: 'Collection not found.' });
            const add = toObjectIds(req.body?.add);
            const remove = toObjectIds(req.body?.remove);
            const added = add.length
                ? await Product.updateMany({ tenantId: TENANT, _id: { $in: add } }, { $set: { collectionId: collection._id } })
                : { modifiedCount: 0 };
            const removed = remove.length
                ? await Product.updateMany({ tenantId: TENANT, _id: { $in: remove }, collectionId: collection._id }, { $unset: { collectionId: 1 } })
                : { modifiedCount: 0 };
            const counts = await productCounts([collection._id]);
            res.json({
                success: true,
                added: added.modifiedCount || 0,
                removed: removed.modifiedCount || 0,
                productCount: counts.get(String(collection._id)) || 0,
            });
        }
        catch (error) {
            sendError(res, error);
        }
    });
};
