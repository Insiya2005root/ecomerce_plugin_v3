// Browser walkthrough: Dashboard and Promotions (overview, 4 tabs, forms, detail, actions).
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const puppeteer = require('C:/Users/InsiyaMerchant/projects/ecommerce-plugin-dev/web/node_modules/puppeteer');

const BASE = 'http://localhost:4317/plugins/ecommerce-plugin/ui/admin';
const API = 'http://localhost:4317/api/plugins/ecommerce-plugin';
const shots = path.join(__dirname, 'shots4');
fs.rmSync(shots, { recursive: true, force: true });
fs.mkdirSync(shots, { recursive: true });

const problems = [];
let step = 0;
const ok = (m) => console.log(`  ✓ ${m}`);
const shot = (page, name) => page.screenshot({ path: path.join(shots, `${String(++step).padStart(2, '0')}-${name}.png`), fullPage: true });
const text = (page) => page.evaluate(() => document.body.innerText);
const waitText = (page, t, timeout = 12000) => page.waitForFunction((s) => document.body.innerText.includes(s), { timeout }, t);
const api = async (p, body) => (await fetch(`${API}${p}`, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {})).json();

async function clickByText(page, selector, label) {
  const h = await page.waitForFunction(
    (sel, l) => [...document.querySelectorAll(sel)].find((el) => el.textContent.trim() === l && el.offsetParent !== null && !el.disabled),
    { timeout: 10000 }, selector, label
  );
  await h.asElement().click();
}
async function clickContaining(page, selector, label) {
  const h = await page.waitForFunction(
    (sel, l) => [...document.querySelectorAll(sel)].find((el) => el.textContent.includes(l) && el.offsetParent !== null && !el.disabled),
    { timeout: 10000 }, selector, label
  );
  await h.asElement().click();
}
async function openMenu(page, ariaLabel, item) {
  await page.waitForFunction(() => !document.querySelector('[role="menu"]'), { timeout: 8000 });
  await page.click(`button[aria-label="${ariaLabel}"]`);
  await clickByText(page, '[role="menuitem"]', item);
}
async function pickProduct(page, buttonId, name) {
  // Product picker window: open it, search, tick the product, then Done (single pickers close on click).
  await page.$eval(`[id="${buttonId}"]`, (el) => el.scrollIntoView({ block: 'center' }));
  await page.click(`[id="${buttonId}"]`);
  await page.waitForSelector('input[aria-label="Search products"]');
  await page.type('input[aria-label="Search products"]', name);
  await page.waitForFunction((n) => [...document.querySelectorAll('[role="option"]')].some((o) => o.textContent.includes(n)) && ![...document.querySelectorAll('[role="option"]')].some((o) => !o.textContent.includes(n)), { timeout: 10000 }, name);
  await clickContaining(page, '[role="option"]', name);
  const done = await page.$$eval('button', (bs) => bs.some((b) => b.textContent.trim() === 'Done' && b.offsetParent !== null));
  if (done) await clickByText(page, 'button', 'Done');
  await page.waitForFunction(() => !document.querySelector('input[aria-label="Search products"]'), { timeout: 8000 });
}
async function save(page, label) {
  await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 20000 }), clickByText(page, 'button[type="submit"]', label)]);
}

(async () => {
  // Data: two orders, one using the TEN coupon.
  const products = (await api('/products?limit=50')).products;
  const p = (n) => products.find((x) => x.name === n);
  const cust = { customerDetails: { name: 'Ravi', email: 'ravi@example.com' }, customerAddress: { addressLine1: '1 MG Road', city: 'Surat' } };
  const o1 = await api('/checkout', { ...cust, items: [{ productId: p('Sample product 05')._id, quantity: 2 }], couponCode: 'TEN' });
  const o2 = await api('/checkout', { ...cust, items: [{ productId: p('Sample product 07')._id, quantity: 1 }] });
  assert.ok(o1.success && o2.success, JSON.stringify([o1, o2]));

  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && problems.push(`[${m.type()}] ${m.text()}`));
  page.on('pageerror', (e) => problems.push(`[pageerror] ${e.message}`));

  try {
    console.log('\n--> Dashboard');
    await page.goto(`${BASE}/index.html`, { waitUntil: 'networkidle0' });
    await waitText(page, 'Revenue · last 30 days');
    const stats = (await api('/dashboard/stats?days=30')).stats;
    const t = await text(page);
    assert.ok(!t.includes('ECOMMERCE PLUGIN'), 'banner removed');
    assert.ok(t.includes('₹' + stats.sales.revenue.toLocaleString('en-IN', { minimumFractionDigits: 2 })), 'hero shows revenue');
    assert.ok(t.includes('Top sellers') && t.includes('Sample product 05'), 'top sellers');
    assert.ok(t.includes('Out of stock'), 'low stock list');
    assert.ok(t.includes('Unpaid orders'), 'attention tiles');
    assert.ok(await page.$('.recharts-area-curve'), 'revenue chart rendered');
    assert.ok(await page.$('.recharts-bar-rectangle'), 'orders chart rendered');
    await shot(page, 'dashboard');
    await clickByText(page, '[role="radio"]', '7 days');
    await waitText(page, 'Revenue · last 7 days');
    ok(`dashboard: hero revenue ${stats.sales.revenue}, charts, top sellers, low stock, attention; range switch`);
    await page.click('a[href*="payment=Not%20paid"]');
    await page.waitForNavigation({ waitUntil: 'networkidle0' }).catch(() => {});
    await waitText(page, 'of 2 orders');
    ok('"Unpaid orders" tile opens Orders filtered to unpaid');

    console.log('\n--> Promotions overview + coupon detail');
    await page.goto(`${BASE}/discounts/index.html`, { waitUntil: 'networkidle0' });
    await waitText(page, 'Live now');
    await waitText(page, 'Recently added');
    await shot(page, 'promotions-overview');
    ok('overview: KPI tiles, four tab cards, ending soon / recently added');

    await page.goto(`${BASE}/discounts/coupons/index.html`, { waitUntil: 'networkidle0' });
    await waitText(page, 'Ten percent off');
    await shot(page, 'coupons-list');
    await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle0' }), clickByText(page, 'tbody a', 'Ten percent off')]);
    await waitText(page, 'Performance');
    await page.waitForFunction(() => document.body.innerText.includes('No orders have used') || document.querySelectorAll('tbody tr').length > 0);
    const det = await text(page);
    assert.ok(det.includes(`#${o1.orderNumber}`), 'order that used the coupon is listed');
    assert.ok(!det.includes(`#${o2.orderNumber}`), 'order without the coupon is not');
    await shot(page, 'coupon-detail');
    ok('coupon detail: usage stats and the order that used it');

    await clickByText(page, 'button', 'Pause');
    await waitText(page, 'Paused');
    await clickByText(page, 'button', 'Activate');
    await waitText(page, 'Activated');
    ok('pause / activate from the detail page');

    await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle0' }), openMenu(page, 'Discount actions', 'Duplicate')]);
    await waitText(page, 'Duplicated as a draft');
    const dup = await text(page);
    assert.ok(dup.includes('Ten percent off (copy)') && dup.includes('Draft') && /TEN-[A-Z0-9]{4}/.test(dup));
    ok('duplicate creates a draft copy with a new code');

    console.log('\n--> Create: Buy X get Y (automatic)');
    await page.goto(`${BASE}/discounts/all/add/index.html`, { waitUntil: 'networkidle0' });
    await clickContaining(page, 'button', 'Buy X get Y');
    await save(page, 'Create discount').catch(() => {});
    await waitText(page, 'Give the discount a name.');
    await waitText(page, 'Choose what the customer must buy.');
    await page.type('#name', 'Buy 2 tees get mug');
    await page.click('[id="bogo.buyQuantity"]', { clickCount: 3 });
    await page.keyboard.press('Backspace');
    await page.type('[id="bogo.buyQuantity"]', '2');
    await pickProduct(page, 'bogo.buyTargetIds', 'Sample product 03');
    await pickProduct(page, 'bogo.rewardTargetIds', 'Sample product 08');
    await waitText(page, 'Buy 2 from 1 product, get 1 from 1 product free');
    await shot(page, 'create-bogo');
    await save(page, 'Create discount');
    await waitText(page, 'Discount created');
    const bogo = await text(page);
    assert.ok(bogo.includes('Customer buys') && bogo.includes('Sample product 03') && bogo.includes('Sample product 08'));
    ok('buy X get Y: validation, product pickers, live summary, detail shows names');

    console.log('\n--> Create: coupon with cap + exclusive');
    await page.goto(`${BASE}/discounts/coupons/add/index.html`, { waitUntil: 'networkidle0' });
    await page.type('#name', 'VIP 40');
    await page.type('#code', 'VIP40');
    await page.type('#value', '40');
    await page.type('#maxDiscountAmount', '300');
    await clickContaining(page, 'label', 'Don’t combine with other discounts');
    await page.type('#minSubtotal', '1000');
    await waitText(page, 'Exclusive');
    await save(page, 'Create coupon');
    await waitText(page, 'Discount created');
    const vip = await text(page);
    assert.ok(vip.includes('No (exclusive)') && vip.includes('₹300.00') && vip.includes('₹1,000.00') && vip.includes('VIP40'));
    const cart = await api('/cart/calculate', { items: [{ productId: p('Sample product 23')._id, quantity: 2 }], couponCode: 'vip40' });
    const vipApplied = cart.pricing.appliedDiscounts.find((d) => d.name === 'VIP 40');
    assert.ok(vipApplied && Math.round(vipApplied.amount) === 300, `cap applies in pricing: ${JSON.stringify(cart.pricing.appliedDiscounts)}`);
    ok('coupon: code, min subtotal, cap and exclusive saved; pricing respects the ₹300 cap');

    console.log('\n--> Campaign + custom rule');
    await page.goto(`${BASE}/discounts/campaigns/add/index.html`, { waitUntil: 'networkidle0' });
    await page.type('#name', 'Diwali sale');
    await page.type('#marketingHeading', 'FESTIVE SALE');
    await waitText(page, 'Buy 2 tees get mug');
    await clickContaining(page, 'label', 'Buy 2 tees get mug');
    await waitText(page, '1 discount included');
    await shot(page, 'create-campaign');
    await save(page, 'Create campaign');
    await waitText(page, 'Campaign created');
    await waitText(page, 'Included discounts');
    await page.waitForFunction(() => document.body.innerText.includes('Buy 2 tees get mug'));
    ok('campaign: heading, included discount picker, detail lists included discounts');

    await page.goto(`${BASE}/discounts/custom/add/index.html`, { waitUntil: 'networkidle0' });
    await page.type('#name', 'Big cart free shipping');
    await clickByText(page, 'button', 'Add condition');
    await page.type('[id="cond-0-0-value"]', '500');
    await page.click('[id="action-0-type"]');
    await clickByText(page, '[role="option"]', 'Free shipping');
    await shot(page, 'create-custom');
    await save(page, 'Create rule');
    await waitText(page, 'Rule created');
    const custom = await text(page);
    assert.ok(custom.includes('Cart total is at least ₹500.00') && custom.includes('Free shipping') && custom.includes('Automatically when conditions match'));
    ok('custom rule: condition + action editors, plain-English detail');
    await clickByText(page, 'a', 'Edit');
    await page.waitForSelector('[id="cond-0-0-value"]');
    assert.strictEqual(await page.$eval('[id="cond-0-0-value"]', (i) => i.value), '500', 'edit loads the saved condition');
    ok('edit page reloads the saved custom rule');

    console.log('\n--> Lists + delete');
    await page.goto(`${BASE}/discounts/all/index.html`, { waitUntil: 'networkidle0' });
    await waitText(page, 'Buy 2 tees get mug');
    await shot(page, 'automatic-list');
    await page.goto(`${BASE}/discounts/coupons/index.html`, { waitUntil: 'networkidle0' });
    await waitText(page, 'VIP 40');
    await page.click('#filter-status');
    await clickByText(page, '[role="option"]', 'Draft');
    await waitText(page, '1 of 3');
    await page.click('#filter-status');
    await clickByText(page, '[role="option"]', 'All statuses');
    await openMenu(page, 'Actions for Ten percent off', 'Delete');
    await clickByText(page, '[role="dialog"] button', 'Delete');
    await waitText(page, 'Archived (used by past orders)');
    ok('list filters; deleting a used coupon archives it');

    await page.setViewport({ width: 400, height: 860 });
    await page.goto(`${BASE}/discounts/coupons/index.html`, { waitUntil: 'networkidle0' });
    await waitText(page, 'VIP 40');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert.ok(overflow <= 0, `overflow ${overflow}px`);
    await page.goto(`${BASE}/index.html`, { waitUntil: 'networkidle0' });
    await waitText(page, 'Revenue · last 30 days');
    const overflow2 = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    await shot(page, 'dashboard-mobile');
    assert.ok(overflow2 <= 0, `dashboard overflow ${overflow2}px`);
    ok('promotions list and dashboard fit a 400px screen');
  } catch (err) {
    await shot(page, 'FAILURE').catch(() => {});
    console.error('\nFAILED:', err.message);
    process.exitCode = 1;
  } finally {
    console.log(`\nBrowser console errors/warnings: ${problems.length}`);
    problems.slice(0, 15).forEach((m) => console.log('  ' + m.slice(0, 300)));
    await browser.close();
  }
})();
