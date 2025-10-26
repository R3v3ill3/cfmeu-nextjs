"use client"

import React, {  useState, useRef, useEffect  } from 'react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { mobileTokens } from '@/styles/mobile-design-tokens'
import { SwipeActions } from './SwipeActions'
import { SkeletonLoader } from './SkeletonLoader'
import { Button } from './button'
import { ChevronDown, ChevronUp, MoreVertical, Search, Filter } from 'lucide-react'

export interface MobileListItem<T = any> {
  id: string | number
  data: T
  title?: string
  subtitle?: string
  description?: string
  leftElement?: ReactNode
  rightElement?: ReactNode
  badge?: ReactNode
  actions?: Array<{
    icon: ReactNode
    label: string
    color?: 'primary' | 'secondary' | 'success' | 'warning' | 'error'
    onPress: () => void
  }>
  disabled?: boolean
  divider?: boolean
}

export interface MobileListProps<T = any> {
  items: MobileListItem<T>[]
  loading?: boolean
  empty?: ReactNode
  className?: string
  variant?: 'default' | 'compact' | 'detailed'
  searchable?: boolean
  filterable?: boolean
  selectable?: boolean
  multiselect?: boolean
  selectedItems?: Set<string | number>
  onSelectionChange?: (selected: Set<string | number>) => void
  onItemClick?: (item: MobileListItem<T>, index: number) => void
  onItemLongPress?: (item: MobileListItem<T>, index: number) => void
  onSearch?: (query: string) => void
  onRefresh?: () => void
  refreshing?: boolean
  pullToRefresh?: boolean
  infiniteScroll?: boolean
  hasMore?: boolean
  onLoadMore?: () => void
  stickyHeader?: boolean
  grouped?: boolean
  groupBy?: (item: MobileListItem<T>) => string
  maxHeight?: string | number
  virtualized?: boolean
  itemHeight?: number
  overscan?: number
}

export function MobileList<T = any>({
  items,
  loading = false,
  empty,
  className,
  variant = 'default',
  searchable = false,
  filterable = false,
  selectable = false,
  multiselect = false,
  selectedItems = new Set(),
  onSelectionChange,
  onItemClick,
  onItemLongPress,
  onSearch,
  onRefresh,
  refreshing = false,
  pullToRefresh = false,
  infiniteScroll = false,
  hasMore = false,
  onLoadMore,
  stickyHeader = false,
  grouped = false,
  groupBy,
  maxHeight,
  virtualized = false,
  itemHeight = 60,
  overscan = 5,
}: MobileListProps<T>) {
  const [searchQuery, setSearchQuery] = useState('')
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [touchStartY, setTouchStartY] = useState(0)
  const [touchEndY, setTouchEndY] = useState(0)
  const [pullDistance, setPullDistance] = useState(0)
  const [isPulling, setIsPulling] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

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

  // Handle long press
  const handleLongPress = (item: MobileListItem<T>, index: number) => {
    if (selectable) {
      handleItemSelection(item.id)
    }
    onItemLongPress?.(item, index)
  }

  // Pull to refresh handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    if (!pullToRefresh) return
    setTouchStartY(e.targetTouches[0].clientY)
    setIsPulling(true)
  }

  const handleTouchMove = (e: React.TouchEvent) => {
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

  // Group items if needed
  const groupedItems = React.useMemo(() => {
    if (!grouped || !groupBy) return { '': items }

    return items.reduce((groups, item) => {
      const groupKey = groupBy(item)
      if (!groups[groupKey]) {
        groups[groupKey] = []
      }
      groups[groupKey].push(item)
      return groups
    }, {} as Record<string, MobileListItem<T>[]>)
  }, [items, grouped, groupBy])

  // Infinite scroll handler
  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container || !infiniteScroll) return

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container

      if (scrollTop + clientHeight >= scrollHeight - 100 && hasMore && !loading) {
        onLoadMore?.()
      }
    }

    container.addEventListener('scroll', handleScroll)
    return () => container.removeEventListener('scroll', handleScroll)
  }, [infiniteScroll, hasMore, loading, onLoadMore])

  // Render item based on variant
  const renderItem = (item: MobileListItem<T>, index: number, groupKey?: string) => {
    const isSelected = selectedItems.has(item.id)
    const showSwipeActions = item.actions && item.actions.length > 0 && !selectable

    const itemContent = (
      <div
        className={cn(
          'relative bg-white transition-colors duration-200',
          variant === 'compact' && 'py-2 px-3 min-h-[44px]',
          variant === 'detailed' && 'py-4 px-4 min-h-[72px]',
          variant === 'default' && 'py-3 px-4 min-h-[60px]',
          item.disabled && 'opacity-50',
          item.divider && 'border-b border-gray-200',
          selectable && 'pl-12',
          showSwipeActions && 'touch-manipulation',
          !item.disabled && 'active:bg-gray-50'
        )}
      >
        {/* Selection indicator */}
        {selectable && (
          <div className="absolute left-3 top-1/2 transform -translate-y-1/2 z-10">
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
          </div>
        )}

        {/* Main content */}
        <div className="flex items-center gap-3">
          {/* Left element */}
          {item.leftElement && (
            <div className="flex-shrink-0">
              {item.leftElement}
            </div>
          )}

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                {item.title && (
                  <h4 className={cn(
                    'font-medium text-gray-900 truncate',
                    variant === 'compact' ? 'text-sm' : 'text-base'
                  )}>
                    {item.title}
                  </h4>
                )}
                {item.subtitle && (
                  <p className={cn(
                    'text-gray-600 truncate',
                    variant === 'compact' ? 'text-xs mt-0.5' : 'text-sm mt-1'
                  )}>
                    {item.subtitle}
                  </p>
                )}
                {item.description && variant !== 'compact' && (
                  <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                    {item.description}
                  </p>
                )}
              </div>

              {/* Right element */}
              <div className="flex items-center gap-2 flex-shrink-0">
                {item.badge}
                {item.rightElement}
              </div>
            </div>
          </div>
        </div>

        {/* Long press indicator for touch devices */}
        {selectable && !item.disabled && (
          <div
            className="absolute inset-0 cursor-pointer"
            onTouchStart={() => {
              const timer = setTimeout(() => handleLongPress(item, index), 500)
              const clearTimer = () => clearTimeout(timer)

              const element = listRef.current?.querySelector(`[data-item-id="${item.id}"]`)
              if (element) {
                element.addEventListener('touchend', clearTimer, { once: true })
                element.addEventListener('touchmove', clearTimer, { once: true })
              }
            }}
            data-item-id={item.id}
          />
        )}
      </div>
    )

    // Wrap with swipe actions if available
    if (showSwipeActions) {
      return (
        <SwipeActions
          key={item.id}
          leftActions={item.actions?.filter(action => ['primary', 'success'].includes(action.color || 'primary'))}
          rightActions={item.actions?.filter(action => ['secondary', 'warning', 'error'].includes(action.color || 'secondary'))}
        >
          {itemContent}
        </SwipeActions>
      )
    }

    return (
      <div
        key={item.id}
        onClick={() => !selectable && onItemClick?.(item, index)}
        onTouchEnd={() => {
          if (!selectable && !isPulling) {
            onItemClick?.(item, index)
          }
        }}
        data-item-id={item.id}
      >
        {itemContent}
      </div>
    )
  }

  return (
    <div className={cn('flex flex-col', className)} style={{ maxHeight }}>
      {/* Search and filters */}
      {(searchable || filterable) && (
        <div className={cn(
          'flex flex-col gap-2 p-3 bg-gray-50 border-b',
          stickyHeader && 'sticky top-0 z-10'
        )}>
          {searchable && (
            <div className="relative">
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
          {filterable && (
            <Button variant="outline" size="sm" className="self-start">
              <Filter className="w-4 h-4 mr-2" />
              Filter
            </Button>
          )}
        </div>
      )}

      {/* Pull to refresh indicator */}
      {pullToRefresh && (
        <div
          className="flex items-center justify-center bg-blue-50 text-blue-600 transition-transform duration-300"
          style={{
            height: `${Math.max(0, pullDistance)}px`,
            transform: `translateY(-${Math.max(0, pullDistance - 60)}px)`,
          }}
        >
          {isRefreshing || refreshing ? (
            <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          ) : (
            <ChevronDown className={cn('w-6 h-6 transition-transform', pullDistance > 80 && 'rotate-180')} />
          )}
        </div>
      )}

      {/* List content */}
      <div
        ref={scrollContainerRef}
        className={cn(
          'flex-1 overflow-y-auto',
          loading && 'opacity-50'
        )}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {loading ? (
          <div className="divide-y divide-gray-200">
            {Array.from({ length: 5 }, (_, index) => (
              <div key={index} className={cn(
                'bg-white',
                variant === 'compact' && 'py-2 px-3',
                variant === 'detailed' && 'py-4 px-4',
                variant === 'default' && 'py-3 px-4'
              )}>
                <SkeletonLoader lines={variant === 'detailed' ? 3 : 2} />
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            {empty || 'No items found'}
          </div>
        ) : grouped ? (
          <div>
            {Object.entries(groupedItems).map(([groupKey, groupItems]) => (
              <div key={groupKey}>
                {groupKey && (
                  <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
                    <h3 className="text-sm font-medium text-gray-700">{groupKey}</h3>
                  </div>
                )}
                <div className="divide-y divide-gray-200">
                  {groupItems.map((item, index) => renderItem(item, index, groupKey))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {items.map((item, index) => renderItem(item, index))}
          </div>
        )}

        {/* Infinite scroll loader */}
        {infiniteScroll && hasMore && !loading && (
          <div className="p-4 text-center">
            <div className="w-6 h-6 border-2 border-gray-300 border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        )}

        {/* End of list indicator */}
        {!infiniteScroll && items.length > 0 && (
          <div className="p-4 text-center text-gray-500 text-sm">
            End of list
          </div>
        )}
      </div>

      {/* Selection footer */}
      {selectable && selectedItems.size > 0 && (
        <div className="p-3 bg-gray-50 border-t flex items-center justify-between">
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

export default MobileList