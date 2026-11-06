import React, { useEffect, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { EditorHint, LinkButton, ProductGridSkeleton, SectionHeading, StorefrontShell } from '../components/StorefrontState';
import { ProductCard } from '../components/ProductCard';
import { storefrontApiClient } from '../services/storefrontApiClient';
import { addProductToCart } from '../cart/cartStore';
import { currentProductSlug, storefrontLinks } from '../cart/links';
import { useCategories } from '../cart/storeData';
import { gridColumns } from './ProductGridBlock';
import type { BlockSettingsMap, PublicProductDTO, StorefrontBlockComponentProps } from '../types/storefront';

/** "You may also like": other products from the same category (or the newest), under the product. */
export function RelatedProductsBlock({ settings, isEditing }: StorefrontBlockComponentProps<BlockSettingsMap>) {
  const max = Math.max(2, Math.min(12, Number(settings.maxItems) || 4));
  const columns = Math.max(2, Math.min(6, Number(settings.columnsDesktop) || Math.min(4, max)));
  const strategy = settings.matchStrategy === 'newest' ? 'newest' : 'same_category';
  const [items, setItems] = useState<PublicProductDTO[] | null>(null);
  const categories = useCategories();
  const names = new Map(categories.map((c) => [c.id, c.name]));

  useEffect(() => {
    const controller = new AbortController();
    const signal = controller.signal;
    (async () => {
      const slug = currentProductSlug();
      const current = slug ? (await storefrontApiClient.getProductBySlugOrId(slug, { signal }).catch(() => null))?.product : undefined;
      const pick = (list: PublicProductDTO[]) => list.filter((p) => p.id !== current?.id);
      let found: PublicProductDTO[] = [];
      if (strategy === 'same_category' && current?.categoryId) {
        found = pick((await storefrontApiClient.getProducts({ categoryId: current.categoryId, limit: max + 1 }, { signal })).products || []);
      }
      if (found.length < max) {
        const newest = pick((await storefrontApiClient.getProducts({ limit: max + 1, sort: 'newest' }, { signal })).products || []);
        for (const p of newest) if (found.length < max && !found.some((f) => f.id === p.id)) found.push(p);
      }
      setItems(found.slice(0, max));
    })().catch((err) => {
      if (!(err instanceof DOMException && err.name === 'AbortError')) setItems([]);
    });
    return () => controller.abort();
  }, [max, strategy]);

  const grid = gridColumns(columns, 2, 2);
  if (items && items.length === 0) return isEditing ? <StorefrontShell><EditorHint>Related products appear here.</EditorHint></StorefrontShell> : null;

  return (
    <StorefrontShell innerClassName="py-12">
      <SectionHeading
        title={String(settings.sectionTitle || 'You may also like')}
        description={String(settings.description || '')}
        action={
          settings.showViewAll !== false ? (
            <LinkButton href={storefrontLinks.shop()} variant="ghost" size="default" className="self-start sm:self-auto">
              View all
              <ArrowRight data-icon="inline-end" />
            </LinkButton>
          ) : undefined
        }
      />
      <div className="@container">
        {!items ? (
          <ProductGridSkeleton count={Math.min(max, columns)} className={grid} />
        ) : (
          <div className={cn(grid)}>
            {items.map((p) => (
              <ProductCard
                key={p.id}
                product={p}
                categoryName={p.categoryId ? names.get(p.categoryId) : undefined}
                showStock={false}
                showAddToCart={settings.showAddToCart !== false}
                onAddToCart={() => !isEditing && addProductToCart(p)}
                href={storefrontLinks.product(p.slug || p.id)}
              />
            ))}
          </div>
        )}
      </div>
    </StorefrontShell>
  );
}
