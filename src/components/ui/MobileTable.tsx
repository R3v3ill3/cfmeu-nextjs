"use client"

import React, { useState, useRef, useEffect } from 'react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { mobileTokens, device } from '@/styles/mobile-design-tokens'
import { SkeletonLoader } from './SkeletonLoader'
import { Button } from './button'
import { ChevronDown, ChevronUp, MoreVertical, Search, Filter } from 'lucide-react'

export interface MobileTableColumn<T = any> {
  key: keyof T
  title: string
  width?: string
  sortable?: boolean
  filterable?: boolean
  render?: (value: any, item: T, index: number) => ReactNode
  mobile?: {
    priority?: 'high' | 'medium' | 'low'
    hidden?: boolean
    render?: (value: any, item: T, index: number) => ReactNode
  }
}

export interface MobileTableProps<T = any> {
  data: T[]
  columns: MobileTableColumn<T>[]
  loading?: boolean
  empty?: ReactNode
  className?: string
  variant?: 'table' | 'cards' | 'list'
  searchable?: boolean
  filterable?: boolean
  sortable?: boolean
  pagination?: {
    page: number
    pageSize: number
    total: number
    onPageChange: (page: number) => void
  }
  onRowClick?: (item: T, index: number) => void
  onSort?: (column: keyof T, direction: 'asc' | 'desc') => void
  onFilter?: (filters: Record<string, any>) => void
  onSearch?: (query: string) => void
  expandable?: boolean
  expandedRow?: (item: T, index: number) => ReactNode
  stickyHeader?: boolean
  striped?: boolean
  bordered?: boolean
  compact?: boolean
}

export function MobileTable<T extends Record<string, any>>({
  data,
  columns,
  loading = false,
  empty,
  className,
  variant = 'table',
  searchable = false,
  filterable = false,
  sortable = false,
  pagination,
  onRowClick,
  onSort,
  onFilter,
  onSearch,
  expandable = false,
  expandedRow,
  stickyHeader = true,
  striped = true,
  bordered = false,
  compact = false,
}: MobileTableProps<T>) {
  const [searchQuery, setSearchQuery] = useState('')
  const [sortColumn, setSortColumn] = useState<keyof T | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set())
  const [filters, setFilters] = useState<Record<string, any>>({})

  // Auto-detect mobile and switch to card variant
  const isMobile = device.isMobile()
  const effectiveVariant = isMobile && variant === 'table' ? 'cards' : variant

  // Handle search
  const handleSearch = (query: string) => {
    setSearchQuery(query)
    onSearch?.(query)
  }

  // Handle sort
  const handleSort = (column: keyof T) => {
    const newDirection = sortColumn === column && sortDirection === 'asc' ? 'desc' : 'asc'
    setSortColumn(column)
    setSortDirection(newDirection)
    onSort?.(column, newDirection)
  }

  // Handle row expansion
  const toggleRowExpansion = (index: number) => {
    const newExpanded = new Set(expandedRows)
    if (newExpanded.has(index)) {
      newExpanded.delete(index)
    } else {
      newExpanded.add(index)
    }
    setExpandedRows(newExpanded)
  }

  // Filter columns based on mobile priority
  const visibleColumns = React.useMemo(() => {
    if (effectiveVariant === 'table') {
      return columns
    }

    return columns.filter(col => !col.mobile?.hidden)
  }, [columns, effectiveVariant])

  // Get mobile card layout columns
  const mobileCardColumns = React.useMemo(() => {
    const highPriority = columns.filter(col => col.mobile?.priority === 'high' && !col.mobile?.hidden)
    const mediumPriority = columns.filter(col => col.mobile?.priority === 'medium' && !col.mobile?.hidden)
    const lowPriority = columns.filter(col => col.mobile?.priority === 'low' && !col.mobile?.hidden)

    return {
      header: highPriority.slice(0, 2),
      subtitle: mediumPriority.slice(0, 1),
      details: [...highPriority.slice(2), ...mediumPriority.slice(1), ...lowPriority],
    }
  }, [columns])

  // Table variant
  if (effectiveVariant === 'table') {
    return (
      <div className={cn('overflow-x-auto', className)}>
        {/* Search and filters */}
        {(searchable || filterable) && (
          <div className="flex flex-col sm:flex-row gap-2 mb-4 p-4 bg-gray-50 border-b">
            {searchable && (
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                />
              </div>
            )}
            {filterable && (
              <Button variant="outline" size="sm">
                <Filter className="w-4 h-4 mr-2" />
                Filter
              </Button>
            )}
          </div>
        )}

        <table className={cn(
          'w-full border-collapse',
          bordered && 'border border-gray-200',
          compact && 'text-sm'
        )}>
          {/* Header */}
          {stickyHeader && (
            <thead className={cn(
              'bg-gray-50 border-b-2 border-gray-200',
              stickyHeader && 'sticky top-0 z-10'
            )}>
              <tr>
                {visibleColumns.map((column) => (
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
                {expandable && <th className="w-12" />}
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
                  {visibleColumns.map((column) => (
                    <td key={String(column.key)} className="px-4 py-3">
                      <SkeletonLoader height="20px" />
                    </td>
                  ))}
                  {expandable && <td className="px-4 py-3" />}
                </tr>
              ))
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={visibleColumns.length + (expandable ? 1 : 0)} className="px-4 py-8 text-center text-gray-500">
                  {empty || 'No data available'}
                </td>
              </tr>
            ) : (
              data.map((item, index) => (
                <React.Fragment key={index}>
                  <tr
                    className={cn(
                      'border-b transition-colors',
                      striped && index % 2 === 1 && 'bg-gray-50',
                      bordered && 'border border-gray-200',
                      onRowClick && 'cursor-pointer hover:bg-gray-50'
                    )}
                    onClick={() => onRowClick?.(item, index)}
                  >
                    {visibleColumns.map((column) => (
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
                    {expandable && (
                      <td className="px-4 py-3">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            toggleRowExpansion(index)
                          }}
                        >
                          {expandedRows.has(index) ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </Button>
                      </td>
                    )}
                  </tr>
                  {expandable && expandedRows.has(index) && expandedRow && (
                    <tr>
                      <td colSpan={visibleColumns.length + 1} className="px-4 py-3 bg-gray-50">
                        {expandedRow(item, index)}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {pagination && (
          <div className="flex items-center justify-between p-4 border-t bg-gray-50">
            <div className="text-sm text-gray-600">
              Showing {((pagination.page - 1) * pagination.pageSize) + 1} to {Math.min(pagination.page * pagination.pageSize, pagination.total)} of {pagination.total} items
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page === 1}
                onClick={() => pagination.onPageChange(pagination.page - 1)}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page * pagination.pageSize >= pagination.total}
                onClick={() => pagination.onPageChange(pagination.page + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    )
  }

  // Cards variant for mobile
  if (effectiveVariant === 'cards') {
    return (
      <div className={cn('space-y-3', className)}>
        {/* Search and filters */}
        {(searchable || filterable) && (
          <div className="flex flex-col gap-2 p-3 bg-gray-50 rounded-lg">
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

        {/* Cards */}
        {loading ? (
          Array.from({ length: 5 }, (_, index) => (
            <div key={index} className="p-4 bg-white border border-gray-200 rounded-lg">
              <SkeletonLoader lines={3} />
            </div>
          ))
        ) : data.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            {empty || 'No data available'}
          </div>
        ) : (
          data.map((item, index) => (
            <div
              key={index}
              className={cn(
                'p-4 bg-white border border-gray-200 rounded-lg transition-colors',
                onRowClick && 'cursor-pointer hover:shadow-md hover:border-gray-300'
              )}
              onClick={() => onRowClick?.(item, index)}
            >
              {/* Header with high priority columns */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  {mobileCardColumns.header.map((column, colIndex) => (
                    <div key={String(column.key)} className={cn(colIndex > 0 && 'mt-1')}>
                      {column.mobile?.render ? (
                        column.mobile.render(item[column.key], item, index)
                      ) : column.render ? (
                        column.render(item[column.key], item, index)
                      ) : (
                        <div className="font-semibold text-gray-900 text-sm truncate">
                          {item[column.key]}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                {expandable && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex-shrink-0 ml-2"
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleRowExpansion(index)
                    }}
                  >
                    {expandedRows.has(index) ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </Button>
                )}
              </div>

              {/* Subtitle */}
              {mobileCardColumns.subtitle.map((column) => (
                <div key={String(column.key)} className="mb-3">
                  <div className="text-xs text-gray-500 mb-1">{column.title}</div>
                  {column.mobile?.render ? (
                    column.mobile.render(item[column.key], item, index)
                  ) : column.render ? (
                    column.render(item[column.key], item, index)
                  ) : (
                    <div className="text-sm text-gray-700">{item[column.key]}</div>
                  )}
                </div>
              ))}

              {/* Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {mobileCardColumns.details.map((column) => (
                  <div key={String(column.key)} className="flex justify-between items-center">
                    <div className="text-xs text-gray-500">{column.title}</div>
                    <div className="text-sm text-gray-900 text-right">
                      {column.mobile?.render ? (
                        column.mobile.render(item[column.key], item, index)
                      ) : column.render ? (
                        column.render(item[column.key], item, index)
                      ) : (
                        item[column.key]
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Expanded content */}
              {expandable && expandedRows.has(index) && expandedRow && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  {expandedRow(item, index)}
                </div>
              )}
            </div>
          ))
        )}

        {/* Pagination */}
        {pagination && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-gray-50 rounded-lg">
            <div className="text-sm text-gray-600">
              Showing {((pagination.page - 1) * pagination.pageSize) + 1} to {Math.min(pagination.page * pagination.pageSize, pagination.total)} of {pagination.total} items
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page === 1}
                onClick={() => pagination.onPageChange(pagination.page - 1)}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page * pagination.pageSize >= pagination.total}
                onClick={() => pagination.onPageChange(pagination.page + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    )
  }

  // List variant
  return (
    <div className={cn('space-y-1', className)}>
      {/* Search and filters */}
      {(searchable || filterable) && (
        <div className="flex flex-col gap-2 p-3 bg-gray-50 rounded-lg mb-3">
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

      {/* List items */}
      {loading ? (
        Array.from({ length: 5 }, (_, index) => (
          <div key={index} className="p-3 bg-white border-b border-gray-200">
            <SkeletonLoader lines={2} />
          </div>
        ))
      ) : data.length === 0 ? (
        <div className="p-8 text-center text-gray-500">
          {empty || 'No data available'}
        </div>
      ) : (
        data.map((item, index) => (
          <div
            key={index}
            className={cn(
              'p-3 bg-white border-b border-gray-200 transition-colors',
              onRowClick && 'cursor-pointer hover:bg-gray-50'
            )}
            onClick={() => onRowClick?.(item, index)}
          >
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3">
                  {visibleColumns.slice(0, 2).map((column, colIndex) => (
                    <div key={String(column.key)} className="min-w-0 flex-1">
                      {column.mobile?.render ? (
                        column.mobile.render(item[column.key], item, index)
                      ) : column.render ? (
                        column.render(item[column.key], item, index)
                      ) : (
                        <div className="text-sm text-gray-900 truncate">
                          {item[column.key]}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {visibleColumns.slice(2, 4).map((column) => (
                  <div key={String(column.key)} className="text-xs text-gray-600">
                    {column.mobile?.render ? (
                      column.mobile.render(item[column.key], item, index)
                    ) : column.render ? (
                      column.render(item[column.key], item, index)
                    ) : (
                      item[column.key]
                    )}
                  </div>
                ))}
                {expandable && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleRowExpansion(index)
                    }}
                  >
                    {expandedRows.has(index) ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </Button>
                )}
              </div>
            </div>

            {/* Expanded content */}
            {expandable && expandedRows.has(index) && expandedRow && (
              <div className="mt-3 pt-3 border-t border-gray-200">
                {expandedRow(item, index)}
              </div>
            )}
          </div>
        ))
      )}

      {/* Pagination */}
      {pagination && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-gray-50 rounded-lg mt-4">
          <div className="text-sm text-gray-600">
            Showing {((pagination.page - 1) * pagination.pageSize) + 1} to {Math.min(pagination.page * pagination.pageSize, pagination.total)} of {pagination.total} items
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page === 1}
              onClick={() => pagination.onPageChange(pagination.page - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page * pagination.pageSize >= pagination.total}
              onClick={() => pagination.onPageChange(pagination.page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

export default MobileTable