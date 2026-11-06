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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

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
  const blockTitle = block?.label || 'Ecommerce storefront';

  // Public mode with an empty catalog: a calm "coming soon" instead of an empty block.
  if (!isEditing && publishedProducts === 0) {
    return (
      <StorefrontShell>
        <StorefrontEmptyState title="Catalog coming soon" description="Our store is preparing new items." />
      </StorefrontShell>
    );
  }

  const metrics = [
    ['Published products', publishedProducts],
    ['Active categories', activeCategories],
    ...(isEditing ? [['Shipping', health.configuration.shippingMethod] as const] : []),
  ] as const;

  return (
    <StorefrontShell>
      <Card data-editing={isEditing}>
        <CardHeader className="flex-row items-start justify-between gap-4">
          <div className="flex flex-col gap-1.5">
            <Badge variant="secondary" className="w-fit">{isEditing ? 'Storefront connected' : 'Store online'}</Badge>
            <CardTitle className="text-xl">{isEditing ? blockTitle : 'Welcome to our store'}</CardTitle>
            <CardDescription>
              {isEditing
                ? 'Editor preview: connected to your live catalog. Pick what this block shows under Plugin Settings.'
                : `Browse ${publishedProducts} ${publishedProducts === 1 ? 'product' : 'products'} across ${activeCategories} ${activeCategories === 1 ? 'category' : 'categories'}.`}
            </CardDescription>
          </div>
          {isEditing && (
            <Button variant="outline" className="cursor-pointer" onClick={() => fetchFoundationStatus()}>
              Refresh
            </Button>
          )}
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          {metrics.map(([label, value]) => (
            <div key={label} className="rounded-2xl bg-muted/50 p-4">
              <span className="text-xs text-muted-foreground">{label}</span>
              <strong className="block text-2xl font-semibold">{value}</strong>
            </div>
          ))}
        </CardContent>
      </Card>
    </StorefrontShell>
  );
}
