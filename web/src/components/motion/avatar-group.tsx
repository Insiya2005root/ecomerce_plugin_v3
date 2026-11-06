'use client'

import * as React from 'react'
import { useEffect, useState } from 'react'

import { cn } from '@/lib/utils'

/**
 * @title Avatar group
 * @description Overlapping avatar stack whose neighbours lift with a distance falloff on hover.
 *
 * Adapted from Transitions.dev "Avatar group hover".
 *
 * A dock, not a switch. Lifting only the hovered item makes the row twitch — one element jumps
 * while the rest sit rigid — so the response falls off with distance: the neighbour rises about
 * half as far, the next barely at all. The falloff is what makes the row read as one soft object.
 *
 * The return is deliberately springier than the approach: a strong overshoot curve on the way back
 * reads as elastic rather than mechanical.
 */
const LIFT = -4
const FALLOFF = 0.45
const ACTIVE_SCALE = 1.05
const DURATION = 320
const EASE_IN = 'cubic-bezier(0.22, 1, 0.36, 1)'
const EASE_OUT = 'cubic-bezier(0.34, 3.85, 0.64, 1)'

export function AvatarGroup({
  children,
  className,
  overlap = '-ml-2',
}: {
  children: React.ReactNode
  className?: string
  /** Negative margin applied to every item but the first. Set to `''` for a non-overlapping row. */
  overlap?: string
}) {
  const items = React.Children.toArray(children)
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const [reducedMotion, setReducedMotion] = useState(false)

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const sync = () => setReducedMotion(query.matches)

    sync()
    query.addEventListener('change', sync)
    return () => query.removeEventListener('change', sync)
  }, [])

  const itemStyle = (index: number): React.CSSProperties | undefined => {
    if (reducedMotion) {
      return undefined
    }

    const isActive = index === activeIndex
    const shift = activeIndex === null ? 0 : LIFT * FALLOFF ** Math.abs(index - activeIndex)

    return {
      // translateY before scale, so scaling never amplifies the lift distance.
      transform: `translateY(${shift.toFixed(3)}px) scale(${isActive ? ACTIVE_SCALE : 1})`,
      transition: `transform ${DURATION}ms ${activeIndex === null ? EASE_OUT : EASE_IN}`,
      willChange: 'transform',
      // A lifted item has to sit above the neighbour overlapping it, or the lift happens underneath.
      zIndex: isActive ? 1 : undefined,
    }
  }

  return (
    <div className={cn('flex', className)} onMouseLeave={() => setActiveIndex(null)}>
      {items.map((child, index) => (
        <div
          // eslint-disable-next-line react/no-array-index-key -- position is the identity here
          key={index}
          className={cn('relative', index > 0 && overlap)}
          style={itemStyle(index)}
          onMouseEnter={() => setActiveIndex(index)}
        >
          {child}
        </div>
      ))}
    </div>
  )
}

export default AvatarGroup
