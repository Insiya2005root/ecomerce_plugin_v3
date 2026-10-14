import Product from '../models/Product';
import Settings from '../models/Settings';
import { DiscountEngine } from '../services/DiscountEngine';
import { ShippingService } from '../services/ShippingService';
import { TaxEngine } from '../services/TaxEngine';

export = (app: any) => {
  app.post('/cart/calculate', async (req: any, res: any) => {
    try {
      const { items, couponCode } = req.body || {};
      if (!items || !Array.isArray(items)) return res.json({ success: false, message: 'Invalid items array' });

      const mongoose = require('mongoose');
      const { resolveTenantId } = require('./storefront');
      const tenantId = typeof resolveTenantId === 'function' ? resolveTenantId(req) : 'default_tenant';

      const ProductModel = Product.getModel();
      const SettingsModel = Settings.getModel();
      const DiscountRuleModel = require('../models/DiscountRule').getModel();
      
      let settings = await SettingsModel.findOne({ tenantId });
      if (!settings) settings = { taxRate: 0, shippingRate: 0, freeShippingThreshold: 0 };

      // Step 1: Load active rules
      const activeRules = await DiscountRuleModel.find({ tenantId, status: 'Active' });

      let baseSubtotal = 0;
      let processedItems = [];

      for (let item of items) {
        if (!item || typeof item !== 'object') continue;
        const rawProductId =
          typeof item.productId === 'string'
            ? item.productId.trim()
            : String(item.productId || '').trim();
        if (!mongoose.Types.ObjectId.isValid(rawProductId) || rawProductId.length !== 24) continue;

        const rawQty = Number(item.quantity);
        if (!Number.isFinite(rawQty) || rawQty <= 0) continue;
        const quantity = Math.min(1000, Math.floor(rawQty));
        if (quantity <= 0) continue;

        const productLookup: Record<string, any> = {
          _id: new mongoose.Types.ObjectId(rawProductId),
          tenantId,
        };
        if (!req.user) {
          productLookup.status = 'Published';
        }

        const product = await ProductModel.findOne(productLookup);
        if (!product) continue;
        let basePrice = product.price;
        let name = product.name;
        let targetVariant = null;
        if (item.variantId && product.variants && typeof product.variants.id === 'function') {
          targetVariant = product.variants.id(item.variantId);
          if (targetVariant) {
            if (targetVariant.priceOverride) basePrice = targetVariant.priceOverride;
            name += ` - ${targetVariant.size || ''} ${targetVariant.color || ''}`.trim();
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

        baseSubtotal += (resolvedBasePrice * quantity);
        processedItems.push({
          productId: product._id,
          categoryId: product.categoryId,
          taxClassId: product.taxClassId,
          variantId: item.variantId,
          name,
          price: discountedBasePrice, 
          originalPrice: resolvedBasePrice,
          discountPercentage: actualDiscount,
          quantity
        });
      }

      const cartContext = { items: processedItems, couponCode };
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

      // Shipping calculation
      let shipping = 0;
      let shippingSnapshot = null;
      let availableLocations = undefined;

      if (baseSubtotal > 0) {
          const reqBody = { ...req.body };
          if (reqBody.customerDetails && reqBody.customerDetails.address && !reqBody.customerAddress) {
              reqBody.customerAddress = { addressLine1: reqBody.customerDetails.address };
          }
          const shippingData = await ShippingService.calculateShipping(engineResult.totalAmount, reqBody, engineResult);
          shipping = shippingData.amount;
          shippingSnapshot = shippingData.snapshot;
          availableLocations = shippingData.availableLocations;
          
          // Now calculate precise taxes with Shipping known
          // Assuming customerAddress has been passed in req.body
          const taxData = await TaxEngine.calculate(processedItems, shipping, reqBody.customerAddress, effectiveRatio);
          tax = taxData.taxTotal;
          taxSnapshot = taxData;
      }

      const finalTotalAmount = engineResult.totalAmount + tax + shipping;

      const sanitizedItems = processedItems.map((item: any) => {
        const { _appliedTaxRule, taxClassId, ...safeItem } = item;
        return safeItem;
      });

      res.json({
        success: true,
        pricing: { 
          subtotal: baseSubtotal, 
          tax, 
          shipping, 
          discount: finalDiscountAmount, 
          totalAmount: finalTotalAmount,
          appliedDiscounts: engineResult.appliedDiscounts,
          progressNotices: engineResult.progressNotices || [],
          taxSnapshot,
          shippingSnapshot,
          availableLocations
        },
        items: sanitizedItems
      });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e.message });
    }
  });
};

