// test_orders_admin.cjs
// API checks for the shared cart pricing, order placement (stock, coupon usage) and order management actions.
// Usage: node test_orders_admin.cjs   (see test_support/plugin-api-harness.cjs for requirements)
const assert = require('assert');
const path = require('path');
const { mongoose, pluginDir, startPlugin, stopPlugin, createChecker } = require('./test_support/plugin-api-harness.cjs');

const TEST_DB = 'ecommerce_plugin_orders_test';
const { check, stats } = createChecker();

async function main() {
  const app = await startPlugin(TEST_DB);
  const post = (url, body, user) => app.call('POST', url, { body, ...(user === null ? { user: null } : {}) });
  const put = (url, body) => app.call('PUT', url, { body });
  const get = (url) => app.call('GET', url);
  const DiscountRule = require(path.join(pluginDir, 'api', 'models', 'DiscountRule.js')).getModel();
  const Order = require(path.join(pluginDir, 'api', 'models', 'Order.js')).getModel();

  const cat = (await post('/categories', { name: 'Apparel', slug: 'apparel' })).body.category;
  const mk = async (body) => (await post('/products', { categoryId: cat._id, status: 'Published', ...body })).body.product;
  const sale = await mk({ name: 'Sale Shirt', sku: 'SALE-1', price: 1000, discountPrice: 800, stock: 10 });
  const tee = await mk({
    name: 'Variant Tee', sku: 'VAR-1', price: 500, stock: 50,
    variants: [{ size: 'M', color: 'Black', stock: 2, sku: 'VAR-1-M' }, { size: 'L', color: 'Black', stock: 5, priceOverride: 600 }],
  });
  const vM = tee.variants[0]._id;
  const vL = tee.variants[1]._id;
  await DiscountRule.create({ name: 'Ten Off', code: 'TEN', type: 'percentage', value: 10, status: 'Active', usageLimit: 1 });

  const customer = { name: 'Asha Patel', email: 'asha@example.com', phone: '+91 98765 43210' };
  const address = { addressLine1: '12 Ring Road', city: 'Surat', state: 'Gujarat', postalCode: '395007', country: 'India' };
  const placeBody = (items, extra = {}) => ({ items, customerDetails: customer, customerAddress: address, source: 'admin_cart', ...extra });

  console.log('\n--> Shared cart pricing');
  await check('cart and checkout charge the same total (sale price is now honoured at checkout)', async () => {
    const items = [{ productId: sale._id, quantity: 2 }];
    const cart = await post('/cart/calculate', { items, customerAddress: address });
    assert.strictEqual(cart.body.success, true);
    assert.strictEqual(cart.body.items[0].price, 800);
    const placed = await post('/checkout', placeBody(items));
    assert.strictEqual(placed.statusCode, 200, JSON.stringify(placed.body));
    const order = (await get(`/orders/${placed.body.orderId}`)).body.order;
    assert.strictEqual(order.pricing.totalAmount, cart.body.pricing.totalAmount);
    assert.strictEqual(order.items[0].price, 800);
    assert.strictEqual(order.source, 'admin_cart');
    assert.strictEqual(order.customerDetails.phone, customer.phone);
    assert.strictEqual(order.shippingAddress.city, 'Surat');
    assert.match(order.customerDetails.address, /12 Ring Road, Surat/);
  });

  await check('cart reports stock problems per variant; response shape is unchanged otherwise', async () => {
    const res = await post('/cart/calculate', { items: [{ productId: tee._id, variantId: vM, quantity: 3 }] });
    assert.deepStrictEqual(Object.keys(res.body).sort(), ['items', 'pricing', 'stockIssues', 'success']);
    assert.strictEqual(res.body.stockIssues.length, 1);
    assert.strictEqual(res.body.stockIssues[0].available, 2);
    assert.strictEqual(res.body.items[0].name, 'Variant Tee - M Black');
  });

  await check('anonymous carts still only price Published products', async () => {
    const draft = await mk({ name: 'Hidden', sku: 'HID-1', price: 10, status: 'Draft' });
    const anon = await post('/cart/calculate', { items: [{ productId: draft._id, quantity: 1 }] }, null);
    assert.strictEqual(anon.body.items.length, 0);
    const admin = await post('/cart/calculate', { items: [{ productId: draft._id, quantity: 1 }] });
    assert.strictEqual(admin.body.items.length, 1);
  });

  console.log('\n--> Placing orders');
  await check('variant orders deduct the variant stock, not the main product stock', async () => {
    const res = await post('/checkout', placeBody([{ productId: tee._id, variantId: vL, quantity: 2 }]));
    assert.strictEqual(res.statusCode, 200, JSON.stringify(res.body));
    const p = (await get(`/products/${tee._id}`)).body.product;
    assert.strictEqual(p.variants.find((v) => String(v._id) === String(vL)).stock, 3);
    assert.strictEqual(p.stock, 50, 'main stock untouched');
    const order = (await get(`/orders/${res.body.orderId}`)).body.order;
    assert.strictEqual(order.items[0].price, 600, 'variant price override');
  });

  await check('insufficient variant stock is refused with 409 and nothing is deducted', async () => {
    const res = await post('/checkout', placeBody([
      { productId: sale._id, quantity: 1 },
      { productId: tee._id, variantId: vM, quantity: 5 },
    ]));
    assert.strictEqual(res.statusCode, 409);
    assert.match(res.body.message, /Insufficient stock for Variant Tee - M Black/);
    assert.strictEqual((await get(`/products/${sale._id}`)).body.product.stock, 8, 'sale stock unchanged by the refused order');
  });

  await check('customer validation and empty carts are rejected', async () => {
    const noEmail = await post('/checkout', { items: [{ productId: sale._id, quantity: 1 }], customerDetails: { name: 'X', address: 'Y' } });
    assert.strictEqual(noEmail.statusCode, 400);
    const empty = await post('/checkout', placeBody([{ productId: 'nope', quantity: 1 }]));
    assert.strictEqual(empty.statusCode, 400);
    assert.match(empty.body.message, /cart is empty/);
  });

  let couponOrderId;
  await check('coupon usage is counted, so a usage limit of 1 stops the second use', async () => {
    const first = await post('/checkout', placeBody([{ productId: sale._id, quantity: 1 }], { couponCode: 'TEN' }));
    couponOrderId = first.body.orderId;
    const o1 = (await get(`/orders/${couponOrderId}`)).body.order;
    assert.ok(o1.pricing.appliedDiscounts.some((d) => d.name === 'Ten Off'), 'coupon applied the first time');
    assert.strictEqual((await DiscountRule.findOne({ code: 'TEN' }).lean()).usedCount, 1);
    const second = await post('/cart/calculate', { items: [{ productId: sale._id, quantity: 1 }], couponCode: 'TEN' });
    assert.strictEqual(second.body.pricing.appliedDiscounts.length, 0, 'limit reached');
  });

  console.log('\n--> Order list');
  await Order.collection.insertOne({
    tenantId: 'default_tenant', orderNumber: 'ORD-LEGACY', status: 'Shipped',
    customerDetails: { name: 'Old Customer', email: 'old@example.com', address: 'Somewhere' },
    items: [{ productId: new mongoose.Types.ObjectId(sale._id), name: 'Sale Shirt', price: 800, quantity: 1 }],
    pricing: { subtotal: 1000, discount: 200, tax: 0, shipping: 0, totalAmount: 800 },
    createdAt: new Date('2025-01-01'), updatedAt: new Date('2025-01-01'),
  });

  await check('without ?page the full list is returned as before; legacy orders get sensible defaults', async () => {
    const res = await get('/orders');
    assert.strictEqual(res.body.orders.length, res.body.total);
    const legacy = res.body.orders.find((o) => o.orderNumber === 'ORD-LEGACY');
    assert.strictEqual(legacy.paymentStatus, 'Not paid');
    assert.strictEqual(legacy.fulfillmentStatus, 'Shipped');
    assert.strictEqual(legacy.events[0].type, 'placed');
    assert.strictEqual(res.body.orders[res.body.orders.length - 1].orderNumber, 'ORD-LEGACY', 'newest first');
  });

  await check('search, status filters (incl. legacy orders) and pagination', async () => {
    assert.strictEqual((await get('/orders?search=old@example')).body.total, 1);
    assert.strictEqual((await get('/orders?fulfillmentStatus=Shipped')).body.total, 1);
    assert.strictEqual((await get('/orders?paymentStatus=Not%20paid')).body.total, 4, 'the refused order was never created');
    const p = await get('/orders?page=2&limit=2');
    assert.strictEqual(p.body.orders.length, 2);
    assert.strictEqual(p.body.page, 2);
    assert.strictEqual(p.body.total, 4);
    assert.strictEqual((await get('/orders/not-an-id')).statusCode, 400);
    assert.strictEqual((await get(`/orders/${new mongoose.Types.ObjectId()}`)).statusCode, 404);
  });

  console.log('\n--> Payment');
  const orderId = (await post('/checkout', placeBody([{ productId: sale._id, quantity: 1 }]))).body.orderId;
  await check('mark as paid captures the order total; a second capture is refused', async () => {
    const res = await post(`/orders/${orderId}/payment`, { action: 'capture', method: 'UPI', reference: 'UTR123' });
    assert.strictEqual(res.body.order.paymentStatus, 'Paid');
    assert.strictEqual(res.body.order.payment.capturedAmount, res.body.order.pricing.totalAmount);
    assert.strictEqual(res.body.order.payment.method, 'UPI');
    assert.strictEqual((await post(`/orders/${orderId}/payment`, { action: 'capture' })).statusCode, 409);
  });

  await check('partial then full refunds; over-refunding is refused', async () => {
    const total = (await get(`/orders/${orderId}`)).body.order.pricing.totalAmount;
    let res = await post(`/orders/${orderId}/payment`, { action: 'refund', amount: 100, reason: 'Damaged box' });
    assert.strictEqual(res.body.order.paymentStatus, 'Partially refunded');
    assert.strictEqual((await post(`/orders/${orderId}/payment`, { action: 'refund', amount: total })).statusCode, 400);
    res = await post(`/orders/${orderId}/payment`, { action: 'refund', amount: total - 100 });
    assert.strictEqual(res.body.order.paymentStatus, 'Refunded');
    assert.strictEqual(res.body.order.refunds.length, 2);
    assert.ok(res.body.order.events.some((e) => e.type === 'refund' && /Damaged box/.test(e.message)), 'refund on the timeline');
  });

  console.log('\n--> Fulfillment');
  const shipId = (await post('/checkout', placeBody([{ productId: sale._id, quantity: 1 }]))).body.orderId;
  await check('fulfil → ship (with tracking) → deliver, in order only', async () => {
    assert.strictEqual((await post(`/orders/${shipId}/fulfillment`, { action: 'ship' })).statusCode, 409);
    let res = await post(`/orders/${shipId}/fulfillment`, { action: 'fulfill' });
    assert.strictEqual(res.body.order.fulfillmentStatus, 'Fulfilled');
    assert.strictEqual(res.body.order.status, 'Processing');
    res = await post(`/orders/${shipId}/fulfillment`, { action: 'ship', carrier: 'Delhivery', trackingNumber: 'DL123' });
    assert.strictEqual(res.body.order.fulfillmentStatus, 'Shipped');
    assert.strictEqual(res.body.order.fulfillment.trackingNumber, 'DL123');
    res = await post(`/orders/${shipId}/fulfillment`, { action: 'deliver' });
    assert.strictEqual(res.body.order.status, 'Delivered');
    assert.deepStrictEqual(res.body.order.events.map((e) => e.type), ['placed', 'fulfillment', 'fulfillment', 'fulfillment']);
  });

  console.log('\n--> Cancel & notes');
  await check('cancel returns stock and coupon usage; shipped orders cannot be cancelled', async () => {
    const before = (await get(`/products/${sale._id}`)).body.product.stock;
    const res = await post(`/orders/${couponOrderId}/cancel`);
    assert.strictEqual(res.body.order.status, 'Cancelled');
    assert.strictEqual((await get(`/products/${sale._id}`)).body.product.stock, before + 1);
    assert.strictEqual((await DiscountRule.findOne({ code: 'TEN' }).lean()).usedCount, 0, 'coupon can be used again');
    assert.strictEqual((await post(`/orders/${couponOrderId}/cancel`)).statusCode, 409);
    assert.strictEqual((await post(`/orders/${shipId}/cancel`)).statusCode, 409);
    assert.strictEqual((await post(`/orders/${couponOrderId}/payment`, { action: 'capture' })).statusCode, 409);
  });

  await check('legacy PUT /status: Cancelled restocks; other values validated', async () => {
    const id = (await post('/checkout', placeBody([{ productId: tee._id, variantId: vL, quantity: 1 }]))).body.orderId;
    const stockAfterOrder = (await get(`/products/${tee._id}`)).body.product.variants.find((v) => String(v._id) === String(vL)).stock;
    assert.strictEqual((await put(`/orders/${id}/status`, { status: 'Bogus' })).statusCode, 400);
    const res = await put(`/orders/${id}/status`, { status: 'Cancelled' });
    assert.strictEqual(res.body.order.status, 'Cancelled');
    const restocked = (await get(`/products/${tee._id}`)).body.product.variants.find((v) => String(v._id) === String(vL)).stock;
    assert.strictEqual(restocked, stockAfterOrder + 1);
  });

  await check('notes are saved and appear on the timeline', async () => {
    assert.strictEqual((await post(`/orders/${shipId}/notes`, { text: '  ' })).statusCode, 400);
    const res = await post(`/orders/${shipId}/notes`, { text: 'Customer asked for gift wrap' });
    assert.strictEqual(res.body.order.notes[0].text, 'Customer asked for gift wrap');
    assert.strictEqual(res.body.order.events.at(-1).type, 'note');
  });

  console.log(`\n${stats.passed} Cart / Order checks passed${stats.failed ? `, ${stats.failed} failed` : ''}.`);
  if (stats.failed) process.exitCode = 1;
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(stopPlugin);
