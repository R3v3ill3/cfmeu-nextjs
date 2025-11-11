"use client";

import {  useState, useRef, useEffect, useCallback, useMemo  } from 'react'
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { MobileSearchInput, SearchSuggestion } from '@/components/search/MobileSearchInput';
import { MobileFilterPanel, FilterSection } from '@/components/ui/MobileFilterPanel';
import { MobileCard, MobileCardListItem } from '@/components/ui/MobileCard';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';
import { SwipeActions } from '@/components/ui/SwipeActions';
import { mobileTokens, device } from '@/styles/mobile-design-tokens';
import {
  Search,
  Filter,
  ChevronDown,
  ChevronUp,
  MoreVertical,
  X,
  RotateCcw,
  Check,
  ArrowUpDown,
  Grid3X3,
  List,
  Table,
  Download,
  Share2,
  Edit,
  Trash2,
  Eye
} from 'lucide-react';

// Enhanced column interface with search integration
export interface EnhancedMobileTableColumn<T = any> {
  key: keyof T
  title: string
  width?: string
  sortable?: boolean
  filterable?: boolean
  searchable?: boolean
  render?: (value: any, item: T, index: number) => ReactNode
  mobile?: {
    priority?: 'high' | 'medium' | 'low'
    hidden?: boolean
    render?: (value: any, item: T, index: number) => ReactNode
  }
  // Filter options for this column
  filterOptions?: Array<{
    value: string
    label: string
    count?: number
  }>
  // Search weights for prioritized search results
  searchWeight?: number
}

// Enhanced table props with search integration
export interface MobileTableWithSearchProps<T = any> {
  data: T[]
  columns: EnhancedMobileTableColumn<T>[]
  loading?: boolean
  empty?: ReactNode
  className?: string
  variant?: 'table' | 'cards' | 'list' | 'grid'

  // Search functionality
  searchable?: boolean
  searchPlaceholder?: string
  searchSuggestions?: SearchSuggestion[]
  enableVoiceSearch?: boolean
  searchHistory?: string[]
  onSearch?: (query: string) => void
  onSearchHistoryAdd?: (query: string) => void

  // Filtering functionality
  filterable?: boolean
  filterSections?: FilterSection[]
  onFilter?: (filters: Record<string, any>) => void
  activeFilters?: Record<string, any>

  // Sorting functionality
  sortable?: boolean
  onSort?: (column: keyof T, direction: 'asc' | 'desc') => void

  // Pagination
  pagination?: {
    page: number
    pageSize: number
    total: number
    onPageChange: (page: number) => void
  }

  // Row interactions
  onRowClick?: (item: T, index: number) => void
  onRowSelect?: (selectedRows: Set<number>) => void
  expandable?: boolean
  expandedRow?: (item: T, index: number) => ReactNode

  // Bulk actions
  bulkActions?: Array<{
    key: string
    label: string
    icon: ReactNode
    onPress: (selectedItems: T[]) => void
    color?: 'primary' | 'secondary' | 'success' | 'warning' | 'error'
    disabled?: (selectedItems: T[]) => boolean
  }>

  // Row actions
  rowActions?: Array<{
    key: string
    label: string
    icon: ReactNode
    onPress: (item: T, index: number) => void
    color?: 'primary' | 'secondary' | 'success' | 'warning' | 'error'
    disabled?: (item: T) => boolean
  }>

  // Export functionality
  exportable?: boolean
  onExport?: (format: 'csv' | 'excel' | 'pdf') => void
  shareable?: boolean
  onShare?: (items: T[]) => void

  // Mobile-specific features
  pullToRefresh?: boolean
  infiniteScroll?: boolean
  onLoadMore?: () => void
  hasMore?: boolean

  // Display options
  showViewToggle?: boolean
  defaultView?: 'table' | 'cards' | 'list' | 'grid'
  compactMode?: boolean
  stickyHeader?: boolean
  striped?: boolean
  bordered?: boolean

  // Performance
  virtualized?: boolean
  itemHeight?: number

  // Selection
  selectable?: boolean
  maxSelections?: number
}

export function MobileTableWithSearch<T extends Record<string, any>>({
  data,
  columns,
  loading = false,
  empty,
  className,
  variant = device.isMobile() ? 'cards' : 'table',

  searchable = true,
  searchPlaceholder = 'Search...',
  searchSuggestions = [],
  enableVoiceSearch = true,
  searchHistory = [],
  onSearch,
  onSearchHistoryAdd,

  filterable = true,
  filterSections = [],
  onFilter,
  activeFilters = {},

  sortable = true,
  onSort,

  pagination,
  onRowClick,
  onRowSelect,
  expandable = false,
  expandedRow,

  bulkActions = [],
  rowActions = [],

  exportable = false,
  onExport,
  shareable = false,
  onShare,

  pullToRefresh = false,
  infiniteScroll = false,
  onLoadMore,
  hasMore,

  showViewToggle = true,
  defaultView = 'cards',
  compactMode = false,
  stickyHeader = true,
  striped = true,
  bordered = false,

  virtualized = false,
  itemHeight = 60,

  selectable = false,
  maxSelections,
}: MobileTableWithSearchProps<T>) {
  const [searchQuery, setSearchQuery] = useState('');
  const [currentView, setCurrentView] = useState(defaultView);
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [sortColumn, setSortColumn] = useState<keyof T | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [showBulkActions, setShowBulkActions] = useState(false);

  const listRef = useRef<HTMLDivElement>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullStartY, setPullStartY] = useState(0);
  const [isPulling, setIsPulling] = useState(false);

  // Enhanced search with column weighting
  const filteredData = useMemo(() => {
    let filtered = [...data];

    // Apply search query with weighting
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.map(item => {
        let score = 0;
        let matches = false;

        columns.forEach(column => {
          if (column.searchable || column.searchWeight) {
            const value = item[column.key];
            if (value) {
              const valueStr = String(value).toLowerCase();
              if (valueStr.includes(query)) {
                matches = true;
                score += column.searchWeight || 1;

                // Boost exact matches
                if (valueStr === query) {
                  score += 10;
                }
                // Boost starts with matches
                if (valueStr.startsWith(query)) {
                  score += 5;
                }
              }
            }
          }
        });

        return { item, score, matches };
      })
      .filter(({ matches }) => matches)
      .sort((a, b) => b.score - a.score)
      .map(({ item }) => item);
    }

    // Apply sorting
    if (sortColumn && sortable) {
      filtered.sort((a, b) => {
        const aVal = a[sortColumn];
        const bVal = b[sortColumn];

        let comparison = 0;
        if (aVal < bVal) comparison = -1;
        if (aVal > bVal) comparison = 1;

        return sortDirection === 'desc' ? -comparison : comparison;
      });
    }

    return filtered;
  }, [data, searchQuery, columns, sortColumn, sortDirection, sortable]);

  // Handle search
  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    onSearch?.(query);

    // Add to search history
    if (query.trim() && onSearchHistoryAdd) {
      onSearchHistoryAdd(query.trim());
    }
  }, [onSearch, onSearchHistoryAdd]);

  // Handle sort
  const handleSort = useCallback((column: keyof T) => {
    const newDirection = sortColumn === column && sortDirection === 'asc' ? 'desc' : 'asc';
    setSortColumn(column);
    setSortDirection(newDirection);
    onSort?.(column, newDirection);
  }, [sortColumn, sortDirection, onSort]);

  // Handle row selection
  const handleRowSelect = useCallback((index: number, selected?: boolean) => {
    setSelectedRows(prev => {
      const newSet = new Set(prev);

      if (selected === undefined) {
        // Toggle
        if (newSet.has(index)) {
          newSet.delete(index);
        } else {
          if (maxSelections && newSet.size >= maxSelections) {
            return prev; // Don't exceed max selections
          }
          newSet.add(index);
        }
      } else {
        // Set specific value
        if (selected && (!maxSelections || newSet.size < maxSelections)) {
          newSet.add(index);
        } else if (!selected) {
          newSet.delete(index);
        } else {
          return prev; // Can't add more selections
        }
      }

      return newSet;
    });
  }, [maxSelections]);

  // Handle select all
  const handleSelectAll = useCallback(() => {
    if (selectedRows.size === filteredData.length) {
      // Deselect all
      setSelectedRows(new Set());
    } else {
      // Select all (respecting max selections)
      const newSet = new Set<number>();
      const limit = Math.min(filteredData.length, maxSelections || Infinity);
      for (let i = 0; i < limit; i++) {
        newSet.add(i);
      }
      setSelectedRows(newSet);
    }
  }, [selectedRows.size, filteredData.length, maxSelections]);

  // Handle row expansion
  const toggleRowExpansion = useCallback((index: number) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  }, []);

  // Handle bulk action
  const handleBulkAction = useCallback((action: typeof bulkActions[0]) => {
    const selectedItems = Array.from(selectedRows).map(index => filteredData[index]);
    action.onPress(selectedItems);
  }, [selectedRows, filteredData]);

  // Handle pull to refresh
  const handlePullStart = useCallback((e: React.TouchEvent) => {
    if (!pullToRefresh) return;
    setPullStartY(e.touches[0].clientY);
    setIsPulling(true);
  }, [pullToRefresh]);

  const handlePullMove = useCallback((e: React.TouchEvent) => {
    if (!isPulling || !pullToRefresh) return;

    const currentY = e.touches[0].clientY;
    const pullDistance = currentY - pullStartY;

    if (pullDistance > 0 && listRef.current) {
      listRef.current.style.transform = `translateY(${Math.min(pullDistance, 80)}px)`;
    }
  }, [isPulling, pullStartY, pullToRefresh]);

  const handlePullEnd = useCallback(async (e: React.TouchEvent) => {
    if (!isPulling || !pullToRefresh) return;

    const currentY = e.changedTouches[0].clientY;
    const pullDistance = currentY - pullStartY;

    if (listRef.current) {
      listRef.current.style.transform = '';
    }

    if (pullDistance > 60 && onSearch) {
      setIsRefreshing(true);
      await onSearch(searchQuery);
      setTimeout(() => setIsRefreshing(false), 500);
    }

    setIsPulling(false);
  }, [isPulling, pullStartY, pullToRefresh, onSearch, searchQuery]);

  // Render row actions
  const renderRowActions = useCallback((item: T, index: number) => {
    if (rowActions.length === 0) return null;

    return (
      <div className="flex items-center gap-1">
        {rowActions.map(action => (
          <Button
            key={action.key}
            variant="ghost"
            size="icon"
            className={cn(
              'w-8 h-8 min-w-[44px] min-h-[44px]',
              action.color === 'error' && 'text-red-600 hover:text-red-700 hover:bg-red-50',
              action.color === 'success' && 'text-green-600 hover:text-green-700 hover:bg-green-50',
              action.color === 'warning' && 'text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50'
            )}
            onClick={() => action.onPress(item, index)}
            disabled={action.disabled?.(item)}
          >
            {action.icon}
          </Button>
        ))}
      </div>
    );
  }, [rowActions]);

  // Render table view
  const renderTableView = () => (
    <div className="overflow-x-auto">
      <table className={cn(
        'w-full border-collapse',
        bordered && 'border border-gray-200',
        compactMode && 'text-sm'
      )}>
        {/* Header */}
        {stickyHeader && (
          <thead className={cn(
            'bg-gray-50 border-b-2 border-gray-200 sticky top-0 z-10'
          )}>
            <tr>
              {selectable && (
                <th className="w-12 px-2 py-3">
                  <div className="flex items-center justify-center">
                    <input
                      type="checkbox"
                      id="select-all-rows"
                      checked={selectedRows.size === filteredData.length && filteredData.length > 0}
                      onChange={handleSelectAll}
                      className="h-5 w-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 focus:ring-2 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                    />
                  </div>
                </th>
              )}
              {columns.map((column) => (
                <th
                  key={String(column.key)}
                  className={cn(
                    'px-4 py-3 text-left font-semibold text-gray-900',
                    sortable && column.sortable && 'cursor-pointer hover:bg-gray-100',
                    bordered && 'border border-gray-200'
                  )}
                  style={{ width: column.width }}
                  onClick={() => sortable && column.sortable && handleSort(column.key)}
                >
                  <div className="flex items-center gap-2">
                    {column.title}
                    {sortable && column.sortable && sortColumn === column.key && (
                      sortDirection === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                    )}
                  </div>
                </th>
              ))}
              {(expandable || rowActions.length > 0) && <th className="w-20" />}
            </tr>
          </thead>
        )}

        {/* Body */}
        <tbody>
          {loading ? (
            Array.from({ length: 5 }, (_, index) => (
              <tr key={index} className={cn(
                striped && index % 2 === 1 && 'bg-gray-50',
                bordered && 'border border-gray-200'
              )}>
                {selectable && <td className="px-2 py-3"><SkeletonLoader height="16px" /></td>}
                {columns.map((column) => (
                  <td key={String(column.key)} className="px-4 py-3">
                    <SkeletonLoader height="20px" />
                  </td>
                ))}
                <td className="px-4 py-3"><SkeletonLoader height="32px" /></td>
              </tr>
            ))
          ) : filteredData.length === 0 ? (
            <tr>
              <td colSpan={columns.length + (selectable ? 1 : 0) + (expandable || rowActions.length > 0 ? 1 : 0)} className="px-4 py-8 text-center text-gray-500">
                {empty || 'No data available'}
              </td>
            </tr>
          ) : (
            filteredData.map((item, index) => (
              <tr
                key={index}
                className={cn(
                  'border-b transition-colors',
                  striped && index % 2 === 1 && 'bg-gray-50',
                  bordered && 'border border-gray-200',
                  onRowClick && 'cursor-pointer hover:bg-gray-50'
                )}
                onClick={() => onRowClick?.(item, index)}
              >
                {selectable && (
                  <td className="px-2 py-3">
                    <div className="flex items-center justify-center min-h-[44px] min-w-[44px] touch-manipulation">
                      <input
                        type="checkbox"
                        id={`select-row-${index}`}
                        checked={selectedRows.has(index)}
                        onChange={() => handleRowSelect(index)}
                        className="h-5 w-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 focus:ring-2 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                      />
                    </div>
                  </td>
                )}
                {columns.map((column) => (
                  <td
                    key={String(column.key)}
                    className={cn(
                      'px-4 py-3',
                      bordered && 'border border-gray-200'
                    )}
                  >
                    {column.render ? column.render(item[column.key], item, index) : item[column.key]}
                  </td>
                ))}
                {(expandable || rowActions.length > 0) && (
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {expandable && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleRowExpansion(index);
                          }}
                        >
                          {expandedRows.has(index) ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </Button>
                      )}
                      {rowActions.length > 0 && renderRowActions(item, index)}
                    </div>
                  </td>
                )}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );

  // Render cards view
  const renderCardsView = () => (
    <div className="divide-y divide-gray-200">
      {loading ? (
        Array.from({ length: 5 }, (_, index) => (
          <MobileCard key={index} loading>
            <SkeletonLoader lines={3} />
          </MobileCard>
        ))
      ) : filteredData.length === 0 ? (
        <div className="p-8 text-center text-gray-500">
          {empty || 'No data available'}
        </div>
      ) : (
        filteredData.map((item, index) => (
          <MobileCardListItem
            key={index}
            index={index}
            totalItems={filteredData.length}
            clickable
            onPress={() => onRowClick?.(item, index)}
            swipeActions={rowActions.length > 0 ? {
              left: rowActions.filter(action => action.color !== 'error').slice(0, 2),
              right: rowActions.filter(action => action.color === 'error').slice(0, 2),
            } : undefined}
          >
            {/* Enhanced selection checkbox */}
            {selectable && (
              <div className="mobile-card-selection flex items-center justify-between mb-3">
                <div className="flex items-center gap-3 p-2 rounded-lg border-2 border-transparent hover:border-gray-300 focus-within:border-blue-500 min-h-[44px] min-w-[44px] touch-manipulation transition-colors">
                  <input
                    type="checkbox"
                    id={`card-select-${index}`}
                    checked={selectedRows.has(index)}
                    onChange={() => handleRowSelect(index)}
                    className="h-5 w-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 focus:ring-2 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                  />
                </div>
              </div>
            )}

            {/* Card content based on column priorities */}
            <div className="space-y-3">
              {columns.filter(col => col.mobile?.priority === 'high').map((column) => (
                <div key={String(column.key)}>
                  <div className="text-xs text-gray-500 mb-1">{column.title}</div>
                  <div className="text-sm text-gray-900">
                    {column.mobile?.render ?
                      column.mobile.render(item[column.key], item, index) :
                      column.render ?
                        column.render(item[column.key], item, index) :
                        item[column.key]
                    }
                  </div>
                </div>
              ))}
            </div>

            {/* Expandable content */}
            {expandable && expandedRows.has(index) && expandedRow && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                {expandedRow(item, index)}
              </div>
            )}
          </MobileCardListItem>
        ))
      )}
    </div>
  );

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Search and filters header */}
      {(searchable || filterable) && (
        <div className="sticky top-0 z-30 bg-white border-b border-gray-200">
          <div className="p-4 pb-3">
            {searchable && (
              <MobileSearchInput
                value={searchQuery}
                onChange={handleSearch}
                onSubmit={handleSearch}
                placeholder={searchPlaceholder}
                enableVoiceSearch={enableVoiceSearch}
                suggestions={searchSuggestions}
                enableHistory={true}
                showCancelButton={!!searchQuery}
                className="mb-3"
              />
            )}

            {/* Action bar */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {filterable && (
                  <Button
                    variant={Object.keys(activeFilters).length > 0 ? "default" : "outline"}
                    size="sm"
                    onClick={() => setShowFilterPanel(true)}
                    className="min-h-[44px] min-w-[44px] touch-manipulation"
                  >
                    <Filter className="w-4 h-4 mr-2" />
                    Filters
                    {Object.keys(activeFilters).length > 0 && (
                      <Badge variant="secondary" className="ml-2 text-xs">
                        {Object.keys(activeFilters).length}
                      </Badge>
                    )}
                  </Button>
                )}

                {showViewToggle && (
                  <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
                    <Button
                      variant={currentView === 'cards' ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setCurrentView('cards')}
                      className="min-h-[32px] min-w-[32px] p-0"
                    >
                      <Grid3X3 className="w-4 h-4" />
                    </Button>
                    <Button
                      variant={currentView === 'table' ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setCurrentView('table')}
                      className="min-h-[32px] min-w-[32px] p-0"
                    >
                      <Table className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>

              {/* Export and share */}
              <div className="flex gap-2">
                {exportable && onExport && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onExport('csv')}
                    className="min-h-[44px] min-w-[44px] touch-manipulation"
                  >
                    <Download className="w-4 h-4" />
                  </Button>
                )}
                {shareable && onShare && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onShare(selectedRows.size > 0 ? Array.from(selectedRows).map(i => filteredData[i]) : filteredData)}
                    className="min-h-[44px] min-w-[44px] touch-manipulation"
                  >
                    <Share2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Enhanced bulk actions bar */}
      {selectable && selectedRows.size > 0 && (
        <div className="mobile-bulk-controls bg-blue-50 border-b border-blue-200 px-4 py-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-h-[44px]">
              <div className="w-5 h-5 rounded-sm border-2 border-blue-600 bg-blue-600 flex items-center justify-center">
                <svg className="h-3 w-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
              <span className="text-sm font-medium text-blue-900">
                {selectedRows.size} selected
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {bulkActions.map(action => (
                <Button
                  key={action.key}
                  variant={action.color === 'error' ? 'destructive' : 'default'}
                  size="sm"
                  onClick={() => handleBulkAction(action)}
                  disabled={action.disabled?.(Array.from(selectedRows).map(i => filteredData[i]))}
                  className="min-h-[44px] min-w-[44px] touch-manipulation px-4"
                >
                  <span className="flex items-center gap-2">
                    {action.icon}
                    <span>{action.label}</span>
                  </span>
                </Button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Results count */}
      {searchQuery && (
        <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
          <p className="text-sm text-gray-600">
            Found {filteredData.length} result{filteredData.length !== 1 ? 's' : ''}
            {searchQuery && ` for "${searchQuery}"`}
          </p>
        </div>
      )}

      {/* Table content with pull-to-refresh */}
      <div
        ref={listRef}
        className={cn(
          'flex-1 overflow-y-auto',
          isPulling && 'transition-transform',
          'touch-manipulation'
        )}
        onTouchStart={handlePullStart}
        onTouchMove={handlePullMove}
        onTouchEnd={handlePullEnd}
      >
        {/* Refresh indicator */}
        {isRefreshing && (
          <div className="flex justify-center py-4">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* Render the appropriate view */}
        {currentView === 'table' ? renderTableView() : renderCardsView()}

        {/* Infinite scroll loading */}
        {infiniteScroll && hasMore && !loading && (
          <div className="p-4 text-center">
            <Button
              onClick={onLoadMore}
              variant="outline"
              disabled={loading}
              className="min-h-[44px] min-w-[44px] touch-manipulation"
            >
              Load More
            </Button>
          </div>
        )}
      </div>

      {/* Pagination */}
      {pagination && !infiniteScroll && (
        <div className="border-t border-gray-200 bg-white p-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-sm text-gray-600">
              Showing {((pagination.page - 1) * pagination.pageSize) + 1} to {Math.min(pagination.page * pagination.pageSize, pagination.total)} of {pagination.total} items
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page === 1}
                onClick={() => pagination.onPageChange(pagination.page - 1)}
                className="min-h-[44px] min-w-[44px] touch-manipulation"
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page * pagination.pageSize >= pagination.total}
                onClick={() => pagination.onPageChange(pagination.page + 1)}
                className="min-h-[44px] min-w-[44px] touch-manipulation"
              >
                Next
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Filter panel */}
      {filterable && (
        <MobileFilterPanel
          isOpen={showFilterPanel}
          onClose={() => setShowFilterPanel(false)}
          onApply={onFilter || (() => {})}
          onReset={() => onFilter?.({})}
          initialFilters={activeFilters}
          sections={filterSections}
          activeFiltersCount={Object.keys(activeFilters).length}
          showSearch={filterSections.length > 5}
        />
      )}
    </div>
  );
}

export default MobileTableWithSearch;