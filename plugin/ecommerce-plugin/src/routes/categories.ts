import type { Express, Request, Response } from 'express';

export = function(app: Express) {
  app.get('/categories', async (req: Request, res: Response) => {
    try {
      const Category = require('../models/Category').getModel();
      const Product = require('../models/Product').getModel();
      
      const categories = await Category.find({}).lean();
      
      const mongoose = require('mongoose');
      const categoriesWithCounts = await Promise.all(categories.map(async (cat: any) => {
        try {
          const catIdObj = new mongoose.Types.ObjectId(cat._id.toString());
          const productCount = await Product.countDocuments({ categoryId: catIdObj });
          return { ...cat, productCount };
        } catch (e) {
          return { ...cat, productCount: 0 };
        }
      }));
      
      res.json({ success: true, categories: categoriesWithCounts });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.get('/categories/:id', async (req: Request, res: Response) => {
    try {
      const Category = require('../models/Category').getModel();
      const category = await Category.findById(req.params.id).lean();
      if (!category) return res.status(404).json({ success: false, message: 'Not found' });
      res.json({ success: true, category });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  const sendCategoryError = (res: Response, error: any) => {
    if (error?.code === 11000) {
      return res.status(409).json({ success: false, message: 'A category with this handle already exists.', field: 'slug' });
    }
    if (error?.name === 'ValidationError' || error?.name === 'CastError') {
      return res.status(400).json({ success: false, message: error.message });
    }
    return res.status(500).json({ success: false, message: error.message });
  };

  app.post('/categories', async (req: Request, res: Response) => {
    try {
      const Category = require('../models/Category').getModel();
      const newCategory = new Category(req.body);
      await newCategory.save();
      res.json({ success: true, category: newCategory });
    } catch (error: any) {
      sendCategoryError(res, error);
    }
  });

  app.put('/categories/:id', async (req: Request, res: Response) => {
    try {
      const Category = require('../models/Category').getModel();
      const parentId = req.body?.parentId;
      if (parentId) {
        // Walk up from the proposed parent; reaching this category would create a cycle.
        let cursor: any = await Category.findById(parentId).lean();
        if (!cursor) return res.status(400).json({ success: false, message: 'Parent category not found.', field: 'parentId' });
        const seen = new Set<string>();
        while (cursor && !seen.has(String(cursor._id))) {
          if (String(cursor._id) === String(req.params.id)) {
            return res.status(400).json({ success: false, message: 'A category cannot be placed inside itself or one of its subcategories.', field: 'parentId' });
          }
          seen.add(String(cursor._id));
          cursor = cursor.parentId ? await Category.findById(cursor.parentId).lean() : null;
        }
      }
      const updated = await Category.findByIdAndUpdate(req.params.id, req.body, { new: true });
      if (!updated) return res.status(404).json({ success: false, message: 'Category not found.' });
      res.json({ success: true, category: updated });
    } catch (error: any) {
      sendCategoryError(res, error);
    }
  });

  app.delete('/categories/:id', async (req: Request, res: Response) => {
    try {
      const Category = require('../models/Category').getModel();
      const Product = require('../models/Product').getModel();
      const categoryId = req.params.id;

      const mongoose = require('mongoose');
      const categoryIdObj = new mongoose.Types.ObjectId(categoryId);

      // 1. Check for child categories
      const childCount = await Category.countDocuments({ parentId: categoryIdObj });
      if (childCount > 0) {
        return res.json({ success: false, message: `Cannot delete: This category has ${childCount} subcategorie(s). Please delete or reassign them first.` });
      }

      // 2. Check for products in this category
      const productCount = await Product.countDocuments({ categoryId: categoryIdObj });
      if (productCount > 0) {
        return res.json({ success: false, message: `Cannot delete: There are ${productCount} product(s) in this category. Please reassign or delete them first.` });
      }

      await Category.findByIdAndDelete(categoryId);
      res.json({ success: true, message: 'Category deleted' });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });
};





