import { CartService } from './CartService';
import { getStoreSettings } from './StoreSettings';
import { InventoryService } from './InventoryService';

export class OrderError extends Error {
  status: number;
  details?: unknown;
  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

const isObjectId = (id: unknown) => typeof id === 'string' && /^[a-f0-9]{24}$/i.test(id);
const event = (type: string, message: string) => ({ type, message, at: new Date() });
const money = (n: number) => `₹${(Math.round(n * 100) / 100).toFixed(2)}`;

/** Orders created before payment/fulfillment tracking existed get the equivalent defaults. */
export function normalizeOrder(order: any) {
  if (!order) return order;
  const legacyFulfillment = order.status === 'Delivered' ? 'Delivered' : order.status === 'Shipped' ? 'Shipped' : 'Not fulfilled';
  return {
    ...order,
    source: order.source || 'manual',
    paymentStatus: order.paymentStatus || 'Not paid',
    payment: { capturedAmount: 0, refundedAmount: 0, ...(order.payment || {}) },
    refunds: order.refunds || [],
    fulfillmentStatus: order.fulfillmentStatus || legacyFulfillment,
    fulfillment: order.fulfillment || {},
    notes: order.notes || [],
    events: order.events && order.events.length ? order.events : [{ type: 'placed', message: 'Order placed', at: order.createdAt }],
  };
}

/** Customers are identified by email address, compared case-insensitively (orders are the source of truth). */
export const CUSTOMER_KEY = { $toLower: { $trim: { input: { $ifNull: ['$customerDetails.email', ''] } } } };

function addressToString(a: any): string {
  if (!a) return '';
  return [a.addressLine1, a.addressLine2, a.city, a.state, a.postalCode, a.country].map((p) => String(p || '').trim()).filter(Boolean).join(', ');
}

export class OrderService {
  static getModel() {
    return require('../models/Order').getModel();
  }

  /** Reads through the raw collection so every stored field is returned whatever schema Mongoose has cached. */
  static async findRaw(id: string, tenantId: string) {
    if (!isObjectId(id)) throw new OrderError(400, 'Invalid order id.');
    const mongoose = require('mongoose');
    const raw = await this.getModel().collection.findOne({ _id: new mongoose.Types.ObjectId(id), tenantId });
    if (!raw) throw new OrderError(404, 'Order not found.');
    return raw;
  }

  static async get(id: string, tenantId: string) {
    return normalizeOrder(await this.findRaw(id, tenantId));
  }

  /** Puts stock back for the order's lines (free gifts were never deducted). */
  static async restock(items: any[]) {
    const Product = require('../models/Product').getModel();
    const flags = await InventoryService.flagsFor((items || []).map((i: any) => String(i.productId)));
    for (const item of items || []) {
      if (item.isFreeGift || item.isAutoAddedGift) continue;
      // Untracked items never had stock taken.
      if (flags.get(`${item.productId}:${item.variantId || ''}`)?.track === false) continue;
      const qty = Number(item.quantity) || 0;
      if (qty <= 0) continue;
      if (item.variantId) {
        await Product.updateOne({ _id: item.productId, 'variants._id': item.variantId }, { $inc: { 'variants.$.stock': qty } });
      } else {
        await Product.updateOne({ _id: item.productId }, { $inc: { stock: qty } });
      }
    }
  }

  /**
   * Prices the cart with the shared pipeline and turns it into an order.
   * Stock is reserved atomically per product/variant so two orders can't oversell; everything is rolled back on failure.
   */
  static async place(body: any, ctx: { tenantId: string; user: any; source: 'admin_cart' | 'storefront' | 'manual' }) {
    const Order = this.getModel();
    const Product = require('../models/Product').getModel();
    const DiscountRule = require('../models/DiscountRule').getModel();

    const customer = body.customerDetails || {};
    const name = String(customer.name || '').trim();
    const email = String(customer.email || '').trim();
    const shippingAddress = body.customerAddress && typeof body.customerAddress === 'object' ? body.customerAddress : null;
    const addressText = addressToString(shippingAddress) || String(customer.address || '').trim();
    const missing = [!name && 'name', !email && 'email', !addressText && 'address'].filter(Boolean);
    if (missing.length) throw new OrderError(400, `Customer ${missing.join(', ')} ${missing.length > 1 ? 'are' : 'is'} required.`);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new OrderError(400, 'Enter a valid customer email.');

    const { processedItems, pricing, stockIssues } = await CartService.price(body, { tenantId: ctx.tenantId, includeUnpublished: Boolean(ctx.user) });
    if (processedItems.length === 0) throw new OrderError(400, 'The cart is empty.');
    if (stockIssues.length) {
      const first = stockIssues[0];
      throw new OrderError(409, `Insufficient stock for ${first.name} (requested ${first.requested}, available ${first.available}).`, { stockIssues });
    }

    const reserved: any[] = [];
    const flags = await InventoryService.flagsFor(processedItems.map((i: any) => String(i.productId)));
    try {
      for (const item of processedItems) {
        if (item.isFreeGift || item.isAutoAddedGift) continue;
        const qty = Number(item.quantity) || 0;
        const flag = flags.get(`${item.productId}:${item.variantId || ''}`);
        if (flag?.track === false) continue; // not tracked: no stock taken or held
        // Backorders may sell past zero; everything else must still be available (atomic check).
        const enough = flag?.backorder ? {} : { $gte: qty };
        const result = item.variantId
          ? await Product.updateOne(
              { _id: item.productId, variants: { $elemMatch: flag?.backorder ? { _id: item.variantId } : { _id: item.variantId, stock: enough } } },
              { $inc: { 'variants.$.stock': -qty } }
            )
          : await Product.updateOne(flag?.backorder ? { _id: item.productId } : { _id: item.productId, stock: enough }, { $inc: { stock: -qty } });
        if (!result.modifiedCount) throw new OrderError(409, `Insufficient stock for ${item.name}.`);
        reserved.push(item);
      }

      // Same number pattern as the model default, with the prefix from Settings → General.
      const { orderPrefix } = await getStoreSettings();
      const order = await new Order({
        tenantId: ctx.tenantId,
        orderNumber: (orderPrefix || 'ORD-') + Date.now().toString().slice(-6) + Math.floor(Math.random() * 1000).toString().padStart(3, '0'),
        source: ctx.source,
        customerDetails: { name, email, phone: String(customer.phone || '').trim() || undefined, address: addressText },
        shippingAddress: shippingAddress || undefined,
        couponCode: body.couponCode ? String(body.couponCode).trim() : undefined,
        items: processedItems.map(({ _appliedTaxRule, taxClassId, categoryId, ...item }: any) => item),
        pricing: {
          subtotal: pricing.subtotal,
          tax: pricing.tax,
          shipping: pricing.shipping,
          discount: pricing.discount,
          totalAmount: pricing.totalAmount,
          appliedDiscounts: pricing.appliedDiscounts,
          shippingSnapshot: pricing.shippingSnapshot,
          taxSnapshot: pricing.taxSnapshot,
        },
        status: 'Pending',
        paymentStatus: 'Not paid',
        fulfillmentStatus: 'Not fulfilled',
        events: [event('placed', ctx.source === 'admin_cart' ? 'Order placed from the Admin cart' : 'Order placed')],
      }).save();

      // Count coupon / rule usage once per order so usage limits are enforced.
      const ruleIds = [...new Set((pricing.appliedDiscounts || []).map((d: any) => String(d.ruleId || '')).filter(isObjectId))];
      if (ruleIds.length) await DiscountRule.updateMany({ _id: { $in: ruleIds } }, { $inc: { usedCount: 1 } });

      // Hold the sold units at a location until the order is packed. The order already exists, so a
      // failure here must not undo it; inventory can be corrected from the Inventory page.
      try {
        await InventoryService.reserveForOrder(order.toObject ? order.toObject() : order);
      } catch (err) {
        console.error('[ecommerce-plugin] Could not reserve inventory for order', order?.orderNumber, err);
      }

      return order;
    } catch (error) {
      await this.restock(reserved);
      throw error;
    }
  }

  /**
   * Applies a validated change plus a timeline event. Written through the raw collection (values are validated
   * above) so new fields persist even if the host still has an older Order schema cached.
   */
  private static async update(
    id: string,
    tenantId: string,
    set: Record<string, unknown>,
    ev: { type: string; message: string },
    push: Record<string, unknown> = {}
  ) {
    const mongoose = require('mongoose');
    const $set = Object.fromEntries(Object.entries({ ...set, updatedAt: new Date() }).filter(([, v]) => v !== undefined));
    await this.getModel().collection.updateOne(
      { _id: new mongoose.Types.ObjectId(id), tenantId },
      { $set, $push: { events: { ...ev, at: new Date() }, ...push } }
    );
    return this.get(id, tenantId);
  }

  static async cancel(id: string, tenantId: string) {
    const order = normalizeOrder(await this.findRaw(id, tenantId));
    if (order.status === 'Cancelled') throw new OrderError(409, 'This order is already cancelled.');
    if (order.fulfillmentStatus === 'Shipped' || order.fulfillmentStatus === 'Delivered') {
      throw new OrderError(409, 'Shipped or delivered orders cannot be cancelled.');
    }
    await InventoryService.releaseOrder(order);
    await this.restock(order.items);
    const ruleIds = [...new Set((order.pricing?.appliedDiscounts || []).map((d: any) => String(d.ruleId || '')).filter(isObjectId))];
    if (ruleIds.length) {
      const DiscountRule = require('../models/DiscountRule').getModel();
      await DiscountRule.updateMany({ _id: { $in: ruleIds }, usedCount: { $gt: 0 } }, { $inc: { usedCount: -1 } });
    }
    const paidNote = order.paymentStatus === 'Paid' || order.paymentStatus === 'Partially refunded' ? ' Payment was not refunded automatically.' : '';
    return this.update(id, tenantId, { status: 'Cancelled', canceledAt: new Date() }, { type: 'canceled', message: `Order cancelled and stock returned.${paidNote}` });
  }

  static async capturePayment(id: string, tenantId: string, input: { method?: string; reference?: string }) {
    const order = normalizeOrder(await this.findRaw(id, tenantId));
    if (order.status === 'Cancelled') throw new OrderError(409, 'Cancelled orders cannot be marked as paid.');
    if (order.paymentStatus !== 'Not paid') throw new OrderError(409, 'Payment has already been recorded for this order.');
    const amount = Number(order.pricing?.totalAmount) || 0;
    const method = String(input.method || 'Manual').trim();
    return this.update(
      id,
      tenantId,
      {
        paymentStatus: 'Paid',
        'payment.method': method,
        'payment.reference': String(input.reference || '').trim() || undefined,
        'payment.capturedAmount': amount,
        'payment.capturedAt': new Date(),
        'payment.refundedAmount': Number(order.payment?.refundedAmount) || 0,
      },
      { type: 'payment', message: `Payment of ${money(amount)} recorded (${method})` }
    );
  }

  static async refund(id: string, tenantId: string, input: { amount?: unknown; reason?: string; note?: string }) {
    const order = normalizeOrder(await this.findRaw(id, tenantId));
    const captured = Number(order.payment?.capturedAmount) || 0;
    const refunded = Number(order.payment?.refundedAmount) || 0;
    if (captured <= 0) throw new OrderError(409, 'Only paid orders can be refunded.');
    const amount = Math.round(Number(input.amount) * 100) / 100;
    if (!Number.isFinite(amount) || amount <= 0) throw new OrderError(400, 'Enter a refund amount greater than 0.');
    const remaining = Math.round((captured - refunded) * 100) / 100;
    if (amount > remaining) throw new OrderError(400, `You can refund at most ${money(remaining)}.`);
    const totalRefunded = Math.round((refunded + amount) * 100) / 100;
    const reason = String(input.reason || '').trim();
    return this.update(
      id,
      tenantId,
      { 'payment.refundedAmount': totalRefunded, paymentStatus: totalRefunded >= captured ? 'Refunded' : 'Partially refunded' },
      { type: 'refund', message: `Refunded ${money(amount)}${reason ? ` — ${reason}` : ''}` },
      { refunds: { amount, reason, note: String(input.note || '').trim(), at: new Date() } }
    );
  }

  static async fulfillment(id: string, tenantId: string, input: { action?: string; carrier?: string; trackingNumber?: string }) {
    const order = normalizeOrder(await this.findRaw(id, tenantId));
    if (order.status === 'Cancelled') throw new OrderError(409, 'Cancelled orders cannot be fulfilled.');
    const carrier = String(input.carrier || '').trim();
    const trackingNumber = String(input.trackingNumber || '').trim();
    const shippingInfo: Record<string, unknown> = {};
    if (carrier) shippingInfo['fulfillment.carrier'] = carrier;
    if (trackingNumber) shippingInfo['fulfillment.trackingNumber'] = trackingNumber;
    const tracking = trackingNumber ? ` · ${carrier ? `${carrier} ` : ''}${trackingNumber}` : '';

    // Each step can only follow the previous one: Not fulfilled → Fulfilled → Shipped → Delivered.
    const steps: Record<string, { from: string; to: string; status: string; at: string; message: string }> = {
      fulfill: { from: 'Not fulfilled', to: 'Fulfilled', status: 'Processing', at: 'fulfillment.fulfilledAt', message: 'Items packed and marked as fulfilled' },
      ship: { from: 'Fulfilled', to: 'Shipped', status: 'Shipped', at: 'fulfillment.shippedAt', message: 'Marked as shipped' },
      deliver: { from: 'Shipped', to: 'Delivered', status: 'Delivered', at: 'fulfillment.deliveredAt', message: 'Marked as delivered' },
    };
    const step = steps[String(input.action)];
    if (!step) throw new OrderError(400, 'Unknown fulfillment action.');
    if (order.fulfillmentStatus !== step.from) {
      throw new OrderError(409, `This order is ${order.fulfillmentStatus.toLowerCase()}; it can't be marked as ${step.to.toLowerCase()} yet.`);
    }
    // Packing the order takes its reserved units off the shelf.
    if (input.action === 'fulfill') await InventoryService.fulfillOrder(order);
    return this.update(
      id,
      tenantId,
      { fulfillmentStatus: step.to, status: step.status, [step.at]: new Date(), ...shippingInfo },
      { type: 'fulfillment', message: `${step.message}${tracking}` }
    );
  }

  static async addNote(id: string, tenantId: string, text: unknown) {
    await this.findRaw(id, tenantId);
    const note = String(text || '').trim();
    if (!note) throw new OrderError(400, 'Write a note first.');
    if (note.length > 2000) throw new OrderError(400, 'Notes can be at most 2000 characters.');
    return this.update(id, tenantId, {}, { type: 'note', message: note }, { notes: { text: note, at: new Date() } });
  }
}
