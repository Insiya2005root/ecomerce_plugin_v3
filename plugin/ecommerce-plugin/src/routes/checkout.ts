import { OrderError, OrderService } from '../services/OrderService';

export = (app: any) => {
  // Prices the cart with the shared CartService (same numbers as /cart/calculate) and creates the order.
  app.post('/checkout', async (req: any, res: any) => {
    try {
      const { customerDetails, items } = req.body || {};
      if (!customerDetails || !items || !Array.isArray(items)) {
        return res.json({ success: false, message: 'Invalid checkout data' });
      }
      const source = req.body.source === 'admin_cart' ? 'admin_cart' : 'manual';
      const order = await OrderService.place(req.body, { tenantId: 'default_tenant', user: req.user, source });
      res.json({ success: true, orderId: order._id, orderNumber: order.orderNumber });
    } catch (e: any) {
      if (e instanceof OrderError) {
        return res.status(e.status).json({ success: false, message: e.message, ...(e.details ? { details: e.details } : {}) });
      }
      res.status(500).json({ success: false, message: e.message });
    }
  });
};
