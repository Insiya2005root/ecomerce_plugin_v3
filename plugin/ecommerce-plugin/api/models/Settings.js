"use strict";
let SettingsModel;
module.exports = {
    register: async (cms) => {
        await cms.database.user();
        const mongoose = require('mongoose');
        const schema = new mongoose.Schema({
            tenantId: { type: String, default: 'default_tenant' },
            // New Tax Engine Settings
            taxesEnabled: { type: Boolean, default: true },
            defaultTaxClassId: { type: String }, // 'None' or ObjectId
            pricesIncludeTax: { type: Boolean, default: false },
            taxShippingByDefault: { type: Boolean, default: false },
            displayTaxBreakdown: { type: Boolean, default: true },
            // Old deprecated field, kept for migration
            taxRate: { type: Number, default: 0 },
            shippingMethod: { type: String, enum: ['Flat', 'Distance'], default: 'Flat' },
            shippingRate: { type: Number, default: 0 },
            freeShippingThreshold: { type: Number, default: 0 },
            shippingRatePerKm: { type: Number, default: 0 },
            locationSelection: { type: String, enum: ['Nearest', 'CustomerSelect'], default: 'Nearest' },
            distanceRounding: { type: String, enum: ['Exact', 'Nearest', 'Up'], default: 'Up' },
            routeFailureBehaviour: { type: String, enum: ['Fallback'], default: 'Fallback' },
            fallbackShippingCost: { type: Number, default: 0 },
            // Deprecated fields
            startCity: { type: Object },
            endCity: { type: Object }
        });
        SettingsModel = cms.models.register('EcommerceSettings', schema);
        return SettingsModel;
    },
    getModel: () => SettingsModel
};
