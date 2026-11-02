'use client';

import { AdminToaster } from '@/components/admin/toast';
import { PromotionsList } from '@/components/discounts/PromotionsList';

export default function AutomaticListPage() {
  return (
    <AdminToaster>
      <PromotionsList tab="automatic" />
    </AdminToaster>
  );
}
