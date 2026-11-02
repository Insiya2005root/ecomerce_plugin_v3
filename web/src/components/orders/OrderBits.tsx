import * as React from "react";
import { StatusBadge, type StatusTone } from "@/components/admin/StatusBadge";
import { ProductThumbnail } from "@/components/products/ProductBits";
import { formatMoney } from "@/lib/format";
import type { FulfillmentStatus, Order, OrderItem, PaymentStatus, Pricing } from "@/lib/orders/types";
import { productUrls } from "@/lib/products/urls";
import { cn } from "@/lib/utils";

const PAYMENT_TONE: Record<PaymentStatus, StatusTone> = {
  "Not paid": "orange",
  Paid: "green",
  "Partially refunded": "blue",
  Refunded: "grey",
};
const FULFILLMENT_TONE: Record<FulfillmentStatus, StatusTone> = {
  "Not fulfilled": "orange",
  Fulfilled: "blue",
  Shipped: "purple",
  Delivered: "green",
};

export function PaymentBadge({ status }: { status: PaymentStatus }) {
  return <StatusBadge tone={PAYMENT_TONE[status] ?? "grey"}>{status}</StatusBadge>;
}

export function FulfillmentBadge({ status }: { status: FulfillmentStatus }) {
  return <StatusBadge tone={FULFILLMENT_TONE[status] ?? "grey"}>{status}</StatusBadge>;
}

export function CancelledBadge() {
  return <StatusBadge tone="red">Cancelled</StatusBadge>;
}

export const sourceLabel: Record<Order["source"], string> = {
  admin_cart: "Admin cart",
  storefront: "Storefront",
  manual: "Manual",
};

/** One order or cart line: thumbnail, name/SKU, unit price (with the pre-discount price struck through), quantity, total. */
export function LineItem({
  item,
  image,
  controls,
}: {
  item: OrderItem;
  image?: string;
  controls?: React.ReactNode;
}) {
  const gift = item.isFreeGift || item.isAutoAddedGift;
  const original = item.originalPrice ?? item.price;
  return (
    <div className="flex items-start gap-3 px-5 py-3 text-[13px]">
      <ProductThumbnail src={image} className="size-10" />
      <div className="min-w-0 flex-1">
        <a href={productUrls.detail(String(item.productId))} className="block truncate font-medium hover:underline">
          {item.name}
        </a>
        <span className="block truncate text-xs text-muted-foreground">
          {[item.sku, gift ? "Free gift" : null].filter(Boolean).join(" · ") || "—"}
        </span>
        {controls}
      </div>
      <div className="shrink-0 text-right tabular-nums">
        <span className="block">
          {item.price < original && <span className="mr-1.5 text-xs text-muted-foreground line-through">{formatMoney(original)}</span>}
          {formatMoney(item.price)} × {item.quantity}
        </span>
        <span className="block font-medium">{formatMoney(item.price * item.quantity)}</span>
      </div>
    </div>
  );
}

function Row({ label, value, muted, strong, className }: { label: React.ReactNode; value: React.ReactNode; muted?: boolean; strong?: boolean; className?: string }) {
  return (
    <div className={cn("flex items-baseline justify-between gap-4", muted && "text-muted-foreground", strong && "font-semibold text-foreground", className)}>
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

/**
 * Totals breakdown shared by the Cart and the order page so both show identical numbers:
 * subtotal → product & rule discounts → shipping → tax → total.
 */
export function PricingBreakdown({ pricing }: { pricing: Pricing }) {
  const ruleDiscounts = (pricing.appliedDiscounts ?? []).filter((d) => (d.amount ?? 0) > 0 || d.isFreeGift);
  const ruleTotal = ruleDiscounts.reduce((sum, d) => sum + (d.amount ?? 0), 0);
  const productDiscount = Math.max(0, (pricing.discount ?? 0) - ruleTotal);
  const shipping = pricing.shippingSnapshot;
  const taxLines = pricing.taxSnapshot?.taxLines ?? [];
  return (
    <div className="space-y-1.5 text-[13px]">
      <Row label="Subtotal" value={formatMoney(pricing.subtotal)} />
      {productDiscount > 0.004 && <Row label="Product discounts" value={`−${formatMoney(productDiscount)}`} muted />}
      {ruleDiscounts.map((d, i) => (
        <Row
          key={`${d.ruleId ?? d.name}-${i}`}
          muted
          label={
            <span>
              {d.name || d.ruleName || "Discount"}
              {d.isFreeGift && d.rewardProductName ? ` (free ${d.rewardProductName})` : ""}
            </span>
          }
          value={`−${formatMoney(d.amount ?? 0)}`}
        />
      ))}
      <Row
        label={
          <span>
            Shipping
            {shipping?.originName && <span className="text-xs text-muted-foreground"> · from {shipping.originName}</span>}
            {shipping?.freeShippingApplied && <span className="text-xs text-emerald-600"> · free</span>}
          </span>
        }
        value={formatMoney(pricing.shipping)}
      />
      <Row label="Tax" value={formatMoney(pricing.tax)} />
      {taxLines.map((line, i) => (
        <Row key={i} muted className="pl-3 text-xs" label={`${line.label ?? "Tax"}${line.rate !== undefined ? ` ${line.rate}%` : ""}`} value={formatMoney(line.taxAmount ?? 0)} />
      ))}
      <div className="border-t pt-2">
        <Row label="Total" value={formatMoney(pricing.totalAmount)} strong />
      </div>
    </div>
  );
}
