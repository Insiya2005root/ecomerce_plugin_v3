import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { DiscountEngine } from '../services/DiscountEngine';
import { InventoryService } from '../services/InventoryService';
import { currentUser } from '../services/StoreSettings';

const userEmail = (req: any) => currentUser(req)?.email || undefined;

const PRODUCT_STATUSES = ['Draft', 'Published', 'Archived'];
const SORTABLE_FIELDS = ['createdAt', 'updatedAt', 'name', 'price', 'stock'];

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Read-only, backend-authoritative catalog pricing for Admin display.
// Uses the same resolver as cart and storefront so Admin never recalculates prices.
function withPricing(product: any) {
  if (!product) return product;
  product.pricing = DiscountEngine.resolveCatalogProductPricing(
    { price: product.price, discountPrice: product.discountPrice, discountPercentage: product.discountPercentage },
    product.discountPercentage
  );
  return product;
}

function sendProductError(res: Response, error: any) {
  if (error?.code === 11000) {
    const field = Object.keys(error.keyPattern || error.keyValue || {})[0] || 'field';
    const label = field === 'sku' ? 'SKU' : field;
    return res.status(409).json({ success: false, message: `A product with this ${label} already exists.`, field });
  }
  if (error?.name === 'ValidationError') {
    const messages = Object.values(error.errors || {}).map((e: any) => e.message);
    return res.status(400).json({ success: false, message: messages.join(' ') || error.message });
  }
  if (error?.name === 'CastError') {
    return res.status(400).json({ success: false, message: `Invalid value for ${error.path}.` });
  }
  return res.status(500).json({ success: false, message: error.message });
}

const IMPORT_MAX_ROWS = 1000;

type ImportRow = Record<string, unknown>;
type ImportResult = { row: number; action: 'create' | 'update' | 'error'; name: string; sku: string; errors: string[]; productId?: string };

const normalizeKey = (key: string) => key.toLowerCase().replace(/[^a-z0-9%]/g, '');
const IMPORT_COLUMNS: Record<string, string> = {
  name: 'name', title: 'name', sku: 'sku', status: 'status', price: 'price',
  discount: 'discountPercentage', 'discount%': 'discountPercentage', discountpercentage: 'discountPercentage',
  saleprice: 'discountPrice', discountprice: 'discountPrice', costprice: 'costPrice', costperitem: 'costPrice', cost: 'costPrice',
  stock: 'stock', stockquantity: 'stock', barcode: 'barcode', category: 'category', collection: 'collection',
  taxclass: 'taxClass', tags: 'tags', digital: 'isDigital', isdigital: 'isDigital', description: 'description',
  metatitle: 'metaTitle', pagetitle: 'metaTitle', metadescription: 'metaDescription', imageurls: 'images', images: 'images',
};

/**
 * Validates CSV-shaped rows and resolves category / collection / tax class names to ids.
 * Blank cells leave existing values unchanged on update. Variants and uploaded media are not part of the CSV.
 */
async function planImport(rows: ImportRow[]) {
  const Product = require('../models/Product').getModel();
  const Category = require('../models/Category').getModel();
  const Collection = require('../models/Collection').getModel();
  const TaxClass = require('../models/TaxClass').getModel();

  const [categories, collections, taxClasses] = await Promise.all([
    Category.find({}).lean(),
    Collection.find({ tenantId: 'default_tenant' }).lean(),
    TaxClass ? TaxClass.find({ tenantId: 'default_tenant' }).lean() : [],
  ]);
  const catById = new Map<string, any>(categories.map((c: any) => [String(c._id), c]));
  const catPath = (c: any): string => {
    const parts: string[] = [];
    const seen = new Set<string>();
    let cur = c;
    while (cur && !seen.has(String(cur._id))) {
      seen.add(String(cur._id));
      parts.unshift(String(cur.name).trim().toLowerCase());
      cur = cur.parentId ? catById.get(String(cur.parentId)) : null;
    }
    return parts.join(' > ');
  };
  const catByPath = new Map<string, string>(categories.map((c: any) => [catPath(c), String(c._id)]));
  const catNameCounts = new Map<string, number>();
  categories.forEach((c: any) => catNameCounts.set(String(c.name).trim().toLowerCase(), (catNameCounts.get(String(c.name).trim().toLowerCase()) || 0) + 1));
  const collByKey = new Map<string, string>();
  collections.forEach((c: any) => {
    collByKey.set(String(c.title).trim().toLowerCase(), String(c._id));
    if (c.handle) collByKey.set(String(c.handle).toLowerCase(), String(c._id));
  });
  const taxByKey = new Map<string, string>([['default', 'Default'], ['nontaxable', 'NonTaxable'], ['non-taxable', 'NonTaxable']]);
  (taxClasses as any[]).forEach((t: any) => taxByKey.set(String(t.name).trim().toLowerCase(), String(t._id)));

  // Map CSV headers ("SKU", "Sale price", …) to field names once, before lookups and validation.
  const normalized = rows.map((raw) => {
    const row: Record<string, string> = {};
    for (const [key, value] of Object.entries(raw || {})) {
      const field = IMPORT_COLUMNS[normalizeKey(key)];
      if (field) row[field] = value === null || value === undefined ? '' : String(value).trim();
    }
    return row;
  });

  const skus = normalized.map((r) => r.sku || '').filter(Boolean);
  const existing = await Product.find({ tenantId: 'default_tenant', sku: { $in: skus } }, { _id: 1, sku: 1 }).lean();
  const existingBySku = new Map<string, string>(existing.map((p: any) => [String(p.sku), String(p._id)]));
  const seenSkus = new Set<string>();

  const plans: { result: ImportResult; doc: Record<string, unknown> }[] = normalized.map((row, index) => {
    const errors: string[] = [];
    const doc: Record<string, unknown> = {};
    const sku = row.sku || '';
    const productId = sku ? existingBySku.get(sku) : undefined;
    const isUpdate = Boolean(productId);

    if (sku) {
      if (seenSkus.has(sku)) errors.push(`SKU "${sku}" appears more than once in this file.`);
      seenSkus.add(sku);
      doc.sku = sku;
    }
    if (row.name) doc.name = row.name;
    else if (!isUpdate) errors.push('Name is required for new products.');

    const num = (field: string, label: string, opts: { integer?: boolean; max?: number } = {}) => {
      const value = row[field];
      if (!value) return;
      const n = Number(value.replace(/[₹,\s]/g, ''));
      if (!Number.isFinite(n) || n < 0 || (opts.integer && !Number.isInteger(n)) || (opts.max !== undefined && n > opts.max)) {
        errors.push(`${label} "${value}" is not valid.`);
      } else {
        doc[field] = n;
      }
    };
    num('price', 'Price');
    if (!isUpdate && !row.price) errors.push('Price is required for new products.');
    num('discountPercentage', 'Discount %', { max: 100 });
    num('discountPrice', 'Sale price');
    num('costPrice', 'Cost price');
    num('stock', 'Stock', { integer: true });

    if (row.status) {
      const status = PRODUCT_STATUSES.find((s) => s.toLowerCase() === row.status.toLowerCase());
      if (status) doc.status = status;
      else errors.push(`Status "${row.status}" must be Draft, Published or Archived.`);
    }
    if (row.category) {
      const key = row.category.toLowerCase().replace(/\s*[›>/]\s*/g, ' > ');
      const byPath = catByPath.get(key);
      const byName = !key.includes(' > ') && catNameCounts.get(key) === 1
        ? categories.find((c: any) => String(c.name).trim().toLowerCase() === key)
        : undefined;
      const id = byPath || (byName ? String(byName._id) : undefined);
      if (id) doc.categoryId = id;
      else errors.push(`Category "${row.category}" was not found${catNameCounts.get(key)! > 1 ? ' (name is ambiguous; use the full path, e.g. "Apparel > Shirts")' : ''}.`);
    } else if (!isUpdate) {
      errors.push('Category is required for new products.');
    }
    if (row.collection) {
      const id = collByKey.get(row.collection.toLowerCase());
      if (id) doc.collectionId = id;
      else errors.push(`Collection "${row.collection}" was not found.`);
    }
    if (row.taxClass) {
      const id = taxByKey.get(row.taxClass.toLowerCase());
      if (id) doc.taxClassId = id;
      else errors.push(`Tax class "${row.taxClass}" was not found.`);
    }
    if (row.isDigital) {
      const v = row.isDigital.toLowerCase();
      if (['yes', 'true', '1', 'y'].includes(v)) doc.isDigital = true;
      else if (['no', 'false', '0', 'n'].includes(v)) doc.isDigital = false;
      else errors.push(`Digital "${row.isDigital}" must be yes or no.`);
    }
    if (row.tags) doc.tags = [...new Set(row.tags.split('|').map((t) => t.trim()).filter(Boolean))];
    if (row.images) {
      const urls = row.images.split('|').map((u) => u.trim()).filter(Boolean);
      const bad = urls.filter((u) => !/^https?:\/\//i.test(u));
      if (bad.length) errors.push('Image URLs must start with http:// or https://.');
      else doc.images = urls;
    }
    for (const field of ['barcode', 'description', 'metaTitle', 'metaDescription']) if (row[field]) doc[field] = row[field];

    return {
      result: {
        row: index + 1,
        action: errors.length ? 'error' : isUpdate ? 'update' : 'create',
        name: row.name || '',
        sku,
        errors,
        ...(productId ? { productId } : {}),
      },
      doc,
    };
  });
  return plans;
}

export = (app: any) => {
  app.post('/products/import', async (req: Request, res: Response) => {
    try {
      const Product = require('../models/Product').getModel();
      const rows = Array.isArray(req.body?.rows) ? req.body.rows : null;
      const dryRun = req.body?.dryRun !== false;
      if (!rows || rows.length === 0) return res.status(400).json({ success: false, message: 'The file has no product rows.' });
      if (rows.length > IMPORT_MAX_ROWS) {
        return res.status(400).json({ success: false, message: `Import up to ${IMPORT_MAX_ROWS} products at a time (this file has ${rows.length}).` });
      }

      const plans = await planImport(rows);
      if (!dryRun) {
        for (const plan of plans) {
          if (plan.result.action === 'error') continue;
          try {
            const { discountPercentage, ...doc } = plan.doc;
            let id = plan.result.productId;
            if (plan.result.action === 'update') {
              await Product.findByIdAndUpdate(id, { $set: doc }, { runValidators: true });
            } else {
              const created = await new Product({ ...doc, tenantId: 'default_tenant' }).save();
              id = String(created._id);
              plan.result.productId = id;
            }
            if (discountPercentage !== undefined) {
              await Product.collection.updateOne({ _id: new mongoose.Types.ObjectId(id) }, { $set: { discountPercentage } });
            }
            await InventoryService.syncProduct(await Product.collection.findOne({ _id: new mongoose.Types.ObjectId(id) }), { by: userEmail(req) });
          } catch (error: any) {
            plan.result.action = 'error';
            plan.result.errors.push(error?.code === 11000 ? 'A product with this SKU already exists.' : error.message);
          }
        }
      }

      const results = plans.map((p) => p.result);
      const count = (action: string) => results.filter((r) => r.action === action).length;
      res.json({
        success: true,
        dryRun,
        summary: { create: count('create'), update: count('update'), error: count('error') },
        results,
      });
    } catch (error: any) {
      sendProductError(res, error);
    }
  });

  app.get('/products', async (req: Request, res: Response) => {
    try {
      const Product = require('../models/Product').getModel();

      const { search, categoryId, collectionId, status, sort, order, page = '1', limit = '20', ids } = req.query;

      let query: any = { tenantId: 'default_tenant' };

      if (ids && typeof ids === 'string') {
        const idArray = ids.split(',').map(id => id.trim()).filter(id => id.length === 24);
        if (idArray.length > 0) {
           const { Types } = require('mongoose');
           query._id = { $in: idArray.map(id => new Types.ObjectId(id)) };
        }
      } else {
        if (search && typeof search === 'string') {
          const pattern = escapeRegex(search.trim());
          query.$or = [
            { name: { $regex: pattern, $options: 'i' } },
            { sku: { $regex: pattern, $options: 'i' } }
          ];
        }

        if (categoryId) {
          query.categoryId = categoryId;
        }

        if (typeof status === 'string' && PRODUCT_STATUSES.includes(status)) {
          query.status = status;
        }

        if (typeof collectionId === 'string' && mongoose.Types.ObjectId.isValid(collectionId) && collectionId.length === 24) {
          query.collectionId = new mongoose.Types.ObjectId(collectionId);
        }
      }

      const pageNum = Number.isFinite(Number(page)) && Number(page) >= 1 ? Math.floor(Number(page)) : 1;
      const limitNum = Number.isFinite(Number(limit)) && Number(limit) >= 1 ? Math.floor(Number(limit)) : 20;
      const skip = (pageNum - 1) * limitNum;

      const sortField = typeof sort === 'string' && SORTABLE_FIELDS.includes(sort) ? sort : 'createdAt';
      const sortDir = order === 'asc' ? 1 : -1;

      // If fetching by specific IDs, we usually want all of them, but we'll apply limit if passed
      let productsQuery = Product.find(query).sort({ [sortField]: sortDir, _id: sortDir });
      if (sortField === 'name') {
        productsQuery = productsQuery.collation({ locale: 'en', strength: 2 });
      }

      if (!ids) {
          productsQuery = productsQuery.skip(skip).limit(limitNum);
      }

      let products = await productsQuery.lean();

      const rawProducts = await Product.collection
        .find({ _id: { $in: products.map((p: any) => p._id) } }, { projection: { discountPercentage: 1 } })
        .toArray();
      products = products.map((p: any) => {
        const raw = rawProducts.find((r: any) => r._id.toString() === p._id.toString());
        p.discountPercentage = raw && raw.discountPercentage !== undefined ? raw.discountPercentage : 0;
        return withPricing(p);
      });

      const total = await Product.countDocuments(query);

      res.json({ success: true, products, total, page: pageNum, limit: limitNum });
    } catch (error: any) {
      sendProductError(res, error);
    }
  });

  app.get('/products/:id', async (req: Request, res: Response) => {
    try {
      const Product = require('../models/Product').getModel();
      const product: any = await Product.findById(req.params.id).lean();
      if (product) {
        const raw = await Product.collection.findOne({ _id: product._id });
        product.discountPercentage = raw && raw.discountPercentage !== undefined ? raw.discountPercentage : 0;
        withPricing(product);
      }
      res.json({ success: true, product });
    } catch (error: any) {
      sendProductError(res, error);
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

      await InventoryService.syncProduct(newProduct.toObject(), { by: userEmail(req) });
      const safeProduct = newProduct.toObject ? newProduct.toObject() : { ...newProduct };
      safeProduct.discountPercentage = discountVal;

      res.json({ success: true, product: withPricing(safeProduct) });
    } catch (error: any) {
      sendProductError(res, error);
    }
  });

  app.put('/products/:id', async (req: Request, res: Response) => {
    try {
      const Product = require('../models/Product').getModel();
      const updated = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true });
      if (!updated) {
        return res.status(404).json({ success: false, message: 'Product not found.' });
      }

      let discountVal = 0;
      if (req.body.discountPercentage !== undefined && req.body.discountPercentage !== "") {
        discountVal = Number(req.body.discountPercentage);
        await Product.collection.updateOne(
          { _id: new mongoose.Types.ObjectId(req.params.id as string) },
          { $set: { discountPercentage: discountVal } }
        );
      }

      // Only edits that touch stock or variants change inventory (section drawers send just their own fields).
      if (req.body && ('stock' in req.body || 'variants' in req.body || 'sku' in req.body || 'name' in req.body)) {
        await InventoryService.syncProduct(await Product.collection.findOne({ _id: new mongoose.Types.ObjectId(req.params.id as string) }), { by: userEmail(req) });
      }
      const finalDoc: any = await Product.findById(req.params.id).lean();
      const rawFinal = await Product.collection.findOne({ _id: finalDoc._id });
      finalDoc.discountPercentage = rawFinal && rawFinal.discountPercentage !== undefined ? rawFinal.discountPercentage : discountVal;

      res.json({ success: true, product: withPricing(finalDoc) });
    } catch (error: any) {
      sendProductError(res, error);
    }
  });

  app.delete('/products/:id', async (req: Request, res: Response) => {
    try {
      const Product = require('../models/Product').getModel();
      await Product.findByIdAndDelete(req.params.id);
      await InventoryService.removeProduct(String(req.params.id));
      res.json({ success: true });
    } catch (error: any) {
      sendProductError(res, error);
    }
  });
};
