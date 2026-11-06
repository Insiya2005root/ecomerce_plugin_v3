'use client'

import { cn } from '@/lib/utils'

const STEP_COUNT = 3

export function CheckoutForm1Progress({ step }: { step: number }) {
  return (
    <div className='mb-8 flex justify-center'>
      <div className='flex items-center gap-4'>
        {Array.from({ length: STEP_COUNT }, (_, index) => index + 1).map(stepNumber => (
          <div key={stepNumber} className='flex items-center'>
            <div
              aria-current={stepNumber === step ? 'step' : undefined}
              className={cn(
                'flex size-10 items-center justify-center rounded-full text-sm font-medium transition-colors',
                stepNumber <= step ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
              )}
            >
              {stepNumber}
            </div>
            {stepNumber < STEP_COUNT ? (
              <div
                aria-hidden='true'
                className={cn(
                  'mx-4 h-1 w-16 rounded transition-colors',
                  stepNumber < step ? 'bg-primary' : 'bg-muted',
                )}
              />
            ) : null}
          </div>
        ))}
      </div>
    </div>
  )
}
