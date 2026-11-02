'use client';

import { AdminToaster } from '@/components/admin/toast';
import { PromotionsList } from '@/components/discounts/PromotionsList';

export default function CampaignsListPage() {
  return (
    <AdminToaster>
      <PromotionsList tab="campaigns" />
    </AdminToaster>
  );
}
