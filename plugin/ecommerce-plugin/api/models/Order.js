"use strict";
let OrderModel;
module.exports = {
    register: async (cms) => {
        await cms.database.user();
        const mongoose = require('mongoose');
        const itemSchema = new mongoose.Schema({
            productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
            variantId: { type: String },
            name: { type: String, required: true },
            price: { type: Number, required: true },
            originalPrice: { type: Number },
            discountPercentage: { type: Number, default: 0 },
            quantity: { type: Number, required: true }
        });
        const schema = new mongoose.Schema({
            tenantId: { type: String, default: 'default_tenant' },
            orderNumber: { type: String, unique: true },
            customerDetails: {
                name: { type: String, required: true },
                email: { type: String, required: true },
                address: { type: String, required: true }
            },
            items: [itemSchema],
            pricing: {
                subtotal: { type: Number, required: true },
                discount: { type: Number, default: 0 },
                tax: { type: Number, required: true },
                shipping: { type: Number, required: true },
                totalAmount: { type: Number, required: true },
                shippingSnapshot: { type: Object },
                taxSnapshot: { type: Object },
                appliedDiscounts: [{ ruleId: String, name: String, code: String, amount: Number }]
            },
            status: { type: String, enum: ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'], default: 'Pending' }
        }, { timestamps: true });
        schema.pre('save', function (next) {
            if (!this.orderNumber) {
                this.orderNumber = 'ORD-' + Date.now().toString().slice(-6) + Math.floor(Math.random() * 1000).toString().padStart(3, '0');
            }
            next();
        });
        OrderModel = cms.models.register('EcommerceOrder', schema);
        return OrderModel;
    },
    getModel: () => OrderModel
};
