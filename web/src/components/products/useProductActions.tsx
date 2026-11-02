"use client";

import * as React from "react";
import { Copy01Icon, Delete02Icon, Edit02Icon, PackageOpenIcon, ViewIcon } from "@hugeicons/core-free-icons";
import type { ActionItem } from "@/components/admin/ActionMenu";
import { useConfirm } from "@/components/admin/ConfirmDialog";
import { toast } from "@/components/admin/toast";
import { deleteProduct, duplicateProduct, getProduct, updateProduct } from "@/lib/products/api";
import { PRODUCT_STATUSES, type Product, type ProductStatus } from "@/lib/products/types";
import { productUrls } from "@/lib/products/urls";

const message = (err: unknown) => (err instanceof Error ? err.message : "Please try again.");

export function useProductActions({
  onUpdated,
  onDeleted,
  includeView = false,
}: {
  onUpdated: (product: Product) => void;
  onDeleted: (product: Product) => void;
  includeView?: boolean;
}) {
  const { confirm, dialog } = useConfirm();
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const setStatus = React.useCallback(
    async (product: Product, status: ProductStatus) => {
      setBusyId(product._id);
      try {
        const updated = await updateProduct(product._id, { status });
        onUpdated(updated);
        toast.success(`Status set to ${status}`, product.name);
      } catch (err) {
        toast.error("Could not update status", message(err));
      } finally {
        setBusyId(null);
      }
    },
    [onUpdated]
  );

  const duplicate = React.useCallback(async (product: Product) => {
    setBusyId(product._id);
    try {
      // List rows are complete documents, but fetch fresh so the copy reflects the latest saved data.
      const source = await getProduct(product._id);
      const copy = await duplicateProduct(source);
      toast.flash("Product duplicated", `${copy.name} was created as a draft.`);
      window.location.href = productUrls.detail(copy._id);
    } catch (err) {
      toast.error("Could not duplicate product", message(err));
      setBusyId(null);
    }
  }, []);

  const remove = React.useCallback(
    (product: Product) =>
      confirm({
        title: "Delete product?",
        description: (
          <>
            <span className="font-medium text-foreground">{product.name}</span> will be permanently deleted. Existing orders
            keep their own copy of the line items. This cannot be undone.
          </>
        ),
        confirmLabel: "Delete",
        destructive: true,
        onConfirm: async () => {
          try {
            await deleteProduct(product._id);
            onDeleted(product);
          } catch (err) {
            toast.error("Could not delete product", message(err));
          }
        },
      }),
    [confirm, onDeleted]
  );

  const menuFor = React.useCallback(
    (product: Product): ActionItem[][] => {
      const busy = busyId === product._id;
      return [
        [
          ...(includeView
            ? [{ label: "View details", icon: ViewIcon, onSelect: () => (window.location.href = productUrls.detail(product._id)) }]
            : []),
          { label: "Edit", icon: Edit02Icon, onSelect: () => (window.location.href = productUrls.edit(product._id)) },
          { label: "Duplicate", icon: Copy01Icon, disabled: busy, onSelect: () => duplicate(product) },
        ],
        PRODUCT_STATUSES.filter((s) => s !== product.status).map((s) => ({
          label: s === "Published" ? "Publish" : s === "Draft" ? "Move to draft" : "Archive",
          icon: PackageOpenIcon,
          disabled: busy,
          onSelect: () => setStatus(product, s),
        })),
        [{ label: "Delete", icon: Delete02Icon, destructive: true, disabled: busy, onSelect: () => remove(product) }],
      ];
    },
    [busyId, includeView, duplicate, setStatus, remove]
  );

  return { menuFor, dialog, busyId, setStatus };
}
