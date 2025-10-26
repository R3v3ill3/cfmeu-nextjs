"use client"

import {  useState, useRef, useEffect  } from 'react'
import type { ReactNode, TouchEvent } from 'react'
import { cn } from '@/lib/utils'
import { mobileTokens } from '@/styles/mobile-design-tokens'
import { SkeletonLoader } from './SkeletonLoader'
import { Button } from './button'
import { Search, Filter, Grid, List, View } from 'lucide-react'

export interface MobileGridItem<T = any> {
  id: string | number
  data: T
  title?: string
  subtitle?: string
  description?: string
  image?: string
  icon?: ReactNode
  badge?: ReactNode
  actions?: ReactNode
  aspectRatio?: 'square' | 'portrait' | 'landscape' | 'video'
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
}

export interface MobileGridProps<T = any> {
  items: MobileGridItem<T>[]
  loading?: boolean
  empty?: ReactNode
  className?: string
  columns?: {
    mobile?: number
    tablet?: number
    desktop?: number
  }
  gap?: 'sm' | 'md' | 'lg'
  searchable?: boolean
  filterable?: boolean
  filterOptions?: Array<{
    label: string
    value: string
    count?: number
  }>
  selectedFilter?: string
  onFilterChange?: (filter: string) => void
  viewMode?: 'grid' | 'list'
  onViewModeChange?: (mode: 'grid' | 'list') => void
  onItemClick?: (item: MobileGridItem<T>, index: number) => void
  onSearch?: (query: string) => void
  onRefresh?: () => void
  refreshing?: boolean
  pullToRefresh?: boolean
  infiniteScroll?: boolean
  hasMore?: boolean
  onLoadMore?: () => void
  stickyHeader?: boolean
  maxHeight?: string | number
  virtualized?: boolean
  itemHeight?: number
  overscan?: number
  selectable?: boolean
  multiselect?: boolean
  selectedItems?: Set<string | number>
  onSelectionChange?: (selected: Set<string | number>) => void
}

export function MobileGrid<T = any>({
  items,
  loading = false,
  empty,
  className,
  columns = { mobile: 2, tablet: 3, desktop: 4 },
  gap = 'md',
  searchable = false,
  filterable = false,
  filterOptions = [],
  selectedFilter,
  onFilterChange,
  viewMode = 'grid',
  onViewModeChange,
  onItemClick,
  onSearch,
  onRefresh,
  refreshing = false,
  pullToRefresh = false,
  infiniteScroll = false,
  hasMore = false,
  onLoadMore,
  stickyHeader = false,
  maxHeight,
  selectable = false,
  multiselect = false,
  selectedItems = new Set(),
  onSelectionChange,
}: MobileGridProps<T>) {
  const [searchQuery, setSearchQuery] = useState('')
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [touchStartY, setTouchStartY] = useState(0)
  const [pullDistance, setPullDistance] = useState(0)
  const [isPulling, setIsPulling] = useState(false)
  const gridRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  // Gap classes
  const gapClasses = {
    sm: 'gap-2',
    md: 'gap-4',
    lg: 'gap-6',
  }

  // Column classes for responsive grid
  const gridColumns = cn(
    'grid',
    `grid-cols-${columns.mobile || 2}`,
    `sm:grid-cols-${columns.tablet || 3}`,
    `lg:grid-cols-${columns.desktop || 4}`,
    gapClasses[gap]
  )

  // Handle search
  const handleSearch = (query: string) => {
    setSearchQuery(query)
    onSearch?.(query)
  }

  // Handle item selection
  const handleItemSelection = (itemId: string | number) => {
    const newSelected = new Set(selectedItems)

    if (multiselect) {
      if (newSelected.has(itemId)) {
        newSelected.delete(itemId)
      } else {
        newSelected.add(itemId)
      }
    } else {
      if (newSelected.has(itemId)) {
        newSelected.clear()
      } else {
        newSelected.clear()
        newSelected.add(itemId)
      }
    }

    onSelectionChange?.(newSelected)
  }

  // Pull to refresh handlers
  const handleTouchStart = (e: TouchEvent) => {
    if (!pullToRefresh) return
    setTouchStartY(e.targetTouches[0].clientY)
    setIsPulling(true)
  }

  const handleTouchMove = (e: TouchEvent) => {
    if (!pullToRefresh || !isPulling) return

    const currentY = e.targetTouches[0].clientY
    const distance = currentY - touchStartY

    // Only allow pulling down when at the top
    if (scrollContainerRef.current?.scrollTop === 0 && distance > 0) {
      setPullDistance(Math.min(distance, 120))
    }
  }

  const handleTouchEnd = () => {
    if (!pullToRefresh || !isPulling) return

    if (pullDistance > 80) {
      // Trigger refresh
      setIsRefreshing(true)
      onRefresh?.()
      setTimeout(() => {
        setIsRefreshing(false)
        setPullDistance(0)
      }, 1000)
    } else {
      setPullDistance(0)
    }

    setIsPulling(false)
  }

  // Aspect ratio classes
  const getAspectRatioClass = (aspectRatio?: MobileGridItem['aspectRatio']) => {
    const ratios = {
      square: 'aspect-square',
      portrait: 'aspect-[3/4]',
      landscape: 'aspect-[4/3]',
      video: 'aspect-[16/9]',
    }
    return ratios[aspectRatio || 'square']
  }

  // Size classes
  const getSizeClass = (size?: MobileGridItem['size']) => {
    const sizes = {
      sm: 'text-xs',
      md: 'text-sm',
      lg: 'text-base',
    }
    return sizes[size || 'md']
  }

  // Render grid item
  const renderItem = (item: MobileGridItem<T>, index: number) => {
    const isSelected = selectedItems.has(item.id)
    const aspectRatioClass = getAspectRatioClass(item.aspectRatio)

    const itemContent = (
      <div
        className={cn(
          'relative bg-white rounded-lg border border-gray-200 overflow-hidden transition-all duration-200',
          'hover:shadow-md hover:border-gray-300 active:scale-95',
          item.disabled && 'opacity-50 pointer-events-none',
          selectable && 'cursor-pointer',
          isSelected && 'ring-2 ring-blue-500 ring-offset-2',
          item.size === 'lg' && 'col-span-2 row-span-2'
        )}
        onClick={() => {
          if (selectable) {
            handleItemSelection(item.id)
          } else {
            onItemClick?.(item, index)
          }
        }}
      >
        {/* Selection indicator */}
        {selectable && (
          <div className="absolute top-2 right-2 z-10">
            <div className={cn(
              'w-5 h-5 rounded-full border-2 transition-colors',
              isSelected ? 'bg-blue-500 border-blue-500' : 'bg-white border-gray-300'
            )}>
              {isSelected && (
                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              )}
            </div>
          </div>
        )}

        {/* Image or icon */}
        <div className={cn('relative overflow-hidden bg-gray-100', aspectRatioClass)}>
          {item.image ? (
            <img
              src={item.image}
              alt={item.title || ''}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : item.icon ? (
            <div className="flex items-center justify-center w-full h-full text-gray-400">
              {item.icon}
            </div>
          ) : (
            <div className="flex items-center justify-center w-full h-full">
              <div className="w-12 h-12 bg-gray-200 rounded-lg" />
            </div>
          )}

          {/* Badge overlay */}
          {item.badge && (
            <div className="absolute top-2 left-2">
              {item.badge}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-3">
          <div className="space-y-1">
            {item.title && (
              <h3 className={cn(
                'font-semibold text-gray-900 truncate',
                getSizeClass(item.size)
              )}>
                {item.title}
              </h3>
            )}
            {item.subtitle && (
              <p className="text-sm text-gray-600 truncate">
                {item.subtitle}
              </p>
            )}
            {item.description && (
              <p className="text-xs text-gray-500 line-clamp-2">
                {item.description}
              </p>
            )}
          </div>

          {/* Actions */}
          {item.actions && (
            <div className="mt-3 flex gap-2">
              {item.actions}
            </div>
          )}
        </div>
      </div>
    )

    return (
      <div key={item.id}>
        {itemContent}
      </div>
    )
  }

  // Render list item (alternative view)
  const renderListItem = (item: MobileGridItem<T>, index: number) => {
    const isSelected = selectedItems.has(item.id)

    return (
      <div
        key={item.id}
        className={cn(
          'flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg transition-all duration-200',
          'hover:shadow-md hover:border-gray-300 active:bg-gray-50',
          item.disabled && 'opacity-50 pointer-events-none',
          selectable && 'cursor-pointer',
          isSelected && 'ring-2 ring-blue-500 ring-offset-2'
        )}
        onClick={() => {
          if (selectable) {
            handleItemSelection(item.id)
          } else {
            onItemClick?.(item, index)
          }
        }}
      >
        {/* Selection indicator */}
        {selectable && (
          <div className={cn(
            'w-5 h-5 rounded-full border-2 transition-colors',
            isSelected ? 'bg-blue-500 border-blue-500' : 'border-gray-300'
          )}>
            {isSelected && (
              <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            )}
          </div>
        )}

        {/* Thumbnail */}
        <div className="flex-shrink-0 w-12 h-12 bg-gray-100 rounded-lg overflow-hidden">
          {item.image ? (
            <img
              src={item.image}
              alt={item.title || ''}
              className="w-full h-full object-cover"
            />
          ) : item.icon ? (
            <div className="flex items-center justify-center w-full h-full text-gray-400 text-sm">
              {item.icon}
            </div>
          ) : (
            <div className="w-full h-full bg-gray-200" />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              {item.title && (
                <h4 className="font-medium text-gray-900 truncate">
                  {item.title}
                </h4>
              )}
              {item.subtitle && (
                <p className="text-sm text-gray-600 truncate">
                  {item.subtitle}
                </p>
              )}
            </div>
            {item.badge && (
              <div className="flex-shrink-0 ml-2">
                {item.badge}
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        {item.actions && (
          <div className="flex-shrink-0 ml-2">
            {item.actions}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className={cn('flex flex-col', className)} style={{ maxHeight }}>
      {/* Search and filters */}
      {(searchable || filterable || onViewModeChange) && (
        <div className={cn(
          'flex flex-col gap-3 p-4 bg-gray-50 border-b',
          stickyHeader && 'sticky top-0 z-10'
        )}>
          <div className="flex flex-col sm:flex-row gap-3">
            {searchable && (
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                />
              </div>
            )}

            <div className="flex gap-2">
              {filterable && filterOptions.length > 0 && (
                <div className="relative">
                  <select
                    className="appearance-none bg-white border border-gray-300 rounded-lg px-4 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={selectedFilter || ''}
                    onChange={(e) => onFilterChange?.(e.target.value)}
                  >
                    <option value="">All</option>
                    {filterOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label} {option.count && `(${option.count})`}
                      </option>
                    ))}
                  </select>
                  <Filter className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>
              )}

              {onViewModeChange && (
                <div className="flex border border-gray-300 rounded-lg">
                  <button
                    className={cn(
                      'px-3 py-2 text-sm transition-colors',
                      viewMode === 'grid' ? 'bg-blue-500 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
                    )}
                    onClick={() => onViewModeChange('grid')}
                  >
                    <Grid className="w-4 h-4" />
                  </button>
                  <button
                    className={cn(
                      'px-3 py-2 text-sm transition-colors border-l border-gray-300',
                      viewMode === 'list' ? 'bg-blue-500 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
                    )}
                    onClick={() => onViewModeChange('list')}
                  >
                    <List className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Pull to refresh indicator */}
      {pullToRefresh && (
        <div
          className="flex items-center justify-center bg-blue-50 text-blue-600 transition-transform duration-300"
          style={{
            height: `${Math.max(0, pullDistance)}px`,
          }}
        >
          {isRefreshing || refreshing ? (
            <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          ) : (
            <div className="w-6 h-6" />
          )}
        </div>
      )}

      {/* Grid/List content */}
      <div
        ref={scrollContainerRef}
        className={cn(
          'flex-1 overflow-y-auto',
          viewMode === 'grid' && 'p-4',
          viewMode === 'list' && 'px-4 py-2',
          loading && 'opacity-50'
        )}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {loading ? (
          viewMode === 'grid' ? (
            <div className={gridColumns}>
              {Array.from({ length: 8 }, (_, index) => (
                <div key={index} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                  <SkeletonLoader variant="rectangular" height="200px" />
                  <div className="p-3">
                    <SkeletonLoader lines={2} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {Array.from({ length: 5 }, (_, index) => (
                <div key={index} className="p-3 bg-white border border-gray-200 rounded-lg">
                  <SkeletonLoader lines={2} />
                </div>
              ))}
            </div>
          )
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            {empty || 'No items found'}
          </div>
        ) : viewMode === 'grid' ? (
          <div className={gridColumns} ref={gridRef}>
            {items.map((item, index) => renderItem(item, index))}
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((item, index) => renderListItem(item, index))}
          </div>
        )}

        {/* Infinite scroll loader */}
        {infiniteScroll && hasMore && !loading && (
          <div className="p-4 text-center">
            <div className="w-6 h-6 border-2 border-gray-300 border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        )}

        {/* End of items indicator */}
        {!infiniteScroll && items.length > 0 && (
          <div className="p-4 text-center text-gray-500 text-sm">
            {items.length} {items.length === 1 ? 'item' : 'items'} total
          </div>
        )}
      </div>

      {/* Selection footer */}
      {selectable && selectedItems.size > 0 && (
        <div className="p-4 bg-gray-50 border-t flex items-center justify-between">
          <span className="text-sm text-gray-600">
            {selectedItems.size} {selectedItems.size === 1 ? 'item' : 'items'} selected
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onSelectionChange?.(new Set())}
            >
              Clear
            </Button>
            <Button size="sm">
              Action
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

export default MobileGrid