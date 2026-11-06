const { DiscountEngine } = require('./plugin/ecommerce-plugin/src/services/DiscountEngine');

const dummyCart = {
  items: [
    { name: "Shirt", price: 1000, quantity: 2 },
    { name: "Pants", price: 2000, quantity: 1 }
  ]
}; // Subtotal = 4000

const activeRules = [
  {
    _id: "rule1",
    name: "Summer Sale 10% Off",
    status: "Active",
    type: "percentage",
    value: 10
  },
  {
    _id: "rule2",
    name: "Flat 500 Off",
    status: "Active",
    type: "fixed_amount",
    value: 500
  }
];

const result = DiscountEngine.evaluate(dummyCart, activeRules);
console.log("Cart Result:", JSON.stringify(result, null, 2));
