"use strict";
const OrderService_1 = require("../services/OrderService");
const TENANT = 'default_tenant';
const DAY = 86400000;
const NEW_CUSTOMER_DAYS = 30;
/**
 * Customers are derived from orders (there are no customer accounts yet): one customer per email address,
 * compared case-insensitively. Spend excludes cancelled orders and subtracts refunds.
 */
const CANCELLED = { $eq: ['$status', 'Cancelled'] };
const NET_TOTAL = { $subtract: [{ $ifNull: ['$pricing.totalAmount', 0] }, { $ifNull: ['$payment.refundedAmount', 0] }] };
function escapeRegex(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
function segmentOf(c, now) {
    if (c.validOrders >= 2)
        return 'Returning';
    if (c.validOrders === 0)
        return 'No purchases';
    return now - new Date(c.firstOrderAt).getTime() <= NEW_CUSTOMER_DAYS * DAY ? 'New' : 'One-time';
}
const groupStage = {
    $group: {
        _id: OrderService_1.CUSTOMER_KEY,
        name: { $first: '$customerDetails.name' },
        email: { $first: '$customerDetails.email' },
        phones: { $push: '$customerDetails.phone' },
        city: { $first: '$shippingAddress.city' },
        orders: { $sum: 1 },
        cancelled: { $sum: { $cond: [CANCELLED, 1, 0] } },
        totalSpent: { $sum: { $cond: [CANCELLED, 0, NET_TOTAL] } },
        firstOrderAt: { $min: '$createdAt' },
        lastOrderAt: { $max: '$createdAt' },
    },
};
function shapeCustomer(c, now) {
    const validOrders = c.orders - c.cancelled;
    return {
        key: c._id,
        name: c.name || c.email,
        email: c._id, // normalised (lower-case) address; orders may differ in letter case
        phone: (c.phones || []).find((p) => p && String(p).trim()) || null,
        city: c.city || null,
        orders: c.orders,
        validOrders,
        cancelledOrders: c.cancelled,
        totalSpent: round2(c.totalSpent),
        averageOrderValue: validOrders ? round2(c.totalSpent / validOrders) : 0,
        firstOrderAt: c.firstOrderAt,
        lastOrderAt: c.lastOrderAt,
        segment: segmentOf({ validOrders, firstOrderAt: c.firstOrderAt }, now),
    };
}
function addressKey(a) {
    return [a?.addressLine1, a?.addressLine2, a?.city, a?.state, a?.postalCode, a?.country]
        .map((p) => String(p || '').trim().toLowerCase())
        .join('|');
}
module.exports = (app) => {
    app.get('/customers', async (req, res) => {
        try {
            const Order = require('../models/Order').getModel();
            const { search, segment, sort, order: dir, page, limit } = req.query;
            const now = Date.now();
            const newSince = new Date(now - NEW_CUSTOMER_DAYS * DAY);
            const filters = [];
            if (typeof search === 'string' && search.trim()) {
                const pattern = new RegExp(escapeRegex(search.trim()), 'i');
                filters.push({ $or: [{ name: pattern }, { _id: pattern }, { phones: pattern }, { city: pattern }] });
            }
            if (segment === 'Returning')
                filters.push({ $expr: { $gte: [{ $subtract: ['$orders', '$cancelled'] }, 2] } });
            else if (segment === 'New')
                filters.push({ firstOrderAt: { $gte: newSince }, $expr: { $eq: [{ $subtract: ['$orders', '$cancelled'] }, 1] } });
            else if (segment === 'One-time')
                filters.push({ firstOrderAt: { $lt: newSince }, $expr: { $eq: [{ $subtract: ['$orders', '$cancelled'] }, 1] } });
            const sortField = { totalSpent: 'totalSpent', orders: 'orders', name: 'name', firstOrderAt: 'firstOrderAt' }[sort] || 'lastOrderAt';
            const sortDir = dir === 'asc' ? 1 : -1;
            const pageNum = Number(page) >= 1 ? Math.floor(Number(page)) : 1;
            const limitNum = Number(limit) >= 1 ? Math.min(100, Math.floor(Number(limit))) : 20;
            const [result] = await Order.collection
                .aggregate([
                { $match: { tenantId: TENANT } },
                { $sort: { createdAt: -1 } },
                groupStage,
                { $match: { _id: { $ne: '' } } },
                {
                    $facet: {
                        rows: [
                            ...(filters.length ? [{ $match: { $and: filters } }] : []),
                            { $sort: { [sortField]: sortDir, _id: 1 } },
                            { $skip: (pageNum - 1) * limitNum },
                            { $limit: limitNum },
                        ],
                        total: [...(filters.length ? [{ $match: { $and: filters } }] : []), { $count: 'n' }],
                        summary: [
                            {
                                $group: {
                                    _id: null,
                                    customers: { $sum: 1 },
                                    returning: { $sum: { $cond: [{ $gte: [{ $subtract: ['$orders', '$cancelled'] }, 2] }, 1, 0] } },
                                    newCustomers: { $sum: { $cond: [{ $gte: ['$firstOrderAt', newSince] }, 1, 0] } },
                                },
                            },
                        ],
                    },
                },
            ])
                .toArray();
            const summary = result?.summary?.[0] || { customers: 0, returning: 0, newCustomers: 0 };
            res.json({
                success: true,
                customers: (result?.rows || []).map((c) => shapeCustomer(c, now)),
                total: result?.total?.[0]?.n || 0,
                page: pageNum,
                limit: limitNum,
                summary: { customers: summary.customers, returning: summary.returning, newCustomers: summary.newCustomers, newCustomerDays: NEW_CUSTOMER_DAYS },
            });
        }
        catch (e) {
            res.status(500).json({ success: false, message: e.message });
        }
    });
    // One customer, looked up by email (query string, so addresses with "+" or "." survive routing).
    app.get('/customers/lookup', async (req, res) => {
        try {
            const email = typeof req.query.email === 'string' ? req.query.email.trim().toLowerCase() : '';
            if (!email)
                return res.status(400).json({ success: false, message: 'An email address is required.' });
            const Order = require('../models/Order').getModel();
            const raw = await Order.collection
                .find({ tenantId: TENANT, 'customerDetails.email': new RegExp(`^\\s*${escapeRegex(email)}\\s*$`, 'i') })
                .sort({ createdAt: -1 })
                .toArray();
            if (!raw.length)
                return res.status(404).json({ success: false, message: 'Customer not found.' });
            const now = Date.now();
            const orders = raw.map(OrderService_1.normalizeOrder);
            const valid = orders.filter((o) => o.status !== 'Cancelled');
            const latest = orders[0];
            const totalSpent = valid.reduce((s, o) => s + (o.pricing?.totalAmount || 0) - (o.payment?.refundedAmount || 0), 0);
            const refunded = orders.reduce((s, o) => s + (o.payment?.refundedAmount || 0), 0);
            const discountTotal = valid.reduce((s, o) => s + (o.pricing?.discount || 0), 0);
            const outstanding = valid.filter((o) => o.paymentStatus === 'Not paid').reduce((s, o) => s + (o.pricing?.totalAmount || 0), 0);
            // Addresses used, most recent first.
            const addresses = new Map();
            for (const o of orders) {
                const a = o.shippingAddress;
                if (!a)
                    continue;
                const k = addressKey(a);
                const existing = addresses.get(k);
                if (existing)
                    existing.orders += 1;
                else
                    addresses.set(k, { ...a, orders: 1, lastUsedAt: o.createdAt });
            }
            // Products bought (paid-for lines; free gifts listed separately by the order page).
            const products = new Map();
            for (const o of valid) {
                for (const item of o.items || []) {
                    if (item.isFreeGift || item.isAutoAddedGift)
                        continue;
                    const k = String(item.productId);
                    const p = products.get(k) || { productId: k, name: item.name, quantity: 0, spent: 0 };
                    p.quantity += Number(item.quantity) || 0;
                    p.spent += (Number(item.price) || 0) * (Number(item.quantity) || 0);
                    products.set(k, p);
                }
            }
            const discounts = new Map();
            for (const o of valid) {
                for (const d of o.pricing?.appliedDiscounts || []) {
                    const label = d.code || d.name || 'Discount';
                    const k = String(d.ruleId || label);
                    const entry = discounts.get(k) || { ruleId: d.ruleId || null, name: d.name || label, code: d.code || null, uses: 0, amount: 0 };
                    entry.uses += 1;
                    entry.amount += Number(d.amount) || 0;
                    discounts.set(k, entry);
                }
            }
            // Orders store the discount's name and amount; codes come from the discount itself.
            const ruleIds = [...discounts.values()].map((d) => String(d.ruleId || '')).filter((id) => /^[a-f0-9]{24}$/i.test(id));
            if (ruleIds.length) {
                const DiscountRule = require('../models/DiscountRule').getModel();
                const rules = await DiscountRule.find({ _id: { $in: ruleIds } }, { code: 1, name: 1 }).lean();
                for (const d of discounts.values()) {
                    const rule = rules.find((r) => String(r._id) === String(d.ruleId));
                    if (rule && !d.code && rule.code)
                        d.code = rule.code;
                }
            }
            const shaped = shapeCustomer({
                _id: email,
                name: latest.customerDetails?.name,
                email: latest.customerDetails?.email,
                phones: orders.map((o) => o.customerDetails?.phone),
                city: latest.shippingAddress?.city,
                orders: orders.length,
                cancelled: orders.length - valid.length,
                totalSpent,
                firstOrderAt: orders[orders.length - 1].createdAt,
                lastOrderAt: latest.createdAt,
            }, now);
            res.json({
                success: true,
                customer: {
                    ...shaped,
                    refunded: round2(refunded),
                    discountTotal: round2(discountTotal),
                    outstanding: round2(outstanding),
                    otherNames: [...new Set(orders.map((o) => String(o.customerDetails?.name || '').trim()).filter(Boolean))].filter((n) => n !== shaped.name),
                    addresses: [...addresses.values()],
                    topProducts: [...products.values()].sort((a, b) => b.quantity - a.quantity || b.spent - a.spent).slice(0, 5).map((p) => ({ ...p, spent: round2(p.spent) })),
                    discounts: [...discounts.values()].sort((a, b) => b.uses - a.uses).map((d) => ({ ...d, amount: round2(d.amount) })),
                    recentOrders: orders.slice(0, 50).map((o) => ({
                        _id: o._id,
                        orderNumber: o.orderNumber,
                        createdAt: o.createdAt,
                        total: o.pricing?.totalAmount || 0,
                        items: (o.items || []).reduce((s, i) => s + (Number(i.quantity) || 0), 0),
                        status: o.status,
                        paymentStatus: o.paymentStatus,
                        fulfillmentStatus: o.fulfillmentStatus,
                        couponCode: o.couponCode || null,
                    })),
                },
            });
        }
        catch (e) {
            res.status(500).json({ success: false, message: e.message });
        }
    });
};
