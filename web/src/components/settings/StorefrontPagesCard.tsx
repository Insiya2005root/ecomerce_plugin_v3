"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SectionCard } from "@/components/admin/SectionCard";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { InlineError } from "@/components/admin/StateViews";
import { useConfirm } from "@/components/admin/ConfirmDialog";
import { toast } from "@/components/admin/toast";
import { apiRequest, sendJson } from "@/lib/request";

type StorefrontPage = {
  pageType: "shop" | "product" | "cart" | "checkout";
  title: string;
  slug: string;
  isPublished: boolean;
  appliedBlueprintVersion: number;
  latestBlueprintVersion: number;
  hasNewerBlueprint: boolean;
  isCustomized: boolean;
};

/**
 * The storefront pages the plugin created in OpenExt Pages, with a way to apply the plugin's latest page
 * design. Pages that were never edited update on their own; edited ones are only replaced from here.
 */
export function StorefrontPagesCard() {
  const [pages, setPages] = React.useState<StorefrontPage[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const { confirm, dialog } = useConfirm();

  const load = React.useCallback(() => {
    setError(null);
    apiRequest<{ pages: StorefrontPage[] }>("/storefront/admin/pages")
      .then((r) => setPages(r.pages))
      .catch((err: Error) => setError(err.message));
  }, []);
  React.useEffect(load, [load]);

  const needsUpdate = (p: StorefrontPage) => p.hasNewerBlueprint || p.appliedBlueprintVersion < p.latestBlueprintVersion || p.isCustomized;
  const outdated = (pages ?? []).filter(needsUpdate);

  const apply = (targets: StorefrontPage[]) =>
    confirm({
      title: targets.length === 1 ? `Apply the latest design to ${targets[0].title}?` : `Apply the latest design to ${targets.length} pages?`,
      description:
        "The page's blocks are replaced with the plugin's current layout. Changes made to these pages in the OpenExt page builder are lost.",
      confirmLabel: "Apply latest design",
      onConfirm: async () => {
        for (const p of targets) await sendJson("POST", `/storefront/admin/pages/${p.pageType}/reset`, { confirmReset: true });
        toast.success(targets.length === 1 ? `${targets[0].title} updated` : "Storefront pages updated", "Open the page in OpenExt to see the new design.");
        load();
      },
    });

  return (
    <SectionCard
      title="Storefront pages"
      description="Shop pages the plugin created in OpenExt Pages. Edit their layout in the OpenExt page builder."
      actions={
        outdated.length > 1 ? (
          <Button size="sm" className="rounded-md" onClick={() => apply(outdated)}>
            Apply latest design to all
          </Button>
        ) : undefined
      }
    >
      {error ? (
        <div className="p-4"><InlineError message={error} /></div>
      ) : !pages ? (
        <div className="space-y-2 p-4">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full rounded" />)}
        </div>
      ) : (
        <ul className="divide-y">
          {pages.map((p) => (
            <li key={p.pageType} className="flex flex-wrap items-center gap-3 px-5 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium">{p.title}</p>
                <p className="text-xs text-muted-foreground">/{p.slug}{p.pageType === "product" ? "?slug=…" : ""}</p>
              </div>
              {needsUpdate(p) ? (
                <StatusBadge tone={p.isCustomized ? "orange" : "blue"}>{p.isCustomized ? "Edited in page builder" : "New design available"}</StatusBadge>
              ) : (
                <StatusBadge tone="green">Latest design</StatusBadge>
              )}
              {needsUpdate(p) && (
                <Button size="sm" variant="outline" className="rounded-md" onClick={() => apply([p])}>
                  Apply latest design
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {dialog}
    </SectionCard>
  );
}
