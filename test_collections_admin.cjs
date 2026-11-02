// test_collections_admin.cjs
// API checks for Collections, product import and the Category safety fixes (compiled api/), on a throwaway database.
// Usage: node test_collections_admin.cjs   (see test_support/plugin-api-harness.cjs for requirements)
const assert = require('assert');
const { mongoose, startPlugin, stopPlugin, createChecker } = require('./test_support/plugin-api-harness.cjs');

const TEST_DB = 'ecommerce_plugin_collections_test';
const { check, stats } = createChecker();

async function main() {
  const app = await startPlugin(TEST_DB);
  const post = (url, body) => app.call('POST', url, { body });
  const put = (url, body) => app.call('PUT', url, { body });
  const get = (url) => app.call('GET', url);

  const apparel = (await post('/categories', { name: 'Apparel', slug: 'apparel' })).body.category;
  const shirts = (await post('/categories', { name: 'Shirts', slug: 'shirts', parentId: apparel._id })).body.category;
  const home = (await post('/categories', { name: 'Home', slug: 'home' })).body.category;
  const mkProduct = async (name, extra = {}) =>
    (await post('/products', { name, price: 100, categoryId: shirts._id, ...extra })).body.product;

  console.log('\n--> Collections CRUD');
  let summer;
  await check('create collection derives the handle from the title', async () => {
    const res = await post('/collections', { title: 'Summer 2026', description: 'Light fabrics' });
    assert.strictEqual(res.statusCode, 200, JSON.stringify(res.body));
    summer = res.body.collection;
    assert.strictEqual(summer.handle, 'summer-2026');
    assert.strictEqual(summer.productCount, 0);
  });

  await check('title is required; duplicate handle returns 409', async () => {
    assert.strictEqual((await post('/collections', { title: '  ' })).statusCode, 400);
    const dup = await post('/collections', { title: 'Another', handle: 'Summer 2026' });
    assert.strictEqual(dup.statusCode, 409);
    assert.match(dup.body.message, /handle already exists/);
  });

  await check('update title/handle/description; unknown id is 404', async () => {
    const res = await put(`/collections/${summer._id}`, { title: 'Summer Edit', handle: 'summer-edit', description: 'Updated' });
    assert.strictEqual(res.body.collection.title, 'Summer Edit');
    assert.strictEqual(res.body.collection.handle, 'summer-edit');
    assert.strictEqual((await put(`/collections/${new mongoose.Types.ObjectId()}`, { title: 'x' })).statusCode, 404);
  });

  await check('list is sorted by title, searchable, with product counts', async () => {
    await post('/collections', { title: 'autumn picks' });
    await post('/collections', { title: 'Basics' });
    const all = await get('/collections');
    assert.deepStrictEqual(all.body.collections.map((c) => c.title), ['autumn picks', 'Basics', 'Summer Edit']);
    const found = await get('/collections?search=summ');
    assert.deepStrictEqual(found.body.collections.map((c) => c.title), ['Summer Edit']);
  });

  console.log('\n--> Products in collections');
  const p1 = await mkProduct('Linen Shirt');
  const p2 = await mkProduct('Cotton Tee');
  const p3 = await mkProduct('Ceramic Mug', { categoryId: home._id });
  const basics = (await get('/collections?search=basics')).body.collections[0];

  await check('add products to a collection; counts and products?collectionId filter', async () => {
    const res = await post(`/collections/${summer._id}/products`, { add: [p1._id, p2._id, 'not-an-id'] });
    assert.strictEqual(res.body.added, 2);
    assert.strictEqual(res.body.productCount, 2);
    const list = await get(`/products?collectionId=${summer._id}&sort=name&order=asc`);
    assert.deepStrictEqual(list.body.products.map((p) => p.name), ['Cotton Tee', 'Linen Shirt']);
    assert.strictEqual((await get(`/collections/${summer._id}`)).body.collection.productCount, 2);
  });

  await check('a product belongs to one collection: adding elsewhere moves it', async () => {
    await post(`/collections/${basics._id}/products`, { add: [p2._id] });
    const p = (await get(`/products/${p2._id}`)).body.product;
    assert.strictEqual(String(p.collectionId), String(basics._id));
    assert.strictEqual((await get(`/collections/${summer._id}`)).body.collection.productCount, 1);
  });

  await check('product PUT can set and clear collectionId (product drawer)', async () => {
    let p = (await put(`/products/${p3._id}`, { collectionId: summer._id })).body.product;
    assert.strictEqual(String(p.collectionId), String(summer._id));
    p = (await put(`/products/${p3._id}`, { collectionId: null })).body.product;
    assert.ok(!p.collectionId);
  });

  await check('remove only detaches products that are in this collection', async () => {
    const res = await post(`/collections/${summer._id}/products`, { remove: [p1._id, p2._id] });
    assert.strictEqual(res.body.removed, 1, 'p2 is in Basics and must not be detached');
    assert.strictEqual(String((await get(`/products/${p2._id}`)).body.product.collectionId), String(basics._id));
  });

  await check('deleting a collection detaches (not deletes) its products', async () => {
    const res = await app.call('DELETE', `/collections/${basics._id}`);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.detachedProducts, 1);
    const p = (await get(`/products/${p2._id}`)).body.product;
    assert.ok(p, 'product still exists');
    assert.ok(!p.collectionId);
    assert.strictEqual((await get(`/collections/${basics._id}`)).statusCode, 404);
  });

  console.log('\n--> Import');
  await mkProduct('Existing', { sku: 'EXIST-1', stock: 3, description: 'keep me' });
  const rows = [
    { Name: 'Imported Tee', SKU: 'IMP-1', Price: '₹1,299.50', Category: 'Apparel > Shirts', Collection: 'summer-edit', Status: 'draft', Tags: 'cotton|summer', Digital: 'no', Stock: '5' },
    { Name: 'Imported Mug', Price: '250', Category: 'home', 'Tax class': 'Non-taxable', 'Discount %': '10' },
    { SKU: 'EXIST-1', Stock: '42', 'Sale price': '80' },
    { Name: 'Bad Row', Price: '-5', Category: 'Nowhere', Status: 'Live', 'Image URLs': 'data:image/png;base64,AA' },
    { Name: 'Dup SKU', SKU: 'IMP-1', Price: '10', Category: 'Home' },
    { Name: 'No category', Price: '10' },
  ];

  await check('dry run validates and plans without writing', async () => {
    const before = (await get('/products?limit=100')).body.total;
    const res = await post('/products/import', { rows });
    assert.strictEqual(res.body.dryRun, true);
    assert.deepStrictEqual(res.body.summary, { create: 2, update: 1, error: 3 });
    const bad = res.body.results[3];
    assert.strictEqual(bad.action, 'error');
    assert.strictEqual(bad.errors.length, 4, bad.errors.join(' | '));
    assert.match(res.body.results[4].errors[0], /more than once/);
    assert.match(res.body.results[5].errors[0], /Category is required/);
    assert.strictEqual((await get('/products?limit=100')).body.total, before, 'dry run must not write');
  });

  await check('import writes valid rows, resolves names, keeps blanks unchanged on update', async () => {
    const res = await post('/products/import', { rows, dryRun: false });
    assert.deepStrictEqual(res.body.summary, { create: 2, update: 1, error: 3 });
    const tee = (await get('/products?search=IMP-1')).body.products[0];
    assert.strictEqual(tee.price, 1299.5);
    assert.strictEqual(tee.status, 'Draft');
    assert.strictEqual(String(tee.categoryId), String(shirts._id));
    assert.strictEqual(String(tee.collectionId), String(summer._id));
    assert.deepStrictEqual(tee.tags, ['cotton', 'summer']);
    const mug = (await get('/products?search=Imported Mug')).body.products[0];
    assert.strictEqual(mug.taxClassId, 'NonTaxable');
    assert.strictEqual(mug.discountPercentage, 10);
    assert.match(mug.sku, /^SKU-\d{6}$/, 'blank SKU is generated');
    const existing = (await get('/products?search=EXIST-1')).body.products[0];
    assert.strictEqual(existing.stock, 42);
    assert.strictEqual(existing.discountPrice, 80);
    assert.strictEqual(existing.name, 'Existing', 'blank name kept');
    assert.strictEqual(existing.description, 'keep me', 'missing column kept');
  });

  await check('ambiguous category names require the full path; empty and oversized files are rejected', async () => {
    await post('/categories', { name: 'Shirts', slug: 'home-shirts', parentId: home._id });
    const res = await post('/products/import', { rows: [{ Name: 'X', Price: '1', Category: 'Shirts' }] });
    assert.match(res.body.results[0].errors[0], /ambiguous/);
    assert.strictEqual((await post('/products/import', { rows: [] })).statusCode, 400);
    assert.strictEqual((await post('/products/import', { rows: Array.from({ length: 1001 }, () => ({})) })).statusCode, 400);
  });

  console.log('\n--> Categories');
  await check('category cannot be moved under itself or a descendant', async () => {
    const self = await put(`/categories/${apparel._id}`, { parentId: apparel._id });
    assert.strictEqual(self.statusCode, 400);
    const child = await put(`/categories/${apparel._id}`, { parentId: shirts._id });
    assert.strictEqual(child.statusCode, 400);
    assert.match(child.body.message, /inside itself/);
    const ok = await put(`/categories/${shirts._id}`, { parentId: home._id, name: 'Shirts' });
    assert.strictEqual(ok.statusCode, 200);
    await put(`/categories/${shirts._id}`, { parentId: apparel._id });
  });

  await check('duplicate category handle returns 409; delete still blocks while in use', async () => {
    const dup = await post('/categories', { name: 'Again', slug: 'apparel' });
    assert.strictEqual(dup.statusCode, 409);
    const blocked = await app.call('DELETE', `/categories/${apparel._id}`);
    assert.strictEqual(blocked.body.success, false);
    assert.match(blocked.body.message, /subcategorie/);
  });

  console.log(`\n${stats.passed} Collections / Import / Category checks passed${stats.failed ? `, ${stats.failed} failed` : ''}.`);
  if (stats.failed) process.exitCode = 1;
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(stopPlugin);
