import React from 'react';

export interface StorefrontShellProps {
  children: React.ReactNode;
  className?: string;
}

export function StorefrontShell({ children, className = '' }: StorefrontShellProps) {
  return (
    <section
      className={`ecom-sf-shell w-full ${className}`.trim()}
      aria-label="Ecommerce Storefront Section"
    >
      <div className="ecom-sf-container">{children}</div>
    </section>
  );
}

export interface StorefrontLoadingStateProps {
  label?: string;
}

export function StorefrontLoadingState({
  label = 'Loading storefront content...',
}: StorefrontLoadingStateProps) {
  return (
    <div
      className="ecom-sf-state ecom-sf-state-loading"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="ecom-sf-spinner" aria-hidden="true" />
      <p className="ecom-sf-state-title">{label}</p>
    </div>
  );
}

export interface StorefrontErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
}

export function StorefrontErrorState({
  title = 'Unable to load storefront content',
  message,
  onRetry,
}: StorefrontErrorStateProps) {
  return (
    <div className="ecom-sf-state ecom-sf-state-error" role="alert">
      <p className="ecom-sf-state-title">{title}</p>
      <p className="ecom-sf-state-desc">{message}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="ecom-sf-btn">
          Try Again
        </button>
      )}
    </div>
  );
}

export interface StorefrontEmptyStateProps {
  title?: string;
  description?: string;
}

export function StorefrontEmptyState({
  title = 'No products available yet',
  description = 'Check back soon once new catalog items are published.',
}: StorefrontEmptyStateProps) {
  return (
    <div className="ecom-sf-state" role="status">
      <p className="ecom-sf-state-title">{title}</p>
      <p className="ecom-sf-state-desc">{description}</p>
    </div>
  );
}

export interface StorefrontNotFoundStateProps {
  title?: string;
  description?: string;
  actionLabel?: string;
  actionHref?: string;
}

export function StorefrontNotFoundState({
  title = 'Item not available',
  description = 'The requested product or category could not be found.',
  actionLabel,
  actionHref,
}: StorefrontNotFoundStateProps) {
  return (
    <div className="ecom-sf-state" role="status">
      <p className="ecom-sf-state-title">{title}</p>
      <p className="ecom-sf-state-desc">{description}</p>
      {actionLabel && actionHref && (
        <a href={actionHref} className="ecom-sf-btn">
          {actionLabel}
        </a>
      )}
    </div>
  );
}
