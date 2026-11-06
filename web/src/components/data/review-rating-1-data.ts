export interface Review {
  id: number
  userName: string
  userAvatar: string
  date: string
  rating: number
  content: string
  likes?: number
  comments?: number
}

export interface StoreData {
  pageTitle: string
  pageDescription: string
  formTitle: string
  formDescription: string
  nameLabel: string
  emailLabel: string
  reviewLabel: string
  namePlaceholder: string
  emailPlaceholder: string
  reviewPlaceholder: string
  submitButtonText: string
  submittingButtonText: string
}

export const reviews: Review[] = [
  {
    id: 1,
    userName: 'Emma Davis',
    userAvatar: 'https://notion-avatars.netlify.app/api/avatar?preset=female-1',
    date: '20 Mar, 2024',
    rating: 5,
    content:
      "I was blown away by the quality of this product. It's clear that a lot of thought and care went into its design. The attention to detail is remarkable, and it's been an absolute pleasure to use. I've already recommended it to several friends who are equally impressed with their purchases.",
    likes: 8,
    comments: 2,
  },
  {
    id: 2,
    userName: 'Anuj Mishra',
    userAvatar: 'https://notion-avatars.netlify.app/api/avatar?preset=male-1',
    date: '16 Dec, 2023',
    rating: 5,
    content:
      "The customer service experience was exceptional from start to finish. When I had questions about my order, the team responded promptly and went above and beyond to ensure I was completely satisfied. It's rare to find such dedication to customer happiness these days.",
    likes: 10,
    comments: 5,
  },
  {
    id: 3,
    userName: 'Robert Karmazov',
    userAvatar: 'https://notion-avatars.netlify.app/api/avatar?preset=male-2',
    date: '24 Oct, 2023',
    rating: 5,
    content:
      "I was hesitant about the price at first, but after using this product for several weeks, I can confidently say it's worth every penny. The quality and durability are outstanding, and it's made a noticeable difference in my daily routine. I'm already planning to purchase more items from this store.",
    likes: 4,
    comments: 0,
  },
  {
    id: 4,
    userName: 'Sophia Chen',
    userAvatar: 'https://notion-avatars.netlify.app/api/avatar?preset=female-2',
    date: '15 May, 2024',
    rating: 4,
    content:
      "This is a fantastic product that has really improved my daily routine. The quality is excellent and it's very user-friendly. The only reason I'm not giving it 5 stars is that I wish it came in more color options. Other than that, it's been a great purchase and I would definitely recommend it to others.",
    likes: 6,
    comments: 1,
  },
]

export const storeData: StoreData = {
  pageTitle: 'Customer Reviews',
  pageDescription: 'Read what our customers have to say about their experience with our products and services.',
  formTitle: 'Submit Your Review',
  formDescription: 'Share your experience with our community',
  nameLabel: 'Name',
  emailLabel: 'Email',
  reviewLabel: 'Write Your Review',
  namePlaceholder: 'John Doe',
  emailPlaceholder: 'mail@example.com',
  reviewPlaceholder: 'Write here...',
  submitButtonText: 'Submit Review',
  submittingButtonText: 'Submitting...',
}