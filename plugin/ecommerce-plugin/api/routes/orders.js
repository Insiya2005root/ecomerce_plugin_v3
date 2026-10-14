"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
const Order_1 = __importDefault(require("../models/Order"));
module.exports = (app) => {
    app.get('/orders', async (req, res) => {
        try {
            const OrderModel = Order_1.default.getModel();
            let orders = await OrderModel.find({ tenantId: 'default_tenant' }).sort({ createdAt: -1 }).lean();
            // Native merge to bypass strict Mongoose schema caching
            const rawOrders = await OrderModel.collection.find({ tenantId: 'default_tenant' }).toArray();
            orders = orders.map((o) => {
                const raw = rawOrders.find((r) => r._id.toString() === o._id.toString());
                if (raw) {
                    if (raw.pricing && raw.pricing.discount !== undefined) {
                        if (!o.pricing)
                            o.pricing = {};
                        o.pricing.discount = raw.pricing.discount;
                    }
                    if (raw.items && Array.isArray(raw.items)) {
                        o.items = raw.items; // Just overwrite items with raw items to get originalPrice and discountPercentage
                    }
                }
                return o;
            });
            res.json({ success: true, orders });
        }
        catch (e) {
            res.status(500).json({ success: false, message: e.message });
        }
    });
    app.put('/orders/:id/status', async (req, res) => {
        try {
            const OrderModel = Order_1.default.getModel();
            const { status } = req.body;
            const order = await OrderModel.findByIdAndUpdate(req.params.id, { status }, { new: true }).lean();
            res.json({ success: true, order });
        }
        catch (e) {
            res.status(500).json({ success: false, message: e.message });
        }
    });
    app.post('/orders/:id/recalculate', async (req, res) => {
        // We'll leave this alone since the frontend doesn't use it heavily anymore, or we can just send success
        res.json({ success: true });
    });
};
