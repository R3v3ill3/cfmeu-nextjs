"use client";

import React, {  useState, useRef, useCallback, useEffect  } from 'react'
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { mobileTokens } from '@/styles/mobile-design-tokens';
import {
  Filter,
  X,
  ChevronLeft,
  ChevronRight,
  Plus,
  Minus,
  RotateCcw,
  Check,
  Sparkles,
  Zap,
  Target
} from 'lucide-react';

// Quick filter interface
export interface QuickFilter {
  id: string;
  label: string;
  icon?: ReactNode;
  color?: 'primary' | 'secondary' | 'success' | 'warning' | 'error';
  active?: boolean;
  count?: number;
  value?: any;
  category?: string;
  description?: string;
}

// Filter action interface
export interface FilterAction {
  id: string;
  label: string;
  icon?: ReactNode;
  color?: 'primary' | 'secondary' | 'success' | 'warning' | 'error';
  onPress: () => void;
  disabled?: boolean;
}

// Swipe gesture options
interface SwipeGestureOptions {
  enabled?: boolean;
  threshold?: number;
  maxVelocity?: number;
  hapticFeedback?: boolean;
  preventDefault?: boolean;
}

interface MobileSwipeFiltersProps {
  // Filters
  quickFilters: QuickFilter[];
  onFilterToggle: (filterId: string, value?: any) => void;
  onFilterReset?: () => void;

  // Swipe actions
  swipeActions?: FilterAction[];
  gestureOptions?: SwipeGestureOptions;

  // Display options
  variant?: 'horizontal' | 'vertical' | 'circular';
  showLabels?: boolean;
  showBadges?: boolean;
  compact?: boolean;
  animated?: boolean;

  // Category grouping
  groupByCategory?: boolean;
  categoryColors?: Record<string, string>;

  // Selection limits
  maxSelections?: number;
  minSelections?: number;

  // Styling
  className?: string;
  containerClassName?: string;
  filterClassName?: string;

  // Analytics
  onFilterAnalytics?: (action: string, filter: QuickFilter) => void;
}

export const MobileSwipeFilters: React.FC<MobileSwipeFiltersProps> = ({
  quickFilters,
  onFilterToggle,
  onFilterReset,

  swipeActions = [],
  gestureOptions = {},

  variant = 'horizontal',
  showLabels = true,
  showBadges = true,
  compact = false,
  animated = true,

  groupByCategory = false,
  categoryColors = {},

  maxSelections,
  minSelections,

  className,
  containerClassName,
  filterClassName,

  onFilterAnalytics,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [swipePosition, setSwipePosition] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const [swipeVelocity, setSwipeVelocity] = useState(0);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  // Gesture configuration
  const {
    enabled = true,
    threshold = 50,
    maxVelocity = 2,
    hapticFeedback = true,
    preventDefault = true,
  } = gestureOptions;

  // Touch tracking
  const touchStartRef = useRef({ x: 0, y: 0, time: 0 });
  const lastTouchRef = useRef({ x: 0, y: 0, time: 0 });

  // Group filters by category
  const groupedFilters = React.useMemo(() => {
    if (!groupByCategory) return { general: quickFilters };

    const groups: Record<string, QuickFilter[]> = {};
    quickFilters.forEach(filter => {
      const category = filter.category || 'general';
      if (!groups[category]) groups[category] = [];
      groups[category].push(filter);
    });

    return groups;
  }, [quickFilters, groupByCategory]);

  // Handle touch start
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!enabled) return;

    const touch = e.touches[0];
    touchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now(),
    };
    lastTouchRef.current = touchStartRef.current;
    setIsSwiping(false);
    setSwipeVelocity(0);

    if (preventDefault) {
      e.preventDefault();
    }
  }, [enabled, preventDefault]);

  // Handle touch move
  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!enabled) return;

    const touch = e.touches[0];
    const deltaX = touch.clientX - touchStartRef.current.x;
    const deltaY = touch.clientY - touchStartRef.current.y;
    const deltaTime = Date.now() - lastTouchRef.current.time;

    // Detect swipe direction (horizontal for horizontal/circular, vertical for vertical)
    let delta = variant === 'vertical' ? deltaY : deltaX;

    // Set swipe position and velocity
    setSwipePosition(delta);
    if (deltaTime > 0) {
      setSwipeVelocity(Math.abs(deltaX / deltaTime));
    }

    lastTouchRef.current = { x: touch.clientX, y: touch.clientY, time: Date.now() };

    // Haptic feedback at threshold
    if (hapticFeedback && Math.abs(delta) === threshold) {
      if ('vibrate' in navigator) {
        navigator.vibrate(10);
      }
    }

    if (preventDefault) {
      e.preventDefault();
    }
  }, [enabled, variant, threshold, hapticFeedback, preventDefault]);

  // Handle touch end
  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!enabled) return;

    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - touchStartRef.current.x;
    const deltaY = touch.clientY - touchStartRef.current.y;
    const deltaTime = Date.now() - touchStartRef.current.time;

    // Calculate final swipe distance and velocity
    const distance = variant === 'vertical' ? deltaY : deltaX;
    const velocity = deltaTime > 0 ? Math.abs(deltaX / deltaTime) : 0;

    // Check if swipe meets criteria
    const isValidSwipe = Math.abs(distance) >= threshold && velocity <= maxVelocity;

    if (isValidSwipe) {
      const direction = distance > 0 ? 'right' : 'left';

      // Determine which filter to activate based on swipe position
      if (variant === 'horizontal') {
        handleHorizontalSwipe(direction);
      } else if (variant === 'vertical') {
        handleVerticalSwipe(direction === 'right' ? 'down' : 'up');
      } else if (variant === 'circular') {
        handleCircularSwipe(direction);
      }

      // Strong haptic feedback for action
      if (hapticFeedback) {
        if ('vibrate' in navigator) {
          navigator.vibrate(25);
        }
      }
    }

    // Reset state
    setSwipePosition(0);
    setIsSwiping(false);
    setSwipeVelocity(0);
  }, [enabled, threshold, maxVelocity, variant, hapticFeedback]);

  // Handle horizontal swipe
  const handleHorizontalSwipe = useCallback((direction: 'left' | 'right') => {
    const activeFilters = quickFilters.filter(f => f.active);
    const currentIndex = direction === 'right'
      ? activeFilters.length - 1
      : 0;

    if (direction === 'right' && activeFilters.length > 0) {
      // Swipe right - activate previous filter
      const allFilters = [...quickFilters];
      const previousIndex = allFilters.findIndex(f => f.id === activeFilters[currentIndex]?.id) - 1;
      if (previousIndex >= 0) {
        const filter = allFilters[previousIndex];
        onFilterToggle(filter.id, !filter.active);
        onFilterAnalytics?.('swipe_activate', filter);
      }
    } else if (direction === 'left') {
      // Swipe left - activate next filter or swipe action
      const allFilters = [...quickFilters];
      const nextInactiveIndex = allFilters.findIndex(f => !f.active);
      if (nextInactiveIndex >= 0) {
        const filter = allFilters[nextInactiveIndex];
        onFilterToggle(filter.id, !filter.active);
        onFilterAnalytics?.('swipe_activate', filter);
      } else if (swipeActions.length > 0) {
        // Trigger first swipe action
        swipeActions[0].onPress();
        onFilterAnalytics?.('swipe_action', quickFilters[0]);
      }
    }
  }, [quickFilters, onFilterToggle, onFilterAnalytics, swipeActions]);

  // Handle vertical swipe
  const handleVerticalSwipe = useCallback((direction: 'up' | 'down') => {
    // Vertical swipe could cycle through categories or filter values
    const categories = Object.keys(groupedFilters);
    const currentIndex = categories.indexOf(activeCategory || categories[0]);

    if (direction === 'down') {
      // Swipe down - previous category
      const prevIndex = (currentIndex - 1 + categories.length) % categories.length;
      setActiveCategory(categories[prevIndex]);
    } else {
      // Swipe up - next category
      const nextIndex = (currentIndex + 1) % categories.length;
      setActiveCategory(categories[nextIndex]);
    }
  }, [groupedFilters, activeCategory]);

  // Handle circular swipe
  const handleCircularSwipe = useCallback((direction: 'left' | 'right') => {
    // Circular swipe rotates through filters in a wheel-like pattern
    const step = direction === 'left' ? 1 : -1;
    const currentRotation = Math.floor((swipePosition / threshold)) * step;

    // Select filter based on rotation
    const index = Math.abs(currentRotation) % quickFilters.length;
    const filter = quickFilters[index];

    if (filter) {
      onFilterToggle(filter.id, !filter.active);
      onFilterAnalytics?.('circular_swipe', filter);
    }
  }, [quickFilters, onFilterToggle, onFilterAnalytics, swipePosition, threshold]);

  // Handle filter click
  const handleFilterClick = useCallback((filter: QuickFilter) => {
    // Check selection limits
    const activeCount = quickFilters.filter(f => f.active).length;
    const willBeActive = !filter.active;

    if (willBeActive && maxSelections && activeCount >= maxSelections) {
      return; // Can't select more
    }

    if (!willBeActive && minSelections && activeCount <= minSelections) {
      return; // Can't deselect below minimum
    }

    onFilterToggle(filter.id, !filter.active);
    onFilterAnalytics?.('tap', filter);

    // Haptic feedback
    if (hapticFeedback && 'vibrate' in navigator) {
      navigator.vibrate(5);
    }
  }, [quickFilters, maxSelections, minSelections, onFilterToggle, onFilterAnalytics, hapticFeedback]);

  // Render individual filter
  const renderFilter = useCallback((filter: QuickFilter, isCompact = false) => {
    const sizeClasses = isCompact ? 'w-12 h-12 min-w-[48px] min-h-[48px]' : 'w-16 h-16 min-w-[64px] min-h-[64px]';
    const baseClasses = cn(
      'relative rounded-xl flex flex-col items-center justify-center transition-all duration-200 touch-manipulation',
      'border-2',
      sizeClasses,
      filter.active
        ? cn(
            'border-blue-500 bg-blue-500 text-white shadow-lg',
            filter.color === 'success' && 'border-green-500 bg-green-500',
            filter.color === 'warning' && 'border-yellow-500 bg-yellow-500',
            filter.color === 'error' && 'border-red-500 bg-red-500'
          )
        : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400',
      filterClassName
    );

    return (
      <button
        key={filter.id}
        onClick={() => handleFilterClick(filter)}
        className={baseClasses}
        disabled={
          (maxSelections && quickFilters.filter(f => f.active).length >= maxSelections && !filter.active) ||
          (minSelections && quickFilters.filter(f => f.active).length <= minSelections && filter.active)
        }
      >
        {/* Icon */}
        <div className={cn(
          'flex items-center justify-center',
          isCompact ? 'text-lg' : 'text-2xl'
        )}>
          {filter.icon || <Filter className="w-6 h-6" />}
        </div>

        {/* Label */}
        {showLabels && !isCompact && (
          <div className="text-xs font-medium mt-1 text-center leading-tight">
            {filter.label}
          </div>
        )}

        {/* Badge */}
        {showBadges && filter.count !== undefined && (
          <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
            {filter.count > 99 ? '99+' : filter.count}
          </div>
        )}

        {/* Active indicator */}
        {filter.active && (
          <div className="absolute inset-0 rounded-xl bg-white bg-opacity-20" />
        )}
      </button>
    );
  }, [handleFilterClick, showLabels, showBadges, maxSelections, minSelections, quickFilters, filterClassName]);

  // Render filter group
  const renderFilterGroup = useCallback((category: string, filters: QuickFilter[]) => {
    const categoryColor = categoryColors[category] || 'gray';
    const isActive = activeCategory === category;

    return (
      <div key={category} className="space-y-3">
        {/* Category header */}
        <div className={cn(
          'px-4 py-2 rounded-lg flex items-center justify-between transition-colors',
          isActive ? 'bg-blue-50 border-l-4 border-blue-500' : 'bg-gray-50'
        )}>
          <h3 className="font-medium text-gray-900 capitalize">{category}</h3>
          <Badge variant="outline" className="text-xs">
            {filters.filter(f => f.active).length}/{filters.length}
          </Badge>
        </div>

        {/* Filters */}
        <div className="flex gap-3 overflow-x-auto px-4 pb-2 no-scrollbar">
          {filters.map(filter => renderFilter(filter, compact))}
        </div>
      </div>
    );
  }, [activeCategory, categoryColors, compact, renderFilter]);

  // Get container transform based on swipe position
  const getTransformStyle = () => {
    if (!isSwiping || !animated) return {};

    const transform = variant === 'vertical' ? `translateY(${swipePosition}px)` : `translateX(${swipePosition}px)`;
    const opacity = 1 - (Math.abs(swipeVelocity) * 0.2);

    return {
      transform,
      opacity: Math.max(0.5, opacity),
      transition: isSwiping ? 'none' : 'transform 0.2s ease-out',
    };
  };

  return (
    <div className={cn('w-full', className)}>
      {/* Swipe actions for horizontal layout */}
      {variant === 'horizontal' && swipeActions.length > 0 && (
        <div className="flex items-center gap-2 px-4 mb-4">
          <span className="text-sm text-gray-600">Swipe actions:</span>
          {swipeActions.map((action, index) => (
            <Button
              key={action.id}
              variant="outline"
              size="sm"
              onClick={action.onPress}
              disabled={action.disabled}
              className="min-h-[44px] min-w-[44px] touch-manipulation"
            >
              <span className="flex items-center gap-2">
                {action.icon}
                <span>{action.label}</span>
              </span>
            </Button>
          ))}
        </div>
      )}

      {/* Main filter container */}
      <div
        ref={containerRef}
        className={cn(
          'relative touch-manipulation',
          variant === 'vertical' ? 'space-y-4' : '',
          containerClassName
        )}
        style={getTransformStyle()}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Circular variant */}
        {variant === 'circular' && (
          <div className="relative mx-auto" style={{ width: '200px', height: '200px' }}>
            {quickFilters.map((filter, index) => {
              const angle = (index / quickFilters.length) * 2 * Math.PI - Math.PI / 2;
              const radius = 70;
              const x = Math.cos(angle) * radius;
              const y = Math.sin(angle) * radius;

              return (
                <div
                  key={filter.id}
                  className="absolute"
                  style={{
                    left: `calc(50% + ${x}px - 32px)`,
                    top: `calc(50% + ${y}px - 32px)`,
                  }}
                >
                  {renderFilter(filter)}
                </div>
              );
            })}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center">
                <Filter className="w-8 h-8 text-gray-600" />
              </div>
            </div>
          </div>
        )}

        {/* Horizontal variant */}
        {variant === 'horizontal' && !groupByCategory && (
          <div className="flex gap-3 overflow-x-auto px-4 pb-2 no-scrollbar">
            {quickFilters.map(filter => renderFilter(filter, compact))}
          </div>
        )}

        {/* Vertical variant */}
        {variant === 'vertical' && !groupByCategory && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 px-4">
            {quickFilters.map(filter => renderFilter(filter, compact))}
          </div>
        )}

        {/* Grouped filters */}
        {groupByCategory && (
          <div className="space-y-6">
            {Object.entries(groupedFilters).map(([category, filters]) =>
              renderFilterGroup(category, filters)
            )}
          </div>
        )}
      </div>

      {/* Swipe hint */}
      {enabled && (
        <div className="mt-4 text-center">
          <p className="text-sm text-gray-500 flex items-center justify-center gap-2">
            {variant === 'horizontal' && (
              <>
                <ChevronLeft className="w-4 h-4" />
                Swipe to navigate filters
                <ChevronRight className="w-4 h-4" />
              </>
            )}
            {variant === 'vertical' && (
              <>
                Swipe up/down to navigate categories
              </>
            )}
            {variant === 'circular' && (
              <>
                <Zap className="w-4 h-4" />
                Swipe to rotate filters
                <Zap className="w-4 h-4" />
              </>
            )}
          </p>
        </div>
      )}

      {/* Reset button */}
      {onFilterReset && quickFilters.some(f => f.active) && (
        <div className="mt-6 text-center">
          <Button
            variant="outline"
            size="sm"
            onClick={onFilterReset}
            className="min-h-[44px] min-w-[44px] touch-manipulation"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Reset Filters
          </Button>
        </div>
      )}

      {/* Selection indicator */}
      {maxSelections && (
        <div className="mt-4 text-center">
          <p className="text-xs text-gray-500">
            {quickFilters.filter(f => f.active).length} of {maxSelections} selected
          </p>
        </div>
      )}
    </div>
  );
};

export default MobileSwipeFilters;