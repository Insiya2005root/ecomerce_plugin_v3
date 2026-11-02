import Product from '../models/Product';
import { DiscountEngine } from './DiscountEngine';
import { ShippingService } from './ShippingService';
import { TaxEngine } from './TaxEngine';
import { InventoryService } from './InventoryService';

export type CartStockIssue = { productId: string; variantId?: string; name: string; requested: number; available: number };

/**
 * The single cart pricing pipeline: product price → DiscountEngine → shipping → tax.
 * Used by /cart/calculate (the Cart page and storefront) and by /checkout, so the
 * total a cart shows is exactly what the order charges.
 */
export class CartService {
  static async price(body: any, ctx: { tenantId: string; includeUnpublished: boolean }) {
    const mongoose = require('mongoose');
    const { items, couponCode } = body || {};
    const ProductModel = Product.getModel();
    const DiscountRuleModel = require('../models/DiscountRule').getModel();

    const activeRules = await DiscountRuleModel.find({ tenantId: ctx.tenantId, status: 'Active' });

    let baseSubtotal = 0;
    let processedItems: any[] = [];
    // Stock currently available per product / variant, for the stock check below.
    const availability = new Map<string, { name: string; available: number; productId: string; variantId?: string }>();

    for (const item of items) {
      if (!item || typeof item !== 'object') continue;
      const rawProductId = typeof item.productId === 'string' ? item.productId.trim() : String(item.productId || '').trim();
      if (!mongoose.Types.ObjectId.isValid(rawProductId) || rawProductId.length !== 24) continue;

      const rawQty = Number(item.quantity);
      if (!Number.isFinite(rawQty) || rawQty <= 0) continue;
      const quantity = Math.min(1000, Math.floor(rawQty));
      if (quantity <= 0) continue;

      const productLookup: Record<string, any> = {
        _id: new mongoose.Types.ObjectId(rawProductId),
        tenantId: ctx.tenantId,
      };
      if (!ctx.includeUnpublished) {
        productLookup.status = 'Published';
      }

      const product = await ProductModel.findOne(productLookup);
      if (!product) continue;
      let basePrice = product.price;
      let name = product.name;
      let targetVariant: any = null;
      if (item.variantId && product.variants && typeof product.variants.id === 'function') {
        targetVariant = product.variants.id(item.variantId);
        if (targetVariant) {
          if (targetVariant.priceOverride) basePrice = targetVariant.priceOverride;
          const label = [targetVariant.size, targetVariant.color].filter(Boolean).join(' ');
          if (label) name += ` - ${label}`;
        }
      }
      const rawProduct = await ProductModel.collection.findOne({ _id: product._id });
      const rawDiscount =
        rawProduct && rawProduct.discountPercentage !== undefined
          ? rawProduct.discountPercentage
          : product.discountPercentage;
      const {
        basePrice: resolvedBasePrice,
        catalogPrice: discountedBasePrice,
        discountPercentage: actualDiscount,
      } = DiscountEngine.resolveCatalogProductPricing(
        { price: basePrice, discountPrice: product.discountPrice, discountPercentage: product.discountPercentage },
        rawDiscount
      );

      const stockKey = targetVariant ? `${product._id}:${targetVariant._id}` : String(product._id);
      if (!availability.has(stockKey)) {
        availability.set(stockKey, {
          name,
          productId: String(product._id),
          ...(targetVariant ? { variantId: String(targetVariant._id) } : {}),
          available: Number(targetVariant ? targetVariant.stock : product.stock) || 0,
        });
      }

      baseSubtotal += (resolvedBasePrice * quantity);
      processedItems.push({
        productId: product._id,
        categoryId: product.categoryId,
        taxClassId: product.taxClassId,
        variantId: targetVariant ? String(targetVariant._id) : undefined,
        sku: (targetVariant && targetVariant.sku) || product.sku,
        name,
        price: discountedBasePrice,
        originalPrice: resolvedBasePrice,
        discountPercentage: actualDiscount,
        quantity
      });
    }

    // The address lets custom rules match on the customer's city.
    const cartContext = { items: processedItems, couponCode, customerAddress: body.customerAddress };
    const engineResult = await DiscountEngine.evaluate(cartContext, activeRules);

    if (engineResult.cartItems) {
      processedItems = engineResult.cartItems;
      baseSubtotal = processedItems.reduce((sum, item) => sum + (item.originalPrice * item.quantity), 0);
    }

    let finalDiscountAmount = engineResult.discountTotal;
    const productLevelDiscountAmount = processedItems.reduce((sum, item) => sum + ((item.originalPrice - item.price) * item.quantity), 0);
    finalDiscountAmount += productLevelDiscountAmount;

    let tax = 0;
    let taxSnapshot = null;
    let effectiveRatio = 1;
    if (engineResult.discountTotal > 0 && engineResult.subtotal > 0) {
      effectiveRatio = engineResult.totalAmount / engineResult.subtotal;
    }

    let shipping = 0;
    let shippingSnapshot = null;
    let availableLocations = undefined;

    if (baseSubtotal > 0) {
      const reqBody = { ...body };
      if (reqBody.customerDetails && reqBody.customerDetails.address && !reqBody.customerAddress) {
        reqBody.customerAddress = { addressLine1: reqBody.customerDetails.address };
      }
      const shippingData = await ShippingService.calculateShipping(engineResult.totalAmount, reqBody, engineResult);
      shipping = shippingData.amount;
      shippingSnapshot = shippingData.snapshot;
      availableLocations = shippingData.availableLocations;

      const taxData = await TaxEngine.calculate(processedItems, shipping, reqBody.customerAddress, effectiveRatio);
      tax = taxData.taxTotal;
      taxSnapshot = taxData;
    }

    // Free gifts added by the engine are not stock-checked (matching how orders deduct stock).
    const requested = new Map<string, number>();
    for (const item of processedItems) {
      if (item.isFreeGift || item.isAutoAddedGift) continue;
      const key = item.variantId ? `${item.productId}:${item.variantId}` : String(item.productId);
      requested.set(key, (requested.get(key) || 0) + Number(item.quantity || 0));
    }
    const stockIssues: CartStockIssue[] = [];
    // Items set to not track inventory, or to allow backorders, can be sold past their stock.
    const flags = await InventoryService.flagsFor([...availability.values()].map((i) => i.productId));
    for (const [key, qty] of requested) {
      const info = availability.get(key);
      const flag = info ? flags.get(`${info.productId}:${info.variantId || ''}`) : undefined;
      if (flag && (flag.track === false || flag.backorder)) continue;
      if (info && qty > info.available) {
        stockIssues.push({ productId: info.productId, variantId: info.variantId, name: info.name, requested: qty, available: info.available });
      }
    }

    return {
      processedItems,
      stockIssues,
      pricing: {
        subtotal: baseSubtotal,
        tax,
        shipping,
        discount: finalDiscountAmount,
        totalAmount: engineResult.totalAmount + tax + shipping,
        appliedDiscounts: engineResult.appliedDiscounts,
        progressNotices: engineResult.progressNotices || [],
        taxSnapshot,
        shippingSnapshot,
        availableLocations,
      },
    };
  }
}
