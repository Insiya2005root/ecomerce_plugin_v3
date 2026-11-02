// test_inventory.cjs
// API checks for inventory: items per product/variant, stock per location, reserve-on-order /
// deduct-on-fulfil / release-on-cancel, manual reservations, adjustments, bulk edit, tracking and backorders.
// After every step the invariant "product stock = Σ(stocked − reserved)" is checked.
// Usage: node test_inventory.cjs   (see test_support/plugin-api-harness.cjs for requirements)
const assert = require('assert');
const path = require('path');
const { mongoose, pluginDir, startPlugin, stopPlugin, createChecker } = require('./test_support/plugin-api-harness.cjs');

const TEST_DB = 'ecommerce_plugin_inventory_test';
const { check, stats } = createChecker();

async function main() {
  const app = await startPlugin(TEST_DB);
  const post = (url, body) => app.call('POST', url, { body });
  const put = (url, body) => app.call('PUT', url, { body });
  const get = (url) => app.call('GET', url);
  const del = (url) => app.call('DELETE', url);
  const Product = require(path.join(pluginDir, 'api', 'models', 'Product.js')).getModel();
  const Inv = require(path.join(pluginDir, 'api', 'models', 'Inventory.js'));
  const Order = require(path.join(pluginDir, 'api', 'models', 'Order.js')).getModel();

  const cat = (await post('/categories', { name: 'General', slug: 'general' })).body.category;
  const address = { addressLine1: '1 Ring Road', city: 'Surat', state: 'Gujarat', postalCode: '395001', country: 'India' };
  const place = async (items) => (await post('/checkout', { items, customerDetails: { name: 'Asha', email: 'asha@example.com' }, customerAddress: address })).body;

  /** Every item's product copy equals Σ(stocked − reserved). */
  async function assertInvariant(label) {
    const items = await Inv.items().find({}).lean();
    for (const item of items) {
      const levels = await Inv.levels().find({ itemId: String(item._id) }).lean();
      const available = levels.reduce((s, l) => s + l.stocked - l.reserved, 0);
      const p = await Product.collection.findOne({ _id: new mongoose.Types.ObjectId(item.productId) });
      const copy = item.variantId ? p.variants.find((v) => String(v._id) === item.variantId).stock : p.stock;
      assert.strictEqual(copy, available, `${label}: ${item.title} product stock ${copy} ≠ available ${available}`);
    }
  }
  const levelsOf = async (productId, variantId = '') => {
    const item = await Inv.items().findOne({ productId: String(productId), variantId }).lean();
    return { item, levels: await Inv.levels().find({ itemId: String(item._id) }).lean() };
  };

  console.log('\n--> Items and locations');
  let shirt;
  await check('a product made before any location keeps its stock as "Unassigned"', async () => {
    shirt = (await post('/products', { name: 'Shirt', price: 500, stock: 10, categoryId: cat._id, status: 'Published' })).body.product;
    const { item, levels } = await levelsOf(shirt._id);
    assert.strictEqual(item.title, 'Shirt');
    assert.deepStrictEqual(levels.map((l) => [l.locationId, l.stocked, l.reserved]), [['default', 10, 0]]);
    await assertInvariant('create');
  });

  let surat, mumbai;
  await check('the first location added takes over unassigned stock', async () => {
    surat = (await post('/locations', { name: 'Surat WH', addressLine1: '1 A', city: 'Surat', state: 'Gujarat', postalCode: '395001', latitude: 21.17, longitude: 72.83, priority: 10 })).body.location;
    const { levels } = await levelsOf(shirt._id);
    assert.deepStrictEqual(levels.map((l) => [l.locationId, l.stocked]), [[String(surat._id), 10]]);
    mumbai = (await post('/locations', { name: 'Mumbai Store', addressLine1: '5 B', city: 'Mumbai', state: 'Maharashtra', postalCode: '400050', latitude: 19.06, longitude: 72.83, priority: 1 })).body.location;
  });

  let tee, teeM;
  await check('a product with variants gets one inventory item per variant', async () => {
    tee = (await post('/products', { name: 'Tee', price: 300, categoryId: cat._id, status: 'Published', variants: [{ size: 'S', stock: 3, sku: 'TEE-S' }, { size: 'M', stock: 4, sku: 'TEE-M' }] })).body.product;
    teeM = tee.variants.find((v) => v.size === 'M');
    const items = await Inv.items().find({ productId: String(tee._id) }).lean();
    assert.deepStrictEqual(items.map((i) => i.title).sort(), ['Tee · M', 'Tee · S']);
    const { levels } = await levelsOf(tee._id, String(teeM._id));
    assert.deepStrictEqual(levels.map((l) => [l.locationId, l.stocked]), [[String(surat._id), 4]], 'new stock goes to the highest-priority location');
    await assertInvariant('variants');
  });

  console.log('\n--> Orders: reserve, fulfil, cancel');
  let o1;
  await check('placing an order reserves stock (shelf unchanged, available down)', async () => {
    o1 = await place([{ productId: shirt._id, quantity: 2 }]);
    assert.ok(o1.orderId, JSON.stringify(o1));
    const { levels } = await levelsOf(shirt._id);
    assert.deepStrictEqual([levels[0].stocked, levels[0].reserved], [10, 2]);
    const reservations = await Inv.reservations().find({ orderId: String(o1.orderId) }).lean();
    assert.strictEqual(reservations.length, 1);
    assert.strictEqual((await Product.findById(shirt._id).lean()).stock, 8);
    await assertInvariant('reserve');
  });

  await check('fulfilling the order takes the units off the shelf and clears the hold', async () => {
    const r = await post(`/orders/${o1.orderId}/fulfillment`, { action: 'fulfill' });
    assert.strictEqual(r.statusCode, 200, JSON.stringify(r.body));
    const { levels } = await levelsOf(shirt._id);
    assert.deepStrictEqual([levels[0].stocked, levels[0].reserved], [8, 0]);
    assert.strictEqual(await Inv.reservations().countDocuments({ orderId: String(o1.orderId) }), 0);
    await assertInvariant('fulfil');
  });

  await check('cancelling an unpacked order just releases the hold', async () => {
    const o = await place([{ productId: shirt._id, quantity: 3 }]);
    assert.deepStrictEqual((await levelsOf(shirt._id)).levels.map((l) => [l.stocked, l.reserved]), [[8, 3]]);
    await post(`/orders/${o.orderId}/cancel`);
    assert.deepStrictEqual((await levelsOf(shirt._id)).levels.map((l) => [l.stocked, l.reserved]), [[8, 0]]);
    assert.strictEqual((await Product.findById(shirt._id).lean()).stock, 8);
    await assertInvariant('cancel unpacked');
  });

  await check('cancelling a packed (fulfilled) order puts the units back on the shelf', async () => {
    const o = await place([{ productId: shirt._id, quantity: 1 }]);
    await post(`/orders/${o.orderId}/fulfillment`, { action: 'fulfill' });
    assert.deepStrictEqual((await levelsOf(shirt._id)).levels.map((l) => [l.stocked, l.reserved]), [[7, 0]]);
    await post(`/orders/${o.orderId}/cancel`);
    assert.deepStrictEqual((await levelsOf(shirt._id)).levels.map((l) => [l.stocked, l.reserved]), [[8, 0]]);
    await assertInvariant('cancel packed');
  });

  await check('orders placed before inventory existed (no reservation) restock correctly on cancel', async () => {
    const o = await place([{ productId: shirt._id, quantity: 2 }]);
    // Simulate an old order: stock was taken from the product, nothing was reserved.
    const res = await Inv.reservations().findOne({ orderId: String(o.orderId) }).lean();
    await Inv.reservations().deleteOne({ _id: res._id });
    await Inv.levels().updateOne({ itemId: res.itemId, locationId: res.locationId }, { $inc: { reserved: -2, stocked: -2 } });
    await assertInvariant('legacy setup');
    await post(`/orders/${o.orderId}/cancel`);
    assert.deepStrictEqual((await levelsOf(shirt._id)).levels.map((l) => [l.stocked, l.reserved]), [[8, 0]]);
    await assertInvariant('legacy cancel');
  });

  await check('overselling is still refused', async () => {
    const r = await post('/checkout', { items: [{ productId: shirt._id, quantity: 9 }], customerDetails: { name: 'A', email: 'a@example.com' }, customerAddress: address });
    assert.strictEqual(r.statusCode, 409);
    await assertInvariant('oversell');
  });

  console.log('\n--> Admin changes');
  let shirtItemId;
  await check('adjusting stock updates the product, records history, and respects reservations', async () => {
    const { item } = await levelsOf(shirt._id);
    shirtItemId = String(item._id);
    const o = await place([{ productId: shirt._id, quantity: 3 }]);
    const tooLow = await post(`/inventory/${shirtItemId}/adjust`, { locationId: String(surat._id), stocked: 2 });
    assert.strictEqual(tooLow.statusCode, 400);
    assert.match(tooLow.body.message, /3 reserved/);
    const ok = await post(`/inventory/${shirtItemId}/adjust`, { locationId: String(surat._id), stocked: 20, reason: 'Received', note: 'PO-77' });
    assert.strictEqual(ok.statusCode, 200, JSON.stringify(ok.body));
    assert.strictEqual((await Product.findById(shirt._id).lean()).stock, 17);
    const detail = (await get(`/inventory/${shirtItemId}`)).body.item;
    assert.strictEqual(detail.movements[0].type, 'received');
    assert.strictEqual(detail.movements[0].note, 'PO-77');
    assert.strictEqual(detail.reservations[0].orderNumber.length > 0, true);
    await post(`/orders/${o.orderId}/cancel`);
    await assertInvariant('adjust');
  });

  await check('stock at a second location adds to what can be sold', async () => {
    assert.strictEqual((await put(`/inventory/${shirtItemId}/locations`, { locationIds: [String(surat._id), String(mumbai._id)] })).statusCode, 200);
    await post(`/inventory/${shirtItemId}/adjust`, { locationId: String(mumbai._id), stocked: 5 });
    assert.strictEqual((await Product.findById(shirt._id).lean()).stock, 25);
    const removeStocked = await put(`/inventory/${shirtItemId}/locations`, { locationIds: [String(surat._id)] });
    assert.strictEqual(removeStocked.statusCode, 409, 'a location with stock cannot be removed');
    await assertInvariant('two locations');
  });

  await check('editing stock on the product adjusts the primary location', async () => {
    await put(`/products/${shirt._id}`, { stock: 30 });
    const { levels } = await levelsOf(shirt._id);
    const atSurat = levels.find((l) => l.locationId === String(surat._id));
    assert.strictEqual(atSurat.stocked, 25, '20 + 5 more at the primary location');
    const detail = (await get(`/inventory/${shirtItemId}`)).body.item;
    assert.strictEqual(detail.movements[0].type, 'product_edit');
    await assertInvariant('product edit');
  });

  await check('manual reservations hold stock and can be removed; order holds cannot', async () => {
    const tooMany = await post('/reservations', { itemId: shirtItemId, locationId: String(mumbai._id), quantity: 6 });
    assert.strictEqual(tooMany.statusCode, 409);
    assert.match(tooMany.body.message, /Only 5 available/);
    const r = await post('/reservations', { itemId: shirtItemId, locationId: String(mumbai._id), quantity: 2, description: 'Phone order' });
    assert.strictEqual(r.statusCode, 200, JSON.stringify(r.body));
    assert.strictEqual((await Product.findById(shirt._id).lean()).stock, 28);
    assert.strictEqual((await put(`/reservations/${r.body.reservation._id}`, { quantity: 3 })).statusCode, 200);
    assert.strictEqual((await Product.findById(shirt._id).lean()).stock, 27);
    const list = (await get('/reservations?kind=manual')).body;
    assert.strictEqual(list.total, 1);
    assert.strictEqual(list.reservations[0].locationName, 'Mumbai Store');
    assert.strictEqual((await del(`/reservations/${r.body.reservation._id}`)).statusCode, 200);
    assert.strictEqual((await Product.findById(shirt._id).lean()).stock, 30);
    const o = await place([{ productId: shirt._id, quantity: 1 }]);
    const orderHold = await Inv.reservations().findOne({ orderId: String(o.orderId) }).lean();
    assert.strictEqual((await del(`/reservations/${orderHold._id}`)).statusCode, 409);
    await post(`/orders/${o.orderId}/cancel`);
    await assertInvariant('reservations');
  });

  await check('bulk edit updates many levels and reports the ones it could not', async () => {
    const { item: sItem } = await levelsOf(tee._id, String(tee.variants.find((v) => v.size === 'S')._id));
    const r = await post('/inventory/bulk', {
      updates: [
        { itemId: String(sItem._id), locationId: String(surat._id), stocked: 9 },
        { itemId: shirtItemId, locationId: String(mumbai._id), stocked: -1 },
      ],
    });
    assert.strictEqual(r.body.updated, 1);
    assert.strictEqual(r.body.errors.length, 1);
    assert.strictEqual((await Product.findById(tee._id).lean()).variants.find((v) => v.size === 'S').stock, 9);
    await assertInvariant('bulk');
  });

  await check('a location still holding stock cannot be deleted', async () => {
    const r = await del(`/locations/${mumbai._id}`);
    assert.strictEqual(r.statusCode, 409);
    const loc = (await get(`/locations/${mumbai._id}`)).body;
    assert.strictEqual(loc.stock.stocked, 5);
  });

  console.log('\n--> Tracking and backorders');
  await check('backorders can sell past zero; untracked items take no stock', async () => {
    const { item: mItem } = await levelsOf(tee._id, String(teeM._id));
    // Without backorders, 6 of the 4 in stock is refused.
    const refused = await post('/checkout', { items: [{ productId: tee._id, variantId: String(teeM._id), quantity: 6 }], customerDetails: { name: 'B', email: 'b@example.com' }, customerAddress: address });
    assert.strictEqual(refused.statusCode, 409);
    await put(`/inventory/${mItem._id}`, { allowBackorder: true });
    const back = await place([{ productId: tee._id, variantId: String(teeM._id), quantity: 6 }]);
    assert.ok(back.orderId, JSON.stringify(back));
    assert.strictEqual((await Product.findById(tee._id).lean()).variants.find((v) => v.size === 'M').stock, -2);
    await assertInvariant('backorder');
    await post(`/orders/${back.orderId}/cancel`);
    await put(`/inventory/${mItem._id}`, { allowBackorder: false, trackInventory: false });
    const free = await place([{ productId: tee._id, variantId: String(teeM._id), quantity: 50 }]);
    assert.ok(free.orderId, JSON.stringify(free));
    assert.strictEqual((await Product.findById(tee._id).lean()).variants.find((v) => v.size === 'M').stock, 4, 'untracked: nothing taken');
    assert.strictEqual(await Inv.reservations().countDocuments({ orderId: String(free.orderId) }), 0);
    await post(`/orders/${free.orderId}/cancel`);
    assert.strictEqual((await Product.findById(tee._id).lean()).variants.find((v) => v.size === 'M').stock, 4, 'untracked: nothing given back');
    await put(`/inventory/${mItem._id}`, { trackInventory: true });
    await assertInvariant('untracked');
  });

  console.log('\n--> List and details');
  await check('inventory list: totals, filters, summary', async () => {
    const all = (await get('/inventory')).body;
    assert.strictEqual(all.total, 3);
    const shirtRow = all.items.find((i) => i.title === 'Shirt');
    assert.strictEqual(shirtRow.stocked, 30, '25 at Surat + 5 at Mumbai');
    assert.strictEqual(shirtRow.locations, 2);
    assert.strictEqual(shirtRow.productName, 'Shirt');
    assert.strictEqual((await get(`/inventory?locationId=${mumbai._id}`)).body.total, 1);
    assert.strictEqual((await get('/inventory?search=tee')).body.total, 2);
    assert.deepStrictEqual((await get('/inventory?stock=low')).body.items.map((i) => i.title), ['Tee · M'], '4 left, at or under the low-stock level of 5');
    const detail = (await get(`/inventory/${shirtItemId}`)).body.item;
    assert.deepStrictEqual(detail.levels.map((l) => l.locationName), ['Mumbai Store', 'Surat WH']);
    assert.ok(detail.movements.length >= 5);
  });

  await check('item details: attributes save and validate', async () => {
    const bad = await put(`/inventory/${shirtItemId}`, { weight: -2 });
    assert.strictEqual(bad.statusCode, 400);
    const ok = await put(`/inventory/${shirtItemId}`, { weight: 250, hsCode: '6205', originCountry: 'India', requiresShipping: true });
    assert.strictEqual(ok.body.item.hsCode, '6205');
    assert.strictEqual(ok.body.item.weight, 250);
  });

  await check('deleting a product removes its inventory', async () => {
    const lamp = (await post('/products', { name: 'Lamp', price: 900, stock: 2, categoryId: cat._id })).body.product;
    assert.strictEqual(await Inv.items().countDocuments({ productId: String(lamp._id) }), 1);
    await del(`/products/${lamp._id}`);
    assert.strictEqual(await Inv.items().countDocuments({ productId: String(lamp._id) }), 0);
  });

  await check('existing products get inventory on start-up (migration)', async () => {
    const raw = await Product.collection.insertOne({ name: 'Old Mug', price: 100, stock: 7, sku: 'OLD-MUG', slug: 'old-mug', categoryId: new mongoose.Types.ObjectId(cat._id), status: 'Published', tenantId: 'default_tenant' });
    const { InventoryService } = require(path.join(pluginDir, 'api', 'services', 'InventoryService.js'));
    await InventoryService.syncAll();
    const { levels } = await levelsOf(raw.insertedId);
    assert.deepStrictEqual(levels.map((l) => [l.locationId, l.stocked]), [[String(surat._id), 7]]);
    await assertInvariant('migration');
  });

  // Order model is used above; keep a reference so linters don't flag it.
  assert.ok(Order);
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
