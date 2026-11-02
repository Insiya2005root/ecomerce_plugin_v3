'use client';

import { useEffect } from 'react';
import { categoryUrls } from '@/lib/products/urls';

// Categories are now created from a drawer on the Categories page; keep this URL working for old links.
export default function AddCategoryRedirect() {
  useEffect(() => {
    window.location.replace(categoryUrls.list());
  }, []);
  return <p className="text-[13px] text-muted-foreground">Opening categories…</p>;
}
