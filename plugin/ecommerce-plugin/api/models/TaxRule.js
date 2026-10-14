"use strict";
let TaxRuleModel;
module.exports = {
    register: async (cms) => {
        await cms.database.user();
        const mongoose = require('mongoose');
        const componentSchema = new mongoose.Schema({
            label: { type: String, required: true },
            rate: { type: Number, required: true }
        });
        const schema = new mongoose.Schema({
            tenantId: { type: String, default: 'default_tenant' },
            name: { type: String, required: true },
            taxClassId: { type: mongoose.Schema.Types.ObjectId, ref: 'EcommerceTaxClass', required: true },
            country: { type: String, default: '*' },
            state: { type: String, default: '*' },
            postalScope: { type: String, default: '*' },
            components: [componentSchema],
            shippingTaxPolicy: { type: String, enum: ['UseGlobal', 'Taxable', 'NonTaxable'], default: 'UseGlobal' },
            priority: { type: Number, default: 0 },
            status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
        }, { timestamps: true });
        TaxRuleModel = cms.models.register('EcommerceTaxRule', schema);
        return TaxRuleModel;
    },
    getModel: () => TaxRuleModel
};
