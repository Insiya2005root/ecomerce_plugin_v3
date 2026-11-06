"use client";

import * as React from "react";
import { Copy01Icon, Delete02Icon, Edit02Icon, PauseIcon, PlayIcon, ViewIcon } from "@hugeicons/core-free-icons";
import type { ActionItem } from "@/components/admin/ActionMenu";
import { useConfirm } from "@/components/admin/ConfirmDialog";
import { toast } from "@/components/admin/toast";
import { deleteDiscount, duplicateDiscount, updateDiscount } from "@/lib/discounts/api";
import { promotionUrls } from "@/lib/discounts/describe";
import type { DiscountRule } from "@/lib/discounts/types";
import { navigate } from "@/lib/router";

const msg = (err: unknown) => (err instanceof Error ? err.message : "Please try again.");

/** View / edit / activate-pause / duplicate / delete for a discount rule, shared by lists and the detail page. */
export function useDiscountActions({
  onUpdated,
  onRemoved,
  includeView = false,
}: {
  onUpdated: (rule: DiscountRule) => void;
  onRemoved: (rule: DiscountRule, archived: boolean) => void;
  includeView?: boolean;
}) {
  const { confirm, dialog } = useConfirm();
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const toggle = React.useCallback(
    async (rule: DiscountRule) => {
      const next = rule.status === "Active" ? "Paused" : "Active";
      setBusyId(rule._id);
      try {
        const updated = await updateDiscount(rule._id, { status: next });
        onUpdated(updated);
        toast.success(next === "Active" ? "Activated" : "Paused", rule.name);
      } catch (err) {
        toast.error("Could not change status", msg(err));
      } finally {
        setBusyId(null);
      }
    },
    [onUpdated]
  );

  const duplicate = React.useCallback(async (rule: DiscountRule) => {
    setBusyId(rule._id);
    try {
      const copy = await duplicateDiscount(rule);
      toast.flash("Duplicated as a draft", copy.code ? `New code: ${copy.code}` : copy.name);
      navigate(promotionUrls.detail(copy._id));
    } catch (err) {
      toast.error("Could not duplicate", msg(err));
      setBusyId(null);
    }
  }, []);

  const remove = React.useCallback(
    (rule: DiscountRule) =>
      confirm({
        title: `Delete ${rule.name}?`,
        description: "It stops applying immediately. If past orders used it, it's archived instead so order history stays intact.",
        confirmLabel: "Delete",
        destructive: true,
        onConfirm: async () => {
          try {
            const res = await deleteDiscount(rule._id);
            onRemoved(rule, res.archived);
          } catch (err) {
            toast.error("Could not delete", msg(err));
          }
        },
      }),
    [confirm, onRemoved]
  );

  const menuFor = React.useCallback(
    (rule: DiscountRule): ActionItem[][] => {
      const busy = busyId === rule._id;
      return [
        [
          ...(includeView ? [{ label: "View details", icon: ViewIcon, onSelect: () => navigate(promotionUrls.detail(rule._id)) }] : []),
          { label: "Edit", icon: Edit02Icon, onSelect: () => navigate(promotionUrls.edit(rule)) },
          { label: "Duplicate", icon: Copy01Icon, disabled: busy, onSelect: () => duplicate(rule) },
        ],
        [
          rule.status === "Active"
            ? { label: "Pause", icon: PauseIcon, disabled: busy, onSelect: () => toggle(rule) }
            : { label: "Activate", icon: PlayIcon, disabled: busy, onSelect: () => toggle(rule) },
        ],
        [{ label: "Delete", icon: Delete02Icon, destructive: true, disabled: busy, onSelect: () => remove(rule) }],
      ];
    },
    [busyId, includeView, duplicate, toggle, remove]
  );

  return { menuFor, dialog, toggle, busyId };
}
