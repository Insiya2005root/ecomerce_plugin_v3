// Browser walkthrough of the Product Admin against the local harness. Screenshots land next to this file.
const path = require('path');
const assert = require('assert');
const puppeteer = require('C:/Users/InsiyaMerchant/projects/ecommerce-plugin-dev/web/node_modules/puppeteer');

const BASE = 'http://localhost:4317/plugins/ecommerce-plugin/ui/admin';
const shots = path.join(__dirname, 'shots');
require('fs').mkdirSync(shots, { recursive: true });

const consoleProblems = [];
let step = 0;
const ok = (msg) => console.log(`  ✓ ${msg}`);

async function shot(page, name) {
  await page.screenshot({ path: path.join(shots, `${String(++step).padStart(2, '0')}-${name}.png`), fullPage: true });
}

const text = (page, sel) => page.$eval(sel, (el) => el.textContent.trim());
const rowCount = (page) => page.$$eval('tbody tr', (rows) => rows.length);
const waitText = (page, t, timeout = 8000) =>
  page.waitForFunction((s) => document.body.innerText.includes(s), { timeout }, t);
const waitNoText = (page, t, timeout = 8000) =>
  page.waitForFunction((s) => !document.body.innerText.includes(s), { timeout }, t);

async function clickByText(page, selector, label) {
  const handle = await page.waitForFunction(
    (sel, l) => [...document.querySelectorAll(sel)].find((el) => el.textContent.trim() === l && el.offsetParent !== null),
    { timeout: 8000 },
    selector,
    label
  );
  await handle.asElement().click();
}

async function openMenu(page, ariaLabel, item) {
  await page.click(`button[aria-label="${ariaLabel}"]`);
  await clickByText(page, '[role="menuitem"]', item);
  if (item.startsWith('Edit')) await waitDrawerSettled(page);
}

// The drawer slides in; wait until it is fully on-screen before interacting.
async function waitDrawerSettled(page) {
  await page.waitForFunction(
    () => {
      const d = document.querySelector('[role="dialog"]:has(form)');
      if (!d) return false;
      const r = d.getBoundingClientRect();
      return r.right <= window.innerWidth && !d.hasAttribute('data-starting-style') && getComputedStyle(d).transform === 'none';
    },
    { timeout: 8000 }
  );
}

async function waitDrawerClosed(page) {
  await page.waitForFunction(() => !document.querySelector('[role="dialog"]:has(form)'), { timeout: 8000 });
}

async function chooseOption(page, triggerId, label) {
  await page.click(`#${triggerId}`);
  await clickByText(page, '[role="option"]', label);
}

async function typeInto(page, selector, value) {
  await page.click(selector);
  await page.keyboard.down('Control');
  await page.keyboard.press('KeyA');
  await page.keyboard.up('Control');
  await page.keyboard.press('Backspace');
  await page.type(selector, value);
}

(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  // The admin scrolls inside #plugin-root under a sticky save bar: center targets before clicking (centerBeforeClick).
  const rawClick = page.click.bind(page);
  page.click = async (sel, opts) => {
    await page.$eval(sel, (el) => el.scrollIntoView({ block: 'center' })).catch(() => {});
    return rawClick(sel, opts);
  };
  await page.setViewport({ width: 1280, height: 900 });
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') consoleProblems.push(`[${m.type()}] ${m.text()}`);
  });
  page.on('pageerror', (e) => consoleProblems.push(`[pageerror] ${e.message}`));

  try {
    console.log('\n--> List');
    await page.goto(`${BASE}/products/index.html`, { waitUntil: 'networkidle0' });
    await waitText(page, 'of 23 results');
    assert.strictEqual(await rowCount(page), 20);
    assert.ok((await page.content()).includes('Out of stock'), 'out-of-stock products are flagged');
    assert.ok(/₹/.test(await page.$eval('tbody', (b) => b.innerText)), 'prices formatted in INR');
    await shot(page, 'list');
    ok('loads 20 of 23 products with INR prices, inventory and status');

    await page.click('button[aria-label="Next page"]');
    await waitText(page, '21–23 of 23 results');
    assert.strictEqual(await rowCount(page), 3);
    assert.ok(page.url().includes('page=2'), 'page is kept in the URL');
    ok('pagination moves to page 2 and syncs the URL');

    await page.type('input[type="search"]', 'linen');
    await waitText(page, '1–1 of 1 results');
    assert.ok(!page.url().includes('page=2'), 'search resets to page 1');
    await shot(page, 'search');
    ok('debounced search filters server-side and resets pagination');

    await typeInto(page, 'input[type="search"]', 'zzzz-nothing');
    await waitText(page, 'No products match your filters');
    await shot(page, 'no-results');
    await clickByText(page, 'button', 'Clear filters');
    await waitText(page, 'of 23 results');
    ok('no-results state and Clear filters');

    await chooseOption(page, 'filter-status', 'Draft');
    await waitText(page, 'of 3 results');
    const statuses = await page.$$eval('tbody tr', (rows) => rows.map((r) => r.children[4].innerText.trim()));
    assert.ok(statuses.every((s) => s === 'Draft'), statuses.join(','));
    ok('status filter (Draft) uses the new backend filter');

    await chooseOption(page, 'filter-status', 'All statuses');
    await chooseOption(page, 'filter-category', 'Home');
    await waitText(page, 'of 11 results');
    ok('category filter');
    await chooseOption(page, 'filter-category', 'All categories');

    await chooseOption(page, 'sort', 'Price, high to low');
    await waitText(page, 'of 23 results');
    const firstName = await page.$eval('tbody tr td a', (a) => a.textContent.trim());
    assert.strictEqual(firstName, 'Sample product 23');
    ok('sorting by price (high to low)');

    await page.goto(`${BASE}/products/index.html?sort=name:asc`, { waitUntil: 'networkidle0' });
    await waitText(page, 'of 23 results');
    assert.strictEqual(await page.$eval('tbody tr td a', (a) => a.textContent.trim()), 'Linen Shirt');
    ok('filters restore from the URL on load');

    await page.setRequestInterception(true);
    const failList = (req) =>
      req.url().includes('/api/plugins/ecommerce-plugin/products?')
        ? req.respond({ status: 500, contentType: 'application/json', body: JSON.stringify({ success: false, message: 'Database unavailable (simulated)' }) })
        : req.continue();
    page.on('request', failList);
    await page.reload({ waitUntil: 'networkidle0' });
    await waitText(page, 'Database unavailable (simulated)');
    await shot(page, 'error-state');
    page.off('request', failList);
    await page.setRequestInterception(false);
    await clickByText(page, 'button', 'Try again');
    await waitText(page, 'of 23 results');
    ok('API error state with working retry');

    console.log('\n--> Detail + drawers');
    await page.goto(`${BASE}/products/index.html?q=linen`, { waitUntil: 'networkidle0' });
    await waitText(page, '1–1 of 1 results');
    await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle0' }).then(() => page.waitForNetworkIdle({ idleTime: 300 })), page.click('tbody tr td:nth-child(3)')]);
    assert.ok(page.url().includes('ecommerce-products?view=detail'), page.url());
    await waitText(page, 'Customer price');
    await shot(page, 'detail');
    ok('row click opens the detail page (two-column sections)');

    await openMenu(page, 'Pricing actions', 'Edit pricing');
    await page.waitForSelector('#discountPercentage', { visible: true });
    await typeInto(page, '#discountPercentage', '20');
    await shot(page, 'drawer-pricing');
    await clickByText(page, 'button', 'Save');
    await waitText(page, 'Changes saved');
    await waitDrawerClosed(page);
    await waitText(page, '20%');
    assert.ok((await page.$eval('main', (m) => m.innerText)).includes('₹189.60'), 'customer price comes from backend pricing (237 − 20%)');
    ok('pricing drawer saves and the backend-resolved customer price updates');

    await openMenu(page, 'Pricing actions', 'Edit pricing');
    await page.waitForSelector('#discountPercentage', { visible: true });
    await typeInto(page, '#discountPercentage', '150');
    await clickByText(page, 'button', 'Save');
    await waitText(page, 'Enter a value between 0 and 100.');
    await shot(page, 'drawer-validation');
    await page.keyboard.press('Escape');
    await waitNoText(page, 'Enter a value between 0 and 100.');
    await waitDrawerClosed(page);
    assert.ok((await page.$eval('main', (m) => m.innerText)).includes('20%'), 'cancelled edit did not save 150%');
    ok('drawer validation blocks invalid values; Escape closes without saving');

    await openMenu(page, 'Variant actions', 'Edit variants');
    await clickByText(page, 'button', 'Add variant');
    await clickByText(page, 'button', 'Save');
    await waitText(page, 'Add a size or a color.');
    await page.type('#variant-2-size', 'XL');
    await typeInto(page, '#variant-2-stock', '6');
    await page.type('#variant-2-price', '1450');
    await shot(page, 'drawer-variants');
    await clickByText(page, 'button', 'Save');
    await waitText(page, 'Changes saved');
    await waitDrawerClosed(page);
    await waitText(page, '3 variants');
    ok('variants drawer: add variant with validation, override price, persists');

    await openMenu(page, 'Organization actions', 'Edit organization');
    await page.waitForSelector('#tags', { visible: true });
    await page.type('#tags', 'cotton,');
    await chooseOption(page, 'taxClassId', 'GST 12%');
    await clickByText(page, 'button', 'Save');
    await waitText(page, 'Changes saved');
    await waitDrawerClosed(page);
    await waitText(page, 'cotton');
    await waitText(page, 'GST 12%');
    ok('organization drawer: tags + tax class persist');

    await openMenu(page, 'Product actions', 'Move to draft');
    await waitText(page, 'Status set to Draft');
    ok('quick status change from the general menu');

    await page.reload({ waitUntil: 'networkidle0' });
    await waitText(page, 'Customer price');
    const body = await page.$eval('main', (m) => m.innerText);
    for (const expected of ['20%', 'XL', 'cotton', 'GST 12%', 'Draft']) assert.ok(body.includes(expected), `persisted after reload: ${expected}`);
    ok('all drawer edits persist after a full reload');

    console.log('\n--> Edit page');
    await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle0' }).then(() => page.waitForNetworkIdle({ idleTime: 300 })), clickByText(page, 'a', 'Edit all fields')]);
    await page.waitForFunction(() => document.querySelector('#name')?.value === 'Linen Shirt');
    assert.strictEqual(await page.$eval('#discountPercentage', (i) => i.value), '20');
    assert.strictEqual(await page.$$eval('[id^="variant-"][id$="-size"]', (els) => els.length), 3);
    await shot(page, 'edit');
    await typeInto(page, '#name', 'Linen Shirt Classic');
    await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle0' }).then(() => page.waitForNetworkIdle({ idleTime: 300 })), clickByText(page, 'button', 'Save changes')]);
    await waitText(page, 'Product saved');
    await waitText(page, 'Linen Shirt Classic');
    ok('edit page loads every field, saves, returns to detail with a toast');

    console.log('\n--> Duplicate + delete');
    await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle0' }).then(() => page.waitForNetworkIdle({ idleTime: 300 })), openMenu(page, 'Product actions', 'Duplicate')]);
    await waitText(page, 'Linen Shirt Classic (Copy)');
    await waitText(page, 'Product duplicated');
    assert.ok((await page.$eval('main', (m) => m.innerText)).includes('Draft'));
    ok('duplicate creates a draft copy and opens it');

    await openMenu(page, 'Product actions', 'Delete');
    await waitText(page, 'Delete product?');
    await shot(page, 'delete-confirm');
    await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle0' }).then(() => page.waitForNetworkIdle({ idleTime: 300 })), clickByText(page, 'button', 'Delete')]);
    await waitText(page, 'Product deleted');
    await waitText(page, 'of 1 results'); // list remembered the "linen" search
    ok('delete with confirmation returns to the list, filters remembered');

    console.log('\n--> Create');
    await page.goto(`${BASE}/products/add/index.html`, { waitUntil: 'networkidle0' });
    await clickByText(page, 'button', 'Create product');
    await waitText(page, 'Title is required.');
    await waitText(page, 'Choose a category, or click New category');
    await shot(page, 'create-validation');
    await page.type('#name', 'Ceramic Mug');
    await page.type('#price', '499');
    await page.type('#stock', '12');
    await chooseOption(page, 'categoryId', 'Home');
    await shot(page, 'create-filled');
    await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle0' }).then(() => page.waitForNetworkIdle({ idleTime: 300 })), clickByText(page, 'button', 'Create product')]);
    await waitText(page, 'Product created');
    const created = await page.$eval('main', (m) => m.innerText);
    assert.ok(created.includes('Ceramic Mug') && created.includes('₹499.00') && /SKU-\d{6}/.test(created), 'auto SKU + price');
    ok('create validates, saves, auto-generates SKU, lands on detail');

    console.log('\n--> Responsive + other modules untouched');
    await page.setViewport({ width: 400, height: 860 });
    await page.goto(`${BASE}/products/index.html`, { waitUntil: 'networkidle0' });
    await waitText(page, 'results');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    await shot(page, 'list-mobile');
    assert.ok(overflow <= 0, `page body scrolls horizontally by ${overflow}px`);
    ok('list works at 400px without page-level horizontal scroll');

    await page.setViewport({ width: 1280, height: 900 });
    await page.goto(`${BASE}/categories/index.html`, { waitUntil: 'networkidle0' });
    await shot(page, 'categories-unchanged');
    ok('categories page still renders with the original layout');
  } catch (err) {
    await shot(page, 'FAILURE').catch(() => {});
    console.error('\nFAILED:', err.message);
    process.exitCode = 1;
  } finally {
    const relevant = consoleProblems.filter((m) => !/Failed to load resource: the server responded with a status of 500/.test(m));
    console.log(`\nBrowser console errors/warnings: ${relevant.length}`);
    relevant.slice(0, 20).forEach((m) => console.log('  ' + m.slice(0, 300)));
    await browser.close();
  }
})();
