'use client'

import { useLayoutEffect, useRef, useState } from 'react'
import { Checkbox as CheckboxPrimitive } from '@base-ui/react/checkbox'

import { cn } from '@/lib/utils'

/**
 * @title Animated checkbox
 * @description Checkbox whose tick draws on with a stroke path instead of appearing instantly.
 *
 * Adapted from Transitions.dev "Checkbox check".
 *
 * A drop-in replacement for `ui/checkbox`: same props, same look at rest. Two things make the
 * draw work, and both are easy to get wrong:
 *
 * 1. The indicator uses `keepMounted`. Base UI unmounts it when unchecked, and an element that
 *    was never in the DOM cannot transition — the tick would still pop.
 * 2. `--check-len` is measured from the real path with `getTotalLength()` rather than hard-coded.
 *    A guessed dash length either over-draws (a visible tail) or under-draws (a clipped tick),
 *    and it drifts the moment the icon or the box size changes.
 *
 * Transitioning the offset (rather than animating it) means an uncheck mid-draw reverses cleanly
 * from wherever it had got to, instead of jumping to the end and restarting.
 */
const BOX_MS = 150
const DRAW_MS = 350
const UNCHECK_MS = 150
const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)'

export function CheckboxCheck({ className, indeterminate, ...props }: CheckboxPrimitive.Root.Props) {
  const pathRef = useRef<SVGPathElement>(null)
  const [length, setLength] = useState(15)

  useLayoutEffect(() => {
    const path = pathRef.current
    if (path) {
      setLength(Math.ceil(path.getTotalLength()))
    }
  }, [])

  // A partial selection draws a dash, not a tick. Rendering a full tick for "some of these are
  // selected" is what the plain checkbox does, and it reads as "all of them".
  /*
    Lucide's own `Check` and `Minus`, rescaled from their 24-unit viewBox into this one
    (×0.4236), and drawn bottom-left to top-right so the stroke draws the way a tick is
    written.

    The first version was a hand-drawn tick spanning 1 → 9.17 on both axes with a stroke of
    1.75. Against the stock `Checkbox` — which is the same 16px box with the same 14px
    indicator — that painted a mark 11px tall with a 2.4px stroke where lucide paints 6.4px
    with 1.2px. Nearly twice the height and twice the weight, which is why the animated
    checkboxes read as heavier than every unanimated one beside them. Geometry is the fix,
    not size: the indicator box was never wrong.
  */
  const mark = indeterminate ? 'M2.12 5.08H8.47' : 'M1.69 5.08L3.81 7.2L8.47 2.54'

  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        'peer relative flex size-4 shrink-0 items-center justify-center rounded-[4px] border border-input outline-none group-has-disabled/field:opacity-50 after:absolute after:-inset-x-3 after:-inset-y-2 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 aria-invalid:aria-checked:border-primary dark:bg-input/30 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 data-checked:border-primary data-checked:bg-primary data-checked:text-primary-foreground dark:data-checked:bg-primary',
        'motion-reduce:transition-none',
        className
      )}
      style={{ transition: `background-color ${BOX_MS}ms ${EASE}, border-color ${BOX_MS}ms ${EASE}` }}
      indeterminate={indeterminate}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        keepMounted
        data-slot="checkbox-indicator"
        className={cn(
          'grid size-3.5 place-content-center text-current',
          // Offset the full dash length at rest, none when checked. Driving it from the
          // indicator's own data-checked keeps the two durations asymmetric: the draw is slower
          // and deliberate, the erase is quick.
          // The transition lives in a class, not inline: an inline `transition` beats any
          // stylesheet rule, so the slower draw duration below could never take effect.
          '[&_path]:[transition:stroke-dashoffset_var(--check-uncheck)_var(--check-ease)]',
          '[&_path]:[stroke-dashoffset:var(--check-len)]',
          'data-checked:[&_path]:[stroke-dashoffset:0]',
          'data-checked:[&_path]:[transition-duration:var(--check-draw)]',
          'motion-reduce:[&_path]:transition-none'
        )}
        style={
          {
            '--check-len': length,
            '--check-draw': `${DRAW_MS}ms`,
            '--check-uncheck': `${UNCHECK_MS}ms`,
            '--check-ease': EASE,
          } as React.CSSProperties
        }
      >
        <svg viewBox="0 0 10.1668 10.1668" fill="none" aria-hidden className="size-full overflow-visible">
          <path
            ref={pathRef}
            d={mark}
            stroke="currentColor"
            // 2 in lucide's 24-unit box, rescaled: the same painted weight as every static tick.
            strokeWidth={0.9}
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ strokeDasharray: length }}
          />
        </svg>
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

export default CheckboxCheck
