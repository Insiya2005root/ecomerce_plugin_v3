import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Banknote, Check, CheckCircle2, Gift, Lock, Shield, Truck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { EditorHint, LinkButton, StorefrontShell } from '../components/StorefrontState';
import { cart, useCart } from '../cart/cartStore';
import { formatInr, storefrontLinks } from '../cart/links';
import { checkoutState, lookupPin, placeStorefrontOrder, useCartQuote, useCheckoutState, type ShippingAddress } from '../cart/pricing';
import { useStoreInfo } from '../cart/storeData';
import { CouponForm, EmptyCart, TotalsRows } from './CartBlocks';
import type { BlockSettingsMap, StorefrontBlockComponentProps } from '../types/storefront';

type Props = StorefrontBlockComponentProps<BlockSettingsMap>;

type Form = {
  name: string;
  email: string;
  phone: string;
  addressLine1: string;
  addressLine2: string;
  postalCode: string;
  city: string;
  state: string;
  notes: string;
};
type Errors = Partial<Record<keyof Form, string>>;
const EMPTY_FORM: Form = { name: '', email: '', phone: '', addressLine1: '', addressLine2: '', postalCode: '', city: '', state: '', notes: '' };
const DETAILS_KEY = 'ecommerce-storefront-checkout';
const FORM_ID = 'ecom-sf-checkout-form';
const CONTACT_FIELDS: (keyof Form)[] = ['name', 'email', 'phone'];
const ADDRESS_FIELDS: (keyof Form)[] = ['addressLine1', 'postalCode', 'city', 'state'];

function validate(f: Form, requirePhone: boolean, only?: (keyof Form)[]): Errors {
  const e: Errors = {};
  if (!f.name.trim()) e.name = 'Enter your name.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) e.email = 'Enter a valid email address.';
  const phone = f.phone.trim();
  if ((requirePhone || phone) && !/^[+\d][\d\s-]{6,18}$/.test(phone)) e.phone = 'Enter a valid phone number.';
  if (!f.addressLine1.trim()) e.addressLine1 = 'Enter your address.';
  if (!/^[1-9]\d{5}$/.test(f.postalCode.trim())) e.postalCode = 'Enter a 6-digit PIN code.';
  if (!f.city.trim()) e.city = 'Enter your city.';
  if (!f.state.trim()) e.state = 'Enter your state.';
  if (!only) return e;
  return Object.fromEntries(Object.entries(e).filter(([k]) => only.includes(k as keyof Form)));
}

const STEPS = [
  { title: 'Contact information', description: "We'll use this to send you order updates." },
  { title: 'Delivery address', description: 'Where should we deliver your order?' },
  { title: 'Payment', description: 'Pay when your order arrives.' },
];

/** Numbered progress (shadcn checkout-form-1). */
function Progress({ step, labels }: { step: number; labels: string[] }) {
  return (
    <ol className="ecom-sf-steps mb-8 flex items-center justify-center gap-2 sm:gap-4" aria-label="Checkout progress">
      {labels.map((label, i) => {
        const n = i + 1;
        return (
          <li key={label} className="flex items-center gap-2 sm:gap-4" aria-current={n === step ? 'step' : undefined}>
            <span className="flex flex-col items-center gap-1.5">
              <span
                className={cn(
                  'flex size-10 items-center justify-center rounded-full text-sm font-medium transition-colors',
                  n <= step ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                )}
              >
                {n < step ? <Check className="size-4" aria-hidden="true" /> : n}
              </span>
              <span className={cn('text-xs', n === step ? 'font-medium' : 'text-muted-foreground')}>{label}</span>
            </span>
            {n < labels.length && <span aria-hidden="true" className={cn('mb-5 h-1 w-8 rounded transition-colors sm:w-16', n < step ? 'bg-primary' : 'bg-muted')} />}
          </li>
        );
      })}
    </ol>
  );
}

/** Thank-you card shown once the order is placed. */
function Confirmation({ settings }: { settings: BlockSettingsMap }) {
  const { placed } = useCheckoutState();
  if (!placed) return null;
  const lookup = String(settings.orderStatusLink || '').trim();
  return (
    <Card className="ecom-sf-confirm mx-auto max-w-xl text-center" role="status">
      <CardContent className="flex flex-col items-center gap-4 py-6">
        <span className="flex size-14 items-center justify-center rounded-full bg-success/15 text-success" aria-hidden="true">
          <CheckCircle2 className="size-8" />
        </span>
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight">{String(settings.thankYouHeading || 'Thank you for your order')}</h1>
          <p className="text-muted-foreground">
            Order <strong className="text-foreground">{placed.orderNumber}</strong> · {formatInr(placed.totalAmount)} · Cash on Delivery
          </p>
        </div>
        <ul className="w-full divide-y rounded-2xl border text-left text-sm">
          {placed.items.map((i) => (
            <li key={i.name} className="flex justify-between gap-3 px-4 py-2">
              <span className="truncate">{i.name}</span>
              <span className="text-muted-foreground">× {i.quantity}</span>
            </li>
          ))}
        </ul>
        <p className="text-sm text-muted-foreground">
          We'll contact you at {placed.email} about delivery. Keep your order number handy
          {lookup ? ' to check its status any time.' : '.'}
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <LinkButton href={storefrontLinks.shop()}>Continue shopping</LinkButton>
          {lookup && (
            <LinkButton
              href={`${lookup}${lookup.includes('?') ? '&' : '?'}order=${encodeURIComponent(placed.orderNumber)}`}
              variant="outline"
            >
              Check order status
            </LinkButton>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/** Contact, delivery and payment. Steps one at a time (layout "steps") or all on one page ("single"). */
function CheckoutForm({ settings, isEditing, showSubmit, layout }: { settings: BlockSettingsMap; isEditing: boolean; showSubmit: boolean; layout: 'steps' | 'single' }) {
  const c = useCart();
  const { placing, step: sharedStep } = useCheckoutState();
  const requirePhone = settings.requirePhone !== false;
  const showNotes = settings.enableOrderNotes !== false;
  // The step lives in the checkout store so the progress bar (a sibling) follows it.
  const step = sharedStep ?? 1;
  const setStep = (n: number) => checkoutState.set({ step: Math.max(1, Math.min(3, n)) });
  const [form, setForm] = useState<Form>(() => {
    try {
      return { ...EMPTY_FORM, ...JSON.parse(window.localStorage.getItem(DETAILS_KEY) || '{}'), notes: '' };
    } catch {
      return EMPTY_FORM;
    }
  });
  const [errors, setErrors] = useState<Errors>({});
  const [submitError, setSubmitError] = useState('');
  const [pinState, setPinState] = useState<'idle' | 'looking' | 'missing'>('idle');
  const lastPin = useRef('');
  const topRef = useRef<HTMLFormElement | null>(null);

  const set = (key: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    setErrors((er) => ({ ...er, [key]: undefined }));
  };

  // Share the address with the summary so shipping is priced for it.
  useEffect(() => {
    const address: ShippingAddress | undefined = /^[1-9]\d{5}$/.test(form.postalCode)
      ? { addressLine1: form.addressLine1, city: form.city, state: form.state, postalCode: form.postalCode, country: 'India' }
      : undefined;
    const t = window.setTimeout(() => checkoutState.set({ address }), 400);
    return () => window.clearTimeout(t);
  }, [form.postalCode, form.city, form.state, form.addressLine1]);

  // PIN code fills city and state.
  useEffect(() => {
    const pin = form.postalCode.trim();
    if (!/^[1-9]\d{5}$/.test(pin) || pin === lastPin.current) return;
    lastPin.current = pin;
    setPinState('looking');
    lookupPin(pin)
      .then((place) => {
        if (!place?.city && !place?.state) return setPinState('missing');
        setPinState('idle');
        setForm((f) => ({ ...f, city: place.city || f.city, state: place.state || f.state }));
        setErrors((er) => ({ ...er, city: undefined, state: undefined }));
      })
      .catch(() => setPinState('missing'));
  }, [form.postalCode]);

  const focusFirst = (found: Errors) => {
    const first = Object.keys(found)[0];
    if (!first) return false;
    const el = document.getElementById(`ecom-sf-${first}`);
    el?.scrollIntoView({ block: 'center' });
    el?.focus();
    return true;
  };

  const goToStep = (n: number) => {
    setStep(n);
    const top = topRef.current?.getBoundingClientRect().top ?? 0;
    if (top < 0) topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const next = () => {
    const found = validate(form, requirePhone, step === 1 ? CONTACT_FIELDS : ADDRESS_FIELDS);
    setErrors(found);
    if (!focusFirst(found)) goToStep(Math.min(3, step + 1));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isEditing || checkoutState.get().placing) return;
    if (layout === 'steps' && step < 3) return next();
    const found = validate(form, requirePhone);
    setErrors(found);
    if (Object.keys(found).length) {
      if (layout === 'steps') goToStep(Object.keys(found).some((k) => CONTACT_FIELDS.includes(k as keyof Form)) ? 1 : 2);
      window.setTimeout(() => focusFirst(found), 0);
      return;
    }
    checkoutState.set({ placing: true });
    setSubmitError('');
    try {
      const { notes, ...details } = form;
      try {
        window.localStorage.setItem(DETAILS_KEY, JSON.stringify(details));
      } catch {
        // Not remembered for next time; checkout still works.
      }
      const res = await placeStorefrontOrder({
        items: c.lines.map((l) => ({ productId: l.productId, variantId: l.variantId, quantity: l.quantity })),
        couponCode: c.coupon || undefined,
        customerDetails: { name: form.name.trim(), email: form.email.trim(), phone: form.phone.trim() },
        customerAddress: {
          addressLine1: form.addressLine1.trim(),
          addressLine2: form.addressLine2.trim(),
          city: form.city.trim(),
          state: form.state.trim(),
          postalCode: form.postalCode.trim(),
        },
        notes: showNotes ? notes.trim() : '',
        paymentMethod: 'COD',
      });
      checkoutState.set({
        placing: false,
        placed: {
          orderId: res.orderId,
          orderNumber: res.orderNumber,
          totalAmount: res.totalAmount,
          email: form.email.trim(),
          items: c.lines.map((l) => ({ name: l.variantLabel ? `${l.name} (${l.variantLabel})` : l.name, quantity: l.quantity })),
        },
      });
      cart.clear();
      window.scrollTo({ top: 0 });
    } catch (err) {
      checkoutState.set({ placing: false });
      setSubmitError(err instanceof Error ? err.message : 'Could not place the order. Please try again.');
    }
  };

  const field = (
    key: keyof Form,
    label: string,
    props: React.InputHTMLAttributes<HTMLInputElement> = {},
    hint?: string
  ) => (
    <Field data-invalid={Boolean(errors[key]) || undefined}>
      <FieldLabel htmlFor={`ecom-sf-${key}`}>{label}</FieldLabel>
      <Input
        id={`ecom-sf-${key}`}
        className="h-9"
        value={form[key]}
        onChange={set(key)}
        aria-invalid={Boolean(errors[key]) || undefined}
        aria-describedby={errors[key] ? `ecom-sf-${key}-error` : undefined}
        {...props}
      />
      {errors[key] ? <FieldError id={`ecom-sf-${key}-error`}>{errors[key]}</FieldError> : hint ? <FieldDescription>{hint}</FieldDescription> : null}
    </Field>
  );

  const contact = (
    <FieldGroup>
      {field('email', 'Email address', { type: 'email', autoComplete: 'email', placeholder: 'you@example.com' }, 'Your order confirmation goes here.')}
      <div className="grid gap-4 md:grid-cols-2">
        {field('name', 'Full name', { autoComplete: 'name' })}
        {field('phone', requirePhone ? 'Phone number' : 'Phone number (optional)', { type: 'tel', autoComplete: 'tel', inputMode: 'tel', placeholder: '+91 98765 43210' })}
      </div>
    </FieldGroup>
  );

  const pinHint = pinState === 'looking' ? 'Finding your city…' : pinState === 'missing' ? 'PIN not found. Enter the city and state.' : 'Fills in your city and state.';
  const address = (
    <FieldGroup>
      {field('addressLine1', 'Address', { autoComplete: 'address-line1', placeholder: 'House no., building, street' })}
      {field('addressLine2', 'Area or landmark (optional)', { autoComplete: 'address-line2' })}
      <div className="grid gap-4 md:grid-cols-3">
        {field('postalCode', 'PIN code', { autoComplete: 'postal-code', inputMode: 'numeric', maxLength: 6 }, pinHint)}
        {field('city', 'City', { autoComplete: 'address-level2' })}
        {field('state', 'State', { autoComplete: 'address-level1' })}
      </div>
      {showNotes && (
        <Field>
          <FieldLabel htmlFor="ecom-sf-notes">Delivery notes (optional)</FieldLabel>
          <Textarea id="ecom-sf-notes" rows={2} value={form.notes} onChange={set('notes')} placeholder="E.g. call before delivery" />
        </Field>
      )}
    </FieldGroup>
  );

  const payment = (
    <RadioGroup value="COD" aria-label="Payment method">
      <label className="flex cursor-pointer items-start gap-3 rounded-2xl border p-4 has-data-checked:border-primary has-data-checked:bg-muted/40">
        <RadioGroupItem value="COD" id="ecom-sf-payment-cod" className="mt-0.5" />
        <Banknote className="size-5 shrink-0" aria-hidden="true" />
        <span className="flex flex-col gap-0.5">
          <span className="font-medium">Cash on Delivery</span>
          <span className="text-sm text-muted-foreground">Pay in cash or UPI when your order arrives.</span>
        </span>
      </label>
    </RadioGroup>
  );

  const notice = settings.checkoutNotice ? <p className="text-xs text-muted-foreground">{String(settings.checkoutNotice)}</p> : null;
  const errorBox = submitError ? (
    <p className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
      {submitError}
    </p>
  ) : null;
  const placeLabel = placing ? 'Placing order…' : String(settings.submitButtonLabel || 'Place order');

  if (layout === 'single') {
    const section = (n: number, body: React.ReactNode) => (
      <Card>
        <CardHeader>
          <CardTitle className="text-balance">
            {n}. {STEPS[n - 1].title}
          </CardTitle>
          <CardDescription>{STEPS[n - 1].description}</CardDescription>
        </CardHeader>
        <CardContent>{body}</CardContent>
      </Card>
    );
    return (
      <form id={FORM_ID} ref={topRef} className="ecom-sf-checkout flex flex-col gap-6" onSubmit={submit} noValidate>
        {section(1, contact)}
        {section(2, address)}
        {section(3, payment)}
        {notice}
        {errorBox}
        {showSubmit && (
          <Button type="submit" size="lg" className="ecom-sf-btn-primary h-10 w-full cursor-pointer text-base" disabled={placing || isEditing}>
            <Lock data-icon="inline-start" />
            {placeLabel}
          </Button>
        )}
      </form>
    );
  }

  return (
    <form id={FORM_ID} ref={topRef} className="ecom-sf-checkout scroll-mt-24" onSubmit={submit} noValidate>
      <Card>
        <CardHeader>
          <CardTitle className="text-balance">{STEPS[step - 1].title}</CardTitle>
          <CardDescription>{STEPS[step - 1].description}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          {step === 1 && contact}
          {step === 2 && address}
          {step === 3 && (
            <>
              {payment}
              <div className="rounded-2xl bg-muted/40 p-4 text-sm">
                <p className="font-medium">Delivering to</p>
                <p className="text-muted-foreground">
                  {form.name} · {form.phone || form.email}
                  <br />
                  {[form.addressLine1, form.addressLine2, form.city, form.state, form.postalCode].filter(Boolean).join(', ')}
                </p>
                <button type="button" className="mt-1 cursor-pointer text-sm underline underline-offset-4" onClick={() => goToStep(2)}>
                  Change
                </button>
              </div>
              {notice}
            </>
          )}
          {errorBox}
          <div className="flex justify-between gap-3 pt-2">
            <Button type="button" variant="outline" className="h-9 cursor-pointer px-4" onClick={() => goToStep(step - 1)} disabled={step === 1}>
              <ArrowLeft data-icon="inline-start" />
              Back
            </Button>
            {/* Separate keys: if React reused one <button> for both, the click on Continue would turn it into
                the submit button mid-click and place the order straight away. */}
            {step < 3 ? (
              <Button key="continue" type="button" className="h-9 cursor-pointer px-4" onClick={next}>
                Continue
              </Button>
            ) : (
              <Button key="place-order" type="submit" className="ecom-sf-btn-primary h-9 cursor-pointer px-4" disabled={placing || isEditing}>
                <Lock data-icon="inline-start" />
                {placeLabel}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </form>
  );
}

/** Order summary (shadcn checkout-form-1): items, coupon, totals priced for the address, perks. */
function OrderReview({ settings, withSubmit, isEditing }: { settings: BlockSettingsMap; withSubmit: boolean; isEditing: boolean }) {
  const c = useCart();
  const info = useStoreInfo();
  const { address, placing } = useCheckoutState();
  const { quote, error } = useCartQuote(address);
  return (
    <Card className="ecom-sf-summary lg:sticky lg:top-24" aria-label="Your order">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-balance">Order summary</CardTitle>
          <a href={storefrontLinks.cart()} className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground">
            Edit cart
          </a>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {settings.showLineItemsList !== false && (
          <ul className="flex flex-col gap-4">
            {c.lines.map((l) => {
              const p = quote?.items.find((i) => i.productId === l.productId && (i.variantId || '') === (l.variantId || '') && !i.isFreeGift);
              return (
                <li key={`${l.productId}:${l.variantId || ''}`} className="flex gap-4">
                  <span className="relative shrink-0">
                    {l.image ? <img src={l.image} alt="" className="size-16 rounded-xl object-cover" /> : <span className="block size-16 rounded-xl bg-muted" />}
                    <Badge variant="secondary" className="absolute -end-2 -top-2 size-6 rounded-full p-0 text-xs">
                      {l.quantity}
                    </Badge>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{l.name}</span>
                    {l.variantLabel && <span className="block text-xs text-muted-foreground">{l.variantLabel}</span>}
                    <span className="mt-1 block text-sm font-medium">{p ? formatInr(p.price * l.quantity) : ''}</span>
                  </span>
                </li>
              );
            })}
            {quote?.items
              .filter((i) => i.isFreeGift || i.isAutoAddedGift)
              .map((g) => (
                <li key={`gift-${g.productId}`} className="flex items-center gap-4 text-sm">
                  <span className="flex size-16 items-center justify-center rounded-xl bg-muted">
                    <Gift className="size-5" aria-hidden="true" />
                  </span>
                  <span className="flex-1">{g.name}</span>
                  <Badge variant="secondary">Free</Badge>
                </li>
              ))}
          </ul>
        )}
        {settings.showCoupon !== false && (
          <>
            <Separator />
            <CouponForm settings={settings} />
          </>
        )}
        <Separator />
        {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
        {quote ? (
          <TotalsRows quote={quote} showShipping={settings.showShippingRow !== false} showTax={settings.showTaxBreakdown !== false} />
        ) : (
          !error && <p className="text-sm text-muted-foreground">Calculating…</p>
        )}
        {!address && <p className="text-xs text-muted-foreground">Enter your PIN code to see the shipping cost.</p>}
        {quote?.pricing.shippingSnapshot?.error && <p className="text-sm text-destructive">{quote.pricing.shippingSnapshot.error}</p>}
        {withSubmit && (
          <Button type="submit" form={FORM_ID} size="lg" className="ecom-sf-btn-primary h-10 w-full cursor-pointer text-base" disabled={placing || isEditing}>
            <Lock data-icon="inline-start" />
            {placing ? 'Placing order…' : String(settings.submitButtonLabel || 'Place order')}
          </Button>
        )}
        {settings.showPerks !== false && (
          <div className="flex flex-col gap-3 pt-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-2">
              <Shield className="size-4 text-success" aria-hidden="true" />
              Your details are only used for this order
            </span>
            <span className="flex items-center gap-2">
              <Truck className="size-4 text-blue-600 dark:text-blue-400" aria-hidden="true" />
              {info.freeShippingThreshold > 0 ? `Free shipping on orders over ${formatInr(info.freeShippingThreshold)}` : 'Delivered to your door'}
            </span>
            <span className="flex items-center gap-2">
              <Banknote className="size-4 text-purple-600 dark:text-purple-400" aria-hidden="true" />
              Cash on Delivery: pay when it arrives
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------------------------------------
// Checkout page: progress, form on the left, order summary on the right.
// ---------------------------------------------------------------------------------------------------------
export function CheckoutPageBlock({ settings, isEditing }: Props) {
  const c = useCart();
  const { placed } = useCheckoutState();
  const layout = settings.checkoutLayout === 'single' ? 'single' : 'steps';
  const heading = String(settings.heading ?? 'Secure checkout');
  const subheading = String(settings.subheading ?? 'Complete your order in a few steps.');
  if (placed) {
    return (
      <StorefrontShell>
        <Confirmation settings={settings} />
      </StorefrontShell>
    );
  }
  if (c.lines.length === 0) {
    return (
      <StorefrontShell>
        <EmptyCart message="Add products to your cart before checking out." isEditing={isEditing} />
      </StorefrontShell>
    );
  }
  return (
    <StorefrontShell>
      {(heading || subheading) && (
        <div className="mb-8 text-center">
          {heading && <h1 className="mb-2 text-3xl font-bold text-balance">{heading}</h1>}
          {subheading && <p className="text-muted-foreground">{subheading}</p>}
        </div>
      )}
      {layout === 'steps' && settings.showProgress !== false && <StepsProgress />}
      <div className="grid gap-8 lg:grid-cols-3 lg:items-start">
        <div className="lg:col-span-2">
          <CheckoutForm settings={settings} isEditing={isEditing} showSubmit={false} layout={layout} />
        </div>
        <div className="lg:col-span-1">
          <OrderReview settings={settings} withSubmit={layout === 'single'} isEditing={isEditing} />
        </div>
      </div>
    </StorefrontShell>
  );
}

/** Progress bar for the checkout steps (reads the step from the checkout store). */
function StepsProgress() {
  const { step } = useCheckoutState();
  return <Progress step={step ?? 1} labels={['Contact', 'Delivery', 'Payment']} />;
}

// ---------------------------------------------------------------------------------------------------------
// Separate checkout blocks (older pages and hand-built pages).
// ---------------------------------------------------------------------------------------------------------
export function CheckoutFormBlock({ settings, isEditing }: Props) {
  const c = useCart();
  const { placed } = useCheckoutState();
  if (placed) return <StorefrontShell><Confirmation settings={settings} /></StorefrontShell>;
  if (c.lines.length === 0) return <StorefrontShell><EmptyCart message="Add products to your cart before checking out." isEditing={isEditing} /></StorefrontShell>;
  return (
    <StorefrontShell>
      <h1 className="mb-6 text-3xl font-bold">Checkout</h1>
      <CheckoutForm settings={settings} isEditing={isEditing} showSubmit layout="single" />
    </StorefrontShell>
  );
}

export function CheckoutSummaryBlock({ settings, isEditing }: Props) {
  const c = useCart();
  const { placed } = useCheckoutState();
  if (placed) return null;
  if (c.lines.length === 0) return isEditing ? <StorefrontShell><EditorHint>Order review (shows when the cart has items).</EditorHint></StorefrontShell> : null;
  return (
    <StorefrontShell>
      <OrderReview settings={settings} withSubmit={false} isEditing={isEditing} />
    </StorefrontShell>
  );
}
