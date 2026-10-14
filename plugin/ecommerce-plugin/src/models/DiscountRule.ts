let DiscountRuleModel: any;

export = {
  register: async (cms: any) => {
    await cms.database.user();
    const mongoose = require('mongoose');

    const schema = new mongoose.Schema({
      tenantId: { type: String, default: 'default_tenant' },
      name: { type: String, required: true },
      code: { type: String, unique: true, sparse: true }, 
      isAutomatic: { type: Boolean, default: false },
      
      // Phase 3: Added new types
      type: { type: String, enum: ['percentage', 'fixed_amount', 'buy_x_get_y', 'free_gift', 'spend_x_get_y', 'campaign', 'custom'], required: true },
      value: { type: Number, default: 0 },
      
      status: { type: String, enum: ['Active', 'Draft', 'Paused', 'Archived'], default: 'Active' },
      startDate: { type: Date },
      endDate: { type: Date },
      
      minSubtotal: { type: Number, default: 0 },
      
      // Phase 3: Item Level Targeting
      targetProductIds: [{ type: String }],
      
      // Phase 3: Advanced Configs
      buyXGetY: {
        buyTargetType: { type: String, enum: ['SpecificProduct', 'MultipleProducts', 'Category', 'EntireStore'] },
        buyTargetIds: [{ type: String }],
        buyQuantity: { type: Number },
        rewardTargetType: { type: String, enum: ['SpecificProduct', 'MultipleProducts', 'Category'] },
        rewardTargetIds: [{ type: String }],
        rewardQuantity: { type: Number },
        rewardType: { type: String, enum: ['Free', 'PercentageOff', 'FixedAmountOff'] },
        rewardValue: { type: Number },
        repeat: { type: Boolean, default: false }
      },
      spendXGetY: {
        minSpend: { type: Number },
        rewardType: { type: String, enum: ['Percentage', 'FixedAmount', 'FreeProduct'] },
        rewardValue: { type: Number },
        rewardTargetIds: [{ type: String }],
        maxDiscount: { type: Number },
        repeat: { type: Boolean, default: false }
      },
      freeGift: {
        productId: { type: String }
      },
      
      campaign: {
        childRuleIds: [{ type: String }],
        description: { type: String },
        storefrontDisplay: { type: Boolean, default: true },
        marketingHeading: { type: String }
      },
      
      // Custom Rules Config
      priority: { type: Number, default: 0 },
      stackingPolicy: { type: String, enum: ['allow', 'exclusive'], default: 'allow' },
      perCustomerLimit: { type: Number },
      maxDiscountAmount: { type: Number },
      customConfig: {
         conditionTree: { type: mongoose.Schema.Types.Mixed },
         actions: [{ type: mongoose.Schema.Types.Mixed }]
      },

      usageLimit: { type: Number },
      usedCount: { type: Number, default: 0 }
    }, { timestamps: true });

    DiscountRuleModel = cms.models.register('EcommerceDiscountRule', schema);
    return DiscountRuleModel;
  },
  getModel: () => DiscountRuleModel
};



