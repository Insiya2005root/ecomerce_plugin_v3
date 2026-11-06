'use client'

import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'

import type { CheckoutForm1Data } from "@/components/data/checkout-form-1-data"

type CheckoutForm1ContactStepProps = {
  formData: CheckoutForm1Data
  onChange: (field: keyof CheckoutForm1Data, value: string) => void
}

export function CheckoutForm1ContactStep({ formData, onChange }: CheckoutForm1ContactStepProps) {
  return (
    <FieldGroup>
      <Field>
        <FieldLabel htmlFor='email-kL9x23P'>Email address</FieldLabel>
        <Input
          id='email-kL9x23P'
          type='email'
          placeholder='john@example.com'
          value={formData.email}
          onChange={event => onChange('email', event.target.value)}
          className='h-9'
        />
      </Field>

      <div className='grid gap-4 md:grid-cols-2'>
        <Field>
          <FieldLabel htmlFor='firstName-mN7z84Q'>First name</FieldLabel>
          <Input
            id='firstName-mN7z84Q'
            placeholder='John'
            value={formData.firstName}
            onChange={event => onChange('firstName', event.target.value)}
            className='h-9'
          />
        </Field>
        <Field>
          <FieldLabel htmlFor='lastName-pL8w45T'>Last name</FieldLabel>
          <Input
            id='lastName-pL8w45T'
            placeholder='Doe'
            value={formData.lastName}
            onChange={event => onChange('lastName', event.target.value)}
            className='h-9'
          />
        </Field>
      </div>

      <Field>
        <FieldLabel htmlFor='phone-rM6n82S'>Phone number (optional)</FieldLabel>
        <Input
          id='phone-rM6n82S'
          type='tel'
          placeholder='+1 (555) 123-4567'
          value={formData.phone}
          onChange={event => onChange('phone', event.target.value)}
          className='h-9'
        />
      </Field>
    </FieldGroup>
  )
}
