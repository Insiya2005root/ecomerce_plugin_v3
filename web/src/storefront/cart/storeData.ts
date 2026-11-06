import { useEffect, useState } from 'react';
import { storefrontApiClient } from '../services/storefrontApiClient';
import type { PublicCategoryDTO } from '../types/storefront';

/** Store details from Settings (public subset), loaded once and shared by every storefront block. */
export interface StoreInfo {
  storeName: string;
  supportEmail: string;
  supportPhone: string;
  freeShippingThreshold: number;
  shippingMethod: 'Flat' | 'Distance';
}

const FALLBACK: StoreInfo = { storeName: '', supportEmail: '', supportPhone: '', freeShippingThreshold: 0, shippingMethod: 'Flat' };

let storePromise: Promise<StoreInfo> | null = null;
let categoriesPromise: Promise<PublicCategoryDTO[]> | null = null;

function loadStore(): Promise<StoreInfo> {
  storePromise ??= storefrontApiClient
    .getSettings()
    .then((r) => ({ ...FALLBACK, ...(r.settings as Partial<StoreInfo>) }))
    .catch(() => {
      storePromise = null;
      return FALLBACK;
    });
  return storePromise;
}

export function loadCategories(): Promise<PublicCategoryDTO[]> {
  categoriesPromise ??= storefrontApiClient
    .getCategories()
    .then((r) => r.categories || [])
    .catch(() => {
      categoriesPromise = null;
      return [];
    });
  return categoriesPromise;
}

export function useStoreInfo(): StoreInfo {
  const [info, setInfo] = useState<StoreInfo>(FALLBACK);
  useEffect(() => {
    let live = true;
    loadStore().then((v) => live && setInfo(v));
    return () => {
      live = false;
    };
  }, []);
  return info;
}

export function useCategories(): PublicCategoryDTO[] {
  const [list, setList] = useState<PublicCategoryDTO[]>([]);
  useEffect(() => {
    let live = true;
    loadCategories().then((v) => live && setList(v));
    return () => {
      live = false;
    };
  }, []);
  return list;
}

/** Top-level categories (those without a parent in the list). */
export const topLevel = (cats: PublicCategoryDTO[]) => cats.filter((c) => !c.parentId || !cats.some((p) => p.id === c.parentId));
