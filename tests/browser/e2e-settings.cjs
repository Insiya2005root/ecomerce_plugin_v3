// Browser walkthrough: Customers (list, detail, cart prefill), Dashboard customers, and every Settings page.
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const puppeteer = require('C:/Users/InsiyaMerchant/projects/ecommerce-plugin-dev/web/node_modules/puppeteer');

const BASE = 'http://localhost:4317/plugins/ecommerce-plugin/ui/admin';
const API = 'http://localhost:4317/api/plugins/ecommerce-plugin';
const shots = path.join(__dirname, 'shots5');
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
  await h.asElement().click();
}
async function openMenu(page, ariaLabel, item) {
  await page.waitForFunction(() => !document.querySelector('[role="menu"]'), { timeout: 8000 });
  await page.click(`button[aria-label="${ariaLabel}"]`);
  await clickByText(page, '[role="menuitem"]', item);
}
async function fill(page, id, value) {
  await page.click(`[id="${id}"]`, { clickCount: 3 });
  await page.$eval(`[id="${id}"]`, (el) => el.select && el.select());
  await page.keyboard.press('Backspace');
  if (value) await page.type(`[id="${id}"]`, value);
}
async function pickSelect(page, id, label) {
  await page.click(`[id="${id}"]`);
  await clickByText(page, '[role="option"]', label);
}
const panelGone = (page) => page.waitForFunction(() => !document.querySelector('[role="dialog"]'), { timeout: 10000 });
async function noHorizontalScroll(page) {
  return page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
}

(async () => {
  const products = (await api('/products?limit=50')).products;
  const p = (n) => products.find((x) => x.name === n);
  const addr = { addressLine1: '1 MG Road', city: 'Surat', state: 'Gujarat', postalCode: '395007', country: 'India' };
  const place = (name, email, items, extra = {}) => api('/checkout', { customerDetails: { name, email, phone: '+91 98250 11111' }, customerAddress: addr, items, ...extra });
  const orders = [
    await place('Ravi Shah', 'ravi@example.com', [{ productId: p('Sample product 05')._id, quantity: 2 }], { couponCode: 'TEN' }),
    await place('Ravi Shah', 'RAVI@example.com', [{ productId: p('Sample product 07')._id, quantity: 1 }]),
    await place('Neha Iyer', 'neha@example.com', [{ productId: p('Sample product 07')._id, quantity: 1 }]),
  ];
  assert.ok(orders.every((o) => o.success), JSON.stringify(orders));

  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && problems.push(`[${m.type()}] ${m.text()}`));
  page.on('pageerror', (e) => problems.push(`[pageerror] ${e.message}`));
  page.on('dialog', (d) => d.accept());

  try {
    console.log('\n--> Customers');
    await page.goto(`${BASE}/customers/index.html`, { waitUntil: 'networkidle0' });
    await waitText(page, 'ravi@example.com');
    let t = await text(page);
    assert.ok(t.includes('Ravi Shah') && t.includes('Neha Iyer'), 'both customers listed');
    assert.ok(/Returning\s*\n?\s*1/.test(t), 'one returning customer in the summary');
    ok('list groups orders by email (Ravi’s two orders with different casing are one customer)');
    await shot(page, 'customers-list');

    await page.type('input[aria-label="Search customers"]', 'neha');
    await page.waitForFunction(() => !document.body.innerText.includes('ravi@example.com'), { timeout: 8000 });
    assert.ok(page.url().includes('q=neha'), 'search in URL');
    ok('search filters and is kept in the URL');
    await page.goto(`${BASE}/customers/index.html`, { waitUntil: 'networkidle0' });
    await waitText(page, 'ravi@example.com');
    // Summary tiles are buttons whose text starts with their label.
    const tile = await page.waitForFunction(() => [...document.querySelectorAll('button[aria-pressed]')].find((b) => b.textContent.startsWith('Returning')));
    await tile.asElement().click();
    await page.waitForFunction(() => !document.body.innerText.includes('neha@example.com'), { timeout: 8000 });
    ok('Returning tile filters the list');

    await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle0' }), page.click('a[href*="customers/detail"]')]);
    await waitText(page, 'Customer since');
    t = await text(page);
    assert.ok(t.includes('Total spent') && t.includes('Discounts used') && t.includes('TEN'), 'detail sections');
    assert.ok(t.includes('1 MG Road') && t.includes('Used on 2 orders'), 'address with use count');
    assert.ok(t.includes('Sample product 05'), 'most bought');
    ok('customer page shows spend, orders, address, products and the coupon they used');
    await shot(page, 'customer-detail');

    // "Create order" was removed from the customer page on request.
    assert.ok(!(await text(page)).includes('Create order'));
    ok('customer page has no Create order button');

    await page.goto(`${BASE}/orders/detail/index.html?id=${orders[2].orderId}`, { waitUntil: 'networkidle0' });
    await waitText(page, 'View customer');
    await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle0' }), clickByText(page, 'a', 'View customer')]);
    await waitText(page, 'neha@example.com · Customer since');
    ok('order page links to its customer');

    console.log('\n--> Dashboard customers');
    await page.goto(`${BASE}/index.html`, { waitUntil: 'networkidle0' });
    await waitText(page, 'Top customers');
    t = await text(page);
    assert.ok(t.includes('were returning customers'), 'customer mix');
    assert.ok(t.includes('Ravi Shah'), 'top customer');
    ok('dashboard shows new vs returning and top customers');

    console.log('\n--> Settings overview');
    await page.goto(`${BASE}/settings/index.html`, { waitUntil: 'networkidle0' });
    await waitText(page, 'Add your store name');
    t = await text(page);
    for (const s of ['General', 'Profile', 'Tax', 'Shipping', 'Locations']) assert.ok(t.includes(s), s);
    ok('overview lists every section with a live summary');
    await shot(page, 'settings-overview');

    console.log('\n--> General');
    await page.goto(`${BASE}/settings/general/index.html`, { waitUntil: 'networkidle0' });
    await waitText(page, 'Store details');
    await clickByText(page, 'button', 'Edit');
    await page.waitForSelector('#store-name');
    await fill(page, 'store-name', 'Surat Silks');
    await fill(page, 'gstin', '24ABC');
    await clickByText(page, 'button[type="submit"]', 'Save');
    await waitText(page, 'A GSTIN has 15 characters');
    ok('invalid GSTIN is rejected with a field message');
    await fill(page, 'gstin', '24AAPFU0939F1ZV');
    await clickByText(page, 'button[type="submit"]', 'Save');
    await panelGone(page);
    await waitText(page, '24AAPFU0939F1ZV');
    // Orders & inventory panel
    const editButtons = await page.$$('button');
    for (const b of editButtons) if ((await b.evaluate((el) => el.textContent.trim())) === 'Edit' && (await b.evaluate((el) => el.closest('section')?.textContent.includes('Orders & inventory')))) await b.click();
    await page.waitForSelector('#prefix');
    await fill(page, 'prefix', 'ss-');
    await fill(page, 'low-stock', '');
    await clickByText(page, 'button[type="submit"]', 'Save');
    await waitText(page, 'Enter a whole number');
    await fill(page, 'low-stock', '8');
    await clickByText(page, 'button[type="submit"]', 'Save');
    await panelGone(page);
    await waitText(page, '8 units or fewer');
    const store = (await api('/settings/store')).store;
    assert.strictEqual(store.orderPrefix, 'SS-');
    const next = await place('Neha Iyer', 'neha@example.com', [{ productId: p('Sample product 07')._id, quantity: 1 }]);
    assert.ok(next.orderNumber.startsWith('SS-'), next.orderNumber);
    ok('store details, order prefix and low-stock level save; new orders use SS-');

    // Store address: same PIN autofill as Locations.
    for (const b of await page.$$('button')) if ((await b.evaluate((el) => el.textContent.trim())) === 'Edit' && (await b.evaluate((el) => el.closest('section')?.textContent.includes('Store address')))) await b.click();
    await page.waitForSelector('#store-pin');
    await fill(page, 'store-line1', '1 Ghod Dod Road');
    await fill(page, 'store-pin', '395007');
    await waitText(page, 'map pin found', 25000);
    assert.strictEqual(await page.$eval('#store-city', (e) => e.value), 'Surat');
    assert.ok((await page.$eval('#store-state', (e) => e.textContent)).includes('Gujarat'));
    await clickByText(page, 'button[type="submit"]', 'Save');
    await panelGone(page);
    await waitText(page, 'Surat, Gujarat, 395007');
    ok('store address: PIN fills city and state, and the address shows on the page');
    await shot(page, 'settings-general');

    console.log('\n--> Profile');
    await page.goto(`${BASE}/settings/profile/index.html`, { waitUntil: 'networkidle0' });
    await waitText(page, 'Managed by OpenExt');
    await clickByText(page, 'button', 'Edit');
    await page.waitForSelector('#display-name');
    await fill(page, 'display-name', 'Insiya');
    await clickByText(page, 'button[type="submit"]', 'Save');
    await panelGone(page);
    await waitText(page, 'Insiya');
    await clickByText(page, '[role="radio"]', '7 days');
    await waitText(page, 'Preference saved');
    await page.goto(`${BASE}/index.html`, { waitUntil: 'networkidle0' });
    await waitText(page, 'Revenue · last 7 days');
    ok('profile saves; dashboard opens on the saved 7-day range');
    await page.goto(`${BASE}/settings/profile/index.html`, { waitUntil: 'networkidle0' });
    await waitText(page, 'Appearance');
    await clickByText(page, '[role="radio"]', 'Dark');
    assert.ok(await page.evaluate(() => document.documentElement.classList.contains('dark')));
    await shot(page, 'settings-profile-dark');
    await clickByText(page, '[role="radio"]', 'Light');
    ok('appearance switches light/dark');

    console.log('\n--> Tax');
    await page.goto(`${BASE}/settings/tax/index.html`, { waitUntil: 'networkidle0' });
    await waitText(page, 'Tax categories');
    await waitText(page, 'GST 12%');
    await shot(page, 'settings-tax');
    await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle0' }), clickByText(page, 'a', 'GST 12%')]);
    await waitText(page, 'No rates yet');
    await clickByText(page, 'button', 'Add rate');
    await page.waitForSelector('#tax-state');
    await clickByText(page, 'button', '18% CGST + SGST');
    await pickSelect(page, 'tax-state', 'Gujarat');
    await clickByText(page, 'button[type="submit"]', 'Add rate');
    await panelGone(page);
    await waitText(page, 'Gujarat, India');
    t = await text(page);
    assert.ok(t.includes('CGST 9% + SGST 9%'), 'components shown');
    ok('add an 18% CGST + SGST rate for Gujarat with the preset');
    await shot(page, 'settings-tax-category');

    await page.goto(`${BASE}/settings/tax/index.html`, { waitUntil: 'networkidle0' });
    await waitText(page, 'Check a rate');
    await pickSelect(page, 'check-class', 'GST 12%');
    await clickByText(page, 'button[type="submit"]', 'Check');
    await waitText(page, '₹180.00');
    ok('rate checker: ₹180 tax on ₹1000 to Gujarat');
    await fill(page, 'check-pin', '400050');
    await page.waitForFunction(() => document.querySelector('#check-state')?.textContent.includes('Maharashtra'), { timeout: 25000 });
    ok('rate checker: typing a PIN picks its state');

    // Cart: PIN fills city and state for the customer's address.
    await page.goto(`${BASE}/cart/index.html`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('#ship-pin');
    await fill(page, 'ship-city', '');
    await fill(page, 'ship-pin', '400050');
    await page.waitForFunction(() => document.querySelector('#ship-city')?.value === 'Mumbai', { timeout: 25000 });
    assert.ok((await page.$eval('#ship-state', (e) => e.textContent)).includes('Maharashtra'));
    ok('cart: PIN fills city and state');

    console.log('\n--> Shipping');
    await page.goto(`${BASE}/settings/shipping/index.html`, { waitUntil: 'networkidle0' });
    await waitText(page, 'How shipping is priced');
    await page.click('input[name="method"]:not(:checked)').catch(() => {});
    await clickByText(page, 'span', 'Flat rate');
    await page.waitForSelector('#flat-rate');
    await fill(page, 'flat-rate', '49');
    await fill(page, 'free-over', '999');
    await waitText(page, 'Unsaved changes');
    await clickByText(page, 'button[type="submit"]', 'Save');
    await waitText(page, 'Shipping settings saved');
    const s = (await api('/settings')).settings;
    assert.strictEqual(s.shippingRate, 49);
    assert.strictEqual(s.freeShippingThreshold, 999);
    await clickByText(page, 'span', 'By distance');
    await waitText(page, 'Distance pricing needs at least one active location');
    ok('flat rate and free threshold save; distance mode warns there is no location');
    await shot(page, 'settings-shipping');
    await page.goto(`${BASE}/settings/shipping/index.html`, { waitUntil: 'networkidle0' });

    console.log('\n--> Locations');
    await page.goto(`${BASE}/settings/locations/index.html`, { waitUntil: 'networkidle0' });
    await waitText(page, 'No locations yet');
    await clickByText(page, 'button', 'Add location');
    await page.waitForSelector('#loc-name');
    await clickByText(page, 'button[type="submit"]', 'Add location');
    await waitText(page, 'Enter a location name.');
    await fill(page, 'loc-name', 'Surat warehouse');
    await fill(page, 'loc-line1', '12 Ring Road');
    // PIN fills city, state and the map pin (live India Post / OpenStreetMap lookup).
    await fill(page, 'loc-pin', '395002');
    await waitText(page, 'map pin found', 25000);
    assert.strictEqual(await page.$eval('#loc-city', (e) => e.value), 'Surat');
    assert.ok((await page.$eval('#loc-state', (e) => e.textContent)).includes('Gujarat'));
    ok('typing a PIN fills city, state and map pin');
    // City picker suggests from the bundled list.
    await fill(page, 'loc-city', 'vado');
    await clickByText(page, '[role="option"]', 'VadodaraGujarat');
    assert.strictEqual(await page.$eval('#loc-city', (e) => e.value), 'Vadodara');
    await fill(page, 'loc-city', 'Surat');
    // Coordinates can still be typed by hand.
    await clickByText(page, 'button', 'Enter coordinates by hand');
    await fill(page, 'loc-lat', '21.1702');
    await fill(page, 'loc-lng', '72.8311');
    await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle0' }), clickByText(page, 'button[type="submit"]', 'Add location')]);
    await waitText(page, 'Open in OpenStreetMap');
    await waitText(page, 'Location added');
    ok('add location with validation, lands on its page');
    await shot(page, 'settings-location');
    await openMenu(page, 'Location actions', 'Deactivate');
    await clickByText(page, 'button', 'Deactivate');
    await waitText(page, 'Location deactivated');
    assert.ok((await text(page)).includes('Inactive'));
    ok('deactivate location');

    console.log('\n--> Phone width');
    await page.setViewport({ width: 400, height: 860 });
    for (const url of ['customers/index.html', 'settings/general/index.html', 'settings/tax/index.html', 'settings/locations/index.html']) {
      await page.goto(`${BASE}/${url}`, { waitUntil: 'networkidle0' });
      assert.ok(await noHorizontalScroll(page), url);
    }
    ok('customers and settings pages fit 400px without sideways scrolling');
  } catch (err) {
    console.error('  ✗', err.message);
    await shot(page, 'FAILURE').catch(() => {});
    process.exitCode = 1;
  } finally {
    await browser.close();
    console.log(`\n${passed} checks passed`);
    console.log(`Browser console errors/warnings: ${problems.length}`);
    problems.slice(0, 15).forEach((pr) => console.log('   ', pr));
  }
})();
