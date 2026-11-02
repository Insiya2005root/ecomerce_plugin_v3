"use client";

import * as React from "react";
import { productListUrl, productUrls } from "@/lib/products/urls";

const noSubscribe = () => () => {};

/** List URL including the last-used filters. Server snapshot is the plain URL so static HTML and hydration match. */
export function useProductListHref() {
  return React.useSyncExternalStore(noSubscribe, productListUrl, () => productUrls.list());
}
