"use client";

import * as React from "react";
import { PackageIcon } from "@hugeicons/core-free-icons";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/admin/StateViews";
import { ApiError, getProduct } from "@/lib/products/api";
import type { Product } from "@/lib/products/types";
import { cn } from "@/lib/utils";
import { useProductListHref } from "./useProductListHref";

type State = { product: Product | null; error: ApiError | Error | null; loading: boolean };

export function useProduct(id: string) {
  const [state, setState] = React.useState<State>({ product: null, error: null, loading: true });
  const [attempt, setAttempt] = React.useState(0);

  React.useEffect(() => {
    if (!id) return;
    let active = true;
    getProduct(id)
      .then((product) => active && setState({ product, error: null, loading: false }))
      .catch((error) => active && setState({ product: null, error, loading: false }));
    return () => {
      active = false;
    };
  }, [id, attempt]);

  const reload = React.useCallback(() => {
    setState((s) => ({ ...s, error: null, loading: true }));
    setAttempt((n) => n + 1);
  }, []);

  /** Replace local data with a fresh server response (e.g. after a drawer save). */
  const setProduct = React.useCallback((product: Product) => setState({ product, error: null, loading: false }), []);

  return { ...state, loading: id ? state.loading : false, reload, setProduct };
}

/** Loading / not-found / error states shared by the detail and edit pages. */
export function ProductLoadState({
  id,
  loading,
  error,
  onRetry,
}: {
  id: string;
  loading: boolean;
  error: Error | null;
  onRetry: () => void;
}) {
  const listHref = useProductListHref();
  const notFound = !id || (error instanceof ApiError && (error.status === 404 || error.status === 400));
  if (loading && id) {
    return (
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]" aria-busy="true" aria-label="Loading product">
        <div className="space-y-4">
          <Skeleton className="h-40 rounded-lg" />
          <Skeleton className="h-56 rounded-lg" />
          <Skeleton className="h-40 rounded-lg" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-32 rounded-lg" />
          <Skeleton className="h-48 rounded-lg" />
        </div>
      </div>
    );
  }
  return (
    <div className="rounded-lg border bg-card">
      {notFound ? (
        <EmptyState
          icon={PackageIcon}
          title="Product not found"
          description="It may have been deleted, or the link is incomplete."
          action={
            <a href={listHref} className={cn(buttonVariants({ variant: "outline", size: "sm" }), "rounded-md")}>
              Back to products
            </a>
          }
        />
      ) : (
        <ErrorState message={error?.message ?? "Could not load this product."} onRetry={onRetry} />
      )}
    </div>
  );
}
