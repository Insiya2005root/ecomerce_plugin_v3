import Inventory from '../models/Inventory';

const TENANT = 'default_tenant';
/** Levels live here until the store has a real location; they move to the first location added. */
export const UNASSIGNED_LOCATION = 'default';

export class InventoryError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

type Actor = { by?: string };
const isObjectId = (id: unknown) => typeof id === 'string' && /^[a-f0-9]{24}$/i.test(id);
const intOf = (v: unknown) => Math.trunc(Number(v) || 0);

function variantTitle(product: any, variant: any): string {
  const label = [variant?.size, variant?.color].filter(Boolean).join(' / ');
  return variant ? `${product.name}${label ? ` · ${label}` : ''}` : product.name;
}

/**
 * Stock per location (Medusa / Shopify model). Invariant kept by every method here:
 *   product.stock (or variant.stock) === Σ over the item's levels of (stocked − reserved)
 * so the cart, storefront and the atomic oversell check in OrderService keep reading the product's own stock.
 */
export class InventoryService {
  static Item = () => Inventory.items();
  static Level = () => Inventory.levels();
  static Reservation = () => Inventory.reservations();
  static Movement = () => Inventory.movements();

  /** Highest-priority active location (new stock goes here), or the unassigned bucket when there is none. */
  static async primaryLocationId(): Promise<string> {
    const Location = require('../models/Location').getModel();
    const loc = await Location.findOne({ tenantId: TENANT, status: 'Active' }).sort({ priority: -1, createdAt: 1 }).lean();
    return loc ? String(loc._id) : UNASSIGNED_LOCATION;
  }

  static async record(entry: Record<string, unknown>) {
    await this.Movement().create({ tenantId: TENANT, ...entry });
  }

  /** Σ(stocked − reserved) for an item. */
  static async availableOf(itemId: string): Promise<number> {
    const levels = await this.Level().find({ itemId }).lean();
    return levels.reduce((s: number, l: any) => s + (l.stocked || 0) - (l.reserved || 0), 0);
  }

  /** Writes the item's total available back onto the product / variant (the copy everything else reads). */
  static async writeProductStock(item: any) {
    const Product = require('../models/Product').getModel();
    const available = await this.availableOf(String(item._id));
    if (item.variantId) {
      await Product.collection.updateOne({ _id: toObjectId(item.productId), 'variants._id': toObjectId(item.variantId) }, { $set: { 'variants.$.stock': available } });
    } else {
      await Product.collection.updateOne({ _id: toObjectId(item.productId) }, { $set: { stock: available } });
    }
    return available;
  }

  /**
   * Makes the product's inventory items match it: one item per variant (or one for the product), and the
   * product's stock numbers treated as the wanted total available — any difference is applied to the
   * primary location as a "product edit" adjustment. Call after any product create/update/import.
   */
  static async syncProduct(product: any, actor: Actor = {}) {
    if (!product?._id) return;
    const productId = String(product._id);
    const variants: any[] = Array.isArray(product.variants) ? product.variants : [];
    const wanted = variants.length
      ? variants.map((v) => ({ variantId: String(v._id), sku: v.sku || product.sku, title: variantTitle(product, v), stock: intOf(v.stock) }))
      : [{ variantId: '', sku: product.sku, title: product.name, stock: intOf(product.stock) }];

    const existing = await this.Item().find({ tenantId: TENANT, productId }).lean();
    // Items for variants that no longer exist are removed (with their stock records) unless stock is still held for orders.
    for (const item of existing) {
      if (wanted.some((w) => w.variantId === item.variantId)) continue;
      const held = await this.Reservation().countDocuments({ itemId: String(item._id) });
      if (held) continue;
      await Promise.all([this.Level().deleteMany({ itemId: String(item._id) }), this.Item().deleteOne({ _id: item._id })]);
    }

    let primary: string | null = null;
    for (const w of wanted) {
      let item = existing.find((i: any) => i.variantId === w.variantId);
      if (!item) {
        item = (await this.Item().create({ tenantId: TENANT, productId, variantId: w.variantId, sku: w.sku, title: w.title })).toObject();
      } else if (item.sku !== w.sku || item.title !== w.title) {
        await this.Item().updateOne({ _id: item._id }, { $set: { sku: w.sku, title: w.title } });
      }
      const itemId = String(item._id);
      const levels = await this.Level().find({ itemId }).lean();
      const current = levels.reduce((s: number, l: any) => s + (l.stocked || 0) - (l.reserved || 0), 0);
      const diff = w.stock - current;
      if (levels.length && diff === 0) continue;

      primary = primary ?? (await this.primaryLocationId());
      const target = levels.find((l: any) => l.locationId === primary) ?? levels[0];
      const locationId = target ? target.locationId : primary;
      // Stocked never goes below what is reserved there; the product copy is rewritten from the result.
      const before = target?.stocked ?? 0;
      const after = Math.max(target?.reserved ?? 0, before + diff, 0);
      await this.Level().updateOne({ itemId, locationId }, { $set: { stocked: after }, $setOnInsert: { tenantId: TENANT, reserved: 0, incoming: 0 } }, { upsert: true });
      if (after !== before || !levels.length) {
        await this.record({ itemId, locationId, type: levels.length ? 'product_edit' : 'migration', stockedDelta: after - before, stockedAfter: after, reason: levels.length ? 'Stock changed on the product' : 'Inventory created', by: actor.by });
      }
      if (after !== before + diff) await this.writeProductStock({ ...item, _id: itemId });
    }
  }

  private static lastSyncAt = 0;

  /** syncAll at most once a minute (the Inventory pages call this so products written elsewhere still appear). */
  static async syncAllThrottled() {
    if (Date.now() - this.lastSyncAt < 60_000) return;
    this.lastSyncAt = Date.now();
    await this.syncAll();
  }

  /** Creates inventory for every product that has none yet (first run, or products written by older code). */
  static async syncAll() {
    const Product = require('../models/Product').getModel();
    const withItems = new Set((await this.Item().distinct('productId', { tenantId: TENANT })).map(String));
    const cursor = Product.collection.find({}, { projection: { name: 1, sku: 1, stock: 1, variants: 1 } });
    for await (const p of cursor) if (!withItems.has(String(p._id))) await this.syncProduct(p);
  }

  static async removeProduct(productId: string) {
    const items = await this.Item().find({ tenantId: TENANT, productId: String(productId) }).lean();
    const ids = items.map((i: any) => String(i._id));
    await Promise.all([
      this.Level().deleteMany({ itemId: { $in: ids } }),
      this.Reservation().deleteMany({ itemId: { $in: ids } }),
      this.Item().deleteMany({ _id: { $in: items.map((i: any) => i._id) } }),
    ]);
  }

  /** The first location added takes over stock that was waiting unassigned. */
  static async adoptUnassigned(locationId: string) {
    await this.Level().updateMany({ locationId: UNASSIGNED_LOCATION }, { $set: { locationId } });
    await this.Reservation().updateMany({ locationId: UNASSIGNED_LOCATION }, { $set: { locationId } });
  }

  /** Per-item tracking flags for the cart / checkout (untracked items and backorders skip stock limits). */
  static async flagsFor(productIds: string[]): Promise<Map<string, { track: boolean; backorder: boolean }>> {
    const items = await this.Item().find({ tenantId: TENANT, productId: { $in: productIds.map(String) } }, { productId: 1, variantId: 1, trackInventory: 1, allowBackorder: 1 }).lean();
    return new Map(items.map((i: any) => [`${i.productId}:${i.variantId || ''}`, { track: i.trackInventory !== false, backorder: i.allowBackorder === true }]));
  }

  // ---------------------------------------------------------------- Orders

  /**
   * Holds stock for a newly placed order (the product's available stock was already taken by OrderService).
   * Each line reserves at the order's ship-from location when it has the stock, else where most is available.
   */
  static async reserveForOrder(order: any) {
    const preferred = order?.pricing?.shippingSnapshot?.selectedLocationId ? String(order.pricing.shippingSnapshot.selectedLocationId) : null;
    for (const line of order.items || []) {
      if (line.isFreeGift || line.isAutoAddedGift) continue;
      const qty = intOf(line.quantity);
      if (qty <= 0) continue;
      const item = await this.Item().findOne({ tenantId: TENANT, productId: String(line.productId), variantId: line.variantId ? String(line.variantId) : '' }).lean();
      if (!item || item.trackInventory === false) continue;
      const itemId = String(item._id);
      const levels = await this.Level().find({ itemId }).lean();
      const free = (l: any) => (l.stocked || 0) - (l.reserved || 0);
      const pick =
        levels.find((l: any) => l.locationId === preferred && free(l) >= qty) ??
        [...levels].sort((a: any, b: any) => free(b) - free(a))[0];
      const locationId = pick ? pick.locationId : await this.primaryLocationId();
      const level = await this.Level().findOneAndUpdate(
        { itemId, locationId },
        { $inc: { reserved: qty }, $setOnInsert: { tenantId: TENANT, stocked: 0, incoming: 0 } },
        { upsert: true, new: true }
      ).lean();
      await this.Reservation().create({ tenantId: TENANT, itemId, locationId, quantity: qty, orderId: String(order._id), lineKey: `${line.productId}:${line.variantId || ''}`, description: `Order #${order.orderNumber}` });
      await this.record({ itemId, locationId, type: 'order_reserved', reservedDelta: qty, stockedAfter: level.stocked, reservedAfter: level.reserved, orderId: String(order._id), orderNumber: order.orderNumber, reason: 'Order placed' });
    }
  }

  /** Packing the order takes its reserved stock off the shelf. */
  static async fulfillOrder(order: any, actor: Actor = {}) {
    const reservations = await this.Reservation().find({ orderId: String(order._id) }).lean();
    for (const r of reservations) {
      const level = await this.Level().findOneAndUpdate({ itemId: r.itemId, locationId: r.locationId }, { $inc: { stocked: -r.quantity, reserved: -r.quantity } }, { new: true }).lean();
      await this.Reservation().deleteOne({ _id: r._id });
      await this.record({ itemId: r.itemId, locationId: r.locationId, type: 'order_fulfilled', stockedDelta: -r.quantity, reservedDelta: -r.quantity, stockedAfter: level?.stocked, reservedAfter: level?.reserved, orderId: String(order._id), orderNumber: order.orderNumber, reason: 'Order fulfilled', by: actor.by });
    }
  }

  /**
   * Cancelling gives the stock back: an open reservation is simply released; stock that already left the
   * shelf (packed orders, or orders placed before inventory existed) is put back on the shelf.
   * Callers restore the product's available stock separately (OrderService.restock).
   */
  static async releaseOrder(order: any, actor: Actor = {}) {
    const reservations = await this.Reservation().find({ orderId: String(order._id) }).lean();
    const handled = new Set<string>();
    for (const r of reservations) {
      const level = await this.Level().findOneAndUpdate({ itemId: r.itemId, locationId: r.locationId }, { $inc: { reserved: -r.quantity } }, { new: true }).lean();
      await this.Reservation().deleteOne({ _id: r._id });
      handled.add(r.lineKey);
      await this.record({ itemId: r.itemId, locationId: r.locationId, type: 'order_released', reservedDelta: -r.quantity, stockedAfter: level?.stocked, reservedAfter: level?.reserved, orderId: String(order._id), orderNumber: order.orderNumber, reason: 'Order cancelled', by: actor.by });
    }
    const origin = order?.pricing?.shippingSnapshot?.selectedLocationId ? String(order.pricing.shippingSnapshot.selectedLocationId) : null;
    for (const line of order.items || []) {
      if (line.isFreeGift || line.isAutoAddedGift) continue;
      const key = `${line.productId}:${line.variantId || ''}`;
      if (handled.has(key)) continue;
      const qty = intOf(line.quantity);
      const item = await this.Item().findOne({ tenantId: TENANT, productId: String(line.productId), variantId: line.variantId ? String(line.variantId) : '' }).lean();
      if (!item || item.trackInventory === false || qty <= 0) continue;
      const itemId = String(item._id);
      const levels = await this.Level().find({ itemId }).lean();
      const locationId = levels.find((l: any) => l.locationId === origin)?.locationId ?? levels[0]?.locationId ?? (await this.primaryLocationId());
      const level = await this.Level().findOneAndUpdate({ itemId, locationId }, { $inc: { stocked: qty }, $setOnInsert: { tenantId: TENANT, reserved: 0, incoming: 0 } }, { upsert: true, new: true }).lean();
      await this.record({ itemId, locationId, type: 'order_restocked', stockedDelta: qty, stockedAfter: level.stocked, reservedAfter: level.reserved, orderId: String(order._id), orderNumber: order.orderNumber, reason: 'Order cancelled, items back on the shelf', by: actor.by });
    }
  }

  // ---------------------------------------------------------------- Admin changes

  static async getItemOrThrow(id: string) {
    if (!isObjectId(id)) throw new InventoryError(400, 'Invalid inventory item.');
    const item = await this.Item().findOne({ _id: id, tenantId: TENANT }).lean();
    if (!item) throw new InventoryError(404, 'Inventory item not found.');
    return item;
  }

  static async assertLocation(locationId: string) {
    if (locationId === UNASSIGNED_LOCATION) return;
    const Location = require('../models/Location').getModel();
    if (!isObjectId(locationId) || !(await Location.exists({ _id: locationId, tenantId: TENANT }))) throw new InventoryError(400, 'Choose one of your locations.');
  }

  /**
   * Sets (or changes by a delta) the stocked quantity at a location, and optionally the incoming quantity.
   * Stocked can't go below what is reserved there (Medusa rule).
   */
  static async adjust(itemId: string, input: { locationId: string; stocked?: unknown; delta?: unknown; incoming?: unknown; reason?: string; note?: string }, actor: Actor = {}) {
    const item = await this.getItemOrThrow(itemId);
    await this.assertLocation(String(input.locationId));
    const level = (await this.Level().findOne({ itemId, locationId: input.locationId }).lean()) ?? { stocked: 0, reserved: 0, incoming: 0 };
    const hasStocked = input.stocked !== undefined && input.stocked !== '' && input.stocked !== null;
    const hasDelta = input.delta !== undefined && input.delta !== '' && input.delta !== null;
    const next = hasStocked ? Number(input.stocked) : hasDelta ? level.stocked + Number(input.delta) : level.stocked;
    if (!Number.isInteger(next) || next < 0) throw new InventoryError(400, 'Stock must be a whole number of 0 or more.');
    if (next < level.reserved) throw new InventoryError(400, `Stocked quantity can't be less than the ${level.reserved} reserved for orders here.`);
    const incoming = input.incoming === undefined || input.incoming === '' ? level.incoming : Number(input.incoming);
    if (!Number.isInteger(incoming) || incoming < 0) throw new InventoryError(400, 'Incoming must be a whole number of 0 or more.');

    const saved = await this.Level().findOneAndUpdate(
      { itemId, locationId: input.locationId },
      { $set: { stocked: next, incoming }, $setOnInsert: { tenantId: TENANT, reserved: 0 } },
      { upsert: true, new: true }
    ).lean();
    if (next !== level.stocked) {
      await this.record({ itemId, locationId: input.locationId, type: input.reason === 'Received' ? 'received' : 'adjustment', stockedDelta: next - level.stocked, stockedAfter: next, reservedAfter: saved.reserved, reason: String(input.reason || 'Correction'), note: String(input.note || '').trim() || undefined, by: actor.by });
      await this.writeProductStock(item);
    }
    return saved;
  }

  /** Turns locations on/off for an item. A location still holding or expecting stock can't be removed. */
  static async setLocations(itemId: string, locationIds: string[]) {
    await this.getItemOrThrow(itemId);
    for (const id of locationIds) await this.assertLocation(id);
    const levels = await this.Level().find({ itemId }).lean();
    for (const l of levels) {
      if (locationIds.includes(l.locationId)) continue;
      if (l.stocked || l.reserved || l.incoming) throw new InventoryError(409, 'A location that still has stocked, reserved or incoming units can’t be removed. Set them to 0 first.');
    }
    await this.Level().deleteMany({ itemId, locationId: { $nin: locationIds } });
    for (const locationId of locationIds) {
      await this.Level().updateOne({ itemId, locationId }, { $setOnInsert: { tenantId: TENANT, stocked: 0, reserved: 0, incoming: 0 } }, { upsert: true });
    }
  }

  /** A manual hold (e.g. for a phone order). Only what is available at that location can be reserved. */
  static async createReservation(input: { itemId: string; locationId: string; quantity: unknown; description?: string }, actor: Actor = {}) {
    const item = await this.getItemOrThrow(input.itemId);
    await this.assertLocation(String(input.locationId));
    const qty = Number(input.quantity);
    if (!Number.isInteger(qty) || qty < 1) throw new InventoryError(400, 'Reserve at least 1.');
    const level = await this.Level().findOneAndUpdate(
      { itemId: input.itemId, locationId: input.locationId, $expr: { $gte: [{ $subtract: ['$stocked', '$reserved'] }, qty] } },
      { $inc: { reserved: qty } },
      { new: true }
    ).lean();
    if (!level) {
      const current = await this.Level().findOne({ itemId: input.itemId, locationId: input.locationId }).lean();
      const free = current ? current.stocked - current.reserved : 0;
      throw new InventoryError(409, free > 0 ? `Only ${free} available at this location.` : 'Nothing is available at this location.');
    }
    const reservation = await this.Reservation().create({ tenantId: TENANT, itemId: input.itemId, locationId: input.locationId, quantity: qty, description: String(input.description || '').trim() || undefined, createdBy: actor.by });
    await this.record({ itemId: input.itemId, locationId: input.locationId, type: 'reservation', reservedDelta: qty, stockedAfter: level.stocked, reservedAfter: level.reserved, reason: 'Manual reservation', note: reservation.description, by: actor.by });
    await this.writeProductStock(item);
    return reservation.toObject();
  }

  static async updateReservation(id: string, input: { quantity?: unknown; description?: string }, actor: Actor = {}) {
    if (!isObjectId(id)) throw new InventoryError(400, 'Invalid reservation.');
    const r = await this.Reservation().findOne({ _id: id, tenantId: TENANT }).lean();
    if (!r) throw new InventoryError(404, 'Reservation not found.');
    const set: Record<string, unknown> = {};
    if (input.description !== undefined) set.description = String(input.description || '').trim();
    if (input.quantity !== undefined) {
      const qty = Number(input.quantity);
      if (!Number.isInteger(qty) || qty < 1) throw new InventoryError(400, 'Reserve at least 1.');
      const delta = qty - r.quantity;
      if (delta) {
        const level = await this.Level().findOneAndUpdate(
          delta > 0 ? { itemId: r.itemId, locationId: r.locationId, $expr: { $gte: [{ $subtract: ['$stocked', '$reserved'] }, delta] } } : { itemId: r.itemId, locationId: r.locationId },
          { $inc: { reserved: delta } },
          { new: true }
        ).lean();
        if (!level) throw new InventoryError(409, 'Not enough available at this location.');
        set.quantity = qty;
        await this.record({ itemId: r.itemId, locationId: r.locationId, type: 'reservation', reservedDelta: delta, stockedAfter: level.stocked, reservedAfter: level.reserved, reason: 'Reservation changed', orderId: r.orderId, by: actor.by });
        await this.writeProductStock(await this.getItemOrThrow(r.itemId));
      }
    }
    await this.Reservation().updateOne({ _id: r._id }, { $set: set });
    return this.Reservation().findById(r._id).lean();
  }

  static async deleteReservation(id: string, actor: Actor = {}) {
    if (!isObjectId(id)) throw new InventoryError(400, 'Invalid reservation.');
    const r = await this.Reservation().findOne({ _id: id, tenantId: TENANT }).lean();
    if (!r) throw new InventoryError(404, 'Reservation not found.');
    if (r.orderId) throw new InventoryError(409, 'This stock is held for an order. Cancel or fulfil the order instead.');
    const level = await this.Level().findOneAndUpdate({ itemId: r.itemId, locationId: r.locationId }, { $inc: { reserved: -r.quantity } }, { new: true }).lean();
    await this.Reservation().deleteOne({ _id: r._id });
    await this.record({ itemId: r.itemId, locationId: r.locationId, type: 'reservation', reservedDelta: -r.quantity, stockedAfter: level?.stocked, reservedAfter: level?.reserved, reason: 'Reservation removed', by: actor.by });
    await this.writeProductStock(await this.getItemOrThrow(r.itemId));
  }
}

function toObjectId(id: string) {
  const mongoose = require('mongoose');
  return isObjectId(id) ? new mongoose.Types.ObjectId(id) : id;
}
