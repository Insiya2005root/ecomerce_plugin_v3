import * as React from "react";
import { cn } from "@/lib/utils";

/** Medusa-style container: one subtle surface, header row, divided body. */
export function SectionCard({
  title,
  description,
  actions,
  children,
  className,
  bodyClassName,
}: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn("divide-y overflow-hidden rounded-lg border bg-card shadow-xs", className)}>
      {(title || actions) && (
        <div className="flex items-center justify-between gap-3 px-5 py-3.5">
          <div className="min-w-0">
            {title && <h3 className="text-sm font-semibold text-foreground">{title}</h3>}
            {description && <p className="mt-0.5 text-[13px] text-muted-foreground">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </div>
      )}
      {children !== undefined && <div className={cn(bodyClassName)}>{children}</div>}
    </section>
  );
}

/** Label / value row used inside detail sections. */
export function SectionRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-1 px-5 py-3 text-[13px] sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] sm:gap-4">
      <dt className="font-medium text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words text-foreground">{children}</dd>
    </div>
  );
}

export function Muted({ children = "—" }: { children?: React.ReactNode }) {
  return <span className="text-muted-foreground">{children}</span>;
}
