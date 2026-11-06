// Mock equivalent logic
function evaluate(cart, rules) {
  let subtotal = cart.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  let discountTotal = 0;
  const appliedDiscounts = [];

  const now = new Date();
  const validRules = rules.filter(rule => {
    if (rule.status !== 'Active') return false;
    return true;
  });

  for (const rule of validRules) {
    let amount = 0;
    if (rule.type === 'percentage') amount = subtotal * (rule.value / 100);
    else if (rule.type === 'fixed_amount') amount = rule.value;

    if (amount > (subtotal - discountTotal)) amount = subtotal - discountTotal;

    if (amount > 0) {
      discountTotal += amount;
      appliedDiscounts.push({ name: rule.name, amount });
    }
  }

  return { subtotal, discountTotal, totalAmount: subtotal - discountTotal, appliedDiscounts };
}

const dummyCart = { items: [{ name: "Shirt", price: 1000, quantity: 2 }, { name: "Pants", price: 2000, quantity: 1 }] }; // 4000
const activeRules = [
  { name: "Summer Sale 10% Off", status: "Active", type: "percentage", value: 10 },
  { name: "Flat 500 Off", status: "Active", type: "fixed_amount", value: 500 }
];

console.log(JSON.stringify(evaluate(dummyCart, activeRules), null, 2));
