'use client'

import { useMemo, useState } from 'react'
import { Star, ThumbsUp, MessageCircle, Calendar } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ReviewRating1ReactionToggle } from './review-rating-1-reaction-toggle'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'
import { type Review, reviews, storeData } from "@/components/data/review-rating-1-data"
import { ReviewRating1ReviewForm } from './review-rating-1-review-form'

export function ReviewRating1() {
  const [currentPage, setCurrentPage] = useState(1)
  const [isLiked, setIsLiked] = useState<Record<number, boolean>>({})
  const reviewsPerPage = 2 // Show only 2 reviews per page

  // Calculate pagination
  const totalPages = Math.ceil(reviews.length / reviewsPerPage)
  const currentReviews = useMemo<Review[]>(() => {
    const startIndex = (currentPage - 1) * reviewsPerPage
    const endIndex = startIndex + reviewsPerPage
    return reviews.slice(startIndex, endIndex)
  }, [currentPage, reviewsPerPage])

  return (
    <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-12 text-center">
        <h1 className="text-3xl font-bold">{storeData.pageTitle}</h1>
        <p className="text-muted-foreground mx-auto mt-2 max-w-2xl">{storeData.pageDescription}</p>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          {currentReviews.map(review => (
            <Card key={review.id} className="transition-all hover:shadow-md">
              <CardContent>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <Avatar className="bg-muted size-12">
                      <AvatarImage src={review.userAvatar} alt={`${review.userName}'s avatar`} />
                      <AvatarFallback>{review.userName.substring(0, 2)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <h3 className="font-medium">{review.userName}</h3>
                      <div className="text-muted-foreground mt-1 flex items-center gap-2 text-sm">
                        <div className="flex" aria-label={`Rated ${review.rating} out of 5`}>
                          {Array(5)
                            .fill(0)
                            .map((_, i) => (
                              <Star
                                key={i}
                                className={cn(
                                  'size-4',
                                  i < review.rating
                                    ? 'fill-foreground text-foreground'
                                    : 'text-foreground fill-transparent'
                                )}
                              />
                            ))}
                        </div>
                        <span>•</span>
                        <time
                          dateTime={new Date(review.date).toISOString().split('T')[0]}
                          className="flex items-center"
                        >
                          <Calendar className="me-1 size-3" />
                          {review.date}
                        </time>
                      </div>
                    </div>
                  </div>
                </div>
                <p className="text-muted-foreground mt-4">{review.content}</p>
                <div className="mt-4 flex gap-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsLiked(prev => ({ ...prev, [review.id]: !prev[review.id] }))}
                    className="h-8 px-3 text-xs text-muted-foreground hover:bg-primary/10 hover:text-primary cursor-pointer"
                    aria-label={`${isLiked[review.id] ? 'Unlike' : 'Like'} this review`}
                  >
                    <ReviewRating1ReactionToggle active={!!isLiked[review.id]} icon={ThumbsUp} iconClassName='size-4' activeColorClassName='text-primary' />
                    <span>{(review.likes ?? 0) + (isLiked[review.id] ? 1 : 0)}</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-3 text-xs text-muted-foreground hover:bg-primary/10 hover:text-primary cursor-pointer"
                    aria-label="View comments"
                  >
                    <MessageCircle className="size-4" />
                    <span>{review.comments}</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {totalPages > 1 ? (
            <Pagination className="mt-6">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                  />
                </PaginationItem>
                {Array.from({ length: totalPages }).map((_, i) => (
                  <PaginationItem key={i}>
                    <PaginationLink
                      onClick={() => setCurrentPage(i + 1)}
                      isActive={currentPage === i + 1}
                      className="cursor-pointer"
                    >
                      {i + 1}
                    </PaginationLink>
                  </PaginationItem>
                ))}
                <PaginationItem>
                  <PaginationNext
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          ) : null}
        </div>

        <ReviewRating1ReviewForm storeData={storeData} />
      </div>
    </div>
  )
}

export default ReviewRating1
