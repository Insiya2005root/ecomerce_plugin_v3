const crypto = require('crypto');
function fakeId() {
  return crypto.randomBytes(12).toString('hex');
}

async function run() {
  const { DiscountEngine } = require('./src/services/DiscountEngine.js');
  
  const prodA_id = fakeId();
  const prodB_id = fakeId();
  const catId = fakeId();

  const bogoRule = {
    _id: fakeId(),
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
      rewardTargetIds: [prodB_id.toString()],
      rewardQuantity: 1,
      rewardType: 'Free',
      repeat: true
    }
  };

  const cartContext = {
    items: [
      { productId: prodB_id, categoryId: catId, price: 150, originalPrice: 150, quantity: 1, name: 'Product B' },
      { productId: prodA_id, categoryId: catId, price: 500, originalPrice: 500, quantity: 1, name: 'Product A' }
    ],
    couponCode: ''
  };

  // Mock out mongoose inside DiscountEngine
  const mockProduct = {
    getModel: () => ({
      findById: async () => null // Not auto-adding, so it can be null
    })
  };
  require.cache[require.resolve('./src/models/Product.js')] = { exports: mockProduct };

  const res = await DiscountEngine.evaluate(cartContext, [bogoRule]);
  
  console.log(JSON.stringify(res, null, 2));
}

run().catch(console.error);
