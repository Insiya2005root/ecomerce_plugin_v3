export const countryOptions = [
  { value: 'US', label: 'United States' },
  { value: 'CA', label: 'Canada' },
  { value: 'UK', label: 'United Kingdom' },
  { value: 'AU', label: 'Australia' },
] as const

export const countryLabels: Record<string, string> = Object.fromEntries(
  countryOptions.map(country => [country.value, country.label]),
)

export interface CheckoutForm1Data {
  email: string
  firstName: string
  lastName: string
  phone: string
  address: string
  city: string
  state: string
  zipCode: string
  country: string
  cardNumber: string
  expiryDate: string
  cvv: string
  cardName: string
  saveInfo: boolean
  sameAsBilling: boolean
  newsletter: boolean
  promoCode: string
}

export const initialCheckoutForm1Data: CheckoutForm1Data = {
  email: '',
  firstName: '',
  lastName: '',
  phone: '',
  address: '',
  city: '',
  state: '',
  zipCode: '',
  country: 'US',
  cardNumber: '',
  expiryDate: '',
  cvv: '',
  cardName: '',
  saveInfo: false,
  sameAsBilling: true,
  newsletter: false,
  promoCode: '',
}

export interface OrderSummaryItem {
  id: number
  name: string
  variant: string
  price: number
  quantity: number
  image: string
}

export interface OrderSummary {
  items: OrderSummaryItem[]
  shipping: number
  tax: number
  discount: number
  promoDiscount: number
}

export const orderSummary: OrderSummary = {
  items: [
    {
      id: 1,
      name: 'Premium Wireless Headphones',
      variant: 'Midnight Black',
      price: 299.99,
      quantity: 1,
      image: 'https://assets.shadcnstore.com/shadcnstore.com/stock/e-commerce/premium-wireless-headphones.600w.7d1414.avif',
    },
    {
      id: 2,
      name: 'Leather Laptop Sleeve',
      variant: 'Brown, 13-inch',
      price: 89.99,
      quantity: 1,
      image: 'https://assets.shadcnstore.com/shadcnstore.com/stock/e-commerce/leather-laptop-sleeve.800w.86ef12.avif',
    },
  ],
  shipping: 15.99,
  tax: 27.54,
  discount: 0,
  promoDiscount: 0,
}