import React, { useCallback, useEffect, useState } from 'react';
import { storefrontApiClient } from '../services/storefrontApiClient';
import type {
  StorefrontBlockComponentProps,
  StorefrontBlockContext,
  StorefrontHealthResponse,
} from '../types/storefront';
import {
  StorefrontEmptyState,
  StorefrontErrorState,
  StorefrontLoadingState,
  StorefrontShell,
} from '../components/StorefrontState';

export type StorefrontFoundationBlockProps =
  | StorefrontBlockContext
  | StorefrontBlockComponentProps<any>;

export function StorefrontFoundationBlock(props: StorefrontFoundationBlockProps) {
  const { block, isEditing } = props;
  const [health, setHealth] = useState<StorefrontHealthResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchFoundationStatus = useCallback((signal?: AbortSignal) => {
    setLoading(true);
    setErrorMessage(null);

    storefrontApiClient
      .getHealth({ signal })
      .then((res) => {
        setHealth(res);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        const msg =
          err instanceof Error && err.message
            ? err.message
            : 'Storefront service is currently unreachable.';
        setErrorMessage(msg);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchFoundationStatus(controller.signal);
    return () => {
      controller.abort();
    };
  }, [fetchFoundationStatus]);

  // Do not render disabled optional blocks on the public storefront
  if (!isEditing && block?.enabled === false) {
    return null;
  }

  if (loading) {
    return (
      <StorefrontShell>
        <StorefrontLoadingState label="Loading store catalog..." />
      </StorefrontShell>
    );
  }

  if (errorMessage || !health) {
    return (
      <StorefrontShell>
        <StorefrontErrorState
          title="Storefront Unavailable"
          message={errorMessage || 'Unable to connect to store catalog.'}
          onRetry={() => fetchFoundationStatus()}
        />
      </StorefrontShell>
    );
  }

  const { publishedProducts, activeCategories } = health.catalog;
  const blockTitle = block?.label || 'Ecommerce Storefront Foundation';
  const isRequiredBlock = Boolean(block?.required);
  const isBlockEnabled = block?.enabled !== false;

  // Editor mode: display helpful setup, block role, and catalog verification details for the merchant
  if (isEditing) {
    return (
      <StorefrontShell>
        <div className="ecom-sf-card" data-editing="true">
          <div className="ecom-sf-header">
            <div>
              <span className="ecom-sf-badge ecom-sf-badge-ready">
                {block?.blockType
                  ? isRequiredBlock
                    ? 'Required System Block'
                    : isBlockEnabled
                      ? 'Optional Block (Active)'
                      : 'Optional Block (Hidden)'
                  : 'Storefront Connected'}
              </span>
              <h3 className="ecom-sf-title">{blockTitle}</h3>
              <p className="ecom-sf-subtitle">
                Editor preview: connected to live catalog data and blueprint configuration.
              </p>
            </div>
            <button
              type="button"
              onClick={() => fetchFoundationStatus()}
              className="ecom-sf-btn"
            >
              Refresh Status
            </button>
          </div>

          <div className="ecom-sf-metrics">
            <div className="ecom-sf-metric-box">
              <span className="ecom-sf-metric-label">Published Products</span>
              <strong className="ecom-sf-metric-value">{publishedProducts}</strong>
            </div>
            <div className="ecom-sf-metric-box">
              <span className="ecom-sf-metric-label">Active Categories</span>
              <strong className="ecom-sf-metric-value">{activeCategories}</strong>
            </div>
            <div className="ecom-sf-metric-box">
              <span className="ecom-sf-metric-label">Shipping Mode</span>
              <strong className="ecom-sf-metric-value">
                {health.configuration.shippingMethod}
              </strong>
            </div>
          </div>
        </div>
      </StorefrontShell>
    );
  }

  // Public customer mode: clean, minimal, customer-safe output with zero technical internals
  if (publishedProducts === 0) {
    return (
      <StorefrontShell>
        <StorefrontEmptyState
          title="Catalog Coming Soon"
          description="Our store is currently preparing new items."
        />
      </StorefrontShell>
    );
  }

  return (
    <StorefrontShell>
      <div className="ecom-sf-card" data-editing="false">
        <div className="ecom-sf-header">
          <div>
            <span className="ecom-sf-badge ecom-sf-badge-ready">Store Online</span>
            <h2 className="ecom-sf-title">
              {block?.blockType ? blockTitle : 'Welcome to Our Store'}
            </h2>
            <p className="ecom-sf-subtitle">
              Browse {publishedProducts} {publishedProducts === 1 ? 'product' : 'products'} across{' '}
              {activeCategories} {activeCategories === 1 ? 'category' : 'categories'}.
            </p>
          </div>
        </div>
      </div>
    </StorefrontShell>
  );
}
