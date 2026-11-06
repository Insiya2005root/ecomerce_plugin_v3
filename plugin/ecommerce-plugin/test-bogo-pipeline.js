const express = require('express');
const mongoose = require('mongoose');

async function run() {
  await mongoose.connect('mongodb://127.0.0.1:27017/ecommerce-dev');
  
  const ProductModel = require('./src/models/Product').getModel ? require('./src/models/Product').getModel() : mongoose.model('Product');
  const DiscountRuleModel = require('./src/models/DiscountRule').getModel ? require('./src/models/DiscountRule').getModel() : mongoose.model('DiscountRule');
  
  // Create test products
  const catId = new mongoose.Types.ObjectId();
  const prodA = await ProductModel.create({ name: 'Product A', price: 500, categoryId: catId, status: 'Published', stock: 100 });
  const prodB = await ProductModel.create({ name: 'Product B', price: 150, categoryId: catId, status: 'Published', stock: 100 });

  // Create BOGO rule directly in DB
  const bogoRule = await DiscountRuleModel.create({
    tenantId: 'default_tenant',
    name: 'BOGO Test Entire Store -> Prod B',
    isAutomatic: true,
    type: 'buy_x_get_y',
    status: 'Active',
    buyXGetY: {
      buyTargetType: 'EntireStore',
      buyTargetIds: [],
      buyQuantity: 1,
      rewardTargetType: 'SpecificProduct',
      rewardTargetIds: [prodB._id.toString()],
      rewardQuantity: 1,
      rewardType: 'Free',
      repeat: true
    }
  });

  console.log("Rule created:", bogoRule._id);
  
  // Now mock the express app or just test DiscountEngine directly with DB models loaded
  const { DiscountEngine } = require('./src/services/DiscountEngine.js');
  
  const cartContext = {
    items: [
      { productId: prodA._id, categoryId: catId, price: 500, originalPrice: 500, quantity: 1, name: 'Product A' },
      { productId: prodB._id, categoryId: catId, price: 150, originalPrice: 150, quantity: 1, name: 'Product B' }
    ],
    couponCode: ''
  };

  const activeRules = await DiscountRuleModel.find({ tenantId: 'default_tenant', status: 'Active' });
  const res = await DiscountEngine.evaluate(cartContext, activeRules);
  
  console.log(JSON.stringify(res, null, 2));

  // cleanup
  await ProductModel.deleteMany({ _id: { $in: [prodA._id, prodB._id] } });
  await DiscountRuleModel.deleteMany({ _id: bogoRule._id });
  mongoose.disconnect();
}

run().catch(console.error);
