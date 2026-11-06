'use client';

import { useEffect } from 'react';
import { categoryUrls } from '@/lib/products/urls';
import { navigate } from '@/lib/router';

// Categories are now created from a drawer on the Categories page; keep this URL working for old links.
export default function AddCategoryRedirect() {
  useEffect(() => {
    navigate(categoryUrls.list(), { replace: true });
  }, []);
  return <p className="text-[13px] text-muted-foreground">Opening categories…</p>;
}
