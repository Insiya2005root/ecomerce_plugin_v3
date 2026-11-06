'use client'

import { Gift, Shield, Tag, Truck } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'

import { orderSummary } from "@/components/data/checkout-form-1-data"

type CheckoutForm1OrderSummaryProps = {
  promoCode: string
  onPromoCodeChange: (value: string) => void
}

export function CheckoutForm1OrderSummary({ promoCode, onPromoCodeChange }: CheckoutForm1OrderSummaryProps) {
  const subtotal = orderSummary.items.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const total =
    subtotal + orderSummary.shipping + orderSummary.tax - orderSummary.discount - orderSummary.promoDiscount

  return (
    <Card className='sticky top-8'>
      <CardHeader>
        <CardTitle className='text-balance'>Order Summary</CardTitle>
      </CardHeader>
      <CardContent className='flex flex-col gap-4'>
        <div className='flex flex-col gap-4'>
          {orderSummary.items.map(item => (
            <div key={item.id} className='flex gap-4'>
              <div className='relative'>
                <img src={item.image} alt={item.name} className='size-16 rounded-lg object-cover' />
                <Badge
                  variant='secondary'
                  className='px-2.5 py-0.5 font-semibold absolute -end-2 -top-2 size-6 rounded-full p-0 text-xs'
                >
                  {item.quantity}
                </Badge>
              </div>
              <div className='min-w-0 flex-1'>
                <h4 className='truncate text-sm font-medium'>{item.name}</h4>
                <p className='text-muted-foreground text-xs'>{item.variant}</p>
                <p className='mt-1 text-sm font-medium'>${item.price}</p>
              </div>
            </div>
          ))}
        </div>

        <Separator />

        <Field>
          <FieldLabel htmlFor='promoCode-kL1m67Q' className='text-sm'>
            Promo code
          </FieldLabel>
          <div className='flex gap-2'>
            <Input
              id='promoCode-kL1m67Q'
              placeholder='Enter code'
              value={promoCode}
              className='h-9'
              onChange={event => onPromoCodeChange(event.target.value)}
            />
            <Button variant='outline' className='h-9 px-4 py-2 cursor-pointer'>
              Apply
            </Button>
          </div>
        </Field>

        <Separator />

        <div className='flex flex-col gap-2'>
          <div className='flex justify-between text-sm'>
            <span className='text-muted-foreground'>Subtotal</span>
            <span>${subtotal.toFixed(2)}</span>
          </div>
          <div className='flex justify-between text-sm'>
            <span className='text-muted-foreground flex items-center gap-1'>
              <Truck className='size-3' aria-hidden='true' />
              Shipping
            </span>
            <span>${orderSummary.shipping.toFixed(2)}</span>
          </div>
          <div className='flex justify-between text-sm'>
            <span className='text-muted-foreground'>Tax</span>
            <span>${orderSummary.tax.toFixed(2)}</span>
          </div>
          {orderSummary.promoDiscount > 0 ? (
            <div className='flex justify-between text-sm text-green-600'>
              <span className='flex items-center gap-1'>
                <Tag className='size-3' aria-hidden='true' />
                Promo discount
              </span>
              <span>-${orderSummary.promoDiscount.toFixed(2)}</span>
            </div>
          ) : null}
        </div>

        <Separator />

        <div className='flex justify-between font-semibold'>
          <span>Total</span>
          <span>${total.toFixed(2)}</span>
        </div>

        <div className='flex flex-col gap-3 pt-4'>
          <div className='text-muted-foreground flex items-center gap-2 text-xs'>
            <Shield className='size-4 text-green-600' aria-hidden='true' />
            <span>SSL encrypted checkout</span>
          </div>
          <div className='text-muted-foreground flex items-center gap-2 text-xs'>
            <Truck className='size-4 text-blue-600' aria-hidden='true' />
            <span>Free shipping on orders over $75</span>
          </div>
          <div className='text-muted-foreground flex items-center gap-2 text-xs'>
            <Gift className='size-4 text-purple-600' aria-hidden='true' />
            <span>30-day return policy</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
