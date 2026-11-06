export interface Category {
  id: string
  name: string
  count: number
}

export interface PriceRange {
  id: string
  label: string
  min: number
  max: number | null
}

export interface SortOption {
  id: string
  label: string
}

export const categories: Category[] = [
  { id: 'all', name: 'All Products', count: 1247 },
  { id: 'electronics', name: 'Electronics', count: 324 },
  { id: 'clothing', name: 'Clothing', count: 189 },
  { id: 'home', name: 'Home & Garden', count: 156 },
  { id: 'books', name: 'Books', count: 97 },
  { id: 'sports', name: 'Sports', count: 134 },
  { id: 'toys', name: 'Toys', count: 78 },
  { id: 'health', name: 'Health & Beauty', count: 112 },
]

export const priceRanges: PriceRange[] = [
  { id: 'all', label: 'All Prices', min: 0, max: null },
  { id: 'under-25', label: 'Under $25', min: 0, max: 25 },
  { id: '25-50', label: '$25 - $50', min: 25, max: 50 },
  { id: '50-100', label: '$50 - $100', min: 50, max: 100 },
  { id: 'over-100', label: 'Over $100', min: 100, max: null },
]

export const sortOptions: SortOption[] = [
  { id: 'featured', label: 'Featured' },
  { id: 'newest', label: 'Newest' },
  { id: 'price-low', label: 'Price: Low to High' },
  { id: 'price-high', label: 'Price: High to Low' },
  { id: 'rating', label: 'Customer Rating' },
]