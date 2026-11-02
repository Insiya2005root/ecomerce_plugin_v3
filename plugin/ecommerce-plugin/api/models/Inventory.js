"use strict";
let ItemModel;
let LevelModel;
let ReservationModel;
let MovementModel;
module.exports = {
    register: async (cms) => {
        await cms.database.user();
        const mongoose = require('mongoose');
        const itemSchema = new mongoose.Schema({
            tenantId: { type: String, default: 'default_tenant' },
            productId: { type: String, required: true },
            variantId: { type: String, default: '' }, // '' = the product itself (no variants)
            sku: { type: String },
            title: { type: String },
            requiresShipping: { type: Boolean, default: true },
            trackInventory: { type: Boolean, default: true },
            allowBackorder: { type: Boolean, default: false },
            weight: { type: Number },
            length: { type: Number },
            width: { type: Number },
            height: { type: Number },
            hsCode: { type: String },
            midCode: { type: String },
            originCountry: { type: String },
            material: { type: String },
            unit: { type: String },
        }, { timestamps: true });
        itemSchema.index({ tenantId: 1, productId: 1, variantId: 1 }, { unique: true });
        const levelSchema = new mongoose.Schema({
            tenantId: { type: String, default: 'default_tenant' },
            itemId: { type: String, required: true },
            locationId: { type: String, required: true }, // a Location _id, or 'default' before any location exists
            stocked: { type: Number, default: 0 },
            reserved: { type: Number, default: 0 },
            incoming: { type: Number, default: 0 },
        }, { timestamps: true });
        levelSchema.index({ itemId: 1, locationId: 1 }, { unique: true });
        const reservationSchema = new mongoose.Schema({
            tenantId: { type: String, default: 'default_tenant' },
            itemId: { type: String, required: true },
            locationId: { type: String, required: true },
            quantity: { type: Number, required: true },
            orderId: { type: String },
            lineKey: { type: String }, // productId:variantId of the order line
            description: { type: String },
            createdBy: { type: String },
        }, { timestamps: true });
        reservationSchema.index({ orderId: 1 });
        reservationSchema.index({ itemId: 1 });
        const movementSchema = new mongoose.Schema({
            tenantId: { type: String, default: 'default_tenant' },
            itemId: { type: String, required: true },
            locationId: { type: String },
            type: { type: String, required: true }, // adjustment | received | product_edit | order_reserved | order_fulfilled | order_released | order_restocked | reservation | migration
            stockedDelta: { type: Number, default: 0 },
            reservedDelta: { type: Number, default: 0 },
            stockedAfter: { type: Number },
            reservedAfter: { type: Number },
            reason: { type: String },
            note: { type: String },
            orderId: { type: String },
            orderNumber: { type: String },
            by: { type: String },
        }, { timestamps: { createdAt: true, updatedAt: false } });
        movementSchema.index({ itemId: 1, createdAt: -1 });
        ItemModel = cms.models.register('EcommerceInventoryItem', itemSchema);
        LevelModel = cms.models.register('EcommerceInventoryLevel', levelSchema);
        ReservationModel = cms.models.register('EcommerceInventoryReservation', reservationSchema);
        MovementModel = cms.models.register('EcommerceInventoryMovement', movementSchema);
    },
    items: () => ItemModel,
    levels: () => LevelModel,
    reservations: () => ReservationModel,
    movements: () => MovementModel,
};
