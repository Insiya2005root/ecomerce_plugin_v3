let TaxClassModel: any;

export = {
  register: async (cms: any) => {
    await cms.database.user();
    const mongoose = require('mongoose');
    
    const schema = new mongoose.Schema({
      tenantId: { type: String, default: 'default_tenant' },
      name: { type: String, required: true },
      code: { type: String, required: true },
      description: { type: String },
      status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
      shippingTaxPolicy: { type: String, enum: ['UseGlobal', 'Taxable', 'NonTaxable'], default: 'UseGlobal' }
    }, { timestamps: true });

    TaxClassModel = cms.models.register('EcommerceTaxClass', schema);
    return TaxClassModel;
  },
  getModel: () => TaxClassModel
};
