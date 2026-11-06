'use client'

import { FormEvent, useState } from 'react'
import { Send } from 'lucide-react'
import { Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

import { type StoreData } from "@/components/data/review-rating-1-data"

interface FormState {
  name: string
  email: string
  review: string
}

export function ReviewRating1ReviewForm({ storeData }: { storeData: StoreData }) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [rating, setRating] = useState<number>(0)
  const [hoveredStar, setHoveredStar] = useState<number>(0)
  const [formData, setFormData] = useState<FormState>({
    name: '',
    email: '',
    review: '',
  })

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsSubmitting(true)
    // Simulate form submission
    setTimeout(() => {
      setRating(0)
      setFormData({ name: '', email: '', review: '' })
      setIsSubmitting(false)
    }, 1000)
  }

  return (
    <div className="lg:sticky lg:top-8 lg:h-fit">
      <Card>
        <CardHeader>
          <CardTitle id="review-form-heading">{storeData.formTitle}</CardTitle>
          <CardDescription>{storeData.formDescription}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <div className="flex gap-1" role="radiogroup" aria-label="Rating">
                {[1, 2, 3, 4, 5].map(star => (
                  <Button
                    variant="ghost"
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHoveredStar(star)}
                    onMouseLeave={() => setHoveredStar(0)}
                    className="h-9 px-4 py-2 focus-visible:ring-ring cursor-pointer rounded-full !p-1 hover:bg-transparent focus:outline-hidden focus-visible:ring-2"
                    aria-pressed={rating === star}
                    aria-label={`Rate ${star} ${star === 1 ? 'star' : 'stars'}`}
                  >
                    <Star className={cn('size-6', (hoveredStar || rating) >= star ? 'fill-foreground' : '')} />
                  </Button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="name">{storeData.nameLabel}</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                placeholder={storeData.namePlaceholder}
                required
                aria-required="true"
                className="h-9"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="email">{storeData.emailLabel}</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={e => setFormData({ ...formData, email: e.target.value })}
                placeholder={storeData.emailPlaceholder}
                required
                aria-required="true"
                className="h-9"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="review">{storeData.reviewLabel}</Label>
              <Textarea
                id="review"
                value={formData.review}
                onChange={e => setFormData({ ...formData, review: e.target.value })}
                placeholder={storeData.reviewPlaceholder}
                required
                aria-required="true"
              />
            </div>

            <Button type="submit" className="h-9 px-4 py-2 w-full cursor-pointer" disabled={isSubmitting}>
              {isSubmitting ? storeData.submittingButtonText : storeData.submitButtonText}
              {!isSubmitting && <Send className="size-4" />}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

export default ReviewRating1ReviewForm
