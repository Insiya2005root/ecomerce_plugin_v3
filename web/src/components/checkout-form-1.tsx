'use client'

import { useState } from 'react'
import { ArrowLeft, Lock } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

import { initialCheckoutForm1Data, type CheckoutForm1Data } from "@/components/data/checkout-form-1-data"
import { CheckoutForm1ContactStep } from './checkout-form-1-contact-step'
import { CheckoutForm1OrderSummary } from './checkout-form-1-order-summary'
import { CheckoutForm1PaymentStep } from './checkout-form-1-payment-step'
import { CheckoutForm1Progress } from './checkout-form-1-progress'
import { CheckoutForm1ShippingStep } from './checkout-form-1-shipping-step'

const STEP_COPY = [
  { title: 'Contact Information', description: "We'll use this to send you order updates" },
  { title: 'Shipping Address', description: 'Where should we deliver your order?' },
  { title: 'Payment Details', description: 'Your payment information is secure and encrypted' },
]

export function CheckoutForm1() {
  const [step, setStep] = useState(1)
  const [formData, setFormData] = useState<CheckoutForm1Data>(initialCheckoutForm1Data)

  const handleInputChange = (field: keyof CheckoutForm1Data, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  /** Card numbers read in four-digit groups, so the value is reformatted as it is typed. */
  const handleCardNumberChange = (value: string) => {
    const formatted = value
      .replace(/\s/g, '')
      .replace(/(.{4})/g, '$1 ')
      .trim()
    handleInputChange('cardNumber', formatted)
  }

  const handleExpiryChange = (value: string) => {
    const formatted = value.replace(/\D/g, '').replace(/(\d{2})(\d)/, '$1/$2')
    handleInputChange('expiryDate', formatted)
  }

  const nextStep = () => setStep(prev => Math.min(prev + 1, STEP_COPY.length))
  const prevStep = () => setStep(prev => Math.max(prev - 1, 1))

  return (
    <div className='bg-muted/30'>
      <div className='mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-8'>
        <div className='mb-8 text-center'>
          <h1 className='mb-2 text-3xl font-bold text-balance'>Secure Checkout</h1>
          <p className='text-muted-foreground'>Complete your purchase in just a few steps</p>
        </div>

        <CheckoutForm1Progress step={step} />

        <div className='grid gap-8 lg:grid-cols-3'>
          <div className='lg:col-span-2'>
            <Card>
              <CardHeader>
                <CardTitle className='text-balance'>{STEP_COPY[step - 1].title}</CardTitle>
                <CardDescription>{STEP_COPY[step - 1].description}</CardDescription>
              </CardHeader>
              <CardContent className='flex flex-col gap-6'>
                {step === 1 ? <CheckoutForm1ContactStep formData={formData} onChange={handleInputChange} /> : null}

                {step === 2 ? <CheckoutForm1ShippingStep formData={formData} onChange={handleInputChange} /> : null}

                {step === 3 ? (
                  <CheckoutForm1PaymentStep
                    formData={formData}
                    onChange={handleInputChange}
                    onCardNumberChange={handleCardNumberChange}
                    onExpiryChange={handleExpiryChange}
                  />
                ) : null}

                <div className='flex justify-between pt-6'>
                  <Button
                    type='button'
                    variant='outline'
                    onClick={prevStep}
                    disabled={step === 1}
                    className='h-9 px-4 py-2 cursor-pointer'
                  >
                    <ArrowLeft data-icon='inline-start' />
                    Back
                  </Button>

                  {step < STEP_COPY.length ? (
                    <Button onClick={nextStep} className='h-9 px-4 py-2 cursor-pointer'>
                      Continue
                    </Button>
                  ) : (
                    <Button className='h-9 px-4 py-2 cursor-pointer'>
                      <Lock data-icon='inline-start' />
                      Complete Order
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className='lg:col-span-1'>
            <CheckoutForm1OrderSummary
              promoCode={formData.promoCode}
              onPromoCodeChange={value => handleInputChange('promoCode', value)}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export default CheckoutForm1
