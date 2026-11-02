"use strict";
const OrderService_1 = require("../services/OrderService");
const TENANT = 'default_tenant';
const { ORDER_STATUSES, PAYMENT_STATUSES, FULFILLMENT_STATUSES } = require('../models/Order');
function escapeRegex(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
function sendError(res, e) {
    if (e instanceof OrderService_1.OrderError) {
        return res.status(e.status).json({ success: false, message: e.message, ...(e.details ? { details: e.details } : {}) });
    }
    return res.status(500).json({ success: false, message: e.message });
}
// Orders created before payment/fulfillment tracking have no such fields; filter them by their equivalent values.
const LEGACY_FULFILLMENT_STATUS = {
    'Not fulfilled': ['Pending', 'Processing', 'Cancelled'],
    Fulfilled: [],
    Shipped: ['Shipped'],
    Delivered: ['Delivered'],
};
module.exports = (app) => {
    app.get('/orders', async (req, res) => {
        try {
            const Order = OrderService_1.OrderService.getModel();
            const { search, status, paymentStatus, fulfillmentStatus, sort, order: dir, page, limit } = req.query;
            const and = [{ tenantId: TENANT }];
            if (typeof search === 'string' && search.trim()) {
                const pattern = new RegExp(escapeRegex(search.trim()), 'i');
                and.push({ $or: [{ orderNumber: pattern }, { 'customerDetails.name': pattern }, { 'customerDetails.email': pattern }] });
            }
            if (typeof status === 'string' && ORDER_STATUSES.includes(status))
                and.push({ status });
            if (typeof paymentStatus === 'string' && PAYMENT_STATUSES.includes(paymentStatus)) {
                and.push(paymentStatus === 'Not paid' ? { $or: [{ paymentStatus }, { paymentStatus: { $exists: false } }] } : { paymentStatus });
            }
            if (typeof fulfillmentStatus === 'string' && FULFILLMENT_STATUSES.includes(fulfillmentStatus)) {
                and.push({
                    $or: [
                        { fulfillmentStatus },
                        { fulfillmentStatus: { $exists: false }, status: { $in: LEGACY_FULFILLMENT_STATUS[fulfillmentStatus] } },
                    ],
                });
            }
            const query = { $and: and };
            const sortField = sort === 'total' ? 'pricing.totalAmount' : 'createdAt';
            const sortDir = dir === 'asc' ? 1 : -1;
            // Read raw documents so every stored field is returned regardless of the cached Mongoose schema.
            let cursor = Order.collection.find(query).sort({ [sortField]: sortDir, _id: sortDir });
            const paginated = page !== undefined;
            const pageNum = Number(page) >= 1 ? Math.floor(Number(page)) : 1;
            const limitNum = Number(limit) >= 1 ? Math.min(100, Math.floor(Number(limit))) : 20;
            if (paginated)
                cursor = cursor.skip((pageNum - 1) * limitNum).limit(limitNum);
            const [orders, total] = await Promise.all([cursor.toArray(), Order.collection.countDocuments(query)]);
            // Without ?page the full list is returned, as before.
            res.json({
                success: true,
                orders: orders.map(OrderService_1.normalizeOrder),
                total,
                page: paginated ? pageNum : 1,
                limit: paginated ? limitNum : total,
            });
        }
        catch (e) {
            sendError(res, e);
        }
    });
    app.get('/orders/:id', async (req, res) => {
        try {
            res.json({ success: true, order: await OrderService_1.OrderService.get(req.params.id, TENANT) });
        }
        catch (e) {
            sendError(res, e);
        }
    });
    // Legacy status endpoint: cancelling goes through the cancel flow so stock is returned.
    app.put('/orders/:id/status', async (req, res) => {
        try {
            const { status } = req.body || {};
            if (!ORDER_STATUSES.includes(status))
                return res.status(400).json({ success: false, message: 'Invalid status.' });
            if (status === 'Cancelled')
                return res.json({ success: true, order: await OrderService_1.OrderService.cancel(req.params.id, TENANT) });
            const current = await OrderService_1.OrderService.get(req.params.id, TENANT);
            if (current.status === 'Cancelled')
                return res.status(409).json({ success: false, message: 'Cancelled orders cannot be changed.' });
            const mongoose = require('mongoose');
            await OrderService_1.OrderService.getModel().collection.updateOne({ _id: new mongoose.Types.ObjectId(req.params.id), tenantId: TENANT }, { $set: { status, updatedAt: new Date() }, $push: { events: { type: 'status', message: `Status set to ${status}`, at: new Date() } } });
            res.json({ success: true, order: await OrderService_1.OrderService.get(req.params.id, TENANT) });
        }
        catch (e) {
            sendError(res, e);
        }
    });
    app.post('/orders/:id/cancel', async (req, res) => {
        try {
            res.json({ success: true, order: await OrderService_1.OrderService.cancel(req.params.id, TENANT) });
        }
        catch (e) {
            sendError(res, e);
        }
    });
    app.post('/orders/:id/payment', async (req, res) => {
        try {
            const body = req.body || {};
            const order = body.action === 'refund'
                ? await OrderService_1.OrderService.refund(req.params.id, TENANT, body)
                : body.action === 'capture'
                    ? await OrderService_1.OrderService.capturePayment(req.params.id, TENANT, body)
                    : null;
            if (!order)
                return res.status(400).json({ success: false, message: 'Unknown payment action.' });
            res.json({ success: true, order });
        }
        catch (e) {
            sendError(res, e);
        }
    });
    app.post('/orders/:id/fulfillment', async (req, res) => {
        try {
            res.json({ success: true, order: await OrderService_1.OrderService.fulfillment(req.params.id, TENANT, req.body || {}) });
        }
        catch (e) {
            sendError(res, e);
        }
    });
    app.post('/orders/:id/notes', async (req, res) => {
        try {
            res.json({ success: true, order: await OrderService_1.OrderService.addNote(req.params.id, TENANT, req.body?.text) });
        }
        catch (e) {
            sendError(res, e);
        }
    });
    // Kept for backward compatibility; nothing calls it.
    app.post('/orders/:id/recalculate', async (_req, res) => {
        res.json({ success: true });
    });
};
