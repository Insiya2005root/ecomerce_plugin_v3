let StorefrontPageModel: any;
let cmsInstance: any;
let FlagModel: any;

export = {
  register: async (cms: any) => {
    cmsInstance = cms;
    await cms.database.user();
    const mongoose = require('mongoose');

    const blockConfigSchema = new mongoose.Schema(
      {
        id: { type: String, required: true },
        uniqueId: { type: String, required: true },
        type: { type: String, default: 'ecommerce-plugin' },
        blockType: { type: String, required: true },
        label: { type: String, required: true },
        required: { type: Boolean, default: false },
        enabled: { type: Boolean, default: true },
        settings: { type: mongoose.Schema.Types.Mixed, default: {} },
      },
      { _id: false }
    );

    const schema = new mongoose.Schema(
      {
        tenantId: { type: String, default: 'default_tenant', required: true, index: true },
        pageType: {
          type: String,
          enum: ['shop', 'product', 'cart', 'checkout'],
          required: true,
        },
        blueprintId: { type: String, required: true },
        cmsPageId: { type: String, default: null },
        slug: { type: String, required: true },
        title: { type: String, required: true },
        description: { type: String, default: '' },
        routePattern: { type: String, required: true },
        isDynamicTemplate: { type: Boolean, default: false },
        isPublished: { type: Boolean, default: true },
        appliedBlueprintVersion: { type: Number, required: true, default: 1 },
        appliedBlueprintHash: { type: String, required: true },
        currentConfigHash: { type: String, required: true },
        // Fingerprint of the OpenExt page content the plugin last wrote; differs once edited in the page builder
        appliedCmsHash: { type: String, default: '' },
        isCustomized: { type: Boolean, default: false },
        revision: { type: Number, default: 1 },
        lastCustomizedAt: { type: Date, default: null },
        lastResetAt: { type: Date, default: null },
        blocks: { type: [blockConfigSchema], default: [] },
      },
      { timestamps: true }
    );

    schema.index({ tenantId: 1, pageType: 1 }, { unique: true });
    schema.index({ tenantId: 1, slug: 1 }, { unique: true });

    StorefrontPageModel = cms.models.register('EcommerceStorefrontPage', schema);
    // One-off storefront set-up steps already done (e.g. the default site header/footer), so they never repeat.
    FlagModel = cms.models.register(
      'EcommerceStorefrontFlag',
      new mongoose.Schema({ tenantId: { type: String, required: true }, key: { type: String, required: true } }, { timestamps: true }).index({ tenantId: 1, key: 1 }, { unique: true })
    );
    return StorefrontPageModel;
  },
  getModel: () => StorefrontPageModel,
  getFlagModel: () => FlagModel,
  getCmsPageModel: async () => {
    if (!cmsInstance || typeof cmsInstance.database?.page !== 'function') {
      return null;
    }
    const pageConn = await cmsInstance.database.page();
    if (!pageConn) return null;

    if (pageConn.models && pageConn.models.Page) {
      return pageConn.models.Page;
    }

    const mongoose = require('mongoose');
    const fallbackPageSchema = new mongoose.Schema(
      {
        pageName: { type: String, required: true, trim: true },
        createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        pageType: {
          type: String,
          enum: ['page', 'header', 'footer'],
          default: 'page',
        },
        isPublished: { type: Boolean, default: false },
        isHome: { type: Boolean, default: false },
        isGlobal: { type: Boolean, default: false },
        preHeading: { type: String },
        description: { type: String },
        slug: { type: String },
        locale: { type: String, default: 'en', index: true },
        translationGroupId: { type: String, index: true },
        seoName: { type: String },
        seoMeta: { type: String },
        component: { type: [mongoose.Schema.Types.Mixed], default: [] },
        modifications: { type: [mongoose.Schema.Types.Mixed], default: [] },
      },
      { timestamps: true }
    );
    fallbackPageSchema.index({ locale: 1, slug: 1 }, { unique: true });

    return pageConn.model('Page', fallbackPageSchema);
  },
};
