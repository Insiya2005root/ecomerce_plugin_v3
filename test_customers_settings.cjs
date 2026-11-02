// test_customers_settings.cjs
// API checks for customers (derived from orders), Settings → General / Profile, tax preview and rule
// validation, location validation, and the customer figures on the dashboard.
// Usage: node test_customers_settings.cjs   (see test_support/plugin-api-harness.cjs for requirements)
const assert = require('assert');
const path = require('path');
const { pluginDir, startPlugin, stopPlugin, createChecker } = require('./test_support/plugin-api-harness.cjs');

const TEST_DB = 'ecommerce_plugin_customers_settings_test';
const { check, stats } = createChecker();

async function main() {
  const app = await startPlugin(TEST_DB);
  const post = (url, body) => app.call('POST', url, { body });
  const put = (url, body, user) => app.call('PUT', url, { body, ...(user !== undefined ? { user } : {}) });
  const get = (url, user) => app.call('GET', url, user !== undefined ? { user } : {});
  const Order = require(path.join(pluginDir, 'api', 'models', 'Order.js')).getModel();

  const cat = (await post('/categories', { name: 'General', slug: 'general' })).body.category;
  const shirt = (await post('/products', { status: 'Published', name: 'Shirt', price: 1000, stock: 50, categoryId: cat._id })).body.product;
  const mug = (await post('/products', { status: 'Published', name: 'Mug', price: 200, stock: 50, categoryId: cat._id })).body.product;
  await post('/discounts', { name: 'Ten', code: 'TEN', type: 'percentage', value: 10, status: 'Active', isAutomatic: false });

  const address = { addressLine1: '1 Ring Road', city: 'Surat', state: 'Gujarat', postalCode: '395001', country: 'India' };
  const place = async (customer, items, extra = {}) =>
    (await post('/checkout', { items, customerDetails: customer, customerAddress: address, ...extra })).body;

  // Asha: three orders (one with different email casing, one cancelled, one refunded in part).
  const a1 = await place({ name: 'Asha', email: 'asha@example.com', phone: '+91 98200 00001' }, [{ productId: shirt._id, quantity: 1 }], { couponCode: 'TEN' });
  const a2 = await place({ name: 'Asha Patel', email: 'ASHA@Example.com ' }, [{ productId: mug._id, quantity: 2 }]);
  const a3 = await place({ name: 'Asha Patel', email: 'asha@example.com' }, [{ productId: mug._id, quantity: 1 }], { customerAddress: { ...address, addressLine1: '9 Lake View' } });
  await post(`/orders/${a3.orderId}/cancel`);
  await post(`/orders/${a2.orderId}/payment`, { action: 'capture', method: 'Cash' });
  await post(`/orders/${a2.orderId}/payment`, { action: 'refund', amount: 50 });
  // Ravi: one recent order. Old Meera: one order 60 days ago.
  await place({ name: 'Ravi', email: 'ravi@example.com' }, [{ productId: shirt._id, quantity: 2 }]);
  const m1 = await place({ name: 'Meera', email: 'meera@example.com' }, [{ productId: mug._id, quantity: 1 }]);
  await Order.collection.updateOne({ orderNumber: m1.orderNumber }, { $set: { createdAt: new Date(Date.now() - 60 * 86400000) } });

  const orderTotal = async (id) => (await get(`/orders/${id}`)).body.order.pricing.totalAmount;
  const [a1Total, a2Total] = [await orderTotal(a1.orderId), await orderTotal(a2.orderId)];

  console.log('\n--> Customers');
  await check('customers are grouped by email, case-insensitively', async () => {
    const res = await get('/customers?page=1&limit=20');
    assert.strictEqual(res.statusCode, 200, JSON.stringify(res.body));
    assert.strictEqual(res.body.total, 3);
    const asha = res.body.customers.find((c) => c.key === 'asha@example.com');
    assert.ok(asha, 'Asha listed');
    assert.strictEqual(asha.orders, 3);
    assert.strictEqual(asha.cancelledOrders, 1);
    assert.strictEqual(asha.segment, 'Returning');
    assert.strictEqual(asha.phone, '+91 98200 00001', 'phone found on an older order');
  });

  await check('total spent excludes cancelled orders and subtracts refunds', async () => {
    const asha = (await get('/customers?search=asha')).body.customers[0];
    assert.strictEqual(asha.totalSpent, Math.round((a1Total + a2Total - 50) * 100) / 100);
    assert.strictEqual(asha.averageOrderValue, Math.round(((a1Total + a2Total - 50) / 2) * 100) / 100);
  });

  await check('summary and segments: returning, new (last 30 days) and one-time', async () => {
    const res = await get('/customers');
    assert.deepStrictEqual(
      { customers: res.body.summary.customers, returning: res.body.summary.returning, newCustomers: res.body.summary.newCustomers },
      { customers: 3, returning: 1, newCustomers: 2 }
    );
    const seg = async (s) => (await get(`/customers?segment=${s}`)).body.customers.map((c) => c.key);
    assert.deepStrictEqual(await seg('Returning'), ['asha@example.com']);
    assert.deepStrictEqual(await seg('New'), ['ravi@example.com']);
    assert.deepStrictEqual(await seg('One-time'), ['meera@example.com']);
  });

  await check('search and sorting', async () => {
    assert.deepStrictEqual((await get('/customers?search=RAVI')).body.customers.map((c) => c.key), ['ravi@example.com']);
    assert.deepStrictEqual((await get('/customers?search=surat')).body.total, 3, 'city search');
    const bySpend = (await get('/customers?sort=totalSpent&order=desc')).body.customers.map((c) => c.key);
    assert.strictEqual(bySpend[0], 'ravi@example.com', 'Ravi spent 2 × ₹1000');
    const byName = (await get('/customers?sort=name&order=asc')).body.customers.map((c) => c.name);
    assert.deepStrictEqual(byName, [...byName].sort());
  });

  await check('customer detail: orders, addresses, products, discounts and other names', async () => {
    const res = await get(`/customers/lookup?email=${encodeURIComponent('Asha@example.com')}`);
    assert.strictEqual(res.statusCode, 200, JSON.stringify(res.body));
    const c = res.body.customer;
    assert.strictEqual(c.recentOrders.length, 3);
    assert.strictEqual(c.addresses.length, 2);
    assert.strictEqual(c.addresses.find((a) => a.addressLine1 === '1 Ring Road').orders, 2);
    assert.strictEqual(c.refunded, 50);
    assert.deepStrictEqual(c.topProducts.map((p) => [p.name, p.quantity]), [['Mug', 2], ['Shirt', 1]], 'cancelled order lines excluded');
    assert.strictEqual(c.discounts.length, 1);
    assert.strictEqual(c.discounts[0].code, 'TEN');
    assert.ok(c.discountTotal > 0);
    assert.strictEqual(c.name, 'Asha Patel', 'latest name wins');
    assert.deepStrictEqual(c.otherNames, ['Asha']);
  });

  await check('customer lookup: 404 for unknown email, 400 without one, no regex injection', async () => {
    assert.strictEqual((await get('/customers/lookup?email=nobody%40example.com')).statusCode, 404);
    assert.strictEqual((await get('/customers/lookup')).statusCode, 400);
    assert.strictEqual((await get(`/customers/lookup?email=${encodeURIComponent('.*')}`)).statusCode, 404);
  });

  console.log('\n--> Settings → General');
  await check('store defaults, validation and save', async () => {
    const before = (await get('/settings/store')).body;
    assert.strictEqual(before.store.orderPrefix, 'ORD-');
    assert.strictEqual(before.store.lowStockThreshold, 5);
    assert.strictEqual(before.currency.code, 'INR');

    const bad = await put('/settings/store', { name: '', email: 'nope', gstin: '123', orderPrefix: 'a b', lowStockThreshold: -1 });
    assert.strictEqual(bad.statusCode, 400);
    assert.deepStrictEqual(Object.keys(bad.body.errors).sort(), ['email', 'gstin', 'lowStockThreshold', 'name', 'orderPrefix']);

    const ok = await put('/settings/store', { name: 'Surat Silks', email: 'Hello@SuratSilks.in', gstin: '24aapfu0939f1zv', orderPrefix: 'ss-', lowStockThreshold: 10, address: { city: 'Surat' } });
    assert.strictEqual(ok.statusCode, 200, JSON.stringify(ok.body));
    assert.strictEqual(ok.body.store.email, 'hello@suratsilks.in');
    assert.strictEqual(ok.body.store.gstin, '24AAPFU0939F1ZV');
    assert.strictEqual(ok.body.store.orderPrefix, 'SS-');
    assert.strictEqual(ok.body.store.address.country, 'India', 'untouched address fields keep defaults');
  });

  await check('store settings do not disturb tax/shipping settings, and vice versa', async () => {
    await post('/settings', { shippingMethod: 'Flat', shippingRate: 49 });
    const s = (await get('/settings')).body.settings;
    assert.strictEqual(s.shippingRate, 49);
    assert.strictEqual((await get('/settings/store')).body.store.name, 'Surat Silks');
    assert.strictEqual((await post('/settings', { shippingRate: -5 })).statusCode, 400);
  });

  await check('new orders use the order number prefix', async () => {
    const o = await place({ name: 'Ravi', email: 'ravi@example.com' }, [{ productId: mug._id, quantity: 1 }]);
    assert.match(o.orderNumber, /^SS-\d{9}$/);
  });

  await check('storefront settings expose the store name and contact', async () => {
    const res = await get('/storefront/settings');
    assert.strictEqual(res.body.settings.storeName, 'Surat Silks');
    assert.strictEqual(res.body.settings.supportEmail, 'hello@suratsilks.in');
  });

  console.log('\n--> Settings → Profile');
  const admin = { userId: 'u-1', email: 'owner@example.com', role: 1 };
  await check('profile shows the OpenExt user and saves plugin preferences', async () => {
    const res = await get('/profile', admin);
    assert.strictEqual(res.statusCode, 200);
    assert.deepStrictEqual(res.body.user, { id: 'u-1', email: 'owner@example.com', role: 1, roleLabel: 'Admin' });
    assert.strictEqual(res.body.profile.dashboardDays, 30);
    assert.strictEqual((await put('/profile', { dashboardDays: 14 }, admin)).statusCode, 400);
    const saved = await put('/profile', { displayName: 'Owner', dashboardDays: 7 }, admin);
    assert.strictEqual(saved.statusCode, 200, JSON.stringify(saved.body));
    assert.strictEqual((await get('/profile', admin)).body.profile.displayName, 'Owner');
    assert.strictEqual((await get('/profile', { userId: 'u-2' })).body.profile.displayName, '', 'profiles are per user');
    assert.strictEqual((await get('/profile', null)).statusCode, 401);
  });

  await check('dashboard uses the saved default range when none is asked for', async () => {
    assert.strictEqual((await get('/dashboard/stats', admin)).body.stats.range.days, 7);
    assert.strictEqual((await get('/dashboard/stats?days=90', admin)).body.stats.range.days, 90);
  });

  console.log('\n--> Dashboard customers');
  await check('dashboard counts new vs returning customers and top spenders', async () => {
    const s = (await get('/dashboard/stats?days=30')).body.stats;
    assert.strictEqual(s.customers.total, 3);
    assert.strictEqual(s.customers.active, 2, 'Meera ordered 60 days ago');
    assert.strictEqual(s.customers.newCustomers, 2);
    assert.strictEqual(s.customers.returning, 0);
    assert.strictEqual(s.customers.top[0].email, 'ravi@example.com');
    assert.strictEqual(s.lowStockThreshold, 10, 'from Settings → General');
    const s90 = (await get('/dashboard/stats?days=90')).body.stats;
    assert.strictEqual(s90.customers.active, 3);
  });

  console.log('\n--> Tax');
  await post('/taxes/migrate');
  const classes = (await get('/taxes/classes')).body;
  const standard = classes.classes.find((c) => c.code === 'standard');
  await check('tax rules are validated (400 with field errors)', async () => {
    const bad = await post('/taxes/rules', { name: '', components: [{ label: '', rate: 5 }] });
    assert.strictEqual(bad.statusCode, 400);
    assert.deepStrictEqual(Object.keys(bad.body.errors).sort(), ['components', 'name', 'taxClassId']);
    const tooHigh = await post('/taxes/rules', { name: 'GST', taxClassId: standard._id, components: [{ label: 'GST', rate: 120 }] });
    assert.strictEqual(tooHigh.statusCode, 400);
  });

  await check('tax preview picks the most specific rule (state beats country)', async () => {
    await post('/taxes/rules', { name: 'GST', taxClassId: standard._id, country: 'India', components: [{ label: 'IGST', rate: 18 }] });
    await post('/taxes/rules', { name: 'GST', taxClassId: standard._id, country: 'India', state: 'Gujarat', components: [{ label: 'CGST', rate: 9 }, { label: 'SGST', rate: 9 }] });
    const gj = (await post('/taxes/preview', { taxClassId: standard._id, country: 'India', state: 'Gujarat', amount: 1000 })).body.preview;
    assert.deepStrictEqual(gj.rule.components.map((c) => c.label), ['CGST', 'SGST']);
    assert.strictEqual(gj.rate, 18);
    assert.strictEqual(gj.tax, 180);
    const mh = (await post('/taxes/preview', { taxClassId: standard._id, country: 'India', state: 'Maharashtra', amount: 1000 })).body.preview;
    assert.deepStrictEqual(mh.rule.components.map((c) => c.label), ['IGST']);
    const abroad = (await post('/taxes/preview', { taxClassId: standard._id, country: 'France', amount: 1000 })).body.preview;
    assert.strictEqual(abroad.rule, null);
    assert.strictEqual(abroad.tax, 0);
  });

  await check('tax rates list each rate with its category (works with OpenExt model names)', async () => {
    const res = await get('/taxes/rules');
    assert.strictEqual(res.statusCode, 200, JSON.stringify(res.body));
    assert.strictEqual(res.body.rules.length, 2);
    assert.ok(res.body.rules.every((r) => r.taxClassId && r.taxClassId.name === standard.name), 'category attached');
  });

  await check('tax categories report how many products use them', async () => {
    await post('/products', { name: 'Taxed', price: 10, stock: 1, categoryId: cat._id, taxClassId: String(standard._id) });
    const counts = (await get('/taxes/classes')).body.productCounts;
    assert.strictEqual(counts[String(standard._id)], 1);
    assert.ok(counts.Default >= 2);
  });

  console.log('\n--> Locations');
  await check('locations are validated (400, not a server error)', async () => {
    const bad = await post('/locations', { name: '', city: 'Surat', latitude: 200 });
    assert.strictEqual(bad.statusCode, 400);
    assert.deepStrictEqual(Object.keys(bad.body.errors).sort(), ['addressLine1', 'latitude', 'name', 'postalCode', 'state']);
    const ok = await post('/locations', { name: 'Surat WH', addressLine1: '1 Ring Road', city: 'Surat', state: 'Gujarat', postalCode: '395001', latitude: 21.17, longitude: 72.83 });
    assert.strictEqual(ok.statusCode, 200, JSON.stringify(ok.body));
    const detail = (await get(`/locations/${ok.body.location._id}`)).body;
    assert.strictEqual(detail.orderCount, 0);
    assert.strictEqual((await put(`/locations/${ok.body.location._id}`, { city: '' })).statusCode, 400);
    // Moving the address but sending coordinates (from the PIN or typed) keeps those coordinates.
    const moved = await put(`/locations/${ok.body.location._id}`, { addressLine1: '5 Link Road', city: 'Mumbai', state: 'Maharashtra', postalCode: '400050', latitude: 19.0576, longitude: 72.8299 });
    assert.strictEqual(moved.statusCode, 200, JSON.stringify(moved.body));
    assert.strictEqual(moved.body.location.latitude, 19.0576);
    assert.strictEqual(moved.body.location.longitude, 72.8299);
  });

  await check('settings overview summarises every section', async () => {
    const o = (await get('/settings/overview', admin)).body.overview;
    assert.strictEqual(o.store.name, 'Surat Silks');
    assert.strictEqual(o.profile.displayName, 'Owner');
    assert.strictEqual(o.tax.rules, 2);
    assert.strictEqual(o.shipping.rate, 49);
    assert.deepStrictEqual(o.locations, { total: 1, active: 1 });
  });

  console.log('\n--> Shipping: fixed ship-from store');
  await check('distance is measured from the chosen store, not the nearest', async () => {
    // Map lookups are replaced so the test never calls OpenStreetMap: distance = |store lat − 20| × 100 km.
    const { ShippingService } = require(path.join(pluginDir, 'api', 'services', 'ShippingService.js'));
    ShippingService.geocodeAddress = async () => ({ lat: 20, lon: 72 });
    ShippingService.getRouteDistanceKm = async (origin) => Math.abs(origin.lat - 20) * 100;

    const near = (await post('/locations', { name: 'Near WH', addressLine1: '1 A', city: 'Navsari', state: 'Gujarat', postalCode: '396445', latitude: 20.5, longitude: 72.9 })).body.location;
    const far = (await post('/locations', { name: 'Far WH', addressLine1: '1 B', city: 'Vadodara', state: 'Gujarat', postalCode: '390001', latitude: 22, longitude: 73.2 })).body.location;
    await post('/settings', { shippingMethod: 'Distance', shippingRatePerKm: 2, distanceRounding: 'Up', freeShippingThreshold: 0, shipFromLocationId: '' });
    const quote = async () => (await post('/cart/calculate', { items: [{ productId: mug._id, quantity: 1 }], customerAddress: address })).body.pricing;

    const auto = await quote();
    assert.strictEqual(auto.shippingSnapshot.originName, 'Near WH', 'nearest by default');
    assert.strictEqual(auto.shipping, 100, '50 km × ₹2');

    const saved = await post('/settings', { shipFromLocationId: far._id });
    assert.strictEqual(saved.statusCode, 200, JSON.stringify(saved.body));
    assert.strictEqual(saved.body.settings.shipFromLocationId, String(far._id));
    const fixed = await quote();
    assert.strictEqual(fixed.shippingSnapshot.originName, 'Far WH');
    assert.strictEqual(fixed.shipping, 400, '200 km × ₹2');
    assert.strictEqual((await get('/settings')).body.settings.shipFromLocationId, String(far._id), 'GET returns it');

    // An inactive chosen store falls back to the nearest active one.
    await put(`/locations/${far._id}`, { status: 'Inactive' });
    assert.strictEqual((await quote()).shippingSnapshot.originName, 'Near WH');

    assert.strictEqual((await post('/settings', { shipFromLocationId: '0123456789abcdef01234567' })).statusCode, 400, 'unknown store rejected');
    await post('/settings', { shipFromLocationId: '' });
    assert.strictEqual((await get('/settings')).body.settings.shipFromLocationId, '');
    assert.ok(near);
  });
}

main()
  .catch((err) => {
    console.error(err);
    stats.failed++;
  })
  .finally(async () => {
    await stopPlugin();
    console.log(`\n${stats.passed} passed, ${stats.failed} failed`);
    process.exit(stats.failed ? 1 : 0);
  });
