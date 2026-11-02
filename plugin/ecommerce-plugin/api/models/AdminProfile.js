"use strict";
let AdminProfileModel;
module.exports = {
    register: async (cms) => {
        await cms.database.user();
        const mongoose = require('mongoose');
        const schema = new mongoose.Schema({
            tenantId: { type: String, default: 'default_tenant' },
            userId: { type: String, required: true },
            displayName: { type: String },
            phone: { type: String },
            jobTitle: { type: String },
            dashboardDays: { type: Number, enum: [7, 30, 90], default: 30 }
        }, { timestamps: true });
        schema.index({ tenantId: 1, userId: 1 }, { unique: true });
        AdminProfileModel = cms.models.register('EcommerceAdminProfile', schema);
        return AdminProfileModel;
    },
    getModel: () => AdminProfileModel
};
