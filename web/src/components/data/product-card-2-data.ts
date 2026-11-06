export interface Product {
  id: number
  title: string
  image: string
  price: number
  rating: number
}

export const products: Product[] = [
  {
    id: 1,
    title: 'Eclax Semispherical',
    image: 'https://assets.shadcnstore.com/shadcnstore.com/stock/e-commerce/eclax-semispherical.600w.fa53b6.avif',
    price: 399,
    rating: 5,
  },
  {
    id: 2,
    title: 'Eclax Cone',
    image: 'https://assets.shadcnstore.com/shadcnstore.com/stock/e-commerce/eclax-cone.600w.ffc5c7.avif',
    price: 399,
    rating: 4,
  },
  {
    id: 3,
    title: 'Eclax Cage Pack',
    image: 'https://assets.shadcnstore.com/shadcnstore.com/stock/e-commerce/eclax-cage-pack.600w.03040e.avif',
    price: 399,
    rating: 5,
  },
]