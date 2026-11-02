'use client';

import { useEffect } from 'react';
import { categoryUrls } from '@/lib/products/urls';

// Categories are now edited from their detail page; keep this URL working for old links.
export default function EditCategoryRedirect() {
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('id');
    window.location.replace(id ? categoryUrls.detail(id) : categoryUrls.list());
  }, []);
  return <p className="text-[13px] text-muted-foreground">Opening category…</p>;
}
