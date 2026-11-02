"use strict";
let ProductModel;
module.exports = {
    register: async (cms) => {
        await cms.database.user();
        const mongoose = require('mongoose');
        const variantSchema = new mongoose.Schema({
            size: { type: String },
            color: { type: String },
            stock: { type: Number, default: 0 },
            priceOverride: { type: Number },
            sku: { type: String }
        });
        const schema = new mongoose.Schema({
            tenantId: { type: String, default: 'default_tenant' },
            name: { type: String, required: true },
            slug: { type: String, unique: true },
            description: { type: String },
            price: { type: Number, required: true },
            discountPrice: { type: Number },
            discountPercentage: { type: Number, default: 0 },
            costPrice: { type: Number },
            sku: { type: String, unique: true },
            barcode: { type: String },
            stock: { type: Number, default: 0 },
            image: { type: String },
            images: [{ type: String }],
            videos: [{ type: String }],
            categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
            collectionId: { type: mongoose.Schema.Types.ObjectId, ref: 'EcommerceCollection' },
            status: { type: String, enum: ['Draft', 'Published', 'Archived'], default: 'Published' },
            isTaxable: { type: Boolean, default: true },
            taxClassId: { type: String, default: 'Default' },
            isDigital: { type: Boolean, default: false },
            tags: [{ type: String }],
            metaTitle: { type: String },
            metaDescription: { type: String },
            variants: [variantSchema]
        }, { timestamps: true });
        schema.pre('save', function (next) {
            if (!this.sku) {
                this.sku = 'SKU-' + Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
            }
            if (!this.slug && this.name) {
                this.slug = this.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '') + '-' + Math.floor(Math.random() * 10000).toString();
            }
            next();
        });
        ProductModel = cms.models.register('Product', schema);
        return ProductModel;
    },
    getModel: () => ProductModel
};
