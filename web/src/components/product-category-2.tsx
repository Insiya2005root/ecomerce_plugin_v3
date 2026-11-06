import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ArrowRight, ShoppingBag } from 'lucide-react'
import { categories } from "@/components/data/product-category-2-data"

export function ProductCategory2() {
  return (
    <section className='py-12'>
      <div className='mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8'>
        {/* Header */}
        <div className='mb-12 text-center'>
          <h2 className='text-3xl font-bold tracking-tight text-balance'>Shop by Category</h2>
          <p className='text-muted-foreground mt-4 text-lg'>Discover products across our most popular categories</p>
        </div>

        {/* Categories Grid */}
        <div className='grid gap-6 sm:grid-cols-2 lg:grid-cols-3'>
          {categories.map(category => (
            <Card
              key={category.id}
              className='group cursor-pointer overflow-hidden py-0 transition-all duration-500 hover:shadow-lg'
            >
              <div className='relative aspect-[5/4] overflow-hidden'>
                <img
                  src={category.image}
                  alt={category.name}
                  className='size-full object-cover transition-transform duration-500 group-hover:scale-105'
                />
                <div className='absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent' />

                {/* Trending Badge */}
                {category.trending ? <Badge className="px-2.5 py-0.5 font-semibold absolute rounded-sm top-4 left-4">Trending</Badge> : null}

                {/* Category Info Overlay */}
                <div className='absolute right-0 bottom-0 left-0 p-6 text-white'>
                  <h3 className='mb-1 text-xl font-bold'>{category.name}</h3>
                  <p className='mb-3 text-sm text-white/90'>{category.description}</p>
                  <div className='flex items-center justify-between'>
                    <span className='text-sm'>{category.itemCount.toLocaleString()} items</span>
                    <Button
                      size='sm'
                      variant='secondary'
                      className="h-8 px-3 text-xs cursor-pointer border-white/30 bg-white/20 text-white backdrop-blur-sm hover:bg-white/30"
                    >
                      Browse
                      <ArrowRight />
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Call to Action */}
        <div className='mt-12 text-center'>
          <Button size='lg' className="h-10 px-4 cursor-pointer gap-2">
            <ShoppingBag className='size-5' />
            View All Categories
          </Button>
        </div>
      </div>
    </section>
  )
}


export default ProductCategory2
