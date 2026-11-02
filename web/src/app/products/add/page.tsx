'use client';

import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { AdminToaster } from '@/components/admin/toast';
import { ProductForm } from '@/components/products/ProductForm';
import { useProductListHref } from '@/components/products/useProductListHref';
import { emptyProductForm } from '@/lib/products/form';

export default function AddProductPage() {
  const listHref = useProductListHref();
  return (
    <AdminToaster>
      <div className="space-y-5">
        <AdminPageHeader
          breadcrumbs={[{ label: 'Products', href: listHref }, { label: 'Create' }]}
          title="Create product"
          description="Add a new product to your catalog."
        />
        <ProductForm mode="create" initialValues={emptyProductForm()} cancelHref={listHref} />
      </div>
    </AdminToaster>
  );
}
