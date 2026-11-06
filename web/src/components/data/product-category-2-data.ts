export interface Category {
  id: number
  name: string
  description: string
  itemCount: number
  image: string
  trending: boolean
}

export const categories: Category[] = [
  {
    id: 1,
    name: 'Electronics',
    description: 'Laptops, phones, and gadgets',
    itemCount: 1248,
    image: 'https://assets.shadcnstore.com/shadcnstore.com/stock/e-commerce/electronics.500w.a09f97.avif',
    trending: true,
  },
  {
    id: 2,
    name: 'Fashion',
    description: 'Clothing, shoes, and accessories',
    itemCount: 2156,
    image: 'https://assets.shadcnstore.com/shadcnstore.com/stock/e-commerce/fashion-store-interior.500w.0f92c5.avif',
    trending: false,
  },
  {
    id: 3,
    name: 'Home & Garden',
    description: 'Furniture, decor, and tools',
    itemCount: 892,
    image: 'https://assets.shadcnstore.com/shadcnstore.com/stock/e-commerce/home-garden.500w.c2cb32.avif',
    trending: false,
  },
  {
    id: 4,
    name: 'Sports & Outdoors',
    description: 'Fitness, camping, and recreation',
    itemCount: 674,
    image: 'https://assets.shadcnstore.com/shadcnstore.com/stock/e-commerce/sports-outdoors.500w.346909.avif',
    trending: true,
  },
  {
    id: 5,
    name: 'Books & Media',
    description: 'Books, music, and entertainment',
    itemCount: 1567,
    image: 'https://assets.shadcnstore.com/shadcnstore.com/stock/e-commerce/books-media.500w.492201.avif',
    trending: false,
  },
  {
    id: 6,
    name: 'Health & Beauty',
    description: 'Skincare, cosmetics, and wellness',
    itemCount: 743,
    image: 'https://assets.shadcnstore.com/shadcnstore.com/stock/e-commerce/health-beauty.500w.e876e5.avif',
    trending: true,
  },
]