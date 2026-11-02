"use strict";
const CartService_1 = require("../services/CartService");
module.exports = (app) => {
    app.post('/cart/calculate', async (req, res) => {
        try {
            const { items } = req.body || {};
            if (!items || !Array.isArray(items))
                return res.json({ success: false, message: 'Invalid items array' });
            const { resolveTenantId } = require('./storefront');
            const tenantId = typeof resolveTenantId === 'function' ? resolveTenantId(req) : 'default_tenant';
            // Signed-in admins may price unpublished products; anonymous storefront carts may not.
            const { processedItems, pricing, stockIssues } = await CartService_1.CartService.price(req.body, { tenantId, includeUnpublished: Boolean(req.user) });
            const sanitizedItems = processedItems.map((item) => {
                const { _appliedTaxRule, taxClassId, ...safeItem } = item;
                return safeItem;
            });
            res.json({ success: true, pricing, items: sanitizedItems, stockIssues });
        }
        catch (e) {
            res.status(500).json({ success: false, message: e.message });
        }
    });
};
