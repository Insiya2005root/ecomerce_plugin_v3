import { Request, Response } from 'express';
import mongoose from 'mongoose';

export = (app: any) => {
  app.get('/products', async (req: Request, res: Response) => {
    try {
      const Product = require('../models/Product').getModel();
      
      const { search, categoryId, page = '1', limit = '20', ids } = req.query;
      
      let query: any = { tenantId: 'default_tenant' };
      
      if (ids && typeof ids === 'string') {
        const idArray = ids.split(',').map(id => id.trim()).filter(id => id.length === 24);
        if (idArray.length > 0) {
           const { Types } = require('mongoose');
           query._id = { $in: idArray.map(id => new Types.ObjectId(id)) };
        }
      } else {
        if (search) {
          query.$or = [
            { name: { $regex: search, $options: 'i' } },
            { sku: { $regex: search, $options: 'i' } }
          ];
        }
        
        if (categoryId) {
          query.categoryId = categoryId;
        }
      }

      const skip = (Number(page) - 1) * Number(limit);
      
      // If fetching by specific IDs, we usually want all of them, but we'll apply limit if passed
      let productsQuery = Product.find(query).sort({ createdAt: -1 });
      
      if (!ids) {
          productsQuery = productsQuery.skip(skip).limit(Number(limit));
      }

      let products = await productsQuery.lean();
      
      const rawProducts = await Product.collection.find({ tenantId: 'default_tenant' }).toArray();
      products = products.map((p: any) => {
        const raw = rawProducts.find((r: any) => r._id.toString() === p._id.toString());
        p.discountPercentage = raw && raw.discountPercentage !== undefined ? raw.discountPercentage : 0;
        return p;
      });

      const total = await Product.countDocuments(query);

      res.json({ success: true, products, total, page: Number(page), limit: Number(limit) });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.get('/products/:id', async (req: Request, res: Response) => {
    try {
      const Product = require('../models/Product').getModel();
      const product: any = await Product.findById(req.params.id).lean();
      if (product) {
        const raw = await Product.collection.findOne({ _id: product._id });
        product.discountPercentage = raw && raw.discountPercentage !== undefined ? raw.discountPercentage : 0;
      }
      res.json({ success: true, product });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.post('/products', async (req: Request, res: Response) => {
    try {
      const Product = require('../models/Product').getModel();
      const newProduct = new Product(req.body);
      await newProduct.save();
      
      let discountVal = 0;
      if (req.body.discountPercentage !== undefined && req.body.discountPercentage !== "") {
        discountVal = Number(req.body.discountPercentage);
        await Product.collection.updateOne(
          { _id: newProduct._id },
          { $set: { discountPercentage: discountVal } }
        );
      }
      
      const safeProduct = newProduct.toObject ? newProduct.toObject() : { ...newProduct };
      safeProduct.discountPercentage = discountVal;

      res.json({ success: true, product: safeProduct });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.put('/products/:id', async (req: Request, res: Response) => {
    try {
      const Product = require('../models/Product').getModel();
      await Product.findByIdAndUpdate(req.params.id, req.body, { new: true });
      
      let discountVal = 0;
      if (req.body.discountPercentage !== undefined && req.body.discountPercentage !== "") {
        discountVal = Number(req.body.discountPercentage);
        await Product.collection.updateOne(
          { _id: new mongoose.Types.ObjectId(req.params.id as string) },
          { $set: { discountPercentage: discountVal } }
        );
      }

      const finalDoc: any = await Product.findById(req.params.id).lean();
      const rawFinal = await Product.collection.findOne({ _id: finalDoc._id });
      finalDoc.discountPercentage = rawFinal && rawFinal.discountPercentage !== undefined ? rawFinal.discountPercentage : discountVal;
      
      res.json({ success: true, product: finalDoc });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.delete('/products/:id', async (req: Request, res: Response) => {
    try {
      const Product = require('../models/Product').getModel();
      await Product.findByIdAndDelete(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });
};

