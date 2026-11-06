import { Star } from 'lucide-react'
import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { type Product, products } from "@/components/data/product-card-2-data"

export function ProductCard2() {
  return (
    <section className='py-12'>
      <div className='mx-auto w-full max-w-7xl flex flex-col gap-8 px-4 sm:px-6 lg:px-8'>
      <header className='flex flex-col gap-2'>
        <h2 className='text-3xl font-bold text-balance sm:text-4xl'>Popular Products</h2>
        <p className='text-muted-foreground max-w-[60ch] text-balance'>
          This beloved product has become a favorite among our customers for its exceptional features and unparalleled
          performance
        </p>
      </header>

      <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3'>
        {products.map(product => (
          <Card key={product.id} className='group overflow-hidden transition-all hover:shadow-lg'>
            <CardContent className='flex flex-col gap-4'>
              <div className='overflow-hidden rounded-md'>
                <img
                  src={product.image}
                  alt={product.title}
                  width={400}
                  height={400}
                  className='aspect-square w-full object-cover transition-transform duration-300 group-hover:scale-105'
                />
              </div>

              <div className='flex flex-col gap-2'>
                <CardTitle className='line-clamp-1 text-lg font-semibold text-balance sm:text-xl'>
                  {product.title}
                </CardTitle>

                <div className='flex items-center gap-0.5' aria-label={`${product.rating} out of 5 stars`} role='img'>
                  {Array.from({ length: product.rating }).map((_, i) => (
                    <Star key={i} className='fill-foreground text-foreground size-4 sm:size-5' />
                  ))}
                </div>

                <p className='text-lg font-semibold sm:text-xl'>${product.price.toFixed(2)}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
    </section>
  )
}

export default ProductCard2
