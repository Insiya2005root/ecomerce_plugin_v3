// test_promotions_dashboard.cjs
// API checks for discount usage stats, discount code conflicts and the dashboard stats endpoint.
// Usage: node test_promotions_dashboard.cjs   (see test_support/plugin-api-harness.cjs for requirements)
const assert = require('assert');
const path = require('path');
const { mongoose, pluginDir, startPlugin, stopPlugin, createChecker } = require('./test_support/plugin-api-harness.cjs');

const TEST_DB = 'ecommerce_plugin_promotions_dashboard_test';
const { check, stats } = createChecker();

async function main() {
  const app = await startPlugin(TEST_DB);
  const post = (url, body) => app.call('POST', url, { body });
  const put = (url, body) => app.call('PUT', url, { body });
  const get = (url) => app.call('GET', url);
  const Order = require(path.join(pluginDir, 'api', 'models', 'Order.js')).getModel();

  const shirts = (await post('/categories', { name: 'Shirts', slug: 'shirts' })).body.category;
  const mugs = (await post('/categories', { name: 'Mugs', slug: 'mugs' })).body.category;
  const mk = async (body) => (await post('/products', { status: 'Published', ...body })).body.product;
  const shirt = await mk({ name: 'Shirt', price: 1000, stock: 50, categoryId: shirts._id });
  const mug = await mk({ name: 'Mug', price: 200, stock: 3, categoryId: mugs._id });
  await mk({ name: 'Draft Lamp', price: 500, stock: 0, categoryId: mugs._id, status: 'Draft' });
  await mk({ name: 'Variant Tee', price: 300, categoryId: shirts._id, variants: [{ size: 'S', stock: 1 }, { size: 'M', stock: 2 }] });
  await post('/collections', { title: 'Summer' });

  const coupon = (await post('/discounts', { name: 'Ten', code: 'TEN', type: 'percentage', value: 10, status: 'Active', isAutomatic: false })).body.rule;
  const child = (await post('/discounts', { name: 'Fest 5', type: 'fixed_amount', value: 50, status: 'Active', isAutomatic: true })).body.rule;
  const campaign = (await post('/discounts', { name: 'Festival', type: 'campaign', status: 'Active', isAutomatic: true, campaign: { childRuleIds: [child._id] } })).body.rule;

  const customer = { name: 'Asha', email: 'asha@example.com' };
  const address = { addressLine1: '1 Road', city: 'Surat' };
  const place = async (items, couponCode) =>
    (await post('/checkout', { items, customerDetails: customer, customerAddress: address, couponCode })).body;

  const o1 = await place([{ productId: shirt._id, quantity: 2 }], 'TEN');
  const o2 = await place([{ productId: mug._id, quantity: 1 }], 'TEN');
  const o3 = await place([{ productId: shirt._id, quantity: 1 }]);
  await post(`/orders/${o2.orderId}/cancel`);

  console.log('\n--> Discount usage');
  await check('usage stats count orders, discount given and revenue (cancelled excluded)', async () => {
    const res = await get(`/discounts/${coupon._id}/usage`);
    assert.strictEqual(res.statusCode, 200, JSON.stringify(res.body));
    const u = res.body.usage;
    assert.strictEqual(u.orderCount, 1);
    assert.strictEqual(u.cancelledOrderCount, 1);
    assert.strictEqual(u.usedCount, 1, 'cancel gave the use back');
    const order1 = (await get(`/orders/${o1.orderId}`)).body.order;
    const tenOff = order1.pricing.appliedDiscounts.find((d) => d.name === 'Ten').amount;
    assert.strictEqual(u.totalDiscount, Math.round(tenOff * 100) / 100);
    assert.strictEqual(u.revenue, order1.pricing.totalAmount);
    assert.strictEqual(u.recentOrders.length, 2);
  });

  await check('campaign usage adds up its child rules', async () => {
    const u = (await get(`/discounts/${campaign._id}/usage`)).body.usage;
    assert.strictEqual(u.orderCount, 2, 'orders 1 and 3 used the automatic child rule');
    assert.strictEqual(u.totalDiscount, 100);
  });

  await check('usage: unknown id is 404, malformed id is 400', async () => {
    assert.strictEqual((await get(`/discounts/${new mongoose.Types.ObjectId()}/usage`)).statusCode, 404);
    assert.strictEqual((await get('/discounts/nope/usage')).statusCode, 400);
  });

  await check('duplicate codes return 409 on create and update; status toggles via PUT', async () => {
    const dup = await post('/discounts', { name: 'Copy', code: 'TEN', type: 'percentage', value: 5, isAutomatic: false });
    assert.strictEqual(dup.statusCode, 409);
    const other = (await post('/discounts', { name: 'Other', code: 'OTHER', type: 'percentage', value: 5, isAutomatic: false })).body.rule;
    assert.strictEqual((await put(`/discounts/${other._id}`, { code: 'TEN' })).statusCode, 409);
    const paused = await put(`/discounts/${other._id}`, { status: 'Paused' });
    assert.strictEqual(paused.body.rule.status, 'Paused');
  });

  console.log('\n--> Dashboard stats');
  await check('sales totals, comparison period and daily series', async () => {
    const s = (await get('/dashboard/stats?days=7&tz=Asia/Kolkata')).body.stats;
    const live = [o1, o3].map((o) => o.orderId);
    const totals = await Promise.all(live.map(async (id) => (await get(`/orders/${id}`)).body.order.pricing.totalAmount));
    const revenue = Math.round(totals.reduce((a, b) => a + b, 0) * 100) / 100;
    assert.strictEqual(s.sales.orders, 2, 'cancelled order excluded');
    assert.strictEqual(s.sales.revenue, revenue);
    assert.strictEqual(s.sales.averageOrderValue, Math.round((revenue / 2) * 100) / 100);
    assert.strictEqual(s.sales.itemsSold, 3);
    assert.strictEqual(s.series.length, 7);
    assert.strictEqual(s.series.reduce((a, d) => a + d.orders, 0), 2);
    assert.strictEqual(s.sales.previous.orders, 0);
    assert.strictEqual(s.range.timeZone, 'Asia/Kolkata');
  });

  await check('top products, sales by category, attention counts and recent orders', async () => {
    const s = (await get('/dashboard/stats')).body.stats;
    assert.strictEqual(s.range.days, 30, 'default range');
    assert.deepStrictEqual(s.topProducts.map((p) => [p.name, p.quantity]), [['Shirt', 3]]);
    assert.deepStrictEqual(s.salesByCategory.map((c) => c.name), ['Shirts']);
    assert.deepStrictEqual(s.attention, { unpaid: 2, toFulfill: 2, toShip: 0 });
    assert.strictEqual(s.recentOrders.length, 3);
    assert.strictEqual(s.recentOrders.find((o) => o._id === o2.orderId || String(o._id) === String(o2.orderId)).status, 'Cancelled');
  });

  await check('catalog counts, newest products and low stock (variant-aware, published only)', async () => {
    const s = (await get('/dashboard/stats')).body.stats;
    assert.deepStrictEqual(
      { products: s.catalog.products, published: s.catalog.published, draft: s.catalog.draft, categories: s.catalog.categories, collections: s.catalog.collections },
      { products: 4, published: 3, draft: 1, categories: 2, collections: 1 }
    );
    assert.strictEqual(s.catalog.activePromotions, 3, 'TEN, the child rule and the campaign (OTHER was paused)');
    assert.strictEqual(s.newestProducts[0].name, 'Variant Tee');
    assert.deepStrictEqual(s.lowStock.map((p) => [p.name, p.stock]), [['Mug', 3], ['Variant Tee', 3]]);
  });

  await check('invalid range and time zone fall back safely', async () => {
    const s = (await get('/dashboard/stats?days=13&tz=Not/AZone')).body.stats;
    assert.strictEqual(s.range.days, 30);
    assert.strictEqual(s.range.timeZone, 'UTC');
  });

  void Order;
  console.log(`\n${stats.passed} Promotions / Dashboard checks passed${stats.failed ? `, ${stats.failed} failed` : ''}.`);
  if (stats.failed) process.exitCode = 1;
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(stopPlugin);
