"use strict";
module.exports = function (app) {
    app.get('/categories', async (req, res) => {
        try {
            const Category = require('../models/Category').getModel();
            const Product = require('../models/Product').getModel();
            const categories = await Category.find({}).lean();
            const mongoose = require('mongoose');
            const categoriesWithCounts = await Promise.all(categories.map(async (cat) => {
                try {
                    const catIdObj = new mongoose.Types.ObjectId(cat._id.toString());
                    const productCount = await Product.countDocuments({ categoryId: catIdObj });
                    return { ...cat, productCount };
                }
                catch (e) {
                    return { ...cat, productCount: 0 };
                }
            }));
            res.json({ success: true, categories: categoriesWithCounts });
        }
        catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    });
    app.get('/categories/:id', async (req, res) => {
        try {
            const Category = require('../models/Category').getModel();
            const category = await Category.findById(req.params.id).lean();
            if (!category)
                return res.status(404).json({ success: false, message: 'Not found' });
            res.json({ success: true, category });
        }
        catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    });
    app.post('/categories', async (req, res) => {
        try {
            const Category = require('../models/Category').getModel();
            const newCategory = new Category(req.body);
            await newCategory.save();
            res.json({ success: true, category: newCategory });
        }
        catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    });
    app.put('/categories/:id', async (req, res) => {
        try {
            const Category = require('../models/Category').getModel();
            const updated = await Category.findByIdAndUpdate(req.params.id, req.body, { new: true });
            res.json({ success: true, category: updated });
        }
        catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    });
    app.delete('/categories/:id', async (req, res) => {
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
        }
        catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    });
};
