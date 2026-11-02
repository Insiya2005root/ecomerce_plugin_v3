"use strict";
let CollectionModel;
function slugifyHandle(value) {
    return String(value || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)+/g, '');
}
module.exports = {
    register: async (cms) => {
        await cms.database.user();
        const mongoose = require('mongoose');
        // A collection groups products for merchandising (e.g. "Summer 2026"); a product belongs to at most one.
        const schema = new mongoose.Schema({
            tenantId: { type: String, default: 'default_tenant' },
            title: { type: String, required: true, trim: true },
            handle: { type: String, trim: true },
            description: { type: String },
        }, { timestamps: true });
        schema.index({ tenantId: 1, handle: 1 }, { unique: true });
        schema.pre('validate', function (next) {
            if (!this.handle && this.title)
                this.handle = slugifyHandle(this.title);
            next();
        });
        CollectionModel = cms.models.register('EcommerceCollection', schema);
        return CollectionModel;
    },
    getModel: () => CollectionModel,
    slugifyHandle,
};
