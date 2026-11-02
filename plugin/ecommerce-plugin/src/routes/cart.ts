import { CartService } from '../services/CartService';

export = (app: any) => {
  app.post('/cart/calculate', async (req: any, res: any) => {
    try {
      const { items } = req.body || {};
      if (!items || !Array.isArray(items)) return res.json({ success: false, message: 'Invalid items array' });

      const { resolveTenantId } = require('./storefront');
      const tenantId = typeof resolveTenantId === 'function' ? resolveTenantId(req) : 'default_tenant';

      // Signed-in admins may price unpublished products; anonymous storefront carts may not.
      const { processedItems, pricing, stockIssues } = await CartService.price(req.body, { tenantId, includeUnpublished: Boolean(req.user) });

      const sanitizedItems = processedItems.map((item: any) => {
        const { _appliedTaxRule, taxClassId, ...safeItem } = item;
        return safeItem;
      });

      res.json({ success: true, pricing, items: sanitizedItems, stockIssues });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e.message });
    }
  });
};
