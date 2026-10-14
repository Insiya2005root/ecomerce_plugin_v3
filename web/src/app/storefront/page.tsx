'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button, buttonVariants } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { StorefrontSubNav } from '@/components/StorefrontSubNav';
import { storefrontApiClient } from '@/storefront/services/storefrontApiClient';
import { BlockRenderer } from '@/storefront/renderer/BlockRenderer';
import { ProductCard } from '@/storefront/components/ProductCard';
import type {
  PublicProductDTO,
  PublicStorefrontSettingsDTO,
  StorefrontHealthResponse,
  StorefrontPageDTO,
  StorefrontPageType,
} from '@/storefront/types/storefront';
import { cn } from '@/lib/utils';
import { ArrowRight, ShoppingCart, Check, RefreshCw } from 'lucide-react';
import '@/storefront/styles.css';

const PAGE_LABELS: Record<StorefrontPageType, string> = {
  shop: 'Shop',
  product: 'Product Page',
  cart: 'Cart',
  checkout: 'Checkout',
};

export default function StorefrontAdminPage() {
  const [health, setHealth] = useState<StorefrontHealthResponse | null>(null);
  const [settings, setSettings] = useState<PublicStorefrontSettingsDTO | null>(null);
  const [pages, setPages] = useState<StorefrontPageDTO[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [previewEditingMode, setPreviewEditingMode] = useState<boolean>(true);

  // Milestone 4: Real ProductCard preview state
  const [previewProduct, setPreviewProduct] = useState<PublicProductDTO | null>(null);
  const [previewCategoryName, setPreviewCategoryName] = useState<string | null>(null);
  const [previewProductLoading, setPreviewProductLoading] = useState<boolean>(true);
  const [cardShowCategory, setCardShowCategory] = useState<boolean>(true);
  const [cardShowComparePrice, setCardShowComparePrice] = useState<boolean>(true);
  const [cardShowDiscountBadge, setCardShowDiscountBadge] = useState<boolean>(true);
  const [cardShowStock, setCardShowStock] = useState<boolean>(true);
  const [cardShowAddToCart, setCardShowAddToCart] = useState<boolean>(true);
  const [cartActionNotice, setCartActionNotice] = useState<string | null>(null);

  const loadFoundationData = useCallback((signal?: AbortSignal) => {
    setLoading(true);
    setPreviewProductLoading(true);
    setErrorMessage(null);

    Promise.all([
      storefrontApiClient.getHealth({ signal }),
      storefrontApiClient.getSettings({ signal }),
      storefrontApiClient.getAdminPages({ signal }),
      storefrontApiClient.getProducts({ limit: 1 }, { signal }).catch(() => null),
      storefrontApiClient.getCategories({ signal }).catch(() => null),
    ])
      .then(([healthRes, settingsRes, pagesRes, productsRes, categoriesRes]) => {
        setHealth(healthRes);
        setSettings(settingsRes.settings);
        setPages(pagesRes.pages || []);

        if (productsRes && productsRes.products && productsRes.products.length > 0) {
          const firstProd = productsRes.products[0];
          setPreviewProduct(firstProd);
          if (firstProd.categoryId && categoriesRes && categoriesRes.categories) {
            const cat = categoriesRes.categories.find((c) => c.id === firstProd.categoryId);
            setPreviewCategoryName(cat ? cat.name : null);
          } else {
            setPreviewCategoryName(null);
          }
        } else {
          setPreviewProduct(null);
          setPreviewCategoryName(null);
        }

        setLoading(false);
        setPreviewProductLoading(false);
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        const msg =
          err instanceof Error && err.message
            ? err.message
            : 'Unable to verify storefront foundation and blueprint endpoints.';
        setErrorMessage(msg);
        setLoading(false);
        setPreviewProductLoading(false);
      });
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    loadFoundationData(controller.signal);
    return () => {
      controller.abort();
    };
  }, [loadFoundationData]);

  const publishedPagesCount = pages.filter((p) => p.isPublished).length;
  const customizedPagesCount = pages.filter((p) => p.isCustomized).length;

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-20">
      <StorefrontSubNav activeTab="overview" />

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Storefront Overview</h1>
          <p className="text-muted-foreground mt-1">
            Manage storefront page blueprints, block structures, and live catalog readiness.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="min-h-11 self-start sm:self-auto"
          onClick={() => loadFoundationData()}
          disabled={loading}
        >
          {loading ? 'Checking...' : 'Refresh Status'}
        </Button>
      </div>

      {errorMessage && (
        <Alert variant="destructive">
          <AlertTitle>Storefront API Check Failed</AlertTitle>
          <AlertDescription className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-2">
            <span>{errorMessage}</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-11"
              onClick={() => loadFoundationData()}
            >
              Retry Check
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Foundation & Blueprint Status Section */}
      <section aria-labelledby="foundation-status-heading" className="space-y-4">
        <div className="flex items-center justify-between">
          <h2
            id="foundation-status-heading"
            className="text-sm font-semibold uppercase tracking-wider text-muted-foreground"
          >
            Storefront System Status
          </h2>
          <Badge variant="outline">Milestone 2 Active</Badge>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((item) => (
              <Card key={item}>
                <CardHeader className="pb-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-6 w-32 mt-2" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-4 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2">
                  <CardDescription className="uppercase font-semibold text-xs">
                    Public API
                  </CardDescription>
                  <Badge
                    variant="outline"
                    className={
                      health?.status === 'ready'
                        ? 'bg-green-500/10 text-green-600 border-green-500'
                        : 'bg-red-500/10 text-red-600 border-red-500'
                    }
                  >
                    {health?.status === 'ready' ? 'ONLINE' : 'OFFLINE'}
                  </Badge>
                </div>
                <CardTitle className="text-xl pt-1">Read-Safe DTOs</CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">
                Public namespace active at{' '}
                <code className="font-mono">/storefront/*</code> with field whitelisting.
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2">
                  <CardDescription className="uppercase font-semibold text-xs">
                    Page Blueprints
                  </CardDescription>
                  <Badge variant="secondary">
                    {publishedPagesCount}/{pages.length || 4} Published
                  </Badge>
                </div>
                <CardTitle className="text-xl pt-1">
                  {pages.length || 4} Store Pages
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">
                {customizedPagesCount === 0
                  ? 'All pages using default v1 blueprints.'
                  : `${customizedPagesCount} ${customizedPagesCount === 1 ? 'page' : 'pages'} customized by merchant.`}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2">
                  <CardDescription className="uppercase font-semibold text-xs">
                    Catalog Readiness
                  </CardDescription>
                  <Badge variant="outline">
                    {health?.catalog.publishedProducts ?? 0} Published
                  </Badge>
                </div>
                <CardTitle className="text-xl pt-1">
                  {health?.catalog.publishedProducts ?? 0} Products
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">
                {health?.catalog.activeCategories ?? 0} active categories available to storefront
                queries.
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2">
                  <CardDescription className="uppercase font-semibold text-xs">
                    Integration
                  </CardDescription>
                  <Badge variant="outline">{settings?.currency || 'INR'}</Badge>
                </div>
                <CardTitle className="text-xl pt-1">
                  {settings?.shippingMethod || 'Flat'} Shipping
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">
                Tax calculation:{' '}
                {settings?.taxesEnabled ? 'Enabled (TaxEngine)' : 'Disabled'}. Fulfilment:{' '}
                {settings?.locationSelection || 'Nearest'}.
              </CardContent>
            </Card>
          </div>
        )}
      </section>

      {/* Storefront Pages & Blueprints Hub */}
      <section aria-labelledby="storefront-pages-heading" className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2
              id="storefront-pages-heading"
              className="text-sm font-semibold uppercase tracking-wider text-muted-foreground"
            >
              Storefront Pages & Blueprints
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Configure ordered block structures, display settings, and publication status for each customer-facing page.
            </p>
          </div>
          <Badge variant="outline">Synced with OpenExt Pages</Badge>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((item) => (
              <Card key={item}>
                <CardHeader>
                  <Skeleton className="h-5 w-36" />
                  <Skeleton className="h-4 w-full mt-2" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-11 w-40" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pages.map((page) => {
              const enabledBlocksCount = page.blocks.filter((b) => b.enabled).length;
              const pageHref = `/plugins/ecommerce-plugin/ui/admin/storefront/${page.pageType}/index.html`;

              return (
                <Card
                  key={page.pageType}
                  className="flex flex-col justify-between hover:border-primary/40 transition-colors"
                >
                  <CardHeader className="pb-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                      <CardTitle className="text-lg">
                        {PAGE_LABELS[page.pageType] || page.title}
                      </CardTitle>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge
                          variant="outline"
                          className={
                            page.isPublished
                              ? 'bg-green-500/10 text-green-600 border-green-500'
                              : 'bg-amber-500/10 text-amber-600 border-amber-500'
                          }
                        >
                          {page.isPublished ? 'Published' : 'Draft'}
                        </Badge>
                        <Badge variant={page.isCustomized ? 'default' : 'secondary'}>
                          {page.isCustomized ? 'Customized' : 'Default'}
                        </Badge>
                        <Badge variant="outline">
                          v{page.appliedBlueprintVersion}
                        </Badge>
                      </div>
                    </div>
                    <CardDescription>{page.description}</CardDescription>
                  </CardHeader>

                  <CardContent className="space-y-4 pt-0">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground border-t pt-3">
                      <span>
                        Route: <code className="font-mono text-foreground">{page.routePattern}</code>
                      </span>
                      <span>
                        {enabledBlocksCount} of {page.blocks.length} blocks active
                      </span>
                    </div>

                    <div className="flex items-center justify-end">
                      <a
                        href={pageHref}
                        className={cn(
                          buttonVariants({ variant: 'outline', size: 'sm' }),
                          'min-h-11 w-full sm:w-auto'
                        )}
                      >
                        Configure {PAGE_LABELS[page.pageType]} Blueprint
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </a>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* Proof Block Interactive Verification */}
      <section aria-labelledby="proof-block-heading" className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2
              id="proof-block-heading"
              className="text-sm font-semibold uppercase tracking-wider text-muted-foreground"
            >
              Foundation Proof Block Preview
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Verify how the block renders inside the OpenExt Editor vs Public Storefront pages.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant={previewEditingMode ? 'default' : 'outline'}
              className="min-h-11"
              onClick={() => setPreviewEditingMode(true)}
            >
              Editor Mode
            </Button>
            <Button
              type="button"
              size="sm"
              variant={!previewEditingMode ? 'default' : 'outline'}
              className="min-h-11"
              onClick={() => setPreviewEditingMode(false)}
            >
              Public Mode
            </Button>
          </div>
        </div>

        <BlockRenderer
          block={{
            id: 'ecommerce-plugin',
            blockType: 'ecommerce.foundation',
            label: 'Ecommerce Storefront Foundation',
          }}
          isEditing={previewEditingMode}
        />
      </section>

      {/* Reusable ProductCard Component Preview (Milestone 4) */}
      <section aria-labelledby="product-card-preview-heading" className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2
                id="product-card-preview-heading"
                className="text-sm font-semibold uppercase tracking-wider text-muted-foreground"
              >
                Customer-Facing ProductCard Preview
              </h2>
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
                Milestone 4
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Production-ready customer-facing card displaying real published catalog data. Reused across Product Grid, Search, and Sliders.
            </p>
          </div>
        </div>

        {cartActionNotice && (
          <Alert className="bg-green-500/10 border-green-500/30 text-green-700 dark:text-green-300">
            <Check className="h-4 w-4" />
            <AlertTitle>Cart Action Callback Dispatched</AlertTitle>
            <AlertDescription className="text-xs mt-1">
              {cartActionNotice}
            </AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader className="pb-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-lg">Real Product Rendering</CardTitle>
                <CardDescription>
                  Interactive preview verifying image aspect ratios, fallback handling, backend pricing, and stock controls.
                </CardDescription>
              </div>

              {/* Display Option Toggles */}
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={cardShowCategory ? 'secondary' : 'outline'}
                  className="text-xs h-8"
                  onClick={() => setCardShowCategory(!cardShowCategory)}
                >
                  Category: {cardShowCategory ? 'On' : 'Off'}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={cardShowComparePrice ? 'secondary' : 'outline'}
                  className="text-xs h-8"
                  onClick={() => setCardShowComparePrice(!cardShowComparePrice)}
                >
                  Compare Price: {cardShowComparePrice ? 'On' : 'Off'}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={cardShowDiscountBadge ? 'secondary' : 'outline'}
                  className="text-xs h-8"
                  onClick={() => setCardShowDiscountBadge(!cardShowDiscountBadge)}
                >
                  Badge: {cardShowDiscountBadge ? 'On' : 'Off'}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={cardShowStock ? 'secondary' : 'outline'}
                  className="text-xs h-8"
                  onClick={() => setCardShowStock(!cardShowStock)}
                >
                  Stock: {cardShowStock ? 'On' : 'Off'}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={cardShowAddToCart ? 'secondary' : 'outline'}
                  className="text-xs h-8"
                  onClick={() => setCardShowAddToCart(!cardShowAddToCart)}
                >
                  Add to Cart: {cardShowAddToCart ? 'On' : 'Off'}
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            {previewProductLoading ? (
              <div className="max-w-xs mx-auto p-4 border rounded-lg space-y-3">
                <Skeleton className="h-48 w-full rounded-md" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-10 w-full rounded-md" />
              </div>
            ) : previewProduct ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                <div className="flex justify-center p-4 bg-muted/20 border rounded-lg">
                  <div className="w-full max-w-xs">
                    <ProductCard
                      product={previewProduct}
                      categoryName={previewCategoryName}
                      currencySymbol={settings?.currencySymbol || '₹'}
                      showCategory={cardShowCategory}
                      showComparePrice={cardShowComparePrice}
                      showDiscountBadge={cardShowDiscountBadge}
                      showStock={cardShowStock}
                      showAddToCart={cardShowAddToCart}
                      onAddToCart={(productId) => {
                        setCartActionNotice(
                          `onAddToCart("${productId}") triggered for "${previewProduct.name}". ProductCard contract verified.`
                        );
                        setTimeout(() => setCartActionNotice(null), 5000);
                      }}
                    />
                  </div>
                </div>

                {/* Data Contract Inspection */}
                <div className="space-y-4 text-xs">
                  <div className="border rounded-md p-4 space-y-2 bg-muted/10">
                    <h4 className="font-semibold text-sm text-foreground">Backend Pricing Contract</h4>
                    <p className="text-muted-foreground">
                      ProductCard consumes backend-calculated fields directly without client-side recalculation:
                    </p>
                    <ul className="space-y-1 font-mono text-muted-foreground mt-2">
                      <li>
                        <span className="text-foreground">catalogPrice:</span>{' '}
                        {previewProduct.catalogPrice ?? 'N/A'} (authoritative listing price)
                      </li>
                      <li>
                        <span className="text-foreground">compareAtPrice:</span>{' '}
                        {previewProduct.compareAtPrice ?? 'null'}
                      </li>
                      <li>
                        <span className="text-foreground">discountPercentage:</span>{' '}
                        {previewProduct.discountPercentage}%
                      </li>
                      <li>
                        <span className="text-foreground">stock:</span> {previewProduct.stock}{' '}
                        ({previewProduct.inStock ? 'In Stock' : 'Out of Stock'})
                      </li>
                      <li>
                        <span className="text-foreground">isDigital:</span>{' '}
                        {previewProduct.isDigital ? 'true' : 'false'}
                      </li>
                    </ul>
                  </div>

                  <div className="border rounded-md p-4 space-y-2 bg-muted/10">
                    <h4 className="font-semibold text-sm text-foreground">Stock & Action Contract</h4>
                    <p className="text-muted-foreground">
                      When <code className="font-mono">inStock === false</code> or{' '}
                      <code className="font-mono">stock &lt;= 0</code>, the Add to Cart button is disabled with{' '}
                      <code className="font-mono">aria-disabled=&quot;true&quot;</code>. Clicking fires the reusable callback{' '}
                      <code className="font-mono">onAddToCart(productId)</code> without faking global cart state.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-12 px-4 border border-dashed rounded-lg">
                <ShoppingCart className="mx-auto h-12 w-12 text-muted-foreground/50 mb-3" />
                <h3 className="text-base font-semibold">No Published Products Found</h3>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1">
                  Publish at least one product in Admin &gt; Products to inspect the customer-facing ProductCard component rendering real catalog data.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
