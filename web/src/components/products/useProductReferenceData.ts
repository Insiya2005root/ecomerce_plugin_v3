"use client";

import * as React from "react";
import { listCategories, listCollections, listTaxClasses } from "@/lib/products/api";
import type { Category, Collection, TaxClass } from "@/lib/products/types";

/** Categories, collections and tax classes used to label and edit products. Failures degrade to empty lists. */
export function useProductReferenceData() {
  const [categories, setCategories] = React.useState<Category[]>([]);
  const [collections, setCollections] = React.useState<Collection[]>([]);
  const [taxClasses, setTaxClasses] = React.useState<TaxClass[]>([]);
  const [loaded, setLoaded] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    Promise.allSettled([listCategories(), listCollections(), listTaxClasses()]).then(([cats, colls, taxes]) => {
      if (!active) return;
      if (cats.status === "fulfilled") setCategories(cats.value);
      if (colls.status === "fulfilled") setCollections(colls.value.collections);
      if (taxes.status === "fulfilled") setTaxClasses(taxes.value);
      setLoaded(true);
    });
    return () => {
      active = false;
    };
  }, []);

  return { categories, collections, taxClasses, loaded };
}
