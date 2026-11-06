import { cn } from '@/lib/utils'
import { features } from "@/components/data/feature-2-data"

interface Feature2Props extends React.HTMLAttributes<HTMLElement> {
  className?: string
}

export function Feature2({ className, ...props }: Feature2Props) {
  return (
    <section className={cn('mx-auto w-full max-w-7xl px-4 py-12 sm:px-6 md:py-16 lg:px-8', className)} {...props}>
      <div>
        <div className='grid gap-12 lg:grid-cols-2 lg:gap-16'>
          <div className='flex flex-col gap-10'>
            <header className='flex flex-col gap-4'>
              <h2 className='text-3xl font-bold tracking-tight text-balance sm:text-4xl lg:text-5xl'>Why Choose Us</h2>
              <p className='text-muted-foreground text-base text-pretty md:text-lg'>
                We deliver exceptional quality and service that sets us apart. Experience the difference with our
                dedicated approach.
              </p>
            </header>

            <div className='grid gap-6 sm:grid-cols-2 sm:gap-8'>
              {features.map(({ icon: Icon, title, description }) => (
                <div key={title} className='group flex flex-col items-start gap-3 rounded-lg'>
                  <div className='bg-secondary text-secondary-foreground inline-flex size-10 items-center justify-center rounded-full'>
                    <Icon className='size-5' aria-hidden='true' />
                  </div>
                  <div className='flex flex-col gap-1.5'>
                    <h3 className='text-foreground text-base font-semibold md:text-lg'>{title}</h3>
                    <p className='text-muted-foreground text-sm text-balance'>{description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className='relative'>
            <div className='bg-muted relative z-10 overflow-hidden rounded-lg shadow-sm transition-all duration-300 hover:shadow-md'>
              <div className='aspect-[4/3] w-full'>
                <img
                  src='https://assets.shadcnstore.com/shadcnstore.com/stock/marketing/modern-living-room-with-pendant-light-and.500w.30f855.avif'
                  alt='Modern living room with pendant light and minimalist furniture'
                  className='size-full object-cover grayscale'
                  loading='lazy'
                  decoding='async'
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default Feature2
