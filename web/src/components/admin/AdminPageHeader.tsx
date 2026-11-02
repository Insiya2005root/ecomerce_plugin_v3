import * as React from "react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

export type Crumb = { label: string; href?: string };

export function AdminBreadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <Breadcrumb>
      <BreadcrumbList className="text-[13px]">
        {items.map((item, i) => {
          const last = i === items.length - 1;
          return (
            <React.Fragment key={`${item.label}-${i}`}>
              <BreadcrumbItem className="min-w-0">
                {last || !item.href ? (
                  <BreadcrumbPage className="truncate max-w-[24ch]">{item.label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink href={item.href}>{item.label}</BreadcrumbLink>
                )}
              </BreadcrumbItem>
              {!last && <BreadcrumbSeparator />}
            </React.Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}

export function AdminPageHeader({
  breadcrumbs,
  title,
  description,
  actions,
}: {
  breadcrumbs?: Crumb[];
  title?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  if (!title) {
    // Detail pages: the entity's own card carries the title, so breadcrumbs and actions share one row.
    return (
      <div className="flex flex-wrap items-center justify-between gap-3">
        {breadcrumbs && <AdminBreadcrumbs items={breadcrumbs} />}
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {breadcrumbs && <AdminBreadcrumbs items={breadcrumbs} />}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold tracking-tight text-foreground">{title}</h2>
          {description && <p className="mt-0.5 text-[13px] text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
