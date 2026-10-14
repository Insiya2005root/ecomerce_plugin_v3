'use client';

import React from 'react';
import { StorefrontPageBlueprintManager } from '@/components/StorefrontPageBlueprintManager';

export default function StorefrontShopBlueprintPage() {
  return (
    <StorefrontPageBlueprintManager
      pageType="shop"
      heading="Shop Page Blueprint"
      subheading="Configure the layout, category filter toolbar, and product grid display rules for your main customer catalog page."
    />
  );
}
