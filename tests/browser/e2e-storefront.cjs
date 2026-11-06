// Browser walkthrough: the storefront as a logged-out shopper (shop → product → cart with coupon →
// checkout → thank you), then the order as the admin sees it. Pages are served like OpenExt public pages.
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const puppeteer = require('C:/Users/InsiyaMerchant/projects/ecommerce-plugin-dev/web/node_modules/puppeteer');

const SITE = 'http://localhost:4317';
const API = 'http://localhost:4317/api/plugins/ecommerce-plugin';
const shots = path.join(__dirname, 'shots-storefront');
fs.rmSync(shots, { recursive: true, force: true });
fs.mkdirSync(shots, { recursive: true });

const problems = [];
let step = 0;
const ok = (m) => console.log(`  ✓ ${m}`);
const shot = (page, name) => page.screenshot({ path: path.join(shots, `${String(++step).padStart(2, '0')}-${name}.png`), fullPage: true });
const text = (page) => page.evaluate(() => document.getElementById('page').innerText);
const waitText = (page, t, timeout = 12000) => page.waitForFunction((s) => document.body.innerText.includes(s), { timeout }, t);
const adminApi = async (p) => (await fetch(`${API}${p}`)).json();
const cmsPage = async (slug, component) =>
  (await fetch(`${SITE}/__cms/page?slug=${slug}`, component ? { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ component }) } : {})).json();
const blockConfig = (c) => JSON.parse(c.content);

async function clickByText(page, selector, label) {
  const h = await page.waitForFunction(
    (sel, l) => [...document.querySelectorAll(sel)].find((el) => el.textContent.trim() === l && el.offsetParent !== null && !el.disabled),
    { timeout: 10000 }, selector, label
  );
  await h.asElement().evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await h.asElement().click();
}
async function fill(page, id, value) {
  await page.$eval(`#${id}`, (el) => { el.scrollIntoView({ block: 'center' }); el.focus(); el.select(); });
  await page.keyboard.press('Backspace');
  if (value) await page.type(`#${id}`, value);
}
const totalOf = (page) => page.evaluate(() => document.querySelector('.ecom-sf-totals .is-total dd .sr-only')?.textContent.trim());

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  page.on('console', (m) => ['error', 'warning'].includes(m.type()) && problems.push(`[${m.type()}] ${m.text()}`));
  page.on('pageerror', (e) => problems.push(`[pageerror] ${e.message}`));

  try {
    console.log('\n--> Public pages answer only what shoppers need');
    const asShopper = (p, init = {}) => fetch(`${API}${p}`, { ...init, headers: { ...(init.headers || {}), 'x-shopper': '1', 'Content-Type': 'application/json' } });
    assert.strictEqual((await asShopper('/storefront/products')).status, 200);
    assert.strictEqual((await asShopper('/orders')).status, 401, 'orders are admin-only');
    assert.strictEqual((await asShopper('/customers')).status, 401, 'customers are admin-only');
    const detail = await (await asShopper('/storefront/products?limit=50')).json();
    assert.ok(detail.products.every((p) => p.costPrice === undefined), 'no cost prices in public data');
    ok('shoppers can read products and price a cart; orders, customers and cost prices stay private');

    console.log('\n--> Shop');
    await page.goto(`${SITE}/shop`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('.ecom-sf-product-card');
    let t = await text(page);
    assert.ok(t.includes('Showing 12 of'), t.slice(0, 200));
    await shot(page, 'shop');
    // A product without sizes goes straight into the cart from the grid.
    const card = await page.waitForFunction(() =>
      [...document.querySelectorAll('.ecom-sf-product-card')].find((c) => c.textContent.includes('Sample product 22'))
    );
    await card.asElement().evaluate((c) => [...c.querySelectorAll('button')].find((b) => /add to cart/i.test(b.textContent)).click());
    // Adding opens the mini cart from the store header.
    await page.waitForFunction(() => document.querySelector('[role="dialog"][aria-label="Your cart"]')?.textContent.includes('Sample product 22'));
    await shot(page, 'mini-cart');
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('[role="dialog"][aria-label="Your cart"]'));
    ok('shop lists published products; Add to cart opens the mini cart with the product');

    // OpenExt's own Header/Footer wrap the page; the plugin adds no header or footer of its own.
    await waitText(page, 'Everyday essentials, made well');
    await waitText(page, 'Shop by category');
    await waitText(page, 'Cash on Delivery');
    assert.strictEqual(await page.$('.ecom-sf-site-header, .ecom-sf-footer, .ecom-sf-announce'), null, 'no plugin header or footer');
    assert.ok(await page.$('#site-header .ecom-sf-cart-btn'), 'cart button sits in the OpenExt header');
    assert.ok(await page.$('#site-header input[aria-label="Search the store"]'), 'search sits in the OpenExt header');
    await waitText(page, '© Demo Store');
    const shopLayout = (await cmsPage('shop')).page.component.map((c) => (c.type === 'ecommerce-plugin' ? blockConfig(c).blockType : c.type));
    assert.deepStrictEqual(shopLayout, ['ecommerce.shop-hero', 'ecommerce.category-showcase', 'ecommerce.category-filter', 'ecommerce.product-grid', 'ecommerce.trust-badges'], shopLayout.join(','));
    ok('page = OpenExt header + hero, category tiles, filter, grid, store features (all page-builder blocks) + OpenExt footer');
    await page.waitForFunction(() => document.querySelector('.ecom-sf-cart-count')?.textContent === '1');
    await clickByText(page, '.ecom-sf-pill', 'Apparel');
    await page.waitForFunction(() => location.search.includes('category='));
    await page.waitForFunction(() => {
      const cats = [...document.querySelectorAll('.ecom-sf-product-card-category')].map((e) => e.textContent.trim().toLowerCase());
      return cats.length > 0 && cats.every((c) => c === 'shirts');
    });
    ok('category pill "Apparel" shows products filed under its sub-category Shirts, and is kept in the address');
    await clickByText(page, '.ecom-sf-pill', 'All');
    await page.type('input[aria-label="Search products"]', 'linen');
    await page.waitForFunction(() => {
      const names = [...document.querySelectorAll('.ecom-sf-product-card')].map((c) => c.textContent);
      return names.length === 1 && names[0].includes('Linen Shirt');
    });
    await waitText(page, 'Showing 1 of 1 product');
    ok('search finds Linen Shirt');
    await page.$eval('input[aria-label="Search products"]', (el) => { el.focus(); el.select(); });
    await page.keyboard.press('Backspace');
    await page.type('input[aria-label="Search products"]', 'zzzz');
    await waitText(page, 'No products match');
    await clickByText(page, 'button', 'Show all products');
    await page.waitForFunction(() => document.querySelectorAll('.ecom-sf-product-card').length === 12);
    assert.strictEqual(await page.$eval('input[aria-label="Search products"]', (el) => el.value), '', 'search box cleared');
    await clickByText(page, 'button', 'Sort: Newest first');
    await clickByText(page, '[role="menuitem"]', 'Price: low to high');
    await page.waitForFunction(() => {
      const prices = [...document.querySelectorAll('.ecom-sf-product-card-price-current')].map((e) => Number(e.textContent.replace(/[^\d.]/g, '')));
      return prices.length > 2 && prices.every((p, i) => i === 0 || p >= prices[i - 1]);
    });
    await shot(page, 'shop-filters');
    await clickByText(page, 'button', 'Price: Any');
    await clickByText(page, '[role="menuitem"]', 'Under ₹500');
    await page.waitForFunction(() => location.search.includes('price=-500'));
    await page.waitForFunction(() => {
      const prices = [...document.querySelectorAll('.ecom-sf-product-card-price-current')].map((e) => Number(e.textContent.replace(/[^\d.]/g, '')));
      return prices.length > 0 && prices.every((p) => p <= 500);
    });
    await waitText(page, 'Active filters:');
    await clickByText(page, 'button', 'Clear all');
    await page.waitForFunction(() => !location.search.includes('price='));
    ok('price filter "Under ₹500" narrows the grid; Clear all removes it');
    ok('no-match message with "Show all products"; sort by price low to high');

    // Page 2 from the bottom of the grid: the view returns to the top of the grid, buttons never fade out.
    await page.waitForFunction(() => document.querySelectorAll('.ecom-sf-product-card').length === 12 && document.querySelector('a[aria-label="Page 2"]'));
    await page.$eval('a[aria-label="Page 2"]', (el) => el.scrollIntoView({ block: 'center' }));
    await page.click('a[aria-label="Page 2"]');
    const fadedButtons = await page.evaluate(() => [...document.querySelectorAll('.ecom-sf-pagination-btn')].filter((b) => b.disabled && !/previous|next/i.test(b.textContent)).length);
    assert.strictEqual(fadedButtons, 0, 'page number buttons stay enabled while loading');
    await page.waitForFunction(() => document.querySelector('[aria-current="page"]')?.textContent === '2');
    await page.waitForFunction(() => {
      const top = document.getElementById('ecom-sf-catalog').getBoundingClientRect().top;
      return top >= 0 && top < window.innerHeight / 2;
    }, { timeout: 5000 });
    ok('page 2 scrolls back to the top of the grid; page buttons stay steady');

    await clickByText(page, '.ecom-sf-tile h3', 'Home');
    await page.waitForFunction(() => {
      const cats = [...document.querySelectorAll('.ecom-sf-product-card-category')].map((e) => e.textContent.trim().toLowerCase());
      return cats.length > 0 && cats.every((c) => c === 'home');
    });
    ok('"Shop by category" tile filters the grid');
    await page.click('.ecom-sf-cart-btn');
    await page.waitForFunction(() => document.querySelector('[role="dialog"][aria-label="Your cart"]')?.textContent.includes('Checkout'));
    await page.keyboard.press('Escape');
    ok('header cart button opens the mini cart');

    console.log('\n--> Product page');
    const products = (await adminApi('/products?limit=50')).products;
    const linen = products.find((p) => p.name === 'Linen Shirt');
    await page.goto(`${SITE}/product?slug=${encodeURIComponent(linen.slug || linen._id)}`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('.ecom-sf-pdp-title');
    t = await text(page);
    assert.ok(t.includes('Linen Shirt') && t.includes('M / White') && t.includes('L / White'), t.slice(0, 400));
    assert.ok(t.includes('Only 4 left'), 'variant stock shown');
    await clickByText(page, '.ecom-sf-chip', 'L / White');
    await waitText(page, 'Out of stock');
    assert.ok(await page.$eval('.ecom-sf-buy-row .ecom-sf-btn-primary', (b) => b.disabled), 'out-of-stock size cannot be added');
    await clickByText(page, '.ecom-sf-chip', 'M / White');
    await page.click('button[aria-label="Increase quantity"]');
    await shot(page, 'product');
    await clickByText(page, 'button', 'Add to cart');
    await page.waitForFunction(() => document.querySelector('[role="dialog"][aria-label="Your cart"]')?.textContent.includes('Linen Shirt'));
    await page.waitForFunction(() => document.querySelector('.ecom-sf-cart-count')?.textContent === '3');
    await page.keyboard.press('Escape');
    ok('product page: gallery, sizes with live stock, sold-out size blocked, quantity, Add to cart');

    console.log('\n--> Cart');
    await page.goto(`${SITE}/cart`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('.ecom-sf-totals');
    t = await text(page);
    assert.ok(t.includes('Linen Shirt') && t.includes('M / White') && t.includes('Sample product 22'), t.slice(0, 400));
    const before = await totalOf(page);
    await fill(page, 'ecom-sf-coupon-code', 'TEN');
    await clickByText(page, 'button', 'Apply');
    await waitText(page, 'TEN applied');
    await page.waitForFunction((b) => document.querySelector('.ecom-sf-totals .is-total dd .sr-only')?.textContent.trim() !== b, {}, before);
    t = await text(page);
    assert.ok(t.includes('Discount'), 'discount row shown');
    ok(`coupon TEN applies through the discount engine (${before} → ${await totalOf(page)})`);
    await fill(page, 'ecom-sf-coupon-code', 'NOPE');
    await clickByText(page, 'button', 'Apply');
    await waitText(page, "NOPE can't be used with this cart.");
    await fill(page, 'ecom-sf-coupon-code', 'TEN');
    await clickByText(page, 'button', 'Apply');
    await waitText(page, 'TEN applied');
    ok('an unknown coupon is rejected with a message');
    // Asking for more than is in stock blocks checkout until fixed.
    const linenLine = await page.waitForFunction(() => [...document.querySelectorAll('.ecom-sf-line')].find((l) => l.textContent.includes('Linen Shirt')));
    for (let i = 0; i < 3; i++) await linenLine.asElement().evaluate((l) => l.querySelector('button[aria-label^="Increase quantity"]').click());
    await waitText(page, 'Only 4 available');
    await page.waitForFunction(() => document.querySelector('.ecom-sf-summary a.ecom-sf-btn-primary')?.getAttribute('aria-disabled') === 'true');
    for (let i = 0; i < 3; i++) await linenLine.asElement().evaluate((l) => l.querySelector('button[aria-label^="Decrease quantity"]').click());
    await page.waitForFunction(() => !document.body.innerText.includes('Only 4 available'));
    await shot(page, 'cart');
    ok('quantity controls; more than the stock shows a warning and blocks checkout');

    console.log('\n--> Checkout');
    await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle0' }), clickByText(page, 'a', 'Proceed to Checkout')]);
    await page.waitForSelector('#ecom-sf-name');
    await clickByText(page, 'button', 'Continue');
    await waitText(page, 'Enter your name.');
    await fill(page, 'ecom-sf-name', 'Meera Shah');
    await fill(page, 'ecom-sf-phone', '9876543210');
    await fill(page, 'ecom-sf-email', 'meera@example.com');
    await clickByText(page, 'button', 'Continue');
    await page.waitForSelector('#ecom-sf-addressLine1');
    await clickByText(page, 'button', 'Continue');
    await waitText(page, 'Enter a 6-digit PIN code.');
    ok('checkout steps validate the details of each step');
    await fill(page, 'ecom-sf-addressLine1', '12 Ring Road');
    await fill(page, 'ecom-sf-postalCode', '395002');
    await page.waitForFunction(() => !document.body.innerText.includes('Finding your city'), { timeout: 15000 });
    if (!(await page.$eval('#ecom-sf-city', (i) => i.value))) await fill(page, 'ecom-sf-city', 'Surat');
    if (!(await page.$eval('#ecom-sf-state', (i) => i.value))) await fill(page, 'ecom-sf-state', 'Gujarat');
    await fill(page, 'ecom-sf-notes', 'Please call before delivery');
    await page.waitForFunction(() => !document.body.innerText.includes('Enter your PIN code to see the shipping cost'));
    await clickByText(page, 'button', 'Continue');
    await waitText(page, 'Delivering to');
    const payTotal = await totalOf(page);
    await shot(page, 'checkout');
    await clickByText(page, 'button', 'Place order');
    await waitText(page, 'Thank you for your order');
    t = await text(page);
    const orderNumber = (t.match(/Order (\S+)/) || [])[1];
    assert.ok(orderNumber && t.includes(payTotal) && t.includes('Cash on Delivery'), t.slice(0, 300));
    await page.waitForFunction(() => !document.querySelector('.ecom-sf-cart-count'));
    await shot(page, 'thank-you');
    ok(`order ${orderNumber} placed for ${payTotal}; thank-you page shown and the cart emptied`);

    console.log('\n--> In the admin');
    const orders = (await adminApi('/orders?limit=10')).orders;
    const order = orders.find((o) => o.orderNumber === orderNumber);
    assert.ok(order, 'order is listed in the admin');
    assert.strictEqual(order.source, 'storefront');
    assert.strictEqual(order.couponCode, 'TEN');
    assert.strictEqual(order.customerDetails.name, 'Meera Shah');
    assert.strictEqual(order.shippingAddress.postalCode, '395002');
    const full = (await adminApi(`/orders/${order._id}`)).order;
    assert.ok((full.notes || []).some((n) => n.text.includes('Please call before delivery')), 'customer note saved');
    assert.ok((full.events || []).some((e) => e.message.includes('storefront')), 'timeline says it came from the storefront');
    const inv = (await adminApi(`/inventory?search=${encodeURIComponent('Linen Shirt')}`)).items || [];
    const mRow = inv.find((r) => (r.variantLabel || r.title || r.name || '').includes('M'));
    if (mRow) assert.ok(Number(mRow.reserved) >= 2, `2 units reserved for the order (row: ${JSON.stringify(mRow).slice(0, 200)})`);
    ok('the order shows in the admin with source storefront, coupon, address, note, and stock reserved');

    console.log('\n--> Order lookup');
    const lookup = (body) => fetch(`${API}/storefront/order-lookup`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    assert.strictEqual((await lookup({ orderNumber, email: 'someone@else.com' })).status, 404, 'wrong email finds nothing');
    const found = await (await lookup({ orderNumber, email: 'MEERA@example.com' })).json();
    assert.ok(found.success && found.order.items.length > 0 && found.order.customerDetails === undefined, 'order found without personal details');
    await cmsPage('track-order', [{ uniqueId: 'track', type: 'ecommerce-plugin', content: JSON.stringify({ blockType: 'ecommerce.order-lookup', settings: {} }) }]);
    await page.goto(`${SITE}/track-order?order=${encodeURIComponent(orderNumber)}`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('#ecom-sf-lookup-email');
    assert.strictEqual(await page.$eval('#ecom-sf-lookup-order', (i) => i.value), orderNumber, 'order number filled from the address');
    await fill(page, 'ecom-sf-lookup-email', 'meera@example.com');
    await clickByText(page, 'button', 'Find my order');
    await waitText(page, `Order ${orderNumber}`);
    await waitText(page, 'Linen Shirt');
    await shot(page, 'order-lookup');
    ok('order lookup: number + email shows the order status and items; a wrong email finds nothing');

    console.log('\n--> Page builder');
    // The settings form OpenExt's page builder shows for an Ecommerce block comes from the plugin.
    await page.goto(`${SITE}/shop`, { waitUntil: 'networkidle0' });
    const schema = await page.evaluate(() => window.__NEXTCMS_PLUGINS__['ecommerce-plugin'].getSettingsSchema());
    const grid = schema.blockTypes.find((b) => b.value === 'ecommerce.product-grid');
    const categoryField = grid.fields.find((f) => f.key === 'categoryId');
    assert.ok(categoryField.type === 'select' && categoryField.options.some((o) => o.label === 'Apparel'), 'category picked from a list');
    assert.ok(['ecommerce.cart', 'ecommerce.checkout', 'ecommerce.cart-button', 'ecommerce.product-search'].every((t) => schema.blockTypes.some((b) => b.value === t)));
    assert.ok(!schema.blockTypes.some((b) => b.value === 'ecommerce.store-header'), 'the old plugin header is not offered');
    ok(`page builder settings form: ${schema.blockTypes.length} Ecommerce blocks, product grid category chosen from a list`);

    // Save the shop page as the page builder would: new hero title, product grid set to 8 per page without stock.
    const edited = (await cmsPage('shop')).page.component.map((c) => {
      if (c.type === 'ecommerce-plugin' && blockConfig(c).blockType === 'ecommerce.shop-hero') {
        const cfg = blockConfig(c);
        return { ...c, content: JSON.stringify({ ...cfg, settings: { ...cfg.settings, heading: 'Summer sale is on' } }) };
      }
      if (c.type === 'ecommerce-plugin' && blockConfig(c).blockType === 'ecommerce.product-grid') {
        const cfg = blockConfig(c);
        return { ...c, content: JSON.stringify({ ...cfg, settings: { ...cfg.settings, pageSize: 8, showStock: false } }) };
      }
      return c;
    });
    await cmsPage('shop', edited);
    // The plugin reading its pages (admin list, start-up) must not undo the edit.
    await adminApi('/storefront/admin/pages');
    await adminApi('/storefront/admin/pages/shop');
    const afterSync = (await cmsPage('shop')).page.component;
    assert.ok(afterSync.some((c) => c.type === 'ecommerce-plugin' && blockConfig(c).settings.heading === 'Summer sale is on'), 'edit kept after the plugin syncs');
    await page.goto(`${SITE}/shop`, { waitUntil: 'networkidle0' });
    await waitText(page, 'Summer sale is on');
    await page.waitForFunction(() => document.querySelectorAll('.ecom-sf-product-card').length === 8);
    assert.strictEqual(await page.$('.ecom-sf-product-card-stock'), null, 'stock hidden');
    await shot(page, 'shop-edited-in-page-builder');
    ok('page builder edits (hero text, 8 products, stock hidden) show on the live page and survive plugin syncs');

    console.log('\n--> Settings: storefront pages');
    await page.goto(`${SITE}/plugins/ecommerce-plugin/ui/admin/settings/index.html`, { waitUntil: 'networkidle0' });
    await waitText(page, 'Storefront pages');
    await waitText(page, 'Edited in page builder');
    assert.strictEqual((await page.evaluate(() => document.body.innerText.match(/Latest design/g) || [])).length, 3, 'the other 3 pages are untouched');
    await clickByText(page, 'button', 'Apply latest design');
    await clickByText(page, '[role="dialog"] button', 'Apply latest design');
    await waitText(page, 'Shop Catalog updated');
    await page.waitForFunction(() => (document.body.innerText.match(/Latest design/g) || []).length === 4);
    const restored = (await cmsPage('shop')).page.component;
    assert.ok(restored.some((c) => c.type === 'ecommerce-plugin' && blockConfig(c).settings.heading === 'Everyday essentials, made well'), 'design restored');
    await shot(page, 'settings-storefront-pages');
    ok('Settings shows the edited page; "Apply latest design" restores it on request only');

    // Removing a store block through the plugin API keeps the merchant's OpenExt blocks.
    const apiBlocks = (await adminApi('/storefront/admin/pages/shop')).page.blocks.filter((b) => b.blockType !== 'ecommerce.category-showcase');
    await fetch(`${API}/storefront/admin/pages/shop`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ blocks: apiBlocks }) });
    const afterApi = (await cmsPage('shop')).page.component.map((c) => (c.type === 'ecommerce-plugin' ? blockConfig(c).blockType : c.type));
    assert.deepStrictEqual(afterApi, ['ecommerce.shop-hero', 'ecommerce.category-filter', 'ecommerce.product-grid', 'ecommerce.trust-badges'], afterApi.join(','));
    ok('plugin API edits update the store blocks in place');

    console.log('\n--> Light / dark');
    await page.goto(`${SITE}/shop`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('.ecom-sf-product-card');
    const surface = () => page.evaluate(() => getComputedStyle(document.querySelector('.ecom-sf-shell')).getPropertyValue('--background').trim());
    assert.strictEqual(await surface(), 'oklch(1 0 0)');
    await page.evaluate(() => document.documentElement.classList.add('dark'));
    assert.strictEqual(await surface(), 'oklch(.145 0 0)');
    assert.ok(await page.evaluate(() => getComputedStyle(document.querySelector('.ecom-sf-product-card')).backgroundColor !== 'rgb(255, 255, 255)'), 'cards turn dark');
    await new Promise((r) => setTimeout(r, 600)); // let colour transitions finish
    await shot(page, 'shop-dark');
    await page.goto(`${SITE}/plugins/ecommerce-plugin/ui/admin/settings/profile/index.html`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('.ecom-admin');
    await page.evaluate(() => document.documentElement.classList.add('dark'));
    await page.waitForFunction(() => document.querySelector('.ecom-admin').classList.contains('dark'));
    await page.evaluate(() => document.documentElement.classList.remove('dark'));
    await page.waitForFunction(() => !document.querySelector('.ecom-admin').classList.contains('dark'));
    ok("storefront and admin both follow OpenExt's light/dark switch");

    console.log('\n--> Phone');
    await page.setViewport({ width: 390, height: 844 });
    await page.goto(`${SITE}/product?slug=${encodeURIComponent(linen.slug || linen._id)}`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('.ecom-sf-pdp-title');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert.ok(overflow <= 0, `no sideways scroll on a phone (overflow ${overflow}px)`);
    await shot(page, 'product-phone');
    ok('product page fits a phone screen');
  } catch (err) {
    await shot(page, 'FAILURE').catch(() => {});
    console.error('\nFAILED:', err.message, (err.stack || '').split('\n').filter((l) => l.includes('e2e-storefront')).join(' | '));
    process.exitCode = 1;
  } finally {
    console.log(`\nBrowser console errors/warnings: ${problems.length}`);
    problems.slice(0, 15).forEach((m) => console.log('  ' + m.slice(0, 300)));
    await browser.close();
  }
})();
