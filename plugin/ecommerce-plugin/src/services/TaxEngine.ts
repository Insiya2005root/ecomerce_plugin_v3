import Product from '../models/Product';
import Settings from '../models/Settings';

export class TaxEngine {
    static async resolveRule(taxClassId: string, location: any) {
        if (!taxClassId || taxClassId === 'NonTaxable') return null;

        const TaxRuleModel = require('../models/TaxRule').getModel();
        const activeRules = await TaxRuleModel.find({ 
            tenantId: 'default_tenant', 
            taxClassId,
            status: 'Active' 
        });

        if (!activeRules.length) return null;

        // Scoring rules to find best match
        let bestRule = null;
        let bestScore = -1;
        let bestPriority = -1;

        const custCountry = (location?.country || '').toLowerCase();
        const custState = (location?.state || '').toLowerCase();
        const custPostal = (location?.postalCode || '').toLowerCase();

        for (const rule of activeRules) {
            let score = 0;
            const rc = (rule.country || '*').toLowerCase();
            const rs = (rule.state || '*').toLowerCase();
            const rp = (rule.postalScope || '*').toLowerCase();

            // Match country
            if (rc !== '*' && rc !== custCountry) continue;
            if (rc === custCountry) score += 10;

            // Match state
            if (rs !== '*' && rs !== custState) continue;
            if (rs === custState) score += 100;

            // Match postal
            if (rp !== '*' && rp !== custPostal) continue;
            if (rp === custPostal) score += 1000;

            if (score > bestScore || (score === bestScore && rule.priority > bestPriority)) {
                bestScore = score;
                bestPriority = rule.priority;
                bestRule = rule;
            }
        }

        return bestRule;
    }

    static async calculate(items: any[], shippingCost: number, location: any, proratedDiscountRatio: number) {
        const SettingsModel = Settings.getModel();
        const settings = await SettingsModel.findOne({ tenantId: 'default_tenant' });
        
        if (!settings || !settings.taxesEnabled) {
            return { taxTotal: 0, taxLines: [], shippingTax: 0 };
        }

        const defaultClassId = settings.defaultTaxClassId || 'NonTaxable';
        const pricesIncludeTax = settings.pricesIncludeTax === true;
        
        let totalTax = 0;
        let shippingTax = 0;
        const taxLines: any[] = [];
        const configurationErrors: string[] = [];
        const ruleCache: any = {};
        
        // Product Line Item Taxation
        for (const item of items) {
            // Find explicit class or fall back
            let tClass = item.taxClassId;
            if (!tClass || tClass === 'Default') tClass = defaultClassId;
            if (tClass === 'NonTaxable') continue;

            if (ruleCache[tClass] === undefined) {
                ruleCache[tClass] = await this.resolveRule(tClass, location);
            }
            const rule = ruleCache[tClass];
            if (!rule) {
                configurationErrors.push(`No applicable tax rate found for product ${item.productName || item.productId || 'Unknown'}.`);
                continue;
            }

            // item.price is already discounted by product-level discounts.
            // We prorate cart-level discounts using proratedDiscountRatio
            const grossLineTotal = (item.price * item.quantity) * proratedDiscountRatio;

            let totalRuleRate = 0;
            if (rule.components && rule.components.length > 0) {
                totalRuleRate = rule.components.reduce((sum: number, c: any) => sum + c.rate, 0);
            }
            if (totalRuleRate <= 0) continue;

            let itemTaxTotal = 0;
            let taxableBase = grossLineTotal;

            if (pricesIncludeTax) {
                // formula: tax = price - (price / (1 + rate/100))
                taxableBase = grossLineTotal / (1 + (totalRuleRate / 100));
                itemTaxTotal = grossLineTotal - taxableBase;
            } else {
                itemTaxTotal = taxableBase * (totalRuleRate / 100);
            }
            
            totalTax += itemTaxTotal;

            // Generate breakdown lines per component
            for (const c of rule.components) {
                let cTax = 0;
                if (pricesIncludeTax) {
                    cTax = itemTaxTotal * (c.rate / totalRuleRate);
                } else {
                    cTax = taxableBase * (c.rate / 100);
                }
                taxLines.push({
                    label: c.label,
                    taxClass: tClass,
                    rate: c.rate,
                    taxableAmount: taxableBase,
                    taxAmount: cTax,
                    productId: item.productId
                });
            }
            
            // Assign rule context to item so we can use it for shipping logic below
            item._appliedTaxRule = rule;
        }

        // Aggregate identical tax lines
        const aggregatedLines: any[] = [];
        taxLines.forEach(line => {
            const existing = aggregatedLines.find(l => l.label === line.label && l.rate === line.rate);
            if (existing) {
                existing.taxableAmount += line.taxableAmount;
                existing.taxAmount += line.taxAmount;
            } else {
                aggregatedLines.push({
                    label: line.label,
                    rate: line.rate,
                    taxableAmount: line.taxableAmount,
                    taxAmount: line.taxAmount
                });
            }
        });

        // Shipping Taxation
        if (shippingCost > 0) {
            let shipRule = null;
            let isShipTaxable = false;

            // Logic: if any item has a rule that explicitly taxes shipping, use it.
            // Otherwise, fall back to global shipping setting.
            // For simplicity and common practice, we find the highest rate rule applied to cart items that allows shipping tax.
            
            let highestRate = -1;
            for (const item of items) {
                if (item._appliedTaxRule) {
                    const r = item._appliedTaxRule;
                    const rRate = r.components.reduce((sum: number, c: any) => sum + c.rate, 0);
                    
                    let policy = r.shippingTaxPolicy;
                    if (policy === 'UseGlobal') {
                        policy = settings.taxShippingByDefault ? 'Taxable' : 'NonTaxable';
                    }

                    if (policy === 'Taxable' && rRate > highestRate) {
                        highestRate = rRate;
                        shipRule = r;
                    }
                }
            }
            
            // If no line items explicitly taxed shipping, use a default fallback if Global is ON
            if (!shipRule && settings.taxShippingByDefault && defaultClassId !== 'NonTaxable') {
                if (!ruleCache[defaultClassId]) {
                    ruleCache[defaultClassId] = await this.resolveRule(defaultClassId, location);
                }
                shipRule = ruleCache[defaultClassId];
            }

            if (shipRule) {
                const totalRuleRate = shipRule.components.reduce((sum: number, c: any) => sum + c.rate, 0);
                
                let shipTaxableBase = shippingCost;
                let shipTaxTotal = 0;
                
                // Usually shipping is entered as inclusive or exclusive depending on the same setting
                if (pricesIncludeTax) {
                    shipTaxableBase = shippingCost / (1 + (totalRuleRate / 100));
                    shipTaxTotal = shippingCost - shipTaxableBase;
                } else {
                    shipTaxTotal = shipTaxableBase * (totalRuleRate / 100);
                }
                
                shippingTax += shipTaxTotal;
                totalTax += shipTaxTotal;

                for (const c of shipRule.components) {
                    let cTax = 0;
                    if (pricesIncludeTax) {
                        cTax = shipTaxTotal * (c.rate / totalRuleRate);
                    } else {
                        cTax = shipTaxableBase * (c.rate / 100);
                    }
                    
                    const existing = aggregatedLines.find(l => l.label === c.label && l.rate === c.rate);
                    if (existing) {
                        existing.taxAmount += cTax;
                        existing.taxableAmount += shipTaxableBase;
                    } else {
                        aggregatedLines.push({
                            label: c.label + ' (Shipping)',
                            rate: c.rate,
                            taxableAmount: shipTaxableBase,
                            taxAmount: cTax
                        });
                    }
                }
            }
        }

        return {
            taxTotal: totalTax,
            shippingTax: shippingTax,
            taxLines: aggregatedLines,
            configurationErrors
        };
    }
}
