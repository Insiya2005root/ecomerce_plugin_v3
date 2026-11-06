import { DiscountEngine } from './plugin/ecommerce-plugin/src/services/DiscountEngine';

const cart = {
    items: [
        { productId: 'p1', price: 1000, quantity: 2 },
        { productId: 'p2', price: 500, quantity: 1 }
    ],
    couponCode: ''
};

const rules = [
    {
        _id: 'r1',
        type: 'fixed_amount',
        status: 'Active',
        isAutomatic: true,
        value: 100,
        targetProductIds: []
    }
];

const res = DiscountEngine.evaluate(cart, rules);
console.log(JSON.stringify(res, null, 2));
