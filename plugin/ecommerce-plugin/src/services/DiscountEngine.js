export class DiscountEngine {
    static async evaluate(cart, rules) {
        const Product = require('../models/Product').getModel();
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
            if (!rule.isAutomatic && ruleCode2 !== passedCode2 && !activatedByCampaign)
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
        validRules.sort((a, b) => {
            const aSpecific = a.targetProductIds && a.targetProductIds.length > 0 ? 1 : 0;
            const bSpecific = b.targetProductIds && b.targetProductIds.length > 0 ? 1 : 0;
            return bSpecific - aSpecific;
        });
        for (const rule of validRules) {
            let ruleTotalAmount = 0;
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
            else if (rule.type === 'buy_x_get_y' && rule.buyXGetY) {
                const bogo = rule.buyXGetY;
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
                units.sort((a, b) => b.ref.remainingPrice - a.ref.remainingPrice);
                const isBuyEligible = (u) => {
                    if (bogo.buyTargetType === 'SpecificProduct' || bogo.buyTargetType === 'MultipleProducts') {
                        return bogo.buyTargetIds.includes(u.ref.productId.toString());
                    }
                    else if (bogo.buyTargetType === 'Category') {
                        return bogo.buyTargetIds.includes(u.ref.categoryId?.toString());
                    }
                    return true; // Entire Store
                };
                const isRewardEligible = (u) => {
                    if (bogo.rewardTargetType === 'SpecificProduct' || bogo.rewardTargetType === 'MultipleProducts') {
                        return bogo.rewardTargetIds.includes(u.ref.productId.toString());
                    }
                    else if (bogo.rewardTargetType === 'Category') {
                        return bogo.rewardTargetIds.includes(u.ref.categoryId?.toString());
                    }
                    return false;
                };
                let setsApplied = 0;
                let continueApplying = true;
                while (continueApplying) {
                    if (!bogo.repeat && setsApplied >= 1)
                        break;
                    const availableBuyUnits = units.filter((u) => !u.usedAsBuy && !u.usedAsReward && isBuyEligible(u));
                    if (availableBuyUnits.length < (bogo.buyQuantity || 1)) {
                        continueApplying = false;
                        break;
                    }
                    const buyGroup = availableBuyUnits.slice(0, (bogo.buyQuantity || 1));
                    buyGroup.forEach((u) => u.usedAsBuy = true);
                    const remainingForReward = units.filter((u) => !u.usedAsBuy && !u.usedAsReward && isRewardEligible(u))
                        .sort((a, b) => a.ref.remainingPrice - b.ref.remainingPrice);
                    let rewardGroup = remainingForReward.slice(0, (bogo.rewardQuantity || 1));
                    // Auto-add Free Gift if it's missing from the cart and rule says Specific Product!
                    if (rewardGroup.length < (bogo.rewardQuantity || 1) && bogo.rewardTargetIds && bogo.rewardTargetIds.length > 0 && (bogo.rewardTargetType === 'SpecificProduct' || bogo.rewardTargetType === 'MultipleProducts')) {
                        const missingCount = (bogo.rewardQuantity || 1) - rewardGroup.length;
                        for (let m = 0; m < missingCount; m++) {
                            const targetId = bogo.rewardTargetIds[0];
                            const product = await Product.findById(targetId);
                            if (product) {
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
                                    usedAsReward: true
                                };
                                units.push(newUnit);
                                rewardGroup.push(newUnit);
                            }
                        }
                    }
                    if (rewardGroup.length > 0) {
                        rewardGroup.forEach((u) => u.usedAsReward = true);
                        setsApplied++;
                    }
                    else {
                        buyGroup.forEach((u) => u.usedAsBuy = false);
                        continueApplying = false;
                        break;
                    }
                }
                const rewardedUnits = units.filter((u) => u.usedAsReward);
                for (const ru of rewardedUnits) {
                    const rewardType = bogo.rewardType || 'Free';
                    const rewardValue = bogo.rewardValue !== undefined ? bogo.rewardValue : 100;
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
            else if (rule.type === 'spend_x_get_y' && rule.spendXGetY) {
                const conf = rule.spendXGetY;
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
                            const product = await Product.findById(targetId);
                            if (product) {
                                const newGiftItem = {
                                    productId: product._id,
                                    categoryId: product.categoryId,
                                    name: product.name,
                                    price: product.price,
                                    originalPrice: product.price,
                                    quantity: availableMultipliers,
                                    remainingPrice: 0,
                                    appliedDiscounts: [],
                                    isAutoAddedGift: true
                                };
                                items.push(newGiftItem);
                                freeProductValue += (product.price * availableMultipliers);
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
            if (ruleTotalAmount > 0) {
                discountTotal += ruleTotalAmount;
                appliedDiscounts.push({
                    ruleId: rule._id,
                    name: rule.name,
                    type: rule.type,
                    amount: ruleTotalAmount
                });
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
