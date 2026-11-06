// Browser walkthrough: Inventory (list, item page, adjust, locations, reservations, bulk edit, order flow),
// plus this round's fixes: product picker window, "New category" on the product form, no Create order on customers.
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const puppeteer = require('C:/Users/InsiyaMerchant/projects/ecommerce-plugin-dev/web/node_modules/puppeteer');

const BASE = 'http://localhost:4317/plugins/ecommerce-plugin/ui/admin';
const API = 'http://localhost:4317/api/plugins/ecommerce-plugin';
const shots = path.join(__dirname, 'shots6');
fs.rmSync(shots, { recursive: true, force: true });
fs.mkdirSync(shots, { recursive: true });

const problems = [];
let step = 0;
let passed = 0;
const ok = (m) => (passed++, console.log(`  ✓ ${m}`));
const shot = (page, name) => page.screenshot({ path: path.join(shots, `${String(++step).padStart(2, '0')}-${name}.png`), fullPage: true });
const text = (page) => page.evaluate(() => document.body.innerText);
const waitText = (page, t, timeout = 12000) => page.waitForFunction((s) => document.body.innerText.includes(s), { timeout }, t);
const api = async (p, body, method = 'POST') => (await fetch(`${API}${p}`, body ? { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {})).json();

async function clickByText(page, selector, label) {
  const h = await page.waitForFunction(
    (sel, l) => [...document.querySelectorAll(sel)].find((el) => el.textContent.trim() === l && el.offsetParent !== null && !el.disabled),
    { timeout: 10000 }, selector, label
  );
  await h.asElement().evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await h.asElement().click().catch((e) => { throw new Error(`${e.message} (clicking "${label}" in ${selector})`); });
}
async function clickContaining(page, selector, label) {
  const h = await page.waitForFunction(
    (sel, l) => [...document.querySelectorAll(sel)].find((el) => el.textContent.includes(l) && el.offsetParent !== null && !el.disabled),
    { timeout: 10000 }, selector, label
  );
  await h.asElement().evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await h.asElement().click().catch((e) => { throw new Error(`${e.message} (clicking "${label}" in ${selector})`); });
}
async function fill(page, id, value) {
  await page.focus(`[id="${id}"]`);
  await page.$eval(`[id="${id}"]`, (el) => el.select());
  await page.keyboard.press('Backspace');
  if (value) await page.type(`[id="${id}"]`, value);
}
const panelGone = (page) => page.waitForFunction(() => !document.querySelector('[role="dialog"]'), { timeout: 10000 });

(async () => {
  // Data: a location (takes over unassigned stock), a second one, one product with stock.
  const products = (await api('/products?limit=50')).products;
  const p05 = products.find((x) => x.name === 'Sample product 05');
  const surat = (await api('/locations', { name: 'Surat WH', addressLine1: '1 Ring Road', city: 'Surat', state: 'Gujarat', postalCode: '395002', latitude: 21.17, longitude: 72.83, priority: 5 })).location;
  const mumbai = (await api('/locations', { name: 'Mumbai Store', addressLine1: '5 Link Road', city: 'Mumbai', state: 'Maharashtra', postalCode: '400050', latitude: 19.06, longitude: 72.83 })).location;
  const inv = (await api(`/inventory?search=${encodeURIComponent('Sample product 05')}`)).items[0];
  assert.ok(inv, 'inventory item exists for the product');

  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  // The admin scrolls inside #plugin-root under a sticky save bar: center targets before clicking (centerBeforeClick).
  const rawClick = page.click.bind(page);
  page.click = async (sel, opts) => {
    await page.$eval(sel, (el) => el.scrollIntoView({ block: 'center' })).catch(() => {});
    return rawClick(sel, opts);
  };
  await page.setViewport({ width: 1366, height: 900 });
  page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && problems.push(`[${m.type()}] ${m.text()}`));
  page.on('pageerror', (e) => problems.push(`[pageerror] ${e.message}`));
  page.on('dialog', (d) => d.accept());

  try {
    console.log('\n--> Inventory list');
    await page.goto(`${BASE}/inventory/index.html`, { waitUntil: 'networkidle0' });
    await waitText(page, 'Sample product 05');
    let t = await text(page);
    assert.ok(t.includes('Low stock') && t.includes('Out of stock') && t.includes('Reserved'), 'summary tiles');
    assert.ok(!t.includes('Your stock is not at any location yet'), 'stock moved to the first location');
    ok('list shows every item with in-stock / reserved / available and summary tiles');
    await shot(page, 'inventory-list');
    const outTile = await page.waitForFunction(() => [...document.querySelectorAll('button[aria-pressed]')].find((b) => b.textContent.startsWith('Out of stock')));
    await outTile.asElement().click();
    await page.waitForFunction(() => location.search.includes('stock=out'));
    ok('Out of stock tile filters the list (kept in the address)');

    console.log('\n--> Item page');
    await page.goto(`${BASE}/inventory/detail/index.html?id=${inv._id}`, { waitUntil: 'networkidle0' });
    await waitText(page, 'Stock history');
    assert.ok((await text(page)).includes('Surat WH'));
    await clickByText(page, 'button', 'Adjust');
    await page.waitForSelector('#adjust-qty');
    await fill(page, 'adjust-qty', '40');
    await page.click('#adjust-reason');
    await clickByText(page, '[role="option"]', 'Received');
    await fill(page, 'adjust-note', 'PO-123');
    await clickByText(page, 'button[type="submit"]', 'Save');
    await panelGone(page);
    await waitText(page, 'PO-123');
    t = await text(page);
    assert.ok(t.includes('Received'), 'history shows the reason');
    const prod = (await api(`/products/${p05._id}`)).product;
    assert.strictEqual(prod.stock, 40, 'product stock follows the adjustment');
    ok('Adjust sets stock with a reason and note; history and product stock update');

    await clickByText(page, 'button', 'Manage locations');
    await clickByText(page, '[role="dialog"] label', 'Mumbai Store');
    await clickByText(page, 'button[type="submit"]', 'Save');
    await panelGone(page);
    await waitText(page, 'Mumbai Store');
    ok('Manage locations adds a second location');

    await clickByText(page, 'button', 'Create reservation');
    await page.waitForSelector('#res-qty');
    await fill(page, 'res-qty', '3');
    await fill(page, 'res-desc', 'Phone order for Ravi');
    await clickByText(page, 'button[type="submit"]', 'Reserve');
    await panelGone(page);
    await waitText(page, 'Phone order for Ravi');
    assert.strictEqual((await api(`/products/${p05._id}`)).product.stock, 37);
    ok('manual reservation holds 3 units (available 40 → 37)');
    await shot(page, 'inventory-item');

    console.log('\n--> Orders reserve, fulfilment deducts');
    const order = await api('/checkout', { customerDetails: { name: 'Neha', email: 'neha@example.com' }, customerAddress: { addressLine1: '1 MG Road', city: 'Surat', state: 'Gujarat', postalCode: '395007', country: 'India' }, items: [{ productId: p05._id, quantity: 2 }] });
    assert.ok(order.orderId, JSON.stringify(order));
    await page.reload({ waitUntil: 'networkidle0' });
    await waitText(page, `Order #${order.orderNumber}`);
    ok('a new order shows as a reservation on the item');
    await page.goto(`${BASE}/orders/detail/index.html?id=${order.orderId}`, { waitUntil: 'networkidle0' });
    await clickByText(page, 'button', 'Mark as fulfilled');
    await waitText(page, 'Marked as fulfilled');
    await page.goto(`${BASE}/inventory/detail/index.html?id=${inv._id}`, { waitUntil: 'networkidle0' });
    await waitText(page, 'Fulfilled order');
    const detail = (await api(`/inventory/${inv._id}`)).item;
    assert.strictEqual(detail.stocked, 38, '40 − 2 packed');
    assert.strictEqual(detail.reserved, 3, 'only the manual hold remains');
    ok('marking the order fulfilled takes the 2 units off the shelf');

    console.log('\n--> Reservations page');
    await page.goto(`${BASE}/inventory/reservations/index.html`, { waitUntil: 'networkidle0' });
    await waitText(page, 'Phone order for Ravi');
    await clickByText(page, 'button', 'Create reservation');
    await page.waitForSelector('input[aria-label="Search items"]');
    await page.type('input[aria-label="Search items"]', 'Sample product 07');
    await clickContaining(page, 'button', 'Sample product 07');
    await page.waitForSelector('#res-qty');
    await fill(page, 'res-qty', '1');
    await clickByText(page, 'button[type="submit"]', 'Reserve');
    await panelGone(page);
    await waitText(page, 'Sample product 07');
    ok('reservations page lists holds and creates one via the item picker');
    await shot(page, 'reservations');

    console.log('\n--> Bulk edit');
    await page.goto(`${BASE}/inventory/stock/index.html`, { waitUntil: 'networkidle0' });
    await waitText(page, 'Sample product 05');
    const cell = `input[aria-label="Sample product 05 at Mumbai Store"]`;
    await page.waitForSelector(cell);
    await page.focus(cell);
    await page.$eval(cell, (el) => el.select());
    await page.type(cell, '6');
    await waitText(page, '1 change not saved');
    await clickByText(page, 'button', 'Save');
    await waitText(page, 'Stock levels saved');
    assert.strictEqual((await api(`/inventory/${inv._id}`)).item.levels.find((l) => l.locationName === 'Mumbai Store').stocked, 6);
    ok('Edit stock levels saves a cell and records it');
    await shot(page, 'bulk-edit');

    console.log('\n--> Product and location pages');
    await page.goto(`${BASE}/products/detail/index.html?id=${p05._id}`, { waitUntil: 'networkidle0' });
    await waitText(page, 'Surat WH: 38');
    ok('product page shows stock by location');
    await page.goto(`${BASE}/settings/locations/detail/index.html?id=${surat._id}`, { waitUntil: 'networkidle0' });
    await waitText(page, 'Items stocked here');
    ok('location page shows what is stocked there');

    console.log('\n--> Fixes');
    await page.goto(`${BASE}/discounts/coupons/add/index.html`, { waitUntil: 'networkidle0' });
    const pickerButton = await page.waitForFunction(() => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Choose products'));
    await pickerButton.asElement().evaluate((el) => el.scrollIntoView({ block: 'center' }));
    await pickerButton.asElement().click();
    await page.waitForSelector('input[aria-label="Search products"]');
    await page.waitForFunction(() => document.querySelectorAll('[role="option"]').length >= 5);
    const count = await page.$$eval('[role="option"]', (o) => o.length);
    await clickContaining(page, '[role="option"]', 'Sample product 05');
    await clickContaining(page, '[role="option"]', 'Sample product 07');
    await waitText(page, '2 selected');
    await shot(page, 'product-picker');
    await clickByText(page, 'button', 'Done');
    await page.waitForFunction(() => !document.querySelector('input[aria-label="Search products"]'));
    t = await text(page);
    assert.ok(t.includes('Sample product 05') && t.includes('Sample product 07'), 'chips shown');
    ok(`promotion product picker opens as a window with ${count} products per page and ticks several`);

    await page.goto(`${BASE}/products/add/index.html`, { waitUntil: 'networkidle0' });
    await clickByText(page, 'button', 'New category');
    await page.waitForSelector('[role="dialog"]');
    // Wait for the drawer to finish sliding in, so its buttons are on screen.
    await page.waitForFunction(() => document.querySelector('[role="dialog"]').getAnimations({ subtree: true }).every((x) => x.playState !== 'running'));
    const nameInput = await page.waitForFunction(() => [...document.querySelectorAll('[role="dialog"] input')].find((i) => i.offsetParent !== null));
    await nameInput.asElement().type('Kurtas');
    await clickContaining(page, '[role="dialog"] button[type="submit"]', 'Create');
    await panelGone(page);
    await page.waitForFunction(() => document.querySelector('#categoryId')?.textContent.includes('Kurtas'), { timeout: 10000 });
    assert.ok(page.url().includes('ecommerce-products?view=add'), 'stayed on the product form');
    ok('"New category" creates a category from the product form and selects it');

    await page.goto(`${BASE}/customers/detail/index.html?email=neha%40example.com`, { waitUntil: 'networkidle0' });
    await waitText(page, 'Customer since');
    assert.ok(!(await text(page)).includes('Create order'));
    ok('customer page no longer has a Create order button');
  } catch (err) {
    console.error('  ✗', err.message);
    await shot(page, 'FAILURE').catch(() => {});
    process.exitCode = 1;
  } finally {
    await browser.close();
    console.log(`\n${passed} checks passed`);
    console.log(`Browser console errors/warnings: ${problems.length}`);
    problems.slice(0, 10).forEach((pr) => console.log('   ', pr));
  }
})();
