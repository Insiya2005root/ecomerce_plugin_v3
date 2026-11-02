let CollectionModel: any;

function slugifyHandle(value: string): string {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}

export = {
  register: async (cms: any) => {
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

    schema.pre('validate', function(this: any, next: any) {
      if (!this.handle && this.title) this.handle = slugifyHandle(this.title);
      next();
    });

    CollectionModel = cms.models.register('EcommerceCollection', schema);
    return CollectionModel;
  },
  getModel: () => CollectionModel,
  slugifyHandle,
};
