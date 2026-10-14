"use strict";
let LocationModel;
module.exports = {
    register: async (cms) => {
        await cms.database.user();
        const mongoose = require('mongoose');
        const schema = new mongoose.Schema({
            tenantId: { type: String, default: 'default_tenant' },
            name: { type: String, required: true },
            addressLine1: { type: String, required: true },
            addressLine2: { type: String },
            city: { type: String, required: true },
            state: { type: String, required: true },
            postalCode: { type: String, required: true },
            country: { type: String, default: 'India' },
            latitude: { type: Number },
            longitude: { type: Number },
            status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
            priority: { type: Number, default: 0 }
        }, { timestamps: true });
        LocationModel = cms.models.register('EcommerceLocation', schema);
        return LocationModel;
    },
    getModel: () => LocationModel
};
