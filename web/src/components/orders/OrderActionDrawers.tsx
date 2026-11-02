"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { AffixInput, Field, SelectField, TextArea, TextInput } from "@/components/admin/fields";
import { SidePanel } from "@/components/admin/SidePanel";
import { InlineError } from "@/components/admin/StateViews";
import { CURRENCY_SYMBOL, formatMoney } from "@/lib/format";
import { orderActions } from "@/lib/orders/api";
import type { Order } from "@/lib/orders/types";

export type OrderDrawer = "capture" | "refund" | "ship" | null;

const PAYMENT_METHODS = ["Cash", "UPI", "Card", "Bank transfer", "Cash on delivery", "Other"].map((m) => ({ value: m, label: m }));

/** Payment capture, refund and shipping drawers for the order page. Each calls one order action and returns the updated order. */
export function OrderActionDrawers({
  order,
  open,
  onClose,
  onDone,
}: {
  order: Order;
  open: OrderDrawer;
  onClose: () => void;
  onDone: (order: Order, message: string) => void;
}) {
  const [method, setMethod] = React.useState("UPI");
  const [reference, setReference] = React.useState("");
  const [amount, setAmount] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [note, setNote] = React.useState("");
  const [carrier, setCarrier] = React.useState("");
  const [tracking, setTracking] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [openedFor, setOpenedFor] = React.useState<OrderDrawer>(null);

  const refundable = Math.max(0, Math.round(((order.payment?.capturedAmount ?? 0) - (order.payment?.refundedAmount ?? 0)) * 100) / 100);

  if (open !== openedFor) {
    setOpenedFor(open);
    if (open) {
      setError(null);
      setSaving(false);
      setReference("");
      setAmount(open === "refund" ? String(refundable) : "");
      setReason("");
      setNote("");
      setCarrier(order.fulfillment?.carrier ?? "");
      setTracking(order.fulfillment?.trackingNumber ?? "");
    }
  }

  const run = async (fn: () => Promise<Order>, message: string) => {
    setSaving(true);
    setError(null);
    try {
      onDone(await fn(), message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  };

  const submit = () => {
    if (open === "capture") return run(() => orderActions.capture(order._id, { method, reference }), "Payment recorded");
    if (open === "refund") {
      const value = Number(amount.replace(/[₹,\s]/g, ""));
      if (!Number.isFinite(value) || value <= 0) return setError("Enter a refund amount greater than 0.");
      if (value > refundable) return setError(`You can refund at most ${formatMoney(refundable)}.`);
      return run(() => orderActions.refund(order._id, { amount: value, reason, note }), "Refund recorded");
    }
    if (open === "ship") return run(() => orderActions.ship(order._id, { carrier, trackingNumber: tracking }), "Marked as shipped");
  };

  const meta = {
    capture: { title: "Mark as paid", description: `Record a payment of ${formatMoney(order.pricing.totalAmount)} for this order.`, cta: "Mark as paid" },
    refund: { title: "Refund payment", description: `Up to ${formatMoney(refundable)} can be refunded. Record refunds you've made outside the store.`, cta: "Record refund" },
    ship: { title: "Mark as shipped", description: "Add tracking details so you can find the shipment later.", cta: "Mark as shipped" },
  } as const;
  const m = open ? meta[open] : null;

  return (
    <SidePanel
      open={open !== null}
      onOpenChange={(o) => !o && !saving && onClose()}
      title={m?.title ?? ""}
      description={m?.description}
      onSubmit={submit}
      footer={
        <>
          <Button type="button" variant="outline" size="sm" className="rounded-md" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" size="sm" className="rounded-md" disabled={saving}>
            {saving ? "Saving…" : m?.cta}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && <InlineError message={error} />}
        {open === "capture" && (
          <>
            <Field id="payment-method" label="Payment method">
              <SelectField id="payment-method" value={method} options={PAYMENT_METHODS} onChange={(v) => setMethod(v || "Other")} />
            </Field>
            <Field id="payment-reference" label="Reference" optional hint="Transaction ID, UTR or receipt number.">
              <TextInput id="payment-reference" value={reference} onChange={(e) => setReference(e.target.value)} />
            </Field>
          </>
        )}
        {open === "refund" && (
          <>
            <Field id="refund-amount" label="Amount">
              <AffixInput id="refund-amount" prefix={CURRENCY_SYMBOL} value={amount} onChange={(e) => setAmount(e.target.value)} />
            </Field>
            <Field id="refund-reason" label="Reason" optional>
              <TextInput id="refund-reason" value={reason} placeholder="e.g. Damaged item" onChange={(e) => setReason(e.target.value)} />
            </Field>
            <Field id="refund-note" label="Internal note" optional>
              <TextArea id="refund-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
            </Field>
          </>
        )}
        {open === "ship" && (
          <>
            <Field id="ship-carrier" label="Carrier" optional>
              <TextInput id="ship-carrier" value={carrier} placeholder="e.g. Delhivery, Blue Dart" onChange={(e) => setCarrier(e.target.value)} />
            </Field>
            <Field id="ship-tracking" label="Tracking number" optional>
              <TextInput id="ship-tracking" value={tracking} onChange={(e) => setTracking(e.target.value)} />
            </Field>
          </>
        )}
      </div>
    </SidePanel>
  );
}
