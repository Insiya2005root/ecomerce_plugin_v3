const fs = require('fs');
const path = require('path');
const { DiscountEngine } = require('./src/services/DiscountEngine.js');

const mockProductId = '5f4d2f8a49c23b0001f3d8a1';

require.cache[require.resolve('./src/models/Product.js')] = {
  exports: {
    getModel: () => ({
      findById: async (id) => {
        if (id === mockProductId) return { _id: mockProductId, name: 'Tape', price: 150, categoryId: 'cat_1' };
        return null;
      }
    })
  }
};

async function test() {
    const cart = {
      items: [
        { productId: 'book_id', price: 5000, originalPrice: 5000, quantity: 1, categoryId: 'cat_book' }
      ],
      couponCode: ''
    };

    const rules = [
      {
        _id: 'spend_1',
        type: 'spend_x_get_y',
        status: 'Active',
        isAutomatic: true,
        code: '',
        spendXGetY: {
          minSpend: 5000,
          rewardType: 'FreeProduct',
          rewardTargetIds: [mockProductId],
          repeat: false
        }
      }
    ];

    const res = await DiscountEngine.evaluate(cart, rules);
    console.log(JSON.stringify(res, null, 2));
}

test();
