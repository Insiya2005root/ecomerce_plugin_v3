export interface OrderItem {
  name: string
  image: string
  color: string
  size: string
  quantity: number
  price: number
  orderDate: string
}

export const orders: OrderItem[] = [
  {
    name: 'Mist Black Triblend',
    image: 'https://assets.shadcnstore.com/shadcnstore.com/stock/e-commerce/mist-black-triblend.800w.7829cf.avif',
    color: 'White',
    size: 'Medium',
    quantity: 1,
    price: 120,
    orderDate: 'March 18, 2025',
  },
  {
    name: 'Trendy Black T-shirt',
    image: 'https://assets.shadcnstore.com/shadcnstore.com/stock/e-commerce/trendy-black-t-shirt.800w.f0e01d.avif',
    color: 'Black',
    size: 'Medium',
    quantity: 1,
    price: 90,
    orderDate: 'March 13, 2025',
  },
]