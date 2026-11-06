"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DiscountEngine = void 0;
class DiscountEngine {
    static resolveCatalogProductPricing(product, rawDiscountPercentage) {
        const basePrice = Math.max(0, Number(product?.price) || 0);
        const rawDiscount = rawDiscountPercentage !== undefined ? rawDiscountPercentage : product?.discountPercentage;
        const discountPercentage = Math.min(100, Math.max(0, Number(rawDiscount) || 0));
        let catalogPrice = basePrice;
        if (discountPercentage > 0) {
            catalogPrice = Number((basePrice * (1 - discountPercentage / 100)).toFixed(2));
        }
        else if (product?.discountPrice !== undefined &&
            product?.discountPrice !== null &&
            product?.discountPrice !== '') {
            const explicitDiscountPrice = Number(product.discountPrice);
            if (Number.isFinite(explicitDiscountPrice) &&
                explicitDiscountPrice >= 0 &&
                explicitDiscountPrice < basePrice) {
                catalogPrice = Number(explicitDiscountPrice.toFixed(2));
            }
        }
        const compareAtPrice = catalogPrice < basePrice ? basePrice : null;
        return {
            basePrice,
            catalogPrice,
            compareAtPrice,
            discountPercentage,
        };
    }
    /**
     * Applies the active rules to a cart. Rules marked `stackingPolicy: 'exclusive'` never combine with others:
     * the cart is priced with each exclusive rule on its own and with all stackable rules together, and the
     * customer gets whichever gives the larger discount. Without exclusive rules this is a single pass.
     */
    static async evaluate(cart, rules) {
        const isExclusive = (r) => r.type !== 'campaign' && r.stackingPolicy === 'exclusive';
        const exclusive = rules.filter(isExclusive);
        if (exclusive.length === 0)
            return this.evaluateRuleSet(cart, rules);
        const campaigns = rules.filter((r) => r.type === 'campaign');
        let best = await this.evaluateRuleSet(cart, rules.filter((r) => !isExclusive(r)));
        for (const rule of exclusive) {
            // Campaign parents are kept so a campaign can still activate its exclusive child rule.
            const candidate = await this.evaluateRuleSet(cart, [...campaigns, rule]);
            if (candidate.discountTotal > best.discountTotal + 0.000001 || this.hasFreeShipping(candidate) && !this.hasFreeShipping(best) && candidate.discountTotal >= best.discountTotal) {
                best = candidate;
            }
        }
        return best;
    }
    static hasFreeShipping(result) {
        return (result.appliedDiscounts || []).some((d) => d.isFreeShipping);
    }
    /** Scales one rule's price reductions down so they total at most `cap`; returns the capped total. */
    static capRule(items, before, rule, cap) {
        let measured = 0;
        for (const item of items) {
            const start = before.has(item) ? before.get(item) : Number(item.price) || 0;
            measured += Math.max(0, start - item.remainingPrice) * item.quantity;
        }
        if (measured <= cap)
            return measured;
        const factor = measured > 0 ? cap / measured : 0;
        for (const item of items) {
            const start = before.has(item) ? before.get(item) : Number(item.price) || 0;
            const reduction = Math.max(0, start - item.remainingPrice);
            item.remainingPrice = start - reduction * factor;
            for (const d of item.appliedDiscounts || []) {
                if (String(d.ruleId) === String(rule._id))
                    d.amount = d.amount * factor;
            }
        }
        return cap;
    }
    static async evaluateRuleSet(cart, rules) {
        const Product = require('../models/Product').getModel();
        const { CustomDiscountEvaluator } = require('./CustomDiscountEvaluator');
        let subtotal = cart.items.reduce((sum, item) => sum + (item.originalPrice * item.quantity), 0); // Base off original subtotal for eligibility
        // Wait, cart.items passed by cart.ts has price (after native discount) and originalPrice.
        // Let's use item.price for evaluations.
        let evaluationSubtotal = cart.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        let discountTotal = 0;
        const appliedDiscounts = [];
        const progressNotices = [];
        const now = new Date();
        const campaigns = rules.filter(r => r.type === 'campaign');
        const childRules = rules.filter(r => r.type !== 'campaign');
        const activeCampaignIds = new Set(campaigns.filter(c => {
            if (c.status !== 'Active')
                return false;
            const passedCode1 = (cart.couponCode || '').trim().toLowerCase();
            const ruleCode1 = (c.code || '').trim().toLowerCase();
            if (!c.isAutomatic && ruleCode1 !== passedCode1)
                return false;
            if (c.startDate && new Date(c.startDate) > now)
                return false;
            if (c.endDate && new Date(c.endDate) < now)
                return false;
            if (c.minSubtotal && evaluationSubtotal < c.minSubtotal)
                return false;
            return true;
        }).map(c => String(c._id)));
        const ruleToActiveCampaign = new Map();
        const allChildIdsInCampaigns = new Set();
        for (const c of campaigns) {
            if (c.campaign && c.campaign.childRuleIds) {
                for (const cid of c.campaign.childRuleIds) {
                    allChildIdsInCampaigns.add(String(cid));
                    if (activeCampaignIds.has(String(c._id))) {
                        ruleToActiveCampaign.set(String(cid), true);
                    }
                }
            }
        }
        const validRules = childRules.filter(rule => {
            if (rule.status !== 'Active')
                return false;
            const ruleIdStr = String(rule._id);
            const activatedByCampaign = allChildIdsInCampaigns.has(ruleIdStr) && ruleToActiveCampaign.get(ruleIdStr);
            const passedCode2 = (cart.couponCode || '').trim().toLowerCase();
            const ruleCode2 = (rule.code || '').trim().toLowerCase();
            // Custom rules are condition-driven, so they apply automatically unless they were given a code.
            const automatic = rule.isAutomatic || (rule.type === 'custom' && !ruleCode2);
            if (!automatic && ruleCode2 !== passedCode2 && !activatedByCampaign)
                return false;
            if (rule.startDate && new Date(rule.startDate) > now)
                return false;
            if (rule.endDate && new Date(rule.endDate) < now)
                return false;
            if (rule.minSubtotal && evaluationSubtotal < rule.minSubtotal)
                return false;
            if (rule.usageLimit && rule.usedCount >= rule.usageLimit)
                return false;
            return true;
        });
        const items = cart.items.map((i) => ({
            ...i,
            remainingPrice: i.price,
            appliedDiscounts: []
        }));
        // Higher priority first (default 0 keeps the previous order), then product-specific rules before store-wide ones.
        validRules.sort((a, b) => {
            const byPriority = (Number(b.priority) || 0) - (Number(a.priority) || 0);
            if (byPriority !== 0)
                return byPriority;
            const aSpecific = a.targetProductIds && a.targetProductIds.length > 0 ? 1 : 0;
            const bSpecific = b.targetProductIds && b.targetProductIds.length > 0 ? 1 : 0;
            return bSpecific - aSpecific;
        });
        for (const rule of validRules) {
            let ruleTotalAmount = 0;
            let ruleFreeShipping = false;
            const priceBeforeRule = new Map(items.map((i) => [i, i.remainingPrice]));
            if (rule.type === 'percentage') {
                for (const item of items) {
                    if (rule.targetProductIds && rule.targetProductIds.length > 0 && !rule.targetProductIds.includes(String(item.productId))) {
                        continue;
                    }
                    if (item.remainingPrice <= 0)
                        continue;
                    let itemDiscount = item.remainingPrice * (rule.value / 100);
                    itemDiscount = Math.min(itemDiscount, item.remainingPrice);
                    if (itemDiscount > 0) {
                        item.remainingPrice -= itemDiscount;
                        ruleTotalAmount += (itemDiscount * item.quantity);
                        item.appliedDiscounts.push({ ruleId: rule._id, amount: itemDiscount });
                    }
                }
            }
            else if (rule.type === 'fixed_amount') {
                let eligibleSubtotal = 0;
                const eligibleItems = [];
                for (const item of items) {
                    if (rule.targetProductIds && rule.targetProductIds.length > 0 && !rule.targetProductIds.includes(String(item.productId))) {
                        continue;
                    }
                    if (item.remainingPrice <= 0)
                        continue;
                    eligibleSubtotal += item.remainingPrice * item.quantity;
                    eligibleItems.push(item);
                }
                let discountToApply = Math.min(rule.value, eligibleSubtotal);
                if (discountToApply > 0) {
                    ruleTotalAmount += discountToApply;
                    for (const item of eligibleItems) {
                        const lineTotal = item.remainingPrice * item.quantity;
                        const portion = lineTotal / eligibleSubtotal;
                        const itemDiscountTotal = discountToApply * portion;
                        const perUnitDiscount = itemDiscountTotal / item.quantity;
                        item.remainingPrice -= perUnitDiscount;
                        item.appliedDiscounts.push({ ruleId: rule._id, amount: perUnitDiscount });
                    }
                }
            }
            else if (rule.type === 'buy_x_get_y') {
                // Canonical BOGO Normalization
                const bogo = rule.buyXGetY || {};
                // Backwards compatibility layer for legacy rules that only used global targetProductIds
                let canonicalBuyTargetType = bogo.buyTargetType || 'EntireStore';
                let canonicalBuyTargetIds = (bogo.buyTargetIds || []).map(String);
                let canonicalRewardTargetIds = (bogo.rewardTargetIds || []).map(String);
                let canonicalRewardTargetType = bogo.rewardTargetType || 'SpecificProduct';
                if (!rule.buyXGetY && rule.targetProductIds && rule.targetProductIds.length > 0) {
                    // Legacy rules assumed targeted products were both the Buy and Reward (e.g. Same-Product BOGO)
                    canonicalBuyTargetType = 'SpecificProduct';
                    canonicalBuyTargetIds = rule.targetProductIds.map(String);
                    canonicalRewardTargetIds = rule.targetProductIds.map(String);
                }
                const buyTargetType = canonicalBuyTargetType;
                const buyTargetIds = canonicalBuyTargetIds;
                const buyQuantity = parseInt(bogo.buyQuantity) || 1;
                const rewardTargetType = canonicalRewardTargetType;
                const rewardTargetIds = canonicalRewardTargetIds;
                const rewardQuantity = parseInt(bogo.rewardQuantity) || 1;
                const rewardType = bogo.rewardType || 'Free';
                const rewardValue = parseFloat(bogo.rewardValue) || 100;
                const repeat = bogo.repeat || false;
                let units = [];
                for (const item of items) {
                    for (let i = 0; i < item.quantity; i++) {
                        units.push({
                            ref: item,
                            unitId: Math.random().toString(36).substring(7),
                            usedAsBuy: false,
                            usedAsReward: false
                        });
                    }
                }
                // Sort descending so we pick the most expensive items as Buy X (Customer favorable)
                units.sort((a, b) => b.ref.remainingPrice - a.ref.remainingPrice);
                const isBuyEligible = (u) => {
                    if (buyTargetType === 'SpecificProduct' || buyTargetType === 'MultipleProducts') {
                        return buyTargetIds.includes(String(u.ref.productId));
                    }
                    else if (buyTargetType === 'Category') {
                        return buyTargetIds.includes(String(u.ref.categoryId));
                    }
                    return true; // Entire Store
                };
                const isRewardEligible = (u) => {
                    if (rewardTargetType === 'SpecificProduct' || rewardTargetType === 'MultipleProducts') {
                        return rewardTargetIds.includes(String(u.ref.productId));
                    }
                    else if (rewardTargetType === 'Category') {
                        return rewardTargetIds.includes(String(u.ref.categoryId));
                    }
                    return false;
                };
                let setsApplied = 0;
                let continueApplying = true;
                while (continueApplying) {
                    if (!repeat && setsApplied >= 1)
                        break;
                    // CRITICAL REQUIREMENT: Determine reward-eligible units first.
                    let availableRewardUnits = units.filter((u) => !u.usedAsBuy && !u.usedAsReward && isRewardEligible(u))
                        .sort((a, b) => a.ref.remainingPrice - b.ref.remainingPrice); // Pick cheapest items for reward
                    let rewardGroup = availableRewardUnits.slice(0, rewardQuantity);
                    // Auto-add missing Free Gifts
                    if (rewardGroup.length < rewardQuantity && rewardTargetIds.length > 0 && (rewardTargetType === 'SpecificProduct' || rewardTargetType === 'MultipleProducts')) {
                        let missingCount = rewardQuantity - rewardGroup.length;
                        const targetId = rewardTargetIds[0];
                        let product;
                        try {
                            product = await Product.findById(targetId);
                        }
                        catch (e) { /* ignore */ }
                        if (product && product.status === 'Published' && product.stock > 0) {
                            missingCount = Math.min(missingCount, product.stock);
                            for (let m = 0; m < missingCount; m++) {
                                const newGiftItem = {
                                    productId: product._id,
                                    categoryId: product.categoryId,
                                    name: product.name,
                                    price: product.price,
                                    originalPrice: product.price,
                                    quantity: 1,
                                    remainingPrice: product.price,
                                    appliedDiscounts: [],
                                    isAutoAddedGift: true
                                };
                                items.push(newGiftItem);
                                const newUnit = {
                                    ref: newGiftItem,
                                    unitId: Math.random().toString(36).substring(7),
                                    usedAsBuy: false,
                                    usedAsReward: false
                                };
                                units.push(newUnit);
                                rewardGroup.push(newUnit);
                            }
                        }
                    }
                    if (rewardGroup.length < rewardQuantity) {
                        continueApplying = false;
                        break;
                    }
                    // Reserve Y units
                    rewardGroup.forEach((u) => u.usedAsReward = true);
                    // Now find X units from remaining eligible items
                    const availableBuyUnits = units.filter((u) => !u.usedAsBuy && !u.usedAsReward && isBuyEligible(u));
                    if (availableBuyUnits.length < buyQuantity) {
                        // Insufficient qualifying units, revert the reward reservation
                        rewardGroup.forEach((u) => u.usedAsReward = false);
                        // Also need to remove the auto-added items if they were just added? 
                        // They will just sit there unused and will naturally not affect the subtotal much if free, 
                        // BUT wait! If they are not free, they add to subtotal!
                        // Actually, we can just remove them from items array.
                        rewardGroup.forEach((u) => {
                            if (u.ref.isAutoAddedGift) {
                                const idx = items.indexOf(u.ref);
                                if (idx > -1)
                                    items.splice(idx, 1);
                            }
                        });
                        continueApplying = false;
                        break;
                    }
                    // Reserve X units
                    const buyGroup = availableBuyUnits.slice(0, buyQuantity);
                    buyGroup.forEach((u) => u.usedAsBuy = true);
                    setsApplied++;
                }
                const rewardedUnits = units.filter((u) => u.usedAsReward);
                for (const ru of rewardedUnits) {
                    let unitDiscount = 0;
                    if (rewardType === 'Free') {
                        unitDiscount = ru.ref.remainingPrice;
                    }
                    else if (rewardType === 'PercentageOff') {
                        unitDiscount = ru.ref.remainingPrice * (rewardValue / 100);
                    }
                    else if (rewardType === 'FixedAmountOff') {
                        unitDiscount = Math.min(ru.ref.remainingPrice, rewardValue);
                    }
                    if (unitDiscount > 0) {
                        ruleTotalAmount += unitDiscount;
                        const avgDiscount = unitDiscount / ru.ref.quantity;
                        ru.ref.remainingPrice -= avgDiscount;
                    }
                }
            }
            else if (rule.type === 'spend_x_get_y') {
                // Canonical SpendXGetY Normalization
                const rawConf = rule.spendXGetY || {};
                const conf = {
                    minSpend: rawConf.minSpend !== undefined ? rawConf.minSpend : (rule.minSubtotal || 0),
                    rewardType: rawConf.rewardType || (rule.targetProductIds?.length > 0 ? 'FreeProduct' : 'Percentage'),
                    rewardValue: rawConf.rewardValue !== undefined ? rawConf.rewardValue : (rule.value || 0),
                    rewardTargetIds: (rawConf.rewardTargetIds || []).length > 0 ? rawConf.rewardTargetIds.map(String) : (rule.targetProductIds || []).map(String),
                    maxDiscount: rawConf.maxDiscount,
                    repeat: rawConf.repeat || false
                };
                const currentEligible = items.reduce((sum, i) => {
                    if (rule.targetProductIds && rule.targetProductIds.length > 0 && !rule.targetProductIds.includes(String(i.productId))) {
                        return sum;
                    }
                    return sum + (i.remainingPrice * i.quantity);
                }, 0);
                if (currentEligible >= conf.minSpend) {
                    let multipliers = 1;
                    if (conf.repeat && conf.rewardType !== 'Percentage') {
                        multipliers = Math.floor(currentEligible / conf.minSpend);
                    }
                    let rVal = 0;
                    if (conf.rewardType === 'FixedAmount') {
                        rVal = conf.rewardValue * multipliers;
                        if (conf.maxDiscount)
                            rVal = Math.min(rVal, conf.maxDiscount);
                        rVal = Math.min(rVal, currentEligible);
                        if (rVal > 0) {
                            ruleTotalAmount += rVal;
                            for (const item of items) {
                                if (item.remainingPrice <= 0)
                                    continue;
                                if (rule.targetProductIds && rule.targetProductIds.length > 0 && !rule.targetProductIds.includes(String(item.productId)))
                                    continue;
                                const lineTotal = item.remainingPrice * item.quantity;
                                const portion = lineTotal / currentEligible;
                                const itemDiscountTotal = rVal * portion;
                                const perUnitDiscount = itemDiscountTotal / item.quantity;
                                item.remainingPrice -= perUnitDiscount;
                            }
                        }
                    }
                    else if (conf.rewardType === 'Percentage') {
                        rVal = currentEligible * (conf.rewardValue / 100);
                        if (conf.maxDiscount)
                            rVal = Math.min(rVal, conf.maxDiscount);
                        if (rVal > 0) {
                            ruleTotalAmount += rVal;
                            for (const item of items) {
                                if (item.remainingPrice <= 0)
                                    continue;
                                if (rule.targetProductIds && rule.targetProductIds.length > 0 && !rule.targetProductIds.includes(String(item.productId)))
                                    continue;
                                const lineTotal = item.remainingPrice * item.quantity;
                                const portion = lineTotal / currentEligible;
                                const itemDiscountTotal = rVal * portion;
                                const perUnitDiscount = itemDiscountTotal / item.quantity;
                                item.remainingPrice -= perUnitDiscount;
                            }
                        }
                    }
                    else if (conf.rewardType === 'FreeProduct' && conf.rewardTargetIds && conf.rewardTargetIds.length > 0) {
                        let freeProductValue = 0;
                        let availableMultipliers = multipliers;
                        for (const item of items) {
                            if (availableMultipliers <= 0)
                                break;
                            if (conf.rewardTargetIds.includes(String(item.productId)) && item.remainingPrice > 0) {
                                const qtyToFree = Math.min(item.quantity, availableMultipliers);
                                const freeValue = item.remainingPrice * qtyToFree;
                                if (freeValue > 0) {
                                    freeProductValue += freeValue;
                                    availableMultipliers -= qtyToFree;
                                    const perUnitDiscount = freeValue / item.quantity;
                                    item.remainingPrice -= perUnitDiscount;
                                }
                            }
                        }
                        // Auto-add remaining missing gifts if needed
                        if (availableMultipliers > 0) {
                            const targetId = conf.rewardTargetIds[0];
                            let product;
                            try {
                                product = await Product.findById(targetId);
                            }
                            catch (e) { /* ignore Invalid ObjectId errors */ }
                            if (product && product.status === 'Published' && product.stock > 0) {
                                const finalQty = Math.min(availableMultipliers, product.stock);
                                const newGiftItem = {
                                    productId: product._id,
                                    categoryId: product.categoryId,
                                    name: product.name,
                                    price: product.price,
                                    originalPrice: product.price,
                                    quantity: finalQty,
                                    remainingPrice: 0,
                                    appliedDiscounts: [],
                                    isAutoAddedGift: true
                                };
                                items.push(newGiftItem);
                                freeProductValue += (product.price * finalQty);
                            }
                        }
                        if (freeProductValue > 0) {
                            ruleTotalAmount += freeProductValue;
                        }
                    }
                }
                else {
                    const short = conf.minSpend - currentEligible;
                    progressNotices.push(`Spend ₹${short.toFixed(2)} more to unlock a discount!`);
                }
            }
            else if (rule.type === 'custom') {
                const config = rule.customConfig || {};
                const city = cart.customerAddress?.city ? String(cart.customerAddress.city) : '';
                const passes = CustomDiscountEvaluator.evaluateConditions(config.conditionTree, { items, evaluationSubtotal, city });
                if (passes && Array.isArray(config.actions) && config.actions.length > 0) {
                    const outcome = await CustomDiscountEvaluator.executeActions(config.actions, items, rule, Product);
                    ruleTotalAmount += outcome.ruleTotalAmount;
                    ruleFreeShipping = Boolean(outcome.meta?.isFreeShipping);
                    progressNotices.push(...(outcome.progressNotices || []));
                }
            }
            const cap = Number(rule.maxDiscountAmount);
            if (Number.isFinite(cap) && cap > 0 && ruleTotalAmount > cap) {
                ruleTotalAmount = this.capRule(items, priceBeforeRule, rule, cap);
            }
            if (ruleTotalAmount > 0 || ruleFreeShipping) {
                discountTotal += ruleTotalAmount;
                let rewardProductId;
                let rewardQuantity = 0;
                if (rule.type === 'buy_x_get_y' && rule.buyXGetY?.rewardTargetType === 'SpecificProduct' && rule.buyXGetY?.rewardTargetIds?.length > 0) {
                    rewardProductId = rule.buyXGetY.rewardTargetIds[0];
                    const bogoMatches = items.filter(i => i.appliedDiscounts?.find(d => d.ruleId === rule._id));
                    rewardQuantity = bogoMatches.length > 0 ? bogoMatches.length : (rule.buyXGetY.rewardQuantity || 1);
                }
                else if (rule.type === 'spend_x_get_y' && rule.spendXGetY?.rewardType === 'FreeProduct' && rule.spendXGetY?.rewardTargetIds?.length > 0) {
                    rewardProductId = rule.spendXGetY.rewardTargetIds[0];
                }
                let rewardProductName;
                let originalPrice = 0;
                let isFreeGift = false;
                if (rewardProductId) {
                    const rewardItem = items.find((i) => String(i.productId) === String(rewardProductId));
                    if (rewardItem) {
                        rewardProductName = rewardItem.name;
                        originalPrice = rewardItem.originalPrice || rewardItem.price;
                        if (rule.type === 'buy_x_get_y' && rule.buyXGetY?.rewardType === 'Free')
                            isFreeGift = true;
                        if (rule.type === 'spend_x_get_y' && rule.spendXGetY?.rewardType === 'FreeProduct')
                            isFreeGift = true;
                    }
                }
                const md = {
                    ruleId: rule._id,
                    ruleName: rule.name,
                    name: rule.name,
                    type: rule.type,
                    amount: ruleTotalAmount,
                    discountAmount: ruleTotalAmount
                };
                // Lets the storefront show which entered coupon code took effect.
                if (rule.code)
                    md.code = String(rule.code);
                if (rewardProductId)
                    md.rewardProductId = rewardProductId;
                if (rewardProductName)
                    md.rewardProductName = rewardProductName;
                if (rewardQuantity)
                    md.rewardQuantity = rewardQuantity;
                if (originalPrice)
                    md.originalPrice = originalPrice;
                if (isFreeGift)
                    md.isFreeGift = isFreeGift;
                // ShippingService reads this flag and charges no shipping.
                if (ruleFreeShipping)
                    md.isFreeShipping = true;
                appliedDiscounts.push(md);
            }
        }
        // Clean up cart items if an auto-added gift is no longer valid
        // Wait, we generate the items from scratch per evaluation. If an old auto-added gift was passed in cart, 
        // it will be filtered naturally by standard checkout matching or we can explicitly remove it before evaluation.
        // The cart should just return the final list of items.
        // Auto-added gifts need to artificially inflate the subtotal so their discount offsets correctly in the bill
        for (const item of items) {
            if (item.isAutoAddedGift) {
                evaluationSubtotal += (item.originalPrice * item.quantity);
            }
        }
        if (discountTotal > evaluationSubtotal)
            discountTotal = evaluationSubtotal;
        return {
            cartItems: items,
            discountTotal,
            appliedDiscounts,
            progressNotices,
            subtotal: evaluationSubtotal,
            totalAmount: Math.max(0, evaluationSubtotal - discountTotal)
        };
    }
}
exports.DiscountEngine = DiscountEngine;
