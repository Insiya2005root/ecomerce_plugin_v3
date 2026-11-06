import { OrderError, OrderService } from '../services/OrderService';

// Public storefront routes for shoppers (no admin login): placing an order and the PIN code lookup.
// Only whitelisted fields reach OrderService, and products are priced as anonymous (published only).

const text = (v: unknown, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

function sanitizeItems(raw: unknown) {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 50).flatMap((item: any) => {
    const productId = text(item?.productId, 24);
    const quantity = Math.floor(Number(item?.quantity));
    if (!/^[a-f0-9]{24}$/i.test(productId) || !Number.isFinite(quantity) || quantity <= 0) return [];
    const variantId = text(item?.variantId, 24);
    return [{ productId, quantity: Math.min(99, quantity), ...(/^[a-f0-9]{24}$/i.test(variantId) ? { variantId } : {}) }];
  });
}

export = (app: any) => {
  app.post('/storefront/checkout', async (req: any, res: any) => {
    try {
      const { resolveTenantId } = require('./storefront');
      const tenantId = resolveTenantId(req);
      const body = req.body || {};
      const items = sanitizeItems(body.items);
      if (items.length === 0) return res.status(400).json({ success: false, message: 'Your cart is empty.' });

      const customer = body.customerDetails || {};
      const address = body.customerAddress || {};
      const phone = text(customer.phone, 20);
      if (!/^[+\d][\d\s-]{6,18}$/.test(phone)) {
        return res.status(400).json({ success: false, message: 'Enter a valid phone number.' });
      }
      const postalCode = text(address.postalCode, 6);
      if (!/^[1-9]\d{5}$/.test(postalCode)) {
        return res.status(400).json({ success: false, message: 'Enter a 6-digit PIN code.' });
      }

      const order = await OrderService.place(
        {
          items,
          couponCode: text(body.couponCode, 40) || undefined,
          customerDetails: { name: text(customer.name, 100), email: text(customer.email, 160), phone },
          customerAddress: {
            addressLine1: text(address.addressLine1),
            addressLine2: text(address.addressLine2) || undefined,
            city: text(address.city, 80),
            state: text(address.state, 80),
            postalCode,
            country: 'India',
          },
        },
        { tenantId, user: null, source: 'storefront' }
      );

      const note = text(body.notes, 1000);
      if (note) {
        try {
          await OrderService.addNote(String(order._id), tenantId, `Customer note: ${note}`);
        } catch {
          // The order is placed; a note that fails to save must not fail checkout.
        }
      }

      res.json({
        success: true,
        orderId: String(order._id),
        orderNumber: order.orderNumber,
        totalAmount: order.pricing?.totalAmount ?? 0,
      });
    } catch (e: any) {
      if (e instanceof OrderError) {
        return res.status(e.status).json({ success: false, message: e.message });
      }
      res.status(500).json({ success: false, message: 'Could not place the order. Please try again.' });
    }
  });

  app.get('/storefront/pincode', async (req: any, res: any) => {
    const pin = String(req.query?.pin || '').trim();
    if (!/^[1-9]\d{5}$/.test(pin)) return res.status(400).json({ success: false, message: 'Enter a 6-digit PIN code.' });
    try {
      const { lookupPincode } = require('../services/GeoLookup');
      const info = await lookupPincode(pin);
      if (!info) return res.status(404).json({ success: false, message: `PIN code ${pin} wasn't found.` });
      res.json({ success: true, place: { city: info.city, state: info.state } });
    } catch {
      res.status(502).json({ success: false, message: 'PIN lookup is unavailable. Enter the city and state by hand.' });
    }
  });

  // Order lookup for shoppers (no accounts yet): the order number plus the email used at checkout.
  // Both must match; a miss gives the same answer either way, and each visitor gets a few tries a minute.
  const tries = new Map<string, { n: number; until: number }>();
  app.post('/storefront/order-lookup', async (req: any, res: any) => {
    const who = String(req.ip || req.headers?.['x-forwarded-for'] || 'anon');
    const now = Date.now();
    const t = tries.get(who);
    if (t && t.until > now && t.n >= 10) {
      return res.status(429).json({ success: false, message: 'Too many tries. Wait a minute and try again.' });
    }
    tries.set(who, t && t.until > now ? { n: t.n + 1, until: t.until } : { n: 1, until: now + 60_000 });
    if (tries.size > 5000) tries.clear();

    const orderNumber = text(req.body?.orderNumber, 40).toUpperCase();
    const email = text(req.body?.email, 160).toLowerCase();
    if (!orderNumber || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ success: false, message: 'Enter your order number and email.' });
    }
    try {
      const { resolveTenantId } = require('./storefront');
      const Order = require('../models/Order').getModel();
      const order: any = await Order.findOne({ tenantId: resolveTenantId(req), orderNumber }).lean();
      if (!order || String(order.customerDetails?.email || '').trim().toLowerCase() !== email) {
        return res.status(404).json({ success: false, message: "We couldn't find an order with that number and email." });
      }
      const addr = order.shippingAddress || {};
      res.json({
        success: true,
        order: {
          orderNumber: order.orderNumber,
          placedAt: order.createdAt,
          status: order.status,
          paymentStatus: order.paymentStatus,
          paymentMethod: order.payment?.method || 'COD',
          fulfillmentStatus: order.fulfillmentStatus,
          carrier: order.fulfillment?.carrier || '',
          trackingNumber: order.fulfillment?.trackingNumber || '',
          deliverTo: [addr.city, addr.state, addr.postalCode].filter(Boolean).join(', '),
          items: (order.items || []).map((i: any) => ({
            productId: String(i.productId),
            name: i.name,
            quantity: i.quantity,
            price: i.price,
            isFreeGift: Boolean(i.isFreeGift || i.isAutoAddedGift),
          })),
          pricing: {
            subtotal: order.pricing?.subtotal ?? 0,
            discount: order.pricing?.discount ?? 0,
            shipping: order.pricing?.shipping ?? 0,
            tax: order.pricing?.tax ?? 0,
            totalAmount: order.pricing?.totalAmount ?? 0,
          },
        },
      });
    } catch {
      res.status(500).json({ success: false, message: 'Could not look up the order. Please try again.' });
    }
  });
};
