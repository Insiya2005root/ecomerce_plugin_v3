// test_products_admin.cjs
// End-to-end checks for the Product Admin API (compiled api/), run against a throwaway MongoDB database.
// Usage: node test_products_admin.cjs   (see test_support/plugin-api-harness.cjs for requirements)
const assert = require('assert');
const path = require('path');
const { mongoose, pluginDir, startPlugin, stopPlugin, createChecker } = require('./test_support/plugin-api-harness.cjs');

const TEST_DB = 'ecommerce_plugin_products_test';
const { check, stats } = createChecker();

async function main() {
  const app = await startPlugin(TEST_DB);
  const { DiscountEngine } = require(path.join(pluginDir, 'api', 'services', 'DiscountEngine.js'));

  const categoryId = new mongoose.Types.ObjectId().toString();
  const otherCategoryId = new mongoose.Types.ObjectId().toString();

  const base = {
    categoryId,
    status: 'Published',
    taxClassId: 'Default',
  };

  console.log('\n--> Create & read');
  let full;
  await check('POST /products persists every Product field', async () => {
    const res = await app.call('POST', '/products', {
      body: {
        ...base,
        name: 'Linen Shirt',
        description: 'Breathable linen',
        price: 1000,
        discountPercentage: 10,
        discountPrice: 850,
        costPrice: 400,
        sku: 'LIN-001',
        barcode: '8901234567890',
        stock: 5,
        images: ['data:image/png;base64,AAAA', 'https://example.com/b.png'],
        videos: ['https://example.com/v.mp4'],
        isDigital: true,
        tags: ['summer', 'linen'],
        metaTitle: 'Linen Shirt | Store',
        metaDescription: 'A linen shirt',
        variants: [
          { size: 'M', color: 'White', stock: 3, sku: 'LIN-001-M', priceOverride: 1100 },
          { size: 'L', color: 'White', stock: 0, sku: 'LIN-001-L' },
        ],
      },
    });
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.success, true);
    full = res.body.product;
    assert.strictEqual(full.discountPercentage, 10);
    assert.deepStrictEqual(full.pricing, { basePrice: 1000, catalogPrice: 900, compareAtPrice: 1000, discountPercentage: 10 });

    const reread = (await app.call('GET', `/products/${full._id}`)).body.product;
    for (const [k, v] of Object.entries({
      name: 'Linen Shirt', description: 'Breathable linen', price: 1000, discountPrice: 850, costPrice: 400,
      sku: 'LIN-001', barcode: '8901234567890', stock: 5, isDigital: true, metaTitle: 'Linen Shirt | Store',
      metaDescription: 'A linen shirt', status: 'Published', taxClassId: 'Default', discountPercentage: 10,
    })) assert.deepStrictEqual(reread[k], v, `field ${k}`);
    assert.deepStrictEqual(reread.tags, ['summer', 'linen']);
    assert.strictEqual(reread.images.length, 2);
    assert.strictEqual(reread.videos.length, 1);
    assert.strictEqual(reread.variants.length, 2);
    assert.strictEqual(reread.variants[0].sku, 'LIN-001-M');
    assert.strictEqual(reread.variants[0].priceOverride, 1100);
    assert.ok(reread.pricing, 'GET /products/:id includes backend pricing');
  });

  await check('POST without SKU auto-generates one (existing behaviour)', async () => {
    const res = await app.call('POST', '/products', { body: { ...base, name: 'Auto SKU', price: 50 } });
    assert.match(res.body.product.sku, /^SKU-\d{6}$/);
  });

  await check('duplicate SKU returns 409 with a readable message', async () => {
    const res = await app.call('POST', '/products', { body: { ...base, name: 'Dup', price: 1, sku: 'LIN-001' } });
    assert.strictEqual(res.statusCode, 409);
    assert.strictEqual(res.body.success, false);
    assert.match(res.body.message, /SKU already exists/);
  });

  await check('missing required fields returns 400 (validation)', async () => {
    const res = await app.call('POST', '/products', { body: { name: 'No price' } });
    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.body.success, false);
  });

  console.log('\n--> Listing: filters, sorting, pagination');
  const seed = [
    { name: 'apple (Red)', price: 30, stock: 9, status: 'Draft', categoryId: otherCategoryId },
    { name: 'Banana', price: 10, stock: 1, status: 'Archived' },
    { name: 'cherry C++', price: 20, stock: 4, status: 'Published' },
  ];
  for (const s of seed) {
    const r = await app.call('POST', '/products', { body: { ...base, ...s } });
    assert.strictEqual(r.statusCode, 200, r.body && r.body.message);
  }

  await check('default response shape and newest-first order are unchanged', async () => {
    const res = await app.call('GET', '/products');
    assert.deepStrictEqual(Object.keys(res.body).sort(), ['limit', 'page', 'products', 'success', 'total']);
    assert.strictEqual(res.body.page, 1);
    assert.strictEqual(res.body.limit, 20);
    assert.strictEqual(res.body.total, 5);
    assert.strictEqual(res.body.products[0].name, 'cherry C++');
    assert.ok(res.body.products.every((p) => p.pricing && typeof p.discountPercentage === 'number'));
  });

  await check('status filter (NEW) and invalid status is ignored', async () => {
    const drafts = await app.call('GET', '/products?status=Draft');
    assert.deepStrictEqual(drafts.body.products.map((p) => p.name), ['apple (Red)']);
    assert.strictEqual(drafts.body.total, 1);
    const bogus = await app.call('GET', '/products?status=Deleted');
    assert.strictEqual(bogus.body.total, 5);
  });

  await check('categoryId filter still works', async () => {
    const res = await app.call('GET', `/products?categoryId=${otherCategoryId}`);
    assert.deepStrictEqual(res.body.products.map((p) => p.name), ['apple (Red)']);
  });

  await check('sorting (NEW): name case-insensitive, price, stock; unknown field falls back', async () => {
    const byName = await app.call('GET', '/products?sort=name&order=asc');
    assert.deepStrictEqual(byName.body.products.map((p) => p.name), ['apple (Red)', 'Auto SKU', 'Banana', 'cherry C++', 'Linen Shirt']);
    const byPrice = await app.call('GET', '/products?sort=price&order=desc');
    assert.deepStrictEqual(byPrice.body.products.map((p) => p.price), [1000, 50, 30, 20, 10]);
    const byStock = await app.call('GET', '/products?sort=stock&order=asc');
    assert.deepStrictEqual(byStock.body.products.map((p) => p.stock), [0, 1, 4, 5, 9]);
    const fallback = await app.call('GET', '/products?sort=costPrice;drop&order=sideways');
    assert.strictEqual(fallback.statusCode, 200);
    assert.strictEqual(fallback.body.products[0].name, 'cherry C++');
  });

  await check('search escapes regex characters (previously a 500)', async () => {
    const plus = await app.call('GET', '/products?search=C%2B%2B');
    assert.strictEqual(plus.statusCode, 200);
    assert.deepStrictEqual(plus.body.products.map((p) => p.name), ['cherry C++']);
    const paren = await app.call('GET', '/products?search=(red');
    assert.deepStrictEqual(paren.body.products.map((p) => p.name), ['apple (Red)']);
    const sku = await app.call('GET', '/products?search=lin-001');
    assert.deepStrictEqual(sku.body.products.map((p) => p.name), ['Linen Shirt']);
  });

  await check('pagination: page/limit, malformed values fall back to defaults', async () => {
    const p2 = await app.call('GET', '/products?sort=name&order=asc&page=2&limit=2');
    assert.deepStrictEqual(p2.body.products.map((p) => p.name), ['Banana', 'cherry C++']);
    assert.strictEqual(p2.body.total, 5);
    const bad = await app.call('GET', '/products?page=abc&limit=-3');
    assert.strictEqual(bad.statusCode, 200);
    assert.strictEqual(bad.body.page, 1);
    assert.strictEqual(bad.body.limit, 20);
  });

  await check('ids= lookup (ProductPicker) ignores pagination as before', async () => {
    const all = (await app.call('GET', '/products?limit=100')).body.products;
    const ids = all.map((p) => p._id).join(',');
    const res = await app.call('GET', `/products?ids=${ids}&limit=1`);
    assert.strictEqual(res.body.products.length, 5);
  });

  console.log('\n--> Update (drawers send partial payloads)');
  await check('partial PUT {status} keeps every other field, incl. discountPercentage', async () => {
    const res = await app.call('PUT', `/products/${full._id}`, { body: { status: 'Draft' } });
    assert.strictEqual(res.statusCode, 200);
    const p = res.body.product;
    assert.strictEqual(p.status, 'Draft');
    assert.strictEqual(p.discountPercentage, 10);
    assert.strictEqual(p.price, 1000);
    assert.strictEqual(p.variants.length, 2);
    assert.deepStrictEqual(p.tags, ['summer', 'linen']);
  });

  await check('editing variants with _id preserves variant ids (cart variantId references)', async () => {
    const before = (await app.call('GET', `/products/${full._id}`)).body.product;
    const kept = before.variants[0];
    const res = await app.call('PUT', `/products/${full._id}`, {
      body: { variants: [{ ...kept, _id: String(kept._id), stock: 7 }] },
    });
    assert.strictEqual(res.body.product.variants.length, 1);
    assert.strictEqual(String(res.body.product.variants[0]._id), String(kept._id));
    assert.strictEqual(res.body.product.variants[0].stock, 7);
  });

  await check('variants: [] clears all variants (Admin now always sends the array)', async () => {
    const res = await app.call('PUT', `/products/${full._id}`, { body: { variants: [] } });
    assert.strictEqual(res.body.product.variants.length, 0);
  });

  await check('pricing section: clearing sale/cost with null, discount precedence', async () => {
    let p = (await app.call('PUT', `/products/${full._id}`, { body: { price: 1000, discountPercentage: 0, discountPrice: 800, costPrice: null } })).body.product;
    assert.strictEqual(p.discountPercentage, 0);
    assert.deepStrictEqual(p.pricing, { basePrice: 1000, catalogPrice: 800, compareAtPrice: 1000, discountPercentage: 0 });
    assert.strictEqual(p.costPrice, null);
    p = (await app.call('PUT', `/products/${full._id}`, { body: { discountPercentage: 25 } })).body.product;
    assert.strictEqual(p.pricing.catalogPrice, 750, 'discount % takes priority over sale price');
    p = (await app.call('PUT', `/products/${full._id}`, { body: { discountPercentage: 0, discountPrice: null } })).body.product;
    assert.deepStrictEqual(p.pricing, { basePrice: 1000, catalogPrice: 1000, compareAtPrice: null, discountPercentage: 0 });
  });

  await check('Admin pricing equals DiscountEngine output used by cart/storefront', async () => {
    await app.call('PUT', `/products/${full._id}`, { body: { discountPercentage: 12.5, status: 'Published' } });
    const p = (await app.call('GET', `/products/${full._id}`)).body.product;
    assert.deepStrictEqual(p.pricing, DiscountEngine.resolveCatalogProductPricing(p, p.discountPercentage));
  });

  await check('PUT unknown id returns 404; malformed id returns 400', async () => {
    const missing = await app.call('PUT', `/products/${new mongoose.Types.ObjectId()}`, { body: { status: 'Draft' } });
    assert.strictEqual(missing.statusCode, 404);
    const bad = await app.call('GET', '/products/not-an-id');
    assert.strictEqual(bad.statusCode, 400);
  });

  await check('duplicate SKU on update returns 409', async () => {
    const other = (await app.call('GET', '/products?search=Banana')).body.products[0];
    const res = await app.call('PUT', `/products/${other._id}`, { body: { sku: 'LIN-001' } });
    assert.strictEqual(res.statusCode, 409);
  });

  console.log('\n--> Regression: cart and storefront consume the edited product');
  await check('cart/calculate prices the product with the same catalog price', async () => {
    const p = (await app.call('GET', `/products/${full._id}`)).body.product;
    const res = await app.call('POST', '/cart/calculate', { body: { items: [{ productId: String(p._id), quantity: 2 }] }, user: null });
    assert.strictEqual(res.body.success, true, JSON.stringify(res.body));
    const line = (res.body.items || res.body.cartItems || []).find((i) => String(i.productId) === String(p._id));
    assert.ok(line, 'line item present');
    assert.strictEqual(line.price, p.pricing.catalogPrice);
  });

  await check('storefront DTO still hides admin-only fields and exposes tags', async () => {
    const res = await app.call('GET', `/storefront/products/${full._id}`, { user: null });
    assert.strictEqual(res.statusCode, 200, JSON.stringify(res.body));
    const dto = res.body.product || res.body.data || res.body;
    assert.deepStrictEqual(dto.tags, ['summer', 'linen']);
    for (const hidden of ['costPrice', 'barcode', 'taxClassId', 'isTaxable', 'tenantId']) {
      assert.ok(!(hidden in dto), `${hidden} must stay hidden from storefront`);
    }
  });

  await check('DELETE removes the product', async () => {
    const res = await app.call('DELETE', `/products/${full._id}`);
    assert.strictEqual(res.body.success, true);
    const gone = await app.call('GET', `/products/${full._id}`);
    assert.strictEqual(gone.body.product, null);
  });

  console.log(`
${stats.passed} Product Admin API checks passed${stats.failed ? `, ${stats.failed} failed` : ""}.`);
  if (stats.failed) process.exitCode = 1;
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(stopPlugin);
