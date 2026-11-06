'use client'

import { useState } from 'react'
import { ChevronDown, Search, SlidersHorizontal, X } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'

import { categories, priceRanges, sortOptions } from "@/components/data/category-filter-1-data"

export function CategoryFilter1() {
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [selectedPriceRange, setSelectedPriceRange] = useState('all')
  const [selectedSort, setSelectedSort] = useState('featured')
  const [searchQuery, setSearchQuery] = useState('')

  const activeFilters = []
  if (selectedCategory !== 'all') {
    const category = categories.find(c => c.id === selectedCategory)
    if (category) activeFilters.push({ type: 'category', label: category.name, value: selectedCategory })
  }
  if (selectedPriceRange !== 'all') {
    const priceRange = priceRanges.find(p => p.id === selectedPriceRange)
    if (priceRange) activeFilters.push({ type: 'price', label: priceRange.label, value: selectedPriceRange })
  }
  if (searchQuery) {
    activeFilters.push({ type: 'search', label: `"${searchQuery}"`, value: searchQuery })
  }

  const clearFilter = (type: string) => {
    if (type === 'category') setSelectedCategory('all')
    if (type === 'price') setSelectedPriceRange('all')
    if (type === 'search') setSearchQuery('')
  }

  const clearAllFilters = () => {
    setSelectedCategory('all')
    setSelectedPriceRange('all')
    setSearchQuery('')
  }

  return (
    <section className="py-8">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold tracking-tight text-balance">Product Catalog</h2>
          <p className="text-muted-foreground mt-2">
            Browse our collection of {categories.find(c => c.id === selectedCategory)?.count || 1247} products
          </p>
        </div>

        <div className="mb-6 flex flex-col gap-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative max-w-md flex-1">
              <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
              <Input
                placeholder="Search products..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-10 h-9"
              />
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="outline" className="h-9 px-4 py-2 w-full cursor-pointer sm:w-auto" />}>
                <SlidersHorizontal data-icon="inline-start" />
                Sort: {sortOptions.find(s => s.id === selectedSort)?.label}
                <ChevronDown data-icon="inline-end" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {sortOptions.map(option => (
                  <DropdownMenuItem
                    key={option.id}
                    onClick={() => setSelectedSort(option.id)}
                    className={selectedSort === option.id ? 'bg-accent' : ''}
                  >
                    {option.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="flex flex-wrap gap-3">
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="outline" size="sm" className="h-8 px-3 text-xs cursor-pointer" />}>
                Category: {categories.find(c => c.id === selectedCategory)?.name}
                <ChevronDown data-icon="inline-end" />
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56">
                {categories.map(category => (
                  <DropdownMenuItem
                    key={category.id}
                    onClick={() => setSelectedCategory(category.id)}
                    className={selectedCategory === category.id ? 'bg-accent' : ''}
                  >
                    <div className="flex w-full items-center justify-between">
                      <span>{category.name}</span>
                      <Badge variant="secondary" className="px-2.5 py-0.5 font-semibold text-xs">
                        {category.count}
                      </Badge>
                    </div>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="outline" size="sm" className="h-8 px-3 text-xs cursor-pointer" />}>
                Price: {priceRanges.find(p => p.id === selectedPriceRange)?.label}
                <ChevronDown data-icon="inline-end" />
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-48">
                {priceRanges.map(range => (
                  <DropdownMenuItem
                    key={range.id}
                    onClick={() => setSelectedPriceRange(range.id)}
                    className={selectedPriceRange === range.id ? 'bg-accent' : ''}
                  >
                    {range.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {activeFilters.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-muted-foreground text-sm font-medium">Active filters:</span>
              {activeFilters.map(filter => (
                <Badge key={filter.type} variant="secondary" className="px-2.5 py-0.5 font-semibold">
                  {filter.label}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-3 text-xs h-auto cursor-pointer !p-1 text-inherit"
                    onClick={() => clearFilter(filter.type)}
                  >
                    <X className="size-3" />
                  </Button>
                </Badge>
              ))}
              <DropdownMenuSeparator className="mx-2" />
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAllFilters}
                className="h-8 px-3 text-xs text-muted-foreground h-auto cursor-pointer p-1.5 text-xs"
              >
                Clear all
              </Button>
            </div>
          ) : null}
        </div>

        <div className="bg-muted/50 rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium">Showing {categories.find(c => c.id === selectedCategory)?.count || 1247} results</span>
              {searchQuery && <span className="text-muted-foreground text-sm">for "{searchQuery}"</span>}
            </div>
            <div className="text-muted-foreground text-xs">Sorted by {sortOptions.find(s => s.id === selectedSort)?.label}</div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default CategoryFilter1
