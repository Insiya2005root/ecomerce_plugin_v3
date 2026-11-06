import StorefrontPage from '../models/StorefrontPage';
import { getStoreSettings } from './StoreSettings';

declare const require: (moduleId: string) => any;

/**
 * Gives the site a default Header and Footer in OpenExt Pages (OpenExt wraps every page, the storefront
 * included, with them). Made of ordinary OpenExt blocks plus the plugin's cart button and search, so the
 * merchant edits them in OpenExt's Header/Footer editor. Runs once per site: an existing header/footer with
 * content is never touched, and a header/footer the merchant later empties or deletes is not re-created.
 */

const DEFAULT_MARK = 'ecommerce-plugin-default';
type Part = 'header' | 'footer';

const pluginBlock = (uniqueId: string, blockType: string, settings: Record<string, unknown> = {}) => ({
  uniqueId,
  type: 'ecommerce-plugin',
  label: blockType === 'ecommerce.cart-button' ? 'Cart Button & Mini Cart' : 'Product Search Box',
  content: JSON.stringify({ blockType, settings }),
  style: { width: '100%' },
});

function headerComponents(storeName: string) {
  return [
    {
      uniqueId: 'ecommerce-site-nav',
      type: 'nav-bar',
      content: JSON.stringify({
        logo: storeName,
        logoType: 'text',
        logoSource: 'custom',
        logoImage: '',
        links: [
          { label: 'Shop', href: '/shop', onClick: 'none', onClickValue: '' },
          { label: 'Cart', href: '/cart', onClick: 'none', onClickValue: '' },
          { label: 'Checkout', href: '/checkout', onClick: 'none', onClickValue: '' },
        ],
      }),
      style: { width: '100%', backgroundColor: 'var(--color-surface, #ffffff)' },
    },
    {
      uniqueId: 'ecommerce-site-header-actions',
      type: 'row',
      content: '',
      children: [
        [pluginBlock('ecommerce-site-search', 'ecommerce.product-search', { align: 'left' })],
        [pluginBlock('ecommerce-site-cart', 'ecommerce.cart-button', { align: 'right' })],
      ],
      style: { width: '100%', display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '16px', padding: '4px 24px 10px' },
    },
  ];
}

function footerComponents(storeName: string, email: string, phone: string) {
  const text = (uniqueId: string, content: string, style: Record<string, unknown>) => ({
    uniqueId,
    type: 'text',
    content,
    style: { width: '100%', textAlign: 'center', ...style },
  });
  const contact = [email, phone].filter(Boolean).join(' · ');
  return [
    text('ecommerce-site-footer-name', storeName, { padding: '32px 24px 4px', fontSize: '18px', fontWeight: 700 }),
    text('ecommerce-site-footer-about', 'Quality products, honest prices, delivered to your door. Cash on Delivery available.', {
      padding: '0 24px 4px',
      fontSize: '14px',
      color: '#6b7280',
    }),
    ...(contact ? [text('ecommerce-site-footer-contact', `Questions? ${contact}`, { padding: '0 24px 4px', fontSize: '14px', color: '#6b7280' })] : []),
    text('ecommerce-site-footer-copy', `© ${new Date().getFullYear()} ${storeName}. All rights reserved.`, {
      padding: '8px 24px 32px',
      fontSize: '13px',
      color: '#9ca3af',
    }),
  ];
}

async function claimOnce(tenantId: string, key: string): Promise<boolean> {
  const Flag = StorefrontPage.getFlagModel();
  if (!Flag) return false;
  try {
    await Flag.create({ tenantId, key });
    return true;
  } catch (err: any) {
    if (err?.code === 11000) return false;
    throw err;
  }
}

async function ensurePart(CmsPageModel: any, tenantId: string, part: Part, userId: string, components: any[]) {
  const mongoose = require('mongoose');
  const owner = mongoose.Types.ObjectId.isValid(userId) && String(userId).length === 24 ? new mongoose.Types.ObjectId(userId) : undefined;
  const site = await CmsPageModel.findOne({ pageType: part, isGlobal: true, isPublished: true }).sort({ updatedAt: -1 });

  if (site && Array.isArray(site.component) && site.component.length > 0) {
    // The site already has its own header/footer: leave it, and never offer the default again.
    await claimOnce(tenantId, `default-${part}`);
    return;
  }
  if (!(await claimOnce(tenantId, `default-${part}`))) return;

  if (site) {
    site.component = components;
    site.markModified?.('component');
    site.preHeading = DEFAULT_MARK;
    if (!site.createdBy && owner) site.createdBy = owner;
    await site.save();
    return;
  }
  const label = part === 'header' ? 'Store Header' : 'Store Footer';
  await CmsPageModel.create({
    pageName: label,
    pageType: part,
    isPublished: true,
    isHome: false,
    isGlobal: true,
    preHeading: DEFAULT_MARK,
    description: `Default site ${part} added by the Ecommerce plugin. Edit it like any OpenExt ${part}.`,
    slug: `${part}-store-${part}`,
    locale: tenantId === 'default_tenant' ? 'en' : `en__${tenantId}`,
    seoName: label,
    seoMeta: '',
    component: components,
    modifications: [],
    ...(owner ? { createdBy: owner } : {}),
  });
}

export class SiteChromeService {
  /** Adds the default header/footer if the site has none yet. `userId` becomes their owner (needed by OpenExt's Pages list). */
  static async ensureDefaultHeaderFooter(tenantId: string, userId: string): Promise<void> {
    const CmsPageModel = await StorefrontPage.getCmsPageModel();
    if (!CmsPageModel) return;
    const store = await getStoreSettings().catch(() => ({ name: '', email: '', phone: '' }) as any);
    const storeName = String(store.name || '').trim() || 'Our Store';
    await ensurePart(CmsPageModel, tenantId, 'header', userId, headerComponents(storeName));
    await ensurePart(CmsPageModel, tenantId, 'footer', userId, footerComponents(storeName, String(store.email || ''), String(store.phone || '')));
  }
}
