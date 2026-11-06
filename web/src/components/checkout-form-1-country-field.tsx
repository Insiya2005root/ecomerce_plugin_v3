'use client'

import { Field, FieldLabel } from '@/components/ui/field'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

import { countryLabels, countryOptions } from "@/components/data/checkout-form-1-data"

type CheckoutForm1CountryFieldProps = {
  id: string
  value: string
  onValueChange: (value: string) => void
}

export function CheckoutForm1CountryField({ id, value, onValueChange }: CheckoutForm1CountryFieldProps) {
  return (
    <Field>
      <FieldLabel htmlFor={id}>Country</FieldLabel>
      <Select value={value} onValueChange={next => next && onValueChange(next)}>
        <SelectTrigger id={id} className='!h-9 w-full'>
          <SelectValue>{(selected: string) => countryLabels[selected] ?? selected}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {countryOptions.map(country => (
              <SelectItem key={country.value} value={country.value}>
                {country.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </Field>
  )
}
