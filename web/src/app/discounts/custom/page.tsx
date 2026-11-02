'use client';

import { AdminToaster } from '@/components/admin/toast';
import { PromotionsList } from '@/components/discounts/PromotionsList';

export default function CustomListPage() {
  return (
    <AdminToaster>
      <PromotionsList tab="custom" />
    </AdminToaster>
  );
}
