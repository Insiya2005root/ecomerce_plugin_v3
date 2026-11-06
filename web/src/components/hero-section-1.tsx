import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { AvatarGroup } from '@/components/motion/avatar-group'
import { Star } from 'lucide-react'

interface ReviewerData {
  id: number
  avatarUrl: string
  fallback: string
}

const reviewers: ReviewerData[] = [
  { id: 1, avatarUrl: 'https://notion-avatars.netlify.app/api/avatar?preset=male-1', fallback: 'U1' },
  { id: 2, avatarUrl: 'https://notion-avatars.netlify.app/api/avatar?preset=female-1', fallback: 'U2' },
  { id: 3, avatarUrl: 'https://notion-avatars.netlify.app/api/avatar?preset=male-2', fallback: 'U3' },
  { id: 4, avatarUrl: 'https://notion-avatars.netlify.app/api/avatar?preset=female-2', fallback: 'U4' },
  { id: 5, avatarUrl: 'https://notion-avatars.netlify.app/api/avatar?preset=male-3', fallback: 'U5' },
]

export function HeroSection1() {
  return (
    <section className='w-full py-12 lg:py-20'>
      <div className='mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8'>
        <div className='grid items-center gap-8 lg:grid-cols-2 lg:gap-12'>
          <div className='flex flex-col gap-8 text-center lg:text-start'>
            <header className='flex flex-col gap-4'>
              <Badge variant='outline' className='h-auto font-semibold rounded-md text-muted-foreground px-3.5 py-1 self-center lg:self-start'>
                Premium UI Components
              </Badge>
              <h1 className='text-4xl font-bold tracking-tight text-balance md:text-5xl'>Welcome to ShadcnStore</h1>
              <p className='text-muted-foreground text-balance md:text-lg'>
                Discover our premium collection of UI components and templates to build beautiful, accessible web
                applications faster than ever.
              </p>
            </header>

            <Button size='lg' className="h-10 px-8 cursor-pointer text-base w-fit self-center lg:self-start">
              Explore Collection
            </Button>

            <div className='flex flex-col items-center gap-4 sm:flex-row sm:justify-center lg:justify-start'>
              <AvatarGroup overlap='-ml-3'>
                {reviewers.map(reviewer => (
                  <Avatar
                    key={reviewer.id}
                    className='ring-background bg-muted size-10 ring-2'
                  >
                    <AvatarImage src={reviewer.avatarUrl} alt={`User ${reviewer.id}`} />
                    <AvatarFallback className='text-xs'>{reviewer.fallback}</AvatarFallback>
                  </Avatar>
                ))}
                <div className='border-background bg-accent relative -ms-1.5 flex size-10 items-center justify-center rounded-full border-2'>
                  <span className='text-xs font-medium'>+5</span>
                </div>
              </AvatarGroup>

              <div className='flex flex-col gap-0.5'>
                <div className='flex items-center justify-center gap-1 lg:justify-start'>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className='fill-foreground size-4' />
                  ))}
                  <span className='ms-2 text-sm font-medium'>(15)</span>
                </div>
                <p className='text-muted-foreground text-sm'>Trusted by 1000+ developers</p>
              </div>
            </div>
          </div>

          <div className='aspect-[4/3] overflow-hidden rounded-xl border'>
            <img
              src='https://ui.shadcn.com/placeholder.svg'
              alt='ShadcnStore Showcase'
              className='size-full object-cover dark:brightness-[0.95] dark:invert'
              width={800}
              height={600}
            />
          </div>
        </div>
      </div>
    </section>
  )
}

export default HeroSection1
