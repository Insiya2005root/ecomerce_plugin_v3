'use client'

import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'

import type { CheckoutForm1Data } from "@/components/data/checkout-form-1-data"
import { CheckoutForm1CountryField } from './checkout-form-1-country-field'

type CheckoutForm1ShippingStepProps = {
  formData: CheckoutForm1Data
  onChange: (field: keyof CheckoutForm1Data, value: string) => void
}

export function CheckoutForm1ShippingStep({ formData, onChange }: CheckoutForm1ShippingStepProps) {
  return (
    <FieldGroup>
      <Field>
        <FieldLabel htmlFor='address-qP4z17X'>Street address</FieldLabel>
        <Input
          id='address-qP4z17X'
          placeholder='123 Main Street'
          value={formData.address}
          onChange={event => onChange('address', event.target.value)}
          className='h-9'
        />
      </Field>

      <div className='grid gap-4 md:grid-cols-2'>
        <Field>
          <FieldLabel htmlFor='city-sT5y91B'>City</FieldLabel>
          <Input
            id='city-sT5y91B'
            placeholder='New York'
            value={formData.city}
            onChange={event => onChange('city', event.target.value)}
            className='h-9'
          />
        </Field>
        <Field>
          <FieldLabel htmlFor='state-wX3k85M'>State</FieldLabel>
          <Input
            id='state-wX3k85M'
            placeholder='NY'
            value={formData.state}
            onChange={event => onChange('state', event.target.value)}
            className='h-9'
          />
        </Field>
      </div>

      <div className='grid gap-4 md:grid-cols-2'>
        <Field>
          <FieldLabel htmlFor='zipCode-vZ9q46N'>ZIP code</FieldLabel>
          <Input
            id='zipCode-vZ9q46N'
            placeholder='10001'
            value={formData.zipCode}
            onChange={event => onChange('zipCode', event.target.value)}
            className='h-9'
          />
        </Field>
        <CheckoutForm1CountryField
          id='country-bH7l52P'
          value={formData.country}
          onValueChange={value => onChange('country', value)}
        />
      </div>
    </FieldGroup>
  )
}
