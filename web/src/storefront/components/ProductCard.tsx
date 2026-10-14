import React, { useState } from 'react';
import type { PublicProductDTO } from '../types/storefront';

export interface ProductCardProps {
  product: PublicProductDTO;
  categoryName?: string | null;
  currencySymbol?: string;
  showCategory?: boolean;
  showSku?: boolean;
  showComparePrice?: boolean;
  showDiscountBadge?: boolean;
  showStock?: boolean;
  showAddToCart?: boolean;
  href?: string;
  onAddToCart?: (productId: string) => void;
  className?: string;
}

export function ProductCard({
  product,
  categoryName,
  currencySymbol = '₹',
  showCategory = true,
  showSku = false,
  showComparePrice = true,
  showDiscountBadge = true,
  showStock = true,
  showAddToCart = true,
  href,
  onAddToCart,
  className = '',
}: ProductCardProps) {
  const [imgError, setImgError] = useState(false);

  // 1. Resolve image: primary image, first array image, or fallback
  const rawImage =
    product?.image ||
    (Array.isArray(product?.images) && product.images.length > 0 ? product.images[0] : null);

  // 2. Resolve pricing: backend-authoritative catalogPrice or price
  const displayPrice =
    typeof product?.catalogPrice === 'number' && Number.isFinite(product.catalogPrice)
      ? product.catalogPrice
      : typeof product?.price === 'number' && Number.isFinite(product.price)
        ? product.price
        : 0;

  const compareAtPrice =
    typeof product?.compareAtPrice === 'number' && Number.isFinite(product.compareAtPrice)
      ? product.compareAtPrice
      : null;

  const hasDiscount =
    compareAtPrice !== null &&
    compareAtPrice > displayPrice &&
    typeof product?.discountPercentage === 'number' &&
    product.discountPercentage > 0;

  // 3. Resolve stock status
  const isOutOfStock =
    product?.inStock === false || (typeof product?.stock === 'number' && product.stock <= 0);

  // 4. Resolve link: leave unset/disabled until Milestone 10 unless explicit href passed
  const hasValidHref = typeof href === 'string' && href.trim().length > 0;
  const productHref = hasValidHref ? href.trim() : undefined;

  const formatCurrency = (amount: number) => {
    return `${currencySymbol}${amount.toLocaleString('en-IN')}`;
  };

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isOutOfStock || !onAddToCart || !product?.id) return;
    onAddToCart(product.id);
  };

  const renderMediaContent = () => (
    <>
      {rawImage && !imgError ? (
        <img
          src={rawImage}
          alt={product?.name || 'Product image'}
          className="ecom-sf-product-card-img"
          loading="lazy"
          decoding="async"
          onError={() => setImgError(true)}
        />
      ) : (
        <div className="ecom-sf-product-card-img-fallback" aria-label="No image available">
          <svg
            className="ecom-sf-product-card-fallback-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
        </div>
      )}
    </>
  );

  return (
    <article
      className={`ecom-sf-product-card ${className}`.trim()}
      data-product-id={product?.id}
      data-in-stock={!isOutOfStock}
    >
      {/* Product Image & Badges */}
      <div className="ecom-sf-product-card-media">
        {hasValidHref ? (
          <a
            href={productHref}
            className="ecom-sf-product-card-img-link"
            tabIndex={-1}
            aria-hidden="true"
          >
            {renderMediaContent()}
          </a>
        ) : (
          <div className="ecom-sf-product-card-img-link" aria-hidden="true">
            {renderMediaContent()}
          </div>
        )}

        {/* Top Badges: Discount & Digital */}
        <div className="ecom-sf-product-card-badge-container">
          {showDiscountBadge && hasDiscount && (
            <span className="ecom-sf-product-card-badge ecom-sf-product-card-badge-discount">
              {Math.round(product.discountPercentage)}% OFF
            </span>
          )}
          {product?.isDigital && (
            <span className="ecom-sf-product-card-badge ecom-sf-product-card-badge-digital">
              Digital
            </span>
          )}
        </div>
      </div>

      {/* Product Content */}
      <div className="ecom-sf-product-card-body">
        {/* Category, SKU & Stock Indicators */}
        <div className="ecom-sf-product-card-meta">
          <div className="ecom-sf-product-card-meta-left">
            {showCategory && categoryName && (
              <span className="ecom-sf-product-card-category" title={categoryName}>
                {categoryName}
              </span>
            )}
            {showSku && product?.sku && (
              <span className="ecom-sf-product-card-sku">SKU: {product.sku}</span>
            )}
          </div>
          {showStock && (
            <span
              className={`ecom-sf-product-card-stock ${
                isOutOfStock
                  ? 'ecom-sf-product-card-stock-out'
                  : 'ecom-sf-product-card-stock-in'
              }`}
            >
              <span className="ecom-sf-product-card-stock-dot" aria-hidden="true" />
              {isOutOfStock ? 'Out of Stock' : 'In Stock'}
            </span>
          )}
        </div>

        {/* Product Title / Semantic Link (max 2 lines) */}
        <h3 className="ecom-sf-product-card-title" title={product?.name || ''}>
          {hasValidHref ? (
            <a href={productHref} className="ecom-sf-product-card-title-link">
              {product?.name || 'Untitled Product'}
            </a>
          ) : (
            <span className="ecom-sf-product-card-title-text">
              {product?.name || 'Untitled Product'}
            </span>
          )}
        </h3>

        {/* Price & Action Section Pinned to Bottom */}
        <div className="ecom-sf-product-card-footer">
          <div className="ecom-sf-product-card-pricing" aria-label="Product Price">
            <span className="ecom-sf-product-card-price-current">
              {formatCurrency(displayPrice)}
            </span>
            {showComparePrice && hasDiscount && compareAtPrice !== null && (
              <span
                className="ecom-sf-product-card-price-compare"
                aria-label={`Original price: ${formatCurrency(compareAtPrice)}`}
              >
                {formatCurrency(compareAtPrice)}
              </span>
            )}
          </div>

          {showAddToCart && (
            <div className="ecom-sf-product-card-actions">
              <button
                type="button"
                className="ecom-sf-product-card-btn"
                onClick={handleAddToCart}
                disabled={isOutOfStock}
                aria-disabled={isOutOfStock}
                aria-label={
                  isOutOfStock
                    ? `${product?.name || 'Product'} is out of stock`
                    : `Add ${product?.name || 'product'} to cart`
                }
              >
                {isOutOfStock ? 'Out of Stock' : 'Add to Cart'}
              </button>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
