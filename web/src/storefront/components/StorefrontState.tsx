import React from 'react';
import { AlertCircle, PackageSearch } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

type ShellTag = 'section' | 'div' | 'header' | 'footer';

/** Page-width container every storefront block sits in (as in the shadcn blocks: max-w-7xl, responsive gutters). */
export function StorefrontShell({
  children,
  className,
  innerClassName,
  as: Tag = 'section',
  ...rest
}: { children: React.ReactNode; className?: string; innerClassName?: string; as?: ShellTag } & React.HTMLAttributes<HTMLElement>) {
  return (
    <Tag className={cn('ecom-sf-shell w-full text-foreground dark:bg-background', className)} {...rest}>
      <div className={cn('mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8', innerClassName)}>{children}</div>
    </Tag>
  );
}

/** Note shown only in the page builder, e.g. "Category tiles appear once you add categories". */
export function EditorHint({ children }: { children: React.ReactNode }) {
  return (
    <p className="ecom-sf-editor-hint rounded-2xl border border-dashed bg-muted/40 px-4 py-3 text-center text-sm text-muted-foreground">
      {children}
    </p>
  );
}

export function StorefrontLoadingState({ label = 'Loading…', rows = 1 }: { label?: string; rows?: number }) {
  return (
    <div className="ecom-sf-state flex flex-col gap-3" role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-24 w-full rounded-2xl" />
      ))}
    </div>
  );
}

/** Card-shaped placeholders while products load. */
export function ProductGridSkeleton({ count = 8, className }: { count?: number; className?: string }) {
  return (
    <div className={cn('grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4', className)} role="status" aria-busy="true">
      <span className="sr-only">Loading products…</span>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex flex-col gap-3">
          <Skeleton className="aspect-square w-full rounded-2xl" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/3" />
        </div>
      ))}
    </div>
  );
}

export function StorefrontErrorState({ title = 'Something went wrong', message, onRetry }: { title?: string; message: string; onRetry?: () => void }) {
  return (
    <div className="ecom-sf-state flex flex-col items-center gap-2 rounded-2xl border border-dashed px-6 py-10 text-center" role="alert">
      <AlertCircle className="size-8 text-destructive" aria-hidden="true" />
      <p className="font-semibold">{title}</p>
      <p className="max-w-md text-sm text-muted-foreground">{message}</p>
      {onRetry && (
        <Button variant="outline" className="mt-2 cursor-pointer" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

export function StorefrontEmptyState({
  title = 'No products yet',
  description = 'Check back soon.',
  icon,
  action,
}: {
  title?: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="ecom-sf-state flex flex-col items-center gap-2 rounded-2xl border border-dashed px-6 py-12 text-center" role="status">
      {icon ?? <PackageSearch className="size-10 text-muted-foreground/60" aria-hidden="true" />}
      <p className="text-lg font-semibold">{title}</p>
      <p className="max-w-md text-sm text-muted-foreground">{description}</p>
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function StorefrontNotFoundState({ title, description, actionLabel, actionHref }: { title: string; description: string; actionLabel?: string; actionHref?: string }) {
  return (
    <StorefrontEmptyState
      title={title}
      description={description}
      action={actionLabel && actionHref ? <LinkButton href={actionHref}>{actionLabel}</LinkButton> : undefined}
    />
  );
}

/** A shadcn Button rendered as a link. */
export function LinkButton({
  href,
  children,
  variant = 'default',
  size = 'lg',
  className,
  onClick,
  disabled,
}: {
  href?: string;
  children: React.ReactNode;
  variant?: 'default' | 'outline' | 'secondary' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
  onClick?: React.MouseEventHandler<HTMLAnchorElement>;
  disabled?: boolean;
}) {
  return (
    <Button
      variant={variant}
      size={size}
      className={cn('cursor-pointer', disabled && 'pointer-events-none opacity-50', className)}
      nativeButton={false}
      render={<a href={disabled ? undefined : href} aria-disabled={disabled || undefined} onClick={onClick} />}
    >
      {children}
    </Button>
  );
}

/** Section heading used by blocks (title, optional text, optional action on the right). */
export function SectionHeading({
  title,
  description,
  action,
  align = 'left',
  as: Tag = 'h2',
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  align?: 'left' | 'center';
  as?: 'h1' | 'h2';
}) {
  if (!title && !description && !action) return null;
  const centered = align === 'center';
  return (
    <header className={cn('mb-8 flex flex-col gap-3', centered ? 'items-center text-center' : 'sm:flex-row sm:items-end sm:justify-between')}>
      <div className={cn('flex flex-col gap-2', centered && 'items-center')}>
        {title && <Tag className="text-2xl font-bold tracking-tight text-balance sm:text-3xl">{title}</Tag>}
        {description && <p className="max-w-[60ch] text-muted-foreground text-balance">{description}</p>}
      </div>
      {action}
    </header>
  );
}
