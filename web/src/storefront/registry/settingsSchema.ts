import { blockRegistry } from './blockRegistry';
import { loadCategories } from '../cart/storeData';
import type { StorefrontBlockFieldSpec } from '../types/storefront';

/**
 * The block settings OpenExt's page builder shows for an Ecommerce block (read through
 * window.__NEXTCMS_PLUGINS__['ecommerce-plugin'].getSettingsSchema()). The editor writes the result
 * into the block's `content` as {"blockType": ..., "settings": {...}}.
 */

type FieldValue = string | number | boolean;

interface SchemaField {
  key: string;
  label: string;
  type: 'boolean' | 'number' | 'string' | 'text' | 'select' | 'color';
  description?: string;
  min?: number;
  max?: number;
  options?: Array<{ label: string; value: FieldValue }>;
  showWhen?: { key: string; equals: FieldValue[] };
}

interface SchemaBlockType {
  value: string;
  label: string;
  description?: string;
  fields: SchemaField[];
  defaults: Record<string, unknown>;
}

export interface StorefrontSettingsSchema {
  blockTypes: SchemaBlockType[];
}

/** Blocks offered in the page builder, in picker order. Older split blocks stay renderable but are not offered. */
const PICKER: Array<{ blockType: string; label: string; description: string }> = [
  { blockType: 'ecommerce.shop-hero', label: 'Hero banner', description: 'Heading, text, buttons and a picture (or your newest product photos).' },
  { blockType: 'ecommerce.product-grid', label: 'Shop · Product grid', description: 'Live products with prices, stock and Add to cart.' },
  { blockType: 'ecommerce.category-filter', label: 'Shop · Filter (search, category, price, sort)', description: 'Filters the product grid on the same page. Bar or sidebar.' },
  { blockType: 'ecommerce.category-showcase', label: 'Shop by category', description: 'Picture tiles for your top categories.' },
  { blockType: 'ecommerce.shop-header', label: 'Shop · Heading & breadcrumbs', description: 'Page heading with the product count.' },
  { blockType: 'ecommerce.trust-badges', label: 'Store features', description: 'Shipping, Cash on Delivery, returns and secure checkout, as a strip, cards or with a picture.' },
  { blockType: 'ecommerce.product-detail', label: 'Product page · Product details', description: 'Gallery, price, options and Add to cart for the product in the address.' },
  { blockType: 'ecommerce.related-products', label: 'Product page · Related products', description: 'More products from the same category.' },
  { blockType: 'ecommerce.cart', label: 'Cart page · Cart', description: 'Cart items, coupon box and order summary.' },
  { blockType: 'ecommerce.checkout', label: 'Checkout page · Checkout', description: 'Contact, delivery and payment steps with the order summary.' },
  { blockType: 'ecommerce.order-lookup', label: 'Order lookup', description: 'Shoppers check an order with its number and their email.' },
  { blockType: 'ecommerce.cart-button', label: 'Header · Cart button & mini cart', description: 'Place this in your OpenExt Header.' },
  { blockType: 'ecommerce.product-search', label: 'Header · Product search', description: 'Place this in your OpenExt Header.' },
];

function toField(spec: StorefrontBlockFieldSpec): SchemaField {
  return {
    key: spec.key,
    label: spec.label,
    type: spec.type,
    description: spec.description,
    min: spec.min,
    max: spec.max,
    options: spec.options,
    showWhen: spec.showWhen,
  };
}

/** Product grid: pick the category from a list, and only show the field the chosen source uses. */
function productGridFields(fields: SchemaField[], categories: Array<{ id: string; name: string }>): SchemaField[] {
  return fields.map((f) => {
    if (f.key === 'categoryId') {
      return {
        ...f,
        label: 'Category',
        type: categories.length ? 'select' : 'string',
        options: categories.length ? categories.map((c) => ({ label: c.name, value: c.id })) : undefined,
        description: 'Includes its sub-categories.',
        showWhen: { key: 'source', equals: ['category'] },
      };
    }
    if (f.key === 'selectedProductIds') return { ...f, showWhen: { key: 'source', equals: ['selected'] } };
    return f;
  });
}

export async function getStorefrontSettingsSchema(): Promise<StorefrontSettingsSchema> {
  const categories = await loadCategories().catch(() => []);
  const blockTypes: SchemaBlockType[] = [];
  for (const entry of PICKER) {
    const def = blockRegistry.get(entry.blockType);
    if (!def || def.status !== 'implemented') continue;
    let fields = (def.fieldSpecs || []).map(toField);
    if (entry.blockType === 'ecommerce.product-grid') fields = productGridFields(fields, categories);
    blockTypes.push({
      value: entry.blockType,
      label: entry.label,
      description: entry.description,
      fields,
      defaults: { ...(def.defaultSettings || {}) },
    });
  }
  return { blockTypes };
}
