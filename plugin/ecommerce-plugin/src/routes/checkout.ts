import Order from '../models/Order';
import Product from '../models/Product';
import Settings from '../models/Settings';
import { DiscountEngine } from '../services/DiscountEngine';
import { ShippingService } from '../services/ShippingService';
import { TaxEngine } from '../services/TaxEngine';

export = (app: any) => {
  app.post('/checkout', async (req: any, res: any) => {
    try {
      const { customerDetails, items, paymentMethod, couponCode, customerAddress, selectedLocationId } = req.body;
      if (!customerDetails || !items || !Array.isArray(items)) {
        return res.json({ success: false, message: 'Invalid checkout data' });
      }

      const OrderModel = Order.getModel();
      const ProductModel = Product.getModel();
      const SettingsModel = Settings.getModel();
      const DiscountRuleModel = require('../models/DiscountRule').getModel();
      
      let settings = await SettingsModel.findOne({ tenantId: 'default_tenant' });
      if (!settings) settings = { taxRate: 0, shippingRate: 0, freeShippingThreshold: 0 };

      const activeRules = await DiscountRuleModel.find({ tenantId: 'default_tenant', status: 'Active' });

      let baseSubtotal = 0;
      let processedItems = [];

      for (let item of items) {
        const product = await ProductModel.findById(item.productId);
        if (!product) continue;
        if (product.stock < item.quantity) {
          return res.json({ success: false, message: `Insufficient stock for ${product.name}` });
        }

        let basePrice = product.price;
        let name = product.name;
        let targetVariant = null;
        if (item.variantId) {
          targetVariant = product.variants.id(item.variantId);
          if (targetVariant) {
            if (targetVariant.priceOverride) basePrice = targetVariant.priceOverride;
            name += ` - ${targetVariant.size || ''} ${targetVariant.color || ''}`.trim();
          }
        }
        const rawProduct = await ProductModel.collection.findOne({ _id: product._id });
        const actualDiscount = rawProduct && rawProduct.discountPercentage !== undefined ? rawProduct.discountPercentage : 0;
        const discountRatio = actualDiscount / 100;
        const discountedBasePrice = basePrice * (1 - discountRatio);

        baseSubtotal += (basePrice * item.quantity);
        processedItems.push({
          productId: product._id,
          categoryId: product.categoryId,
          taxClassId: product.taxClassId,
          variantId: item.variantId,
          name,
          price: discountedBasePrice,
          originalPrice: basePrice,
          discountPercentage: actualDiscount,
          quantity: item.quantity
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

      let shipping = 0;
      let shippingSnapshot = null;
      if (baseSubtotal > 0) {
          const reqBody = { ...req.body };
          if (reqBody.customerDetails && reqBody.customerDetails.address && !reqBody.customerAddress) {
              reqBody.customerAddress = { addressLine1: reqBody.customerDetails.address };
          }
          const shippingData = await ShippingService.calculateShipping(engineResult.totalAmount, reqBody, engineResult);
          shipping = shippingData.amount;
          shippingSnapshot = shippingData.snapshot;
          
          const taxData = await TaxEngine.calculate(processedItems, shipping, reqBody.customerAddress, effectiveRatio);
          tax = taxData.taxTotal;
          taxSnapshot = taxData;
      }

      const finalTotalAmount = engineResult.totalAmount + tax + shipping;
      
      const pricingPayload = { 
        subtotal: baseSubtotal, 
        tax, 
        shipping, 
        discount: finalDiscountAmount, 
        totalAmount: finalTotalAmount,
        appliedDiscounts: engineResult.appliedDiscounts,
        shippingSnapshot,
        taxSnapshot
      };

      const newOrder = new OrderModel({
        tenantId: 'default_tenant',
        customerDetails,
        items: processedItems,
        pricing: pricingPayload,
        status: 'Pending'
      });

      await newOrder.save();

      // Deduct stock
      for (let item of processedItems) {
        if (item.isFreeGift) continue; 
        const product = await ProductModel.findById(item.productId);
        if (product) {
          product.stock -= item.quantity;
          await product.save();
        }
      }

      res.json({ success: true, orderId: newOrder._id });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e.message });
    }
  });
};

