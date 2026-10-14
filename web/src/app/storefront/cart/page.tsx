'use client';

import React from 'react';
import { StorefrontPageBlueprintManager } from '@/components/StorefrontPageBlueprintManager';

export default function StorefrontCartBlueprintPage() {
  return (
    <StorefrontPageBlueprintManager
      pageType="cart"
      heading="Cart Page Blueprint"
      subheading="Configure the shopping cart layout, coupon entry section, and backend-calculated order totals display."
    />
  );
}
