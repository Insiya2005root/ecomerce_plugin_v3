import { cn } from "@/lib/utils";

export type StatusTone = "green" | "grey" | "orange" | "red" | "blue" | "purple";

// Medusa-style tinted pills: soft background, coloured text and dot, thin matching ring.
const toneClasses: Record<StatusTone, { pill: string; dot: string }> = {
  green: { pill: "bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-400/25", dot: "bg-emerald-500" },
  grey: { pill: "bg-zinc-100 text-zinc-600 ring-zinc-500/20 dark:bg-zinc-500/10 dark:text-zinc-400 dark:ring-zinc-400/25", dot: "bg-zinc-400" },
  orange: { pill: "bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-400/25", dot: "bg-amber-500" },
  red: { pill: "bg-red-50 text-red-700 ring-red-600/20 dark:bg-red-500/10 dark:text-red-400 dark:ring-red-400/25", dot: "bg-red-500" },
  blue: { pill: "bg-sky-50 text-sky-700 ring-sky-600/20 dark:bg-sky-500/10 dark:text-sky-400 dark:ring-sky-400/25", dot: "bg-sky-500" },
  purple: { pill: "bg-violet-50 text-violet-700 ring-violet-600/20 dark:bg-violet-500/10 dark:text-violet-400 dark:ring-violet-400/25", dot: "bg-violet-500" },
};

export function StatusBadge({ tone, children, className }: { tone: StatusTone; children: React.ReactNode; className?: string }) {
  const t = toneClasses[tone] ?? toneClasses.grey;
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1.5 rounded-md px-2 text-xs font-medium whitespace-nowrap ring-1 ring-inset",
        t.pill,
        className
      )}
    >
      <span aria-hidden className={cn("size-1.5 rounded-full", t.dot)} />
      {children}
    </span>
  );
}
