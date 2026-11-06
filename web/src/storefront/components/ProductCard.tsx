import React, { useState } from 'react';
import { ImageOff, ShoppingBag } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { formatInr } from '../cart/links';
import type { PublicProductDTO } from '../types/storefront';

export interface ProductCardProps {
  product: PublicProductDTO;
  categoryName?: string | null;
  showCategory?: boolean;
  showSku?: boolean;
  showComparePrice?: boolean;
  showDiscountBadge?: boolean;
  showStock?: boolean;
  showAddToCart?: boolean;
  /** 'square' (default), 'portrait' (4:5) or 'landscape' (4:3). */
  imageAspect?: string;
  href?: string;
  onAddToCart?: (productId: string) => void;
  className?: string;
}

const ASPECT: Record<string, string> = { square: 'aspect-square', portrait: 'aspect-[4/5]', landscape: 'aspect-[4/3]' };

/** Product tile (shadcn product-card-2): image with hover zoom, badges, name, price and Add to cart. */
export function ProductCard({
  product,
  categoryName,
  showCategory = true,
  showSku = false,
  showComparePrice = true,
  showDiscountBadge = true,
  showStock = true,
  showAddToCart = true,
  imageAspect = 'square',
  href,
  onAddToCart,
  className,
}: ProductCardProps) {
  const [imgError, setImgError] = useState(false);
  const image = product.image || product.images?.[0] || null;
  const price = Number.isFinite(product.catalogPrice) ? product.catalogPrice : product.price || 0;
  const compareAt = typeof product.compareAtPrice === 'number' ? product.compareAtPrice : null;
  const hasDiscount = compareAt !== null && compareAt > price && product.discountPercentage > 0;
  const isOutOfStock = product.inStock === false || (typeof product.stock === 'number' && product.stock <= 0);
  const lowStock = !isOutOfStock && product.variants.length === 0 && product.stock > 0 && product.stock <= 5;
  const hasValidHref = typeof href === 'string' && href.trim().length > 0;
  const link = hasValidHref ? href!.trim() : undefined;
  const name = product.name || 'Untitled product';

  return (
    <Card
      className={cn('ecom-sf-product-card group h-full gap-0 overflow-hidden py-0 transition-shadow hover:shadow-lg', className)}
      data-product-id={product.id}
      data-in-stock={!isOutOfStock}
    >
      <a href={link} tabIndex={-1} aria-hidden="true" className="relative block overflow-hidden bg-muted">
        {image && !imgError ? (
          <img
            src={image}
            alt=""
            loading="lazy"
            decoding="async"
            onError={() => setImgError(true)}
            className={cn('w-full object-cover transition-transform duration-300 group-hover:scale-105', ASPECT[imageAspect] || ASPECT.square)}
          />
        ) : (
          <div className={cn('ecom-sf-product-card-img-fallback flex w-full items-center justify-center text-muted-foreground/60', ASPECT[imageAspect] || ASPECT.square)}>
            <ImageOff className="size-8" aria-label="No image" />
          </div>
        )}
        <div className="absolute top-3 left-3 flex flex-col items-start gap-1.5">
          {showDiscountBadge && hasDiscount && <Badge className="ecom-sf-product-card-badge-discount rounded-md">{Math.round(product.discountPercentage)}% off</Badge>}
          {product.isDigital && <Badge variant="secondary" className="rounded-md">Digital</Badge>}
          {isOutOfStock && <Badge variant="secondary" className="rounded-md">Sold out</Badge>}
        </div>
      </a>

      <CardContent className="flex flex-1 flex-col gap-2 p-4">
        {showCategory && categoryName && (
          <span className="ecom-sf-product-card-category truncate text-xs font-medium tracking-wide text-muted-foreground uppercase">{categoryName}</span>
        )}
        <h3 className="ecom-sf-product-card-title line-clamp-2 text-base font-semibold text-balance" title={name}>
          {link ? (
            <a href={link} className="hover:underline underline-offset-4">
              {name}
            </a>
          ) : (
            <span className="ecom-sf-product-card-title-text">{name}</span>
          )}
        </h3>
        {showSku && product.sku && <span className="ecom-sf-product-card-sku text-xs text-muted-foreground">SKU {product.sku}</span>}

        <div className="ecom-sf-product-card-footer mt-auto flex flex-wrap items-baseline gap-2 pt-1" aria-label="Price">
          <span className="ecom-sf-product-card-price-current text-lg font-semibold">{formatInr(price)}</span>
          {showComparePrice && hasDiscount && <span className="ecom-sf-product-card-price-compare text-sm text-muted-foreground line-through">{formatInr(compareAt)}</span>}
        </div>
        {showStock && (
          <span className={cn('ecom-sf-product-card-stock flex items-center gap-1.5 text-xs font-medium', isOutOfStock ? 'text-destructive' : 'text-success')}>
            <span className={cn('size-1.5 rounded-full', isOutOfStock ? 'bg-destructive' : 'bg-success')} aria-hidden="true" />
            {isOutOfStock ? 'Out of stock' : lowStock ? `Only ${product.stock} left` : 'In stock'}
          </span>
        )}
        {showAddToCart && (
          <Button
            variant={isOutOfStock ? 'secondary' : 'default'}
            className="ecom-sf-product-card-btn mt-2 w-full cursor-pointer"
            disabled={isOutOfStock}
            aria-disabled={isOutOfStock}
            onClick={(e) => {
              e.preventDefault();
              if (!isOutOfStock) onAddToCart?.(product.id);
            }}
            aria-label={isOutOfStock ? `${name} is out of stock` : product.variants.length ? `Choose options for ${name}` : `Add ${name} to cart`}
          >
            {!isOutOfStock && <ShoppingBag data-icon="inline-start" />}
            {isOutOfStock ? 'Out of stock' : product.variants.length ? 'Choose options' : 'Add to cart'}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
