'use client';

import { AdminToaster } from '@/components/admin/toast';
import { PromotionsList } from '@/components/discounts/PromotionsList';

export default function CouponsListPage() {
  return (
    <AdminToaster>
      <PromotionsList tab="coupons" />
    </AdminToaster>
  );
}
