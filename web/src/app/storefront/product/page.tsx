'use client';

import React from 'react';
import { StorefrontPageBlueprintManager } from '@/components/StorefrontPageBlueprintManager';

export default function StorefrontProductBlueprintPage() {
  return (
    <StorefrontPageBlueprintManager
      pageType="product"
      heading="Product Page Blueprint"
      subheading="Configure the reusable dynamic template that renders live product galleries, variant selectors, stock badges, and related items."
    />
  );
}
