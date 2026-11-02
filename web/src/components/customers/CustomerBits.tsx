import { StatusBadge, type StatusTone } from "@/components/admin/StatusBadge";
import type { CustomerSegment } from "@/lib/customers";
import { cn } from "@/lib/utils";

const SEGMENT_TONE: Record<CustomerSegment, StatusTone> = {
  Returning: "green",
  New: "blue",
  "One-time": "grey",
  "No purchases": "orange",
};

export const SEGMENT_HINT: Record<CustomerSegment, string> = {
  Returning: "2 or more orders",
  New: "First order in the last 30 days",
  "One-time": "1 order, more than 30 days ago",
  "No purchases": "Every order was cancelled",
};

export function SegmentBadge({ segment }: { segment: CustomerSegment }) {
  return (
    <span title={SEGMENT_HINT[segment]}>
      <StatusBadge tone={SEGMENT_TONE[segment] ?? "grey"}>{segment}</StatusBadge>
    </span>
  );
}

// Soft tints for initials; picked from the email so a customer keeps the same colour everywhere.
const AVATAR_TINTS = [
  "bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300",
  "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300",
  "bg-violet-100 text-violet-800 dark:bg-violet-500/15 dark:text-violet-300",
  "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
  "bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-300",
  "bg-teal-100 text-teal-800 dark:bg-teal-500/15 dark:text-teal-300",
];

export function CustomerAvatar({ name, email, className }: { name: string; email: string; className?: string }) {
  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join("") || email[0]?.toUpperCase() || "?";
  let hash = 0;
  for (const ch of email.toLowerCase()) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return (
    <span
      aria-hidden
      className={cn("flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold", AVATAR_TINTS[hash % AVATAR_TINTS.length], className)}
    >
      {initials}
    </span>
  );
}
