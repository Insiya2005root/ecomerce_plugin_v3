'use client'

import { useEffect, useRef, useState, type ComponentType } from 'react'

import { cn } from '@/lib/utils'

const PARTICLE_COUNT = 8

/**
 * The pop/burst keyframes travel with the component instead of living in the
 * app's stylesheet, so this file is self-contained: drop it in and the
 * animation works with no Tailwind config or global CSS to copy over.
 * Injected once per page, guarded by the marker attribute.
 */
const STYLE_MARKER = 'data-reaction-toggle-keyframes'
const STYLES = `
@keyframes reaction-toggle-pop {
  0% { transform: scale(1); }
  30% { transform: scale(0.82); }
  100% { transform: scale(1); }
}
@keyframes reaction-toggle-burst {
  0% { opacity: 0; transform: translate(0, 0) scale(0.4); }
  20% { opacity: 1; transform: translate(calc(var(--rx) * 0.25), calc(var(--ry) * 0.25)) scale(1); }
  100% { opacity: 0; transform: translate(var(--rx), var(--ry)) scale(0.6); }
}
.reaction-toggle-pop {
  animation: reaction-toggle-pop 350ms cubic-bezier(0.34, 1.96, 0.64, 1);
}
.reaction-toggle-burst {
  animation-name: reaction-toggle-burst;
  animation-timing-function: ease-out;
  animation-fill-mode: forwards;
}
@media (prefers-reduced-motion: reduce) {
  .reaction-toggle-pop,
  .reaction-toggle-burst { animation: none !important; }
}
`

function useReactionToggleStyles() {
  useEffect(() => {
    if (document.head.querySelector(`[${STYLE_MARKER}]`)) return

    const style = document.createElement('style')
    style.setAttribute(STYLE_MARKER, '')
    style.textContent = STYLES
    document.head.append(style)
  }, [])
}

type ReactionIconProps = {
  className?: string
}

type Particle = {
  rx: number
  ry: number
  duration: number
  delay: number
  size: number
}

function buildParticles(): Particle[] {
  return Array.from({ length: PARTICLE_COUNT }, (_, i) => {
    const angle = (Math.PI * 2 * i) / PARTICLE_COUNT + (Math.random() - 0.5) * 0.4
    const dist = 16 + Math.random() * 10

    return {
      rx: Math.round(Math.cos(angle) * dist * 10) / 10,
      ry: Math.round(Math.sin(angle) * dist * 10) / 10,
      duration: Math.round(500 + Math.random() * 200),
      delay: Math.round(Math.random() * 60),
      size: Math.round((0.7 + Math.random() * 0.8) * 100) / 100,
    }
  })
}

type ReactionToggleProps = {
  /** Whether the reaction is currently active (liked/helpful/etc). */
  active: boolean
  /** Icon component to render, e.g. `Heart` or `ThumbsUp` from lucide-react. */
  icon: ComponentType<ReactionIconProps>
  /** Wrapper class - sizing/positioning of the whole control. */
  className?: string
  /** Class applied to the icon itself (e.g. `size-5`). */
  iconClassName?: string
  /**
   * Tailwind color class (e.g. `text-primary`, `text-destructive`) applied to the
   * icon and particles while active. Drives `fill-current`/`bg-current`, so it
   * stays in sync with the design system instead of a hardcoded brand color.
   */
  activeColorClassName?: string
}

/**
 * Heart/thumbs-up style reaction control: the icon pops with an overshoot scale
 * and sprinkles 8 particles outward the moment it becomes active.
 */
export function ReviewRating1ReactionToggle({
  active,
  icon: Icon,
  className,
  iconClassName,
  activeColorClassName = 'text-primary',
}: ReactionToggleProps) {
  const [isBursting, setIsBursting] = useState(false)
  const wasActive = useRef(active)
  const particlesRef = useRef<Particle[]>(buildParticles())

  useReactionToggleStyles()

  useEffect(() => {
    if (active && !wasActive.current) {
      particlesRef.current = buildParticles()
      setIsBursting(true)
      const timeout = setTimeout(() => setIsBursting(false), 700)
      wasActive.current = active
      return () => clearTimeout(timeout)
    }

    wasActive.current = active
  }, [active])

  return (
    <span className={cn('relative inline-flex', className)}>
      <span className={cn('inline-flex', active && 'reaction-toggle-pop')}>
        <Icon
          className={cn(
            'transition-[fill,stroke,color] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)]',
            active ? cn('fill-current', activeColorClassName) : 'fill-transparent',
            iconClassName
          )}
        />
      </span>

      {isBursting && (
        <span
          aria-hidden='true'
          className={cn('pointer-events-none absolute top-1/2 left-1/2 size-0', activeColorClassName)}
        >
          {particlesRef.current.map((particle, index) => (
            <i
              key={index}
              className='reaction-toggle-burst absolute rounded-full bg-current opacity-0'
              style={
                {
                  '--rx': `${particle.rx}px`,
                  '--ry': `${particle.ry}px`,
                  animationDuration: `${particle.duration}ms`,
                  animationDelay: `${particle.delay}ms`,
                  width: `${2.5 * particle.size}px`,
                  height: `${2.5 * particle.size}px`,
                  left: `${-1.25 * particle.size}px`,
                  top: `${-1.25 * particle.size}px`,
                } as React.CSSProperties
              }
            />
          ))}
        </span>
      )}
    </span>
  )
}

export default ReviewRating1ReactionToggle
