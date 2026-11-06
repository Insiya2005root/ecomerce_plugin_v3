import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowRight } from 'lucide-react'
import { features } from "@/components/data/feature-1-data"

export function Feature1() {
  return (
    <section className='mx-auto w-full max-w-7xl px-4 py-12 sm:px-6 md:py-16 lg:px-8'>
      {/* Header Section */}
      <header className='mx-auto mb-12 max-w-2xl text-center'>
        <Badge variant='secondary' className='h-auto mb-4 rounded-full px-4 py-1 font-medium'>
          Why Choose Us
        </Badge>
        <h2 className='mb-4 text-3xl font-bold tracking-tight sm:text-4xl'>Experience the Difference</h2>
        <p className='text-muted-foreground text-pretty'>
          Discover why thousands of customers trust us for their shopping needs. We combine quality, convenience, and
          exceptional service.
        </p>
      </header>

      {/* Features Grid */}
      <div className='grid gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-4'>
        {features.map(feature => (
          <article key={feature.id} className='group'>
            <Card className='relative h-full overflow-hidden transition-all hover:shadow-md'>
              <CardContent className='px-6'>
                <div className='bg-secondary text-secondary-foreground mb-4 inline-flex size-12 items-center justify-center rounded-xl'>
                  <feature.icon className='size-5' aria-hidden='true' />
                </div>
                <h3 className='mb-2 text-lg font-semibold'>{feature.title}</h3>
                <p className='text-muted-foreground mb-4 text-sm'>{feature.description}</p>

                <Button
                  variant='link'
                  size='sm'
                  className="h-8 px-3 text-xs text-muted-foreground hover:text-foreground h-auto cursor-pointer !p-0 text-sm"
                >
                  Learn more
                  <ArrowRight />
                </Button>
              </CardContent>
            </Card>
          </article>
        ))}
      </div>

      {/* Bottom CTA */}
      <div className='mt-12 text-center'>
        <Button size='lg' className='h-10 cursor-pointer rounded-lg !px-8'>
          Start Shopping
          <ArrowRight />
        </Button>
      </div>
    </section>
  )
}

export default Feature1
