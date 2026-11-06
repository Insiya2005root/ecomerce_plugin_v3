const { DiscountEngine } = require('./plugin/ecommerce-plugin/src/services/DiscountEngine.js');

const cart = {
  items: [
    { productId: 'tape_id', price: 150, quantity: 1, categoryId: 'cat_tape' }
  ],
  couponCode: ''
};

const rules = [
  {
    _id: 'bogo_1',
    type: 'buy_x_get_y',
    status: 'Active',
    isAutomatic: true,
    code: '',
    buyXGetY: {
      buyTargetType: 'EntireStore',
      buyTargetIds: [],
      buyQuantity: 1,
      rewardTargetType: 'SpecificProduct',
      rewardTargetIds: ['tape_id'],
      rewardQuantity: 1,
      rewardType: 'Free',
      repeat: true
    }
  }
];

const res = DiscountEngine.evaluate(cart, rules);
console.log(JSON.stringify(res, null, 2));
