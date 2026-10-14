let CategoryModel: any;

export = {
  register: async (cms: any) => {
    await cms.database.user();
    
    const mongoose = require('mongoose');
    
    const schema = new mongoose.Schema({
      tenantId: { type: String, default: 'default_tenant' },
      name: { type: String, required: true },
      description: { type: String },
      slug: { type: String, unique: true },
      image: { type: String },
      parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null },
      metaTitle: { type: String },
      metaDescription: { type: String }
    }, { timestamps: true });

    schema.pre('save', function(this: any, next: any) {
      if (!this.slug && this.name) {
        this.slug = this.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
      }
      next();
    });

    CategoryModel = cms.models.register('Category', schema);
    return CategoryModel;
  },
  getModel: () => CategoryModel
};
