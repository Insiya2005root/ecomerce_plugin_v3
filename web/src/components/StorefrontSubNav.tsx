'use client';

import React from 'react';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { StorefrontPageType } from '@/storefront/types/storefront';

export type StorefrontNavTab = 'overview' | StorefrontPageType;

interface StorefrontSubNavProps {
  activeTab: StorefrontNavTab;
}

const NAV_ITEMS: Array<{
  id: StorefrontNavTab;
  label: string;
  href: string;
}> = [
  {
    id: 'overview',
    label: 'Overview',
    href: '/plugins/ecommerce-plugin/ui/admin/storefront/index.html',
  },
  {
    id: 'shop',
    label: 'Shop',
    href: '/plugins/ecommerce-plugin/ui/admin/storefront/shop/index.html',
  },
  {
    id: 'product',
    label: 'Product Page',
    href: '/plugins/ecommerce-plugin/ui/admin/storefront/product/index.html',
  },
  {
    id: 'cart',
    label: 'Cart',
    href: '/plugins/ecommerce-plugin/ui/admin/storefront/cart/index.html',
  },
  {
    id: 'checkout',
    label: 'Checkout',
    href: '/plugins/ecommerce-plugin/ui/admin/storefront/checkout/index.html',
  },
];

export function StorefrontSubNav({ activeTab }: StorefrontSubNavProps) {
  return (
    <nav
      aria-label="Storefront section navigation"
      className="flex flex-wrap items-center gap-2 pb-4 border-b"
    >
      {NAV_ITEMS.map((item) => {
        const isActive = item.id === activeTab;
        return (
          <a
            key={item.id}
            href={item.href}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              buttonVariants({
                variant: isActive ? 'default' : 'outline',
                size: 'sm',
              }),
              'min-h-11 px-4 font-medium'
            )}
          >
            {item.label}
          </a>
        );
      })}
    </nav>
  );
}
