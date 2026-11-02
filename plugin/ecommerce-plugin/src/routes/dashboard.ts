import { Request, Response } from 'express';
import { CUSTOMER_KEY, normalizeOrder } from '../services/OrderService';
import { currentUser, getAdminProfile, getStoreSettings } from '../services/StoreSettings';

const TENANT = 'default_tenant';
const DAY = 86400000;
const LOW_STOCK_THRESHOLD = 5;

function validTimeZone(tz: unknown): string {
  if (typeof tz !== 'string' || !tz) return 'UTC';
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return tz;
  } catch {
    return 'UTC';
  }
}

/** YYYY-MM-DD for a date in the given time zone (matches Mongo's $dateToString output). */
function dayKey(date: Date, tz: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

/** Total stock: variant stock when a product has variants, otherwise its own stock. */
const TOTAL_STOCK = {
  $cond: [{ $gt: [{ $size: { $ifNull: ['$variants', []] } }, 0] }, { $sum: '$variants.stock' }, { $ifNull: ['$stock', 0] }],
};

export = (app: any) => {
  // Read-only numbers for the Admin dashboard. Cancelled orders are excluded from sales figures.
  app.get('/dashboard/stats', async (req: Request, res: Response) => {
    try {
      const Order = require('../models/Order').getModel();
      const Product = require('../models/Product').getModel();
      const Category = require('../models/Category').getModel();
      const Collection = require('../models/Collection').getModel();
      const DiscountRule = require('../models/DiscountRule').getModel();

      // No explicit range: use the signed-in admin's saved default (Settings → Profile).
      const user = currentUser(req);
      const days = [7, 30, 90].includes(Number(req.query.days))
        ? Number(req.query.days)
        : user
          ? (await getAdminProfile(user.id)).dashboardDays
          : 30;
      const store = await getStoreSettings();
      const lowStockThreshold = Number.isFinite(Number(store.lowStockThreshold)) ? Number(store.lowStockThreshold) : LOW_STOCK_THRESHOLD;
      const tz = validTimeZone(req.query.tz);
      const now = new Date();
      const since = new Date(now.getTime() - days * DAY);
      const prevSince = new Date(since.getTime() - days * DAY);
      const notCancelled = { status: { $ne: 'Cancelled' } };
      const productsCollection = Product.collection.collectionName;

      const salesFacet = (from: Date, to: Date) => [
        { $match: { tenantId: TENANT, ...notCancelled, createdAt: { $gte: from, $lt: to } } },
        {
          $facet: {
            totals: [
              { $group: { _id: null, revenue: { $sum: '$pricing.totalAmount' }, orders: { $sum: 1 }, discount: { $sum: '$pricing.discount' } } },
            ],
            daily: [
              { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: tz } }, revenue: { $sum: '$pricing.totalAmount' }, orders: { $sum: 1 } } },
            ],
            items: [
              { $unwind: '$items' },
              { $match: { 'items.isFreeGift': { $ne: true }, 'items.isAutoAddedGift': { $ne: true } } },
              {
                $group: {
                  _id: '$items.productId',
                  name: { $first: '$items.name' },
                  quantity: { $sum: '$items.quantity' },
                  revenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
                },
              },
            ],
          },
        },
      ];

      const [current] = await Order.collection.aggregate(salesFacet(since, now)).toArray();
      const [previous] = await Order.collection.aggregate(salesFacet(prevSince, since)).toArray();
      const totals = current?.totals?.[0] || { revenue: 0, orders: 0, discount: 0 };
      const prevTotals = previous?.totals?.[0] || { revenue: 0, orders: 0, discount: 0 };
      const itemsSold = (current?.items || []).reduce((sum: number, i: any) => sum + (i.quantity || 0), 0);

      // Continuous day-by-day series (days with no orders show as 0).
      const dailyMap = new Map<string, any>((current?.daily || []).map((d: any) => [d._id, d]));
      const series = [];
      for (let i = days - 1; i >= 0; i--) {
        const key = dayKey(new Date(now.getTime() - i * DAY), tz);
        const d = dailyMap.get(key);
        series.push({ date: key, revenue: round2(d?.revenue || 0), orders: d?.orders || 0 });
      }

      // Top sellers, with current product details (image, stock) when the product still exists.
      const top = [...(current?.items || [])].sort((a: any, b: any) => b.quantity - a.quantity || b.revenue - a.revenue).slice(0, 5);
      const topDocs = await Product.collection
        .find({ _id: { $in: top.map((t: any) => t._id) } }, { projection: { images: { $slice: 1 }, status: 1, name: 1 } })
        .toArray();
      const topProducts = top.map((t: any) => {
        const doc = topDocs.find((p: any) => String(p._id) === String(t._id));
        return { productId: t._id, name: doc?.name || t.name, image: doc?.images?.[0] || null, quantity: t.quantity, revenue: round2(t.revenue), exists: Boolean(doc) };
      });

      // Revenue by category (order lines joined to their product's current category).
      const byCategory = await Order.collection
        .aggregate([
          { $match: { tenantId: TENANT, ...notCancelled, createdAt: { $gte: since, $lt: now } } },
          { $unwind: '$items' },
          { $match: { 'items.isFreeGift': { $ne: true }, 'items.isAutoAddedGift': { $ne: true } } },
          { $lookup: { from: productsCollection, localField: 'items.productId', foreignField: '_id', as: 'product' } },
          { $group: { _id: { $first: '$product.categoryId' }, revenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } } } },
          { $sort: { revenue: -1 } },
          { $limit: 6 },
        ])
        .toArray();
      const categoryNames = new Map<string, string>(
        (await Category.find({ _id: { $in: byCategory.map((c: any) => c._id).filter(Boolean) } }, { name: 1 }).lean()).map((c: any) => [String(c._id), c.name])
      );
      const salesByCategory = byCategory.map((c: any) => ({
        categoryId: c._id,
        name: c._id ? categoryNames.get(String(c._id)) || 'Deleted category' : 'Uncategorized',
        revenue: round2(c.revenue),
      }));

      // Orders that need action now (any date).
      const legacyUnfulfilled = { fulfillmentStatus: { $exists: false }, status: { $in: ['Pending', 'Processing'] } };
      const [unpaid, toFulfill, toShip] = await Promise.all([
        Order.collection.countDocuments({ tenantId: TENANT, ...notCancelled, $or: [{ paymentStatus: 'Not paid' }, { paymentStatus: { $exists: false } }] }),
        Order.collection.countDocuments({ tenantId: TENANT, ...notCancelled, $or: [{ fulfillmentStatus: 'Not fulfilled' }, legacyUnfulfilled] }),
        Order.collection.countDocuments({ tenantId: TENANT, ...notCancelled, fulfillmentStatus: 'Fulfilled' }),
      ]);
      const recentOrders = (await Order.collection.find({ tenantId: TENANT }).sort({ createdAt: -1 }).limit(6).toArray()).map((o: any) => {
        const n = normalizeOrder(o);
        return {
          _id: n._id,
          orderNumber: n.orderNumber,
          createdAt: n.createdAt,
          customerName: n.customerDetails?.name,
          total: n.pricing?.totalAmount,
          status: n.status,
          paymentStatus: n.paymentStatus,
          fulfillmentStatus: n.fulfillmentStatus,
        };
      });

      // Catalog
      const productProjection = { name: 1, price: 1, discountPrice: 1, status: 1, createdAt: 1, sku: 1, images: { $slice: 1 } };
      const [statusCounts, newestProducts, lowStock, categories, collections, activePromotions] = await Promise.all([
        Product.collection.aggregate([{ $match: { tenantId: TENANT } }, { $group: { _id: '$status', count: { $sum: 1 } } }]).toArray(),
        Product.collection.find({ tenantId: TENANT }, { projection: productProjection }).sort({ createdAt: -1 }).limit(5).toArray(),
        Product.collection
          .aggregate([
            { $match: { tenantId: TENANT, status: 'Published' } },
            { $addFields: { totalStock: TOTAL_STOCK } },
            { $match: { totalStock: { $lte: lowStockThreshold } } },
            { $sort: { totalStock: 1, name: 1 } },
            { $limit: 6 },
            // Aggregation $slice takes [array, n] (find projections use the { $slice: n } form above).
            { $project: { ...productProjection, images: { $slice: [{ $ifNull: ['$images', []] }, 1] }, totalStock: 1 } },
          ])
          .toArray(),
        Category.countDocuments({}),
        Collection.countDocuments({ tenantId: TENANT }),
        DiscountRule.countDocuments({ tenantId: TENANT, status: 'Active' }),
      ]);
      // Customers (by email): who ordered in the range, and whether it was their first order ever.
      const inRange = { $and: [{ $gte: ['$createdAt', since] }, { $lt: ['$createdAt', now] }] };
      const [customerFacts] = await Order.collection
        .aggregate([
          { $match: { tenantId: TENANT, ...notCancelled } },
          { $sort: { createdAt: -1 } },
          {
            $group: {
              _id: CUSTOMER_KEY,
              name: { $first: '$customerDetails.name' },
              email: { $first: '$customerDetails.email' },
              firstAt: { $min: '$createdAt' },
              active: { $max: { $cond: [inRange, 1, 0] } },
              ordersInRange: { $sum: { $cond: [inRange, 1, 0] } },
              spentInRange: { $sum: { $cond: [inRange, { $subtract: [{ $ifNull: ['$pricing.totalAmount', 0] }, { $ifNull: ['$payment.refundedAmount', 0] }] }, 0] } },
            },
          },
          { $match: { _id: { $ne: '' } } },
          {
            $facet: {
              total: [{ $count: 'n' }],
              active: [{ $match: { active: 1 } }, { $group: { _id: null, n: { $sum: 1 }, newCustomers: { $sum: { $cond: [{ $gte: ['$firstAt', since] }, 1, 0] } } } }],
              top: [{ $match: { active: 1 } }, { $sort: { spentInRange: -1, ordersInRange: -1 } }, { $limit: 5 }],
            },
          },
        ])
        .toArray();
      const activeCustomers = customerFacts?.active?.[0]?.n || 0;
      const newCustomers = customerFacts?.active?.[0]?.newCustomers || 0;

      const byStatus = Object.fromEntries(statusCounts.map((s: any) => [s._id || 'Published', s.count]));
      const lean = (p: any) => ({ _id: p._id, name: p.name, sku: p.sku, price: p.price, status: p.status, createdAt: p.createdAt, image: p.images?.[0] || null, ...(p.totalStock !== undefined ? { stock: p.totalStock } : {}) });

      res.json({
        success: true,
        stats: {
          range: { days, since, until: now, timeZone: tz },
          sales: {
            revenue: round2(totals.revenue),
            orders: totals.orders,
            averageOrderValue: totals.orders ? round2(totals.revenue / totals.orders) : 0,
            discountGiven: round2(totals.discount),
            itemsSold,
            previous: {
              revenue: round2(prevTotals.revenue),
              orders: prevTotals.orders,
              averageOrderValue: prevTotals.orders ? round2(prevTotals.revenue / prevTotals.orders) : 0,
              discountGiven: round2(prevTotals.discount),
            },
          },
          series,
          topProducts,
          salesByCategory,
          attention: { unpaid, toFulfill, toShip },
          recentOrders,
          catalog: {
            products: Object.values(byStatus).reduce((a: number, b: any) => a + Number(b), 0),
            published: byStatus.Published || 0,
            draft: byStatus.Draft || 0,
            archived: byStatus.Archived || 0,
            categories,
            collections,
            activePromotions,
          },
          newestProducts: newestProducts.map(lean),
          lowStock: lowStock.map(lean),
          lowStockThreshold,
          customers: {
            total: customerFacts?.total?.[0]?.n || 0,
            active: activeCustomers,
            newCustomers,
            returning: activeCustomers - newCustomers,
            top: (customerFacts?.top || []).map((c: any) => ({ email: c.email, name: c.name || c.email, orders: c.ordersInRange, spent: round2(c.spentInRange) })),
          },
        },
      });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });
};
