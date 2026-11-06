export interface CartItem {
  id: string
  name: string
  color: string
  size: string
  price: number
  originalPrice: number
  quantity: number
  image: string
  estimatedDelivery: string
}

export interface CartData {
  items: CartItem[]
  shipping: {
    freeThreshold: number
    message: string
    cost: number
  }
}

export const cartData: CartData = {
  items: [
    {
      id: '1',
      name: 'Premium Wool Cardigan',
      color: 'Sage Green',
      size: 'M',
      price: 129.99,
      originalPrice: 159.99,
      quantity: 1,
      image: 'https://assets.shadcnstore.com/shadcnstore.com/stock/e-commerce/premium-wool-sweater.800w.b234d4.avif',
      estimatedDelivery: '2-4 business days',
    },
    {
      id: '2',
      name: 'Designer Leather Bag',
      color: 'Vintage Brown',
      size: 'One Size',
      price: 299.99,
      originalPrice: 349.99,
      quantity: 1,
      image: 'https://assets.shadcnstore.com/shadcnstore.com/stock/e-commerce/designer-leather-bag.800w.b43230.avif',
      estimatedDelivery: '3-5 business days',
    },
    {
      id: '3',
      name: 'Smart Watch Pro',
      color: 'Space Grey',
      size: 'One Size',
      price: 199.99,
      originalPrice: 249.99,
      quantity: 1,
      image: 'https://assets.shadcnstore.com/shadcnstore.com/stock/e-commerce/accessories.800w.900f12.avif',
      estimatedDelivery: '1-3 business days',
    },
  ],
  shipping: {
    freeThreshold: 500,
    message: 'Free shipping on orders over $500',
    cost: 15.99,
  },
}