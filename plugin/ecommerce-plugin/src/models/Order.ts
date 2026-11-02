let OrderModel: any;

const ORDER_STATUSES = ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];
const PAYMENT_STATUSES = ['Not paid', 'Paid', 'Partially refunded', 'Refunded'];
const FULFILLMENT_STATUSES = ['Not fulfilled', 'Fulfilled', 'Shipped', 'Delivered'];

export = {
  ORDER_STATUSES,
  PAYMENT_STATUSES,
  FULFILLMENT_STATUSES,
  register: async (cms: any) => {
    await cms.database.user();
    const mongoose = require('mongoose');

    const itemSchema = new mongoose.Schema({
      productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
      variantId: { type: String },
      sku: { type: String },
      name: { type: String, required: true },
      price: { type: Number, required: true },
      originalPrice: { type: Number },
      discountPercentage: { type: Number, default: 0 },
      quantity: { type: Number, required: true },
      isFreeGift: { type: Boolean },
      isAutoAddedGift: { type: Boolean },
      // Per-line discounts reported by the DiscountEngine (shape owned by the engine).
      appliedDiscounts: { type: mongoose.Schema.Types.Mixed }
    });

    const addressSchema = new mongoose.Schema({
      addressLine1: String,
      addressLine2: String,
      city: String,
      state: String,
      postalCode: String,
      country: String
    }, { _id: false });

    const schema = new mongoose.Schema({
      tenantId: { type: String, default: 'default_tenant' },
      orderNumber: { type: String, unique: true },
      // Where the order came from: the Admin cart, the storefront, or legacy/manual creation.
      source: { type: String, enum: ['admin_cart', 'storefront', 'manual'], default: 'manual' },
      customerDetails: {
        name: { type: String, required: true },
        email: { type: String, required: true },
        phone: { type: String },
        address: { type: String, required: true }
      },
      shippingAddress: { type: addressSchema },
      items: [itemSchema],
      pricing: {
        subtotal: { type: Number, required: true },
        discount: { type: Number, default: 0 },
        tax: { type: Number, required: true },
        shipping: { type: Number, required: true },
        totalAmount: { type: Number, required: true },
        shippingSnapshot: { type: Object },
        taxSnapshot: { type: Object },
        appliedDiscounts: [{ ruleId: String, name: String, code: String, amount: Number }]
      },
      couponCode: { type: String },
      // Overall lifecycle (kept for existing consumers); payment and fulfillment are tracked separately.
      status: { type: String, enum: ORDER_STATUSES, default: 'Pending' },
      paymentStatus: { type: String, enum: PAYMENT_STATUSES, default: 'Not paid' },
      payment: {
        method: { type: String },
        reference: { type: String },
        capturedAmount: { type: Number, default: 0 },
        capturedAt: { type: Date },
        refundedAmount: { type: Number, default: 0 }
      },
      refunds: [{ amount: Number, reason: String, note: String, at: Date }],
      fulfillmentStatus: { type: String, enum: FULFILLMENT_STATUSES, default: 'Not fulfilled' },
      fulfillment: {
        carrier: { type: String },
        trackingNumber: { type: String },
        fulfilledAt: { type: Date },
        shippedAt: { type: Date },
        deliveredAt: { type: Date }
      },
      canceledAt: { type: Date },
      notes: [{ text: String, at: Date }],
      // Activity timeline shown on the order page.
      events: [{ type: { type: String }, message: String, at: Date }]
    }, { timestamps: true });

    schema.pre('save', function(this: any, next: any) {
      if (!this.orderNumber) {
        this.orderNumber = 'ORD-' + Date.now().toString().slice(-6) + Math.floor(Math.random() * 1000).toString().padStart(3, '0');
      }
      next();
    });

    OrderModel = cms.models.register('EcommerceOrder', schema);
    if (!OrderModel.schema.path('paymentStatus')) {
      cms.logger?.warn?.('Order model is using a cached older schema; restart OpenExt so new order fields are saved.');
    }
    return OrderModel;
  },
  getModel: () => OrderModel
};
