"use client";

import * as React from "react";
import { Suspense } from "react";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { EmptyState, ErrorState } from "@/components/admin/StateViews";
import { AdminToaster } from "@/components/admin/toast";
import { CampaignForm, campaignFromRule } from "@/components/discounts/CampaignForm";
import { CustomRuleForm, customFromRule } from "@/components/discounts/CustomRuleForm";
import { DiscountForm } from "@/components/discounts/DiscountForm";
import { TAB_ACCENT, TabIcon } from "@/components/discounts/PromotionBits";
import { getDiscount } from "@/lib/discounts/api";
import { TAB_META, promotionUrls, tabOf, type PromotionTab } from "@/lib/discounts/describe";
import { discountFromRule } from "@/lib/discounts/form";
import type { DiscountRule } from "@/lib/discounts/types";
import { ApiError } from "@/lib/products/api";
import { cn } from "@/lib/utils";

function FormFor({ tab, mode, rule }: { tab: PromotionTab; mode: "create" | "edit"; rule?: DiscountRule }) {
  if (tab === "campaigns") return <CampaignForm key={rule?._id} mode={mode} rule={rule} initial={campaignFromRule(rule)} />;
  if (tab === "custom") return <CustomRuleForm key={rule?._id} mode={mode} rule={rule} initial={customFromRule(rule)} />;
  return <DiscountForm key={rule?._id} mode={mode} rule={rule} initial={discountFromRule(rule)} coupon={tab === "coupons"} />;
}

function Editor({ tab, mode }: { tab: PromotionTab; mode: "create" | "edit" }) {
  const meta = TAB_META[tab];
  const [rule, setRule] = React.useState<DiscountRule | null>(null);
  const [error, setError] = React.useState<Error | null>(null);
  const [attempt, setAttempt] = React.useState(0);
  const id = React.useSyncExternalStore(
    () => () => {},
    () => new URLSearchParams(window.location.search).get("id") ?? "",
    () => null
  );

  React.useEffect(() => {
    if (mode !== "edit" || !id) return;
    let active = true;
    getDiscount(id)
      .then((r) => active && (setRule(r), setError(null)))
      .catch((err) => active && setError(err));
    return () => {
      active = false;
    };
  }, [mode, id, attempt]);

  // An edit link from the wrong tab still opens the right form.
  const formTab = rule ? tabOf(rule) : tab;
  const crumbs = [
    { label: "Promotions", href: promotionUrls.overview() },
    { label: TAB_META[formTab].label, href: promotionUrls.list(formTab) },
    ...(rule ? [{ label: rule.name, href: promotionUrls.detail(rule._id) }] : []),
    { label: mode === "create" ? "Create" : "Edit" },
  ];
  const title = mode === "create" ? `Create ${meta.singular}` : rule ? `Edit ${TAB_META[formTab].singular}` : "Edit";

  return (
    <div className="space-y-5">
      <AdminPageHeader
        breadcrumbs={crumbs}
        title={
          <span className="flex items-center gap-2.5">
            <TabIcon tab={formTab} className="size-7" />
            {title}
          </span>
        }
        description={mode === "create" ? meta.description : rule?.name}
      />
      {mode === "create" ? (
        <FormFor tab={tab} mode="create" />
      ) : rule ? (
        <FormFor tab={formTab} mode="edit" rule={rule} />
      ) : error || id === "" ? (
        <div className="rounded-lg border bg-card">
          {!id || (error instanceof ApiError && (error.status === 404 || error.status === 400)) ? (
            <EmptyState
              icon={TAB_ACCENT[tab].icon}
              title="Discount not found"
              action={<a href={promotionUrls.list(tab)} className={cn(buttonVariants({ variant: "outline", size: "sm" }), "rounded-md")}>Back to {meta.label.toLowerCase()}</a>}
            />
          ) : (
            <ErrorState message={error?.message ?? "Could not load."} onRetry={() => setAttempt((n) => n + 1)} />
          )}
        </div>
      ) : (
        <div className="space-y-4" aria-busy="true">
          <Skeleton className="h-40 rounded-lg" />
          <Skeleton className="h-64 rounded-lg" />
        </div>
      )}
    </div>
  );
}

export function PromotionEditorPage({ tab, mode }: { tab: PromotionTab; mode: "create" | "edit" }) {
  return (
    <AdminToaster>
      <Suspense fallback={null}>
        <Editor tab={tab} mode={mode} />
      </Suspense>
    </AdminToaster>
  );
}
