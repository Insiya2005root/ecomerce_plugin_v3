'use client';

import { Suspense } from 'react';
import { useSearchParams } from '@/lib/router';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { AdminToaster } from '@/components/admin/toast';
import { ProductForm } from '@/components/products/ProductForm';
import { ProductLoadState, useProduct } from '@/components/products/useProduct';
import { useProductListHref } from '@/components/products/useProductListHref';
import { productToForm } from '@/lib/products/form';
import { productUrls } from '@/lib/products/urls';

function EditProduct() {
  const id = useSearchParams().get('id') ?? '';
  const { product, error, loading, reload } = useProduct(id);
  const listHref = useProductListHref();

  const crumbs = [
    { label: 'Products', href: listHref },
    ...(product ? [{ label: product.name, href: productUrls.detail(product._id) }] : []),
    { label: 'Edit' },
  ];

  return (
    <div className="space-y-5">
      <AdminPageHeader breadcrumbs={crumbs} title="Edit product" description={product?.name} />
      {product ? (
        <ProductForm
          key={product._id}
          mode="edit"
          productId={product._id}
          initialValues={productToForm(product)}
          cancelHref={productUrls.detail(product._id)}
        />
      ) : (
        <ProductLoadState id={id} loading={loading} error={error} onRetry={reload} />
      )}
    </div>
  );
}

export default function EditProductPage() {
  return (
    <AdminToaster>
      <Suspense fallback={null}>
        <EditProduct />
      </Suspense>
    </AdminToaster>
  );
}
