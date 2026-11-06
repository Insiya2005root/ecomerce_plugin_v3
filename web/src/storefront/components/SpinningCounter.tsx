/* Adapted from the shadcn shopping-cart-1 block: the cart total spins to its new value. */
import { useEffect, useRef } from 'react'

import { cn } from '@/lib/utils'

/**
 * Spinning counter: each digit is a clipped vertical reel of 0-9 cells that
 * spins forward and lands on the target digit. Adapted from Transitions.dev
 * "Spinning counter" (26-spinning-counter.md), re-tuned for cart totals:
 * one loop instead of several, and a snappier duration so rapid +/- clicks
 * don't queue up sluggish animations. The spec's directional SVG blur is
 * approximated here with a CSS `filter: blur()` transition for simplicity.
 *
 * Non-digit characters (currency symbol, decimal point, thousands separator)
 * render as static text so only the digits spin.
 */
const CELL_SIZE = 20 // px
const DURATION = 450 // ms
const STAGGER = 60 // ms per column
const SPINS = 1 // extra full loops before landing
const SPIN_BLUR = 2 // px

const REEL_DIGITS = Array.from({ length: (SPINS + 1) * 10 }, (_, i) => i % 10)

type SpinningCounterProps = {
  /** The text to show, e.g. "₹12,499": digits spin, other characters stay still. */
  text: string
  className?: string
  digitClassName?: string
}

export function SpinningCounter({ text, className, digitClassName }: SpinningCounterProps) {
  const prefix = ''
  const formatted = text
  const chars = formatted.split('')
  const containerRef = useRef<HTMLSpanElement>(null)
  const isFirstRender = useRef(true)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const strips = Array.from(container.querySelectorAll<HTMLElement>('[data-reel-strip]'))
    const timeouts: number[] = []

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    strips.forEach((strip, index) => {
      const digit = Number(strip.dataset.digit)
      const delay = (strips.length - 1 - index) * STAGGER

      if (isFirstRender.current || !strip.dataset.initialized || prefersReducedMotion) {
        strip.style.transition = 'none'
        strip.style.transform = `translateY(-${digit * CELL_SIZE}px)`
        strip.style.filter = 'blur(0px)'
        strip.dataset.initialized = 'true'
        void strip.offsetHeight
        return
      }

      const landingIndex = SPINS * 10 + digit
      strip.style.transition = `transform ${DURATION}ms cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms, filter ${DURATION}ms ease-out ${delay}ms`
      strip.style.transform = `translateY(-${landingIndex * CELL_SIZE}px)`
      strip.style.filter = `blur(${SPIN_BLUR}px)`

      const settleTimeout = window.setTimeout(() => {
        strip.style.filter = 'blur(0px)'
      }, delay + 30)

      const resetTimeout = window.setTimeout(() => {
        strip.style.transition = 'none'
        strip.style.transform = `translateY(-${digit * CELL_SIZE}px)`
        void strip.offsetHeight
      }, delay + DURATION + 30)

      timeouts.push(settleTimeout, resetTimeout)
    })

    isFirstRender.current = false

    return () => {
      timeouts.forEach(window.clearTimeout)
    }
  }, [formatted])

  return (
    <span className='relative inline-flex items-center'>
      <span className='sr-only'>{prefix}{formatted}</span>
      <span
        ref={containerRef}
        className={cn('inline-flex items-center font-[inherit] tabular-nums', className)}
        style={{ height: CELL_SIZE }}
        aria-hidden='true'
      >
        {prefix ? (
          <span className={digitClassName} style={{ display: 'inline-flex', alignItems: 'center', height: CELL_SIZE }}>
            {prefix}
          </span>
        ) : null}
        {chars.map((char, index) => {
          if (!/\d/.test(char)) {
            return (
              <span
                key={index}
                className={digitClassName}
                style={{ display: 'inline-flex', alignItems: 'center', height: CELL_SIZE }}
              >
                {char}
              </span>
            )
          }

          return (
            <span
              key={index}
              className='relative inline-block overflow-hidden'
              style={{
                height: CELL_SIZE,
                maskImage: 'linear-gradient(to bottom, transparent 0%, #000 22%, #000 78%, transparent 100%)',
                WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, #000 22%, #000 78%, transparent 100%)',
              }}
            >
              <span data-reel-strip data-digit={char} className='flex flex-col will-change-[transform,filter]'>
                {REEL_DIGITS.map((cellDigit, cellIndex) => (
                  <span
                    key={cellIndex}
                    className={cn('flex items-center justify-center', digitClassName)}
                    style={{ height: CELL_SIZE }}
                  >
                    {cellDigit}
                  </span>
                ))}
              </span>
            </span>
          )
        })}
      </span>
    </span>
  )
}

