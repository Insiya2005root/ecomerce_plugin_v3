// test_discount_engine.cjs
// 1) Golden test: the current DiscountEngine must give exactly the same results as the original engine
//    (from the repo's first commit) for every existing rule type when the new options (priority/exclusive/cap) are unused.
// 2) Behaviour tests for priority, exclusive stacking, max discount cap and custom rules.
// Usage: node test_discount_engine.cjs   (needs git, plus the requirements in test_support/plugin-api-harness.cjs)
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');
const { mongoose, pluginDir, startPlugin, stopPlugin, createChecker } = require('./test_support/plugin-api-harness.cjs');

const TEST_DB = 'ecommerce_plugin_discount_engine_test';
const { check, stats } = createChecker();

function loadLegacyEngine() {
  // Original compiled engine from the first commit, with its model require pointed at this checkout.
  const firstCommit = execSync('git rev-list --max-parents=0 HEAD', { cwd: __dirname, encoding: 'utf8' }).trim().split(/\s+/)[0];
  const src = execSync(`git show ${firstCommit}:plugin/ecommerce-plugin/api/services/DiscountEngine.js`, { cwd: __dirname, encoding: 'utf8' });
  const productModel = path.join(pluginDir, 'api', 'models', 'Product.js').replace(/\\/g, '/');
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'legacy-engine-')), 'DiscountEngine.js');
  fs.writeFileSync(file, src.split("require('../models/Product')").join(`require('${productModel}')`));
  return require(file).DiscountEngine;
}

const round = (n) => Math.round(Number(n) * 10000) / 10000;
function summarize(result) {
  return {
    discountTotal: round(result.discountTotal),
    totalAmount: round(result.totalAmount),
    subtotal: round(result.subtotal),
    progressNotices: result.progressNotices,
    applied: (result.appliedDiscounts || []).map((d) => ({ id: String(d.ruleId), amount: round(d.amount), gift: Boolean(d.isFreeGift) })),
    items: (result.cartItems || []).map((i) => ({ p: String(i.productId), q: i.quantity, r: round(i.remainingPrice), gift: Boolean(i.isAutoAddedGift) })),
  };
}

async function main() {
  const app = await startPlugin(TEST_DB);
  const post = (url, body) => app.call('POST', url, { body });
  const { DiscountEngine } = require(path.join(pluginDir, 'api', 'services', 'DiscountEngine.js'));
  const Legacy = loadLegacyEngine();
  const DiscountRule = require(path.join(pluginDir, 'api', 'models', 'DiscountRule.js')).getModel();
  const Settings = require(path.join(pluginDir, 'api', 'models', 'Settings.js')).getModel();

  const catA = (await post('/categories', { name: 'Shirts', slug: 'shirts' })).body.category;
  const catB = (await post('/categories', { name: 'Mugs', slug: 'mugs' })).body.category;
  const mk = async (name, price, categoryId, stock = 100) =>
    (await post('/products', { name, price, categoryId, stock, status: 'Published' })).body.product;
  const shirt = await mk('Shirt', 1000, catA._id);
  const tee = await mk('Tee', 400, catA._id);
  const mug = await mk('Mug', 250, catB._id);
  const gift = await mk('Gift Pin', 99, catB._id);
  const line = (p, quantity, extra = {}) => ({ productId: p._id, categoryId: p.categoryId, name: p.name, price: p.price, originalPrice: p.price, quantity, ...extra });
  const id = () => new mongoose.Types.ObjectId();
  const past = new Date(Date.now() - 86400000);
  const future = new Date(Date.now() + 86400000);

  // Plain objects shaped like stored rules (engine reads fields only).
  const R = {
    pct10: { _id: id(), name: 'Ten off', type: 'percentage', value: 10, status: 'Active', isAutomatic: true },
    pctShirt: { _id: id(), name: 'Shirt 20', type: 'percentage', value: 20, status: 'Active', isAutomatic: true, targetProductIds: [String(shirt._id)] },
    fixed150: { _id: id(), name: 'Flat 150', type: 'fixed_amount', value: 150, status: 'Active', isAutomatic: true },
    couponFixed: { _id: id(), name: 'SAVE100', code: 'SAVE100', type: 'fixed_amount', value: 100, status: 'Active', isAutomatic: false },
    couponMin: { _id: id(), name: 'BIG', code: 'BIG', type: 'percentage', value: 15, status: 'Active', isAutomatic: false, minSubtotal: 2000 },
    used: { _id: id(), name: 'Used up', type: 'percentage', value: 50, status: 'Active', isAutomatic: true, usageLimit: 3, usedCount: 3 },
    expired: { _id: id(), name: 'Expired', type: 'percentage', value: 50, status: 'Active', isAutomatic: true, endDate: past },
    upcoming: { _id: id(), name: 'Upcoming', type: 'percentage', value: 50, status: 'Active', isAutomatic: true, startDate: future },
    paused: { _id: id(), name: 'Paused', type: 'percentage', value: 50, status: 'Paused', isAutomatic: true },
    bogoSame: { _id: id(), name: 'Tee BOGO', type: 'buy_x_get_y', status: 'Active', isAutomatic: true, buyXGetY: { buyTargetType: 'SpecificProduct', buyTargetIds: [String(tee._id)], buyQuantity: 1, rewardTargetType: 'SpecificProduct', rewardTargetIds: [String(tee._id)], rewardQuantity: 1, rewardType: 'Free', repeat: true } },
    bogoCat: { _id: id(), name: 'Shirt → mug half', type: 'buy_x_get_y', status: 'Active', isAutomatic: true, buyXGetY: { buyTargetType: 'Category', buyTargetIds: [String(catA._id)], buyQuantity: 2, rewardTargetType: 'Category', rewardTargetIds: [String(catB._id)], rewardQuantity: 1, rewardType: 'PercentageOff', rewardValue: 50 } },
    bogoGift: { _id: id(), name: 'Shirt + pin', type: 'buy_x_get_y', status: 'Active', isAutomatic: true, buyXGetY: { buyTargetType: 'SpecificProduct', buyTargetIds: [String(shirt._id)], buyQuantity: 1, rewardTargetType: 'SpecificProduct', rewardTargetIds: [String(gift._id)], rewardQuantity: 1, rewardType: 'Free' } },
    spendFixed: { _id: id(), name: 'Spend 1500 save 200', type: 'spend_x_get_y', status: 'Active', isAutomatic: true, spendXGetY: { minSpend: 1500, rewardType: 'FixedAmount', rewardValue: 200, repeat: true, maxDiscount: 500 } },
    spendPct: { _id: id(), name: 'Spend 3000 get 5%', type: 'spend_x_get_y', status: 'Active', isAutomatic: true, spendXGetY: { minSpend: 3000, rewardType: 'Percentage', rewardValue: 5 } },
    spendGift: { _id: id(), name: 'Spend 1000 free pin', type: 'spend_x_get_y', status: 'Active', isAutomatic: true, spendXGetY: { minSpend: 1000, rewardType: 'FreeProduct', rewardTargetIds: [String(gift._id)] } },
  };
  const campChild = { _id: id(), name: 'Campaign 25', type: 'percentage', value: 25, status: 'Active', isAutomatic: false, code: 'HIDDEN' };
  const campaign = { _id: id(), name: 'Diwali', type: 'campaign', status: 'Active', isAutomatic: true, campaign: { childRuleIds: [String(campChild._id)] } };

  const carts = [
    { items: [line(shirt, 1)] },
    { items: [line(shirt, 2), line(tee, 3), line(mug, 1)] },
    { items: [line(tee, 4)] },
    { items: [line(shirt, 1), line(mug, 2)], couponCode: 'SAVE100' },
    { items: [line(shirt, 3)], couponCode: 'big' },
    { items: [line(mug, 1)], couponCode: 'BIG' },
    { items: [line(shirt, 1, { price: 800 }), line(tee, 1)] },
  ];
  const ruleSets = [
    [R.pct10], [R.pctShirt, R.pct10], [R.fixed150], [R.couponFixed, R.pct10], [R.couponMin],
    [R.used, R.expired, R.upcoming, R.paused, R.pct10], [R.bogoSame], [R.bogoCat], [R.bogoGift],
    [R.spendFixed], [R.spendPct], [R.spendGift], [campaign, campChild],
    [R.pctShirt, R.fixed150, R.bogoSame, R.spendFixed, R.spendGift, R.couponFixed],
  ];

  console.log('\n--> Golden: unchanged results for existing rules');
  await check(`${carts.length * ruleSets.length} cart × rule-set combinations match the original engine exactly`, async () => {
    const coverage = { discounted: 0, gifts: 0, notices: 0 };
    for (const [ci, cart] of carts.entries()) {
      for (const [ri, rules] of ruleSets.entries()) {
        const clone = (x) => JSON.parse(JSON.stringify(x), (k, v) => (k === '_id' || k === 'productId' || k === 'categoryId' ? v : v));
        const reviveRules = () => rules.map((r) => ({ ...clone(r), _id: r._id, startDate: r.startDate, endDate: r.endDate }));
        const oldResult = summarize(await Legacy.evaluate(clone(cart), reviveRules()));
        const newResult = summarize(await DiscountEngine.evaluate(clone(cart), reviveRules()));
        assert.deepStrictEqual(newResult, oldResult, `cart ${ci} × rules ${ri}`);
        if (newResult.discountTotal > 0) coverage.discounted++;
        if (newResult.items.some((i) => i.gift)) coverage.gifts++;
        if (newResult.progressNotices.length) coverage.notices++;
      }
    }
    // Guard against a vacuous pass: the combinations must actually exercise discounts, gifts and notices.
    console.log(`    coverage: ${JSON.stringify(coverage)}`);
    assert.ok(coverage.discounted >= 40, 'enough combinations produce a discount');
    assert.ok(coverage.gifts >= 3, 'auto-added gifts are exercised');
    assert.ok(coverage.notices >= 3, 'spend-more notices are exercised');
  });

  console.log('\n--> Priority');
  const cartK = { items: [line(shirt, 1)] };
  await check('default order unchanged; higher priority applies first', async () => {
    const fixed = { ...R.fixed150, _id: id(), value: 100 };
    const half = { ...R.pct10, _id: id(), value: 50 };
    const defaultOrder = await DiscountEngine.evaluate(JSON.parse(JSON.stringify(cartK)), [fixed, half]);
    assert.strictEqual(round(defaultOrder.discountTotal), 550, 'fixed first, then 50% of the rest');
    const prioritised = await DiscountEngine.evaluate(JSON.parse(JSON.stringify(cartK)), [fixed, { ...half, priority: 10 }]);
    assert.strictEqual(round(prioritised.discountTotal), 600, '50% first, then the fixed 100');
    assert.strictEqual(prioritised.appliedDiscounts[0].name, half.name);
  });

  console.log('\n--> Exclusive');
  await check('exclusive rule never combines; the customer gets the better option', async () => {
    const ex20 = { ...R.pct10, _id: id(), name: 'Exclusive 20', value: 20, stackingPolicy: 'exclusive' };
    const a = { ...R.pct10, _id: id(), name: 'Stack 10' };
    const b = { ...R.fixed150, _id: id(), name: 'Stack 150' };
    let res = await DiscountEngine.evaluate(JSON.parse(JSON.stringify(cartK)), [ex20, a, b]);
    // Stacked: 100 + 150 = 250 beats exclusive 200.
    assert.deepStrictEqual(res.appliedDiscounts.map((d) => d.name).sort(), ['Stack 10', 'Stack 150']);
    res = await DiscountEngine.evaluate(JSON.parse(JSON.stringify(cartK)), [{ ...ex20, value: 40 }, a, b]);
    assert.deepStrictEqual(res.appliedDiscounts.map((d) => d.name), ['Exclusive 20']);
    assert.strictEqual(round(res.discountTotal), 400);
  });

  console.log('\n--> Max discount cap');
  await check('cap limits a rule and keeps line prices consistent', async () => {
    const capped = { ...R.pct10, _id: id(), value: 50, maxDiscountAmount: 120 };
    const res = await DiscountEngine.evaluate(JSON.parse(JSON.stringify({ items: [line(shirt, 1), line(tee, 2)] })), [capped]);
    assert.strictEqual(round(res.discountTotal), 120);
    const lineReduction = res.cartItems.reduce((s, i) => s + (i.price - i.remainingPrice) * i.quantity, 0);
    assert.strictEqual(round(lineReduction), 120);
    const uncapped = await DiscountEngine.evaluate(JSON.parse(JSON.stringify({ items: [line(shirt, 1)] })), [{ ...capped, maxDiscountAmount: 10000 }]);
    assert.strictEqual(round(uncapped.discountTotal), 500, 'a cap above the discount changes nothing');
  });

  console.log('\n--> Custom rules (now connected)');
  const custom = (name, conditions, actions, extra = {}) =>
    DiscountRule.create({ name, type: 'custom', status: 'Active', customConfig: { conditionTree: { operator: 'AND', conditions }, actions }, ...extra });
  await Settings.create({ tenantId: 'default_tenant', shippingMethod: 'Flat', shippingRate: 80 });
  const calc = async (items, extra = {}) =>
    (await post('/cart/calculate', { items: items.map(([p, q]) => ({ productId: p._id, quantity: q })), customerAddress: { city: 'Surat' }, ...extra })).body;

  await check('cart-total condition + percentage action applies automatically (no code needed)', async () => {
    const rule = await custom('Big cart 10%', [{ type: 'CartTotal', operator: '>=', value: 1500 }], [{ type: 'PercentageOff', percentage: 10, applyTo: 'Cart' }]);
    let res = await calc([[shirt, 1]]);
    assert.ok(!res.pricing.appliedDiscounts.some((d) => d.name === 'Big cart 10%'), 'below threshold');
    res = await calc([[shirt, 2]]);
    assert.strictEqual(round(res.pricing.appliedDiscounts.find((d) => d.name === 'Big cart 10%').amount), 200);
    await DiscountRule.deleteOne({ _id: rule._id });
  });

  await check('free-shipping action removes shipping; city condition uses the shipping address', async () => {
    let res = await calc([[mug, 1]]);
    assert.strictEqual(res.pricing.shipping, 80, 'flat shipping before the rule');
    const rule = await custom('Free ship Surat', [{ type: 'Location', value: 'surat' }], [{ type: 'FreeShipping' }]);
    res = await calc([[mug, 1]]);
    assert.strictEqual(res.pricing.shipping, 0);
    res = await calc([[mug, 1]], { customerAddress: { city: 'Mumbai' } });
    assert.strictEqual(res.pricing.shipping, 80, 'other cities still pay shipping');
    await DiscountRule.deleteOne({ _id: rule._id });
  });

  await check('set-price and auto-added free product actions; coded custom rules need the code', async () => {
    const rule = await custom('Tee 299 + pin', [{ type: 'ProductInCart', operator: 'Contains', value: [String(tee._id)] }], [
      { type: 'SetProductPrice', productIds: [String(tee._id)], newPrice: 299 },
      { type: 'FreeProduct', rewardProductId: String(gift._id), quantity: 1, autoAdd: true },
    ], { code: 'TEEDEAL' });
    let res = await calc([[tee, 2]]);
    assert.ok(!res.pricing.appliedDiscounts.some((d) => d.name === 'Tee 299 + pin'), 'needs its code');
    res = await calc([[tee, 2]], { couponCode: 'teedeal' });
    const applied = res.pricing.appliedDiscounts.find((d) => d.name === 'Tee 299 + pin');
    assert.strictEqual(round(applied.amount), 2 * (400 - 299) + 99);
    assert.ok(res.items.some((i) => i.isAutoAddedGift && String(i.productId) === String(gift._id)), 'gift added');
    await DiscountRule.deleteOne({ _id: rule._id });
  });

  await check('inactive custom rules and failing OR-groups do nothing', async () => {
    await custom('Paused custom', [], [{ type: 'PercentageOff', percentage: 50, applyTo: 'Cart' }], { status: 'Paused' });
    await custom('OR group', [{ operator: 'OR', conditions: [{ type: 'TotalCartQuantity', operator: '>=', value: 10 }, { type: 'CartItemCount', operator: '>=', value: 5 }] }], [{ type: 'PercentageOff', percentage: 50, applyTo: 'Cart' }]);
    const res = await calc([[shirt, 1]]);
    assert.strictEqual(res.pricing.appliedDiscounts.length, 0);
  });

  console.log(`\n${stats.passed} Discount engine checks passed${stats.failed ? `, ${stats.failed} failed` : ''}.`);
  if (stats.failed) process.exitCode = 1;
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(stopPlugin);
