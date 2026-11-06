'use client'

import { useState } from 'react'
import { CreditCard, Eye, EyeOff } from 'lucide-react'

import { CheckboxCheck } from '@/components/motion/checkbox-check'
import { Field, FieldGroup, FieldLabel, FieldLegend, FieldSet } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '@/components/ui/input-group'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'

import type { CheckoutForm1Data } from "@/components/data/checkout-form-1-data"

type CheckoutForm1PaymentStepProps = {
  formData: CheckoutForm1Data
  onChange: (field: keyof CheckoutForm1Data, value: string | boolean) => void
  onCardNumberChange: (value: string) => void
  onExpiryChange: (value: string) => void
}

export function CheckoutForm1PaymentStep({
  formData,
  onChange,
  onCardNumberChange,
  onExpiryChange,
}: CheckoutForm1PaymentStepProps) {
  const [showCvv, setShowCvv] = useState(false)

  return (
    <div className='flex flex-col gap-6'>
      <FieldSet>
        <FieldLegend className='text-sm font-medium'>Payment method</FieldLegend>
        <RadioGroup defaultValue='card' className='flex flex-col gap-3'>
          <FieldLabel htmlFor='card-payment-cN9m74K'>
            <Field orientation='horizontal' className='rounded-lg border p-4'>
              <RadioGroupItem value='card' id='card-payment-cN9m74K' />
              <CreditCard className='text-muted-foreground size-5' aria-hidden='true' />
              <span className='flex-1'>Credit or debit card</span>
            </Field>
          </FieldLabel>
        </RadioGroup>
      </FieldSet>

      <FieldGroup>
        <Field>
          <FieldLabel htmlFor='cardNumber-dK5p83L'>Card number</FieldLabel>
          <Input
            id='cardNumber-dK5p83L'
            placeholder='1234 5678 9012 3456'
            value={formData.cardNumber}
            onChange={event => onCardNumberChange(event.target.value)}
            maxLength={19}
            className='h-9'
          />
        </Field>

        <div className='grid gap-4 md:grid-cols-3'>
          <Field>
            <FieldLabel htmlFor='expiryDate-fJ6r29M'>Expiry</FieldLabel>
            <Input
              id='expiryDate-fJ6r29M'
              placeholder='MM/YY'
              value={formData.expiryDate}
              onChange={event => onExpiryChange(event.target.value)}
              maxLength={5}
              className='h-9'
            />
          </Field>
          <Field>
            <FieldLabel htmlFor='cvv-gH8s34N'>CVV</FieldLabel>
            <InputGroup className='h-9'>
              <InputGroupInput
                id='cvv-gH8s34N'
                type={showCvv ? 'text' : 'password'}
                placeholder='123'
                value={formData.cvv}
                onChange={event => onChange('cvv', event.target.value)}
                maxLength={4}
              />
              <InputGroupAddon align='inline-end'>
                <InputGroupButton
                  type='button'
                  variant='ghost'
                  size='icon-xs'
                  aria-label={showCvv ? 'Hide CVV' : 'Show CVV'}
                  className='cursor-pointer hover:bg-transparent'
                  onClick={() => setShowCvv(current => !current)}
                >
                  {showCvv ? <EyeOff className='text-muted-foreground' /> : <Eye className='text-muted-foreground' />}
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
          </Field>
          <Field>
            <FieldLabel htmlFor='cardName-hI9t45O'>Name on card</FieldLabel>
            <Input
              id='cardName-hI9t45O'
              placeholder='John Doe'
              value={formData.cardName}
              onChange={event => onChange('cardName', event.target.value)}
              className='h-9'
            />
          </Field>
        </div>

        <Field orientation='horizontal'>
          <CheckboxCheck
            id='saveInfo-jK0u56P'
            checked={formData.saveInfo}
            onCheckedChange={checked => onChange('saveInfo', checked as boolean)}
          />
          <FieldLabel htmlFor='saveInfo-jK0u56P' className='text-sm font-normal'>
            Save payment information for future purchases
          </FieldLabel>
        </Field>
      </FieldGroup>
    </div>
  )
}
