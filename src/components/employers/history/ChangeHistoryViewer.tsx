'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'
import {
  History,
  User,
  Calendar,
  FileText,
  AlertTriangle,
  CheckCircle,
  ArrowUpDown,
  Search,
  Filter,
  Eye,
  RotateCcw,
  Download
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'

interface EmployerChange {
  id: string
  employer_id: string
  change_type: 'INSERT' | 'UPDATE' | 'DELETE'
  changed_by: string
  changed_at: string
  from_version: number | null
  to_version: number
  changed_fields: Record<string, boolean>
  old_values: Record<string, any> | null
  new_values: Record<string, any> | null
  change_context: Record<string, any>
  conflict_with_change_id: string | null
  conflict_resolution_type: string | null
  resolved_at: string | null
  resolved_by: string | null
  bulk_operation_id: string | null
  changed_by_name: string
  changed_by_email: string
}

interface ChangeHistoryViewerProps {
  employerId: string
  className?: string
  compact?: boolean
  showFilters?: boolean
  maxItems?: number
}

export function ChangeHistoryViewer({
  employerId,
  className,
  compact = false,
  showFilters = true,
  maxItems
}: ChangeHistoryViewerProps) {
  const [changes, setChanges] = useState<EmployerChange[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const [totalItems, setTotalItems] = useState(0)
  const [pageSize] = useState(20)

  // Filters
  const [searchTerm, setSearchTerm] = useState('')
  const [changeTypeFilter, setChangeTypeFilter] = useState<string>('all')
  const [userFilter, setUserFilter] = useState<string>('all')
  const [dateFilter, setDateFilter] = useState<string>('all')
  const [includeConflicts, setIncludeConflicts] = useState(false)

  // UI State
  const [selectedChange, setSelectedChange] = useState<EmployerChange | null>(null)
  const [showDetails, setShowDetails] = useState(false)

  const supabase = createClientComponentClient()
  const { toast } = useToast()

  // Fetch changes
  const fetchChanges = useCallback(async (page = 1) => {
    setIsLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({
        limit: maxItems ? maxItems.toString() : pageSize.toString(),
        offset: ((page - 1) * pageSize).toString(),
      })

      // Apply filters
      if (changeTypeFilter !== 'all') {
        params.append('change_type', changeTypeFilter)
      }

      if (userFilter !== 'all') {
        params.append('user_id', userFilter)
      }

      if (dateFilter !== 'all') {
        const now = new Date()
        let startDate: Date

        switch (dateFilter) {
          case 'today':
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
            break
          case 'week':
            startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
            break
          case 'month':
            startDate = new Date(now.getFullYear(), now.getMonth(), 1)
            break
          default:
            startDate = new Date(0)
        }

        params.append('start_date', startDate.toISOString())
        params.append('end_date', now.toISOString())
      }

      if (includeConflicts) {
        params.append('include_conflicts', 'true')
      }

      const response = await fetch(`/api/employers/${employerId}/changes?${params}`)

      if (!response.ok) {
        throw new Error('Failed to fetch change history')
      }

      const data = await response.json()
      setChanges(data.changes || [])
      setTotalItems(data.pagination?.total || 0)

      if (maxItems && data.changes.length > 0) {
        // For compact mode with max items, we don't need pagination
        setCurrentPage(1)
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMessage)
      toast({
        title: 'Error',
        description: 'Failed to load change history',
        variant: 'destructive'
      })
    } finally {
      setIsLoading(false)
    }
  }, [employerId, pageSize, maxItems, changeTypeFilter, userFilter, dateFilter, includeConflicts, toast])

  // Initial fetch
  useEffect(() => {
    fetchChanges(1)
  }, [fetchChanges])

  // Format change type
  const formatChangeType = (type: string) => {
    switch (type) {
      case 'INSERT':
        return { label: 'Created', color: 'bg-green-100 text-green-800' }
      case 'UPDATE':
        return { label: 'Updated', color: 'bg-blue-100 text-blue-800' }
      case 'DELETE':
        return { label: 'Deleted', color: 'bg-red-100 text-red-800' }
      default:
        return { label: type, color: 'bg-gray-100 text-gray-800' }
    }
  }

  // Format date
  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'MMM d, yyyy h:mm a')
    } catch {
      return dateString
    }
  }

  // Get changed fields count
  const getChangedFieldsCount = (changedFields: Record<string, boolean>) => {
    return Object.values(changedFields).filter(Boolean).length
  }

  // Get unique users for filter
  const getUniqueUsers = () => {
    const users = new Set(changes.map(c => c.changed_by))
    return Array.from(users).map(userId => {
      const change = changes.find(c => c.changed_by === userId)
      return {
        id: userId,
        name: change?.changed_by_name || `User ${userId.slice(0, 8)}`,
        email: change?.changed_by_email || ''
      }
    })
  }

  // Filter changes by search term
  const filteredChanges = changes.filter(change => {
    if (!searchTerm) return true

    const searchLower = searchTerm.toLowerCase()
    return (
      change.changed_by_name?.toLowerCase().includes(searchLower) ||
      change.changed_by_email?.toLowerCase().includes(searchLower) ||
      change.change_type.toLowerCase().includes(searchLower) ||
      Object.keys(change.changed_fields).some(field => field.toLowerCase().includes(searchLower))
    )
  })

  const totalPages = Math.ceil(totalItems / pageSize)
  const hasPagination = !maxItems && totalPages > 1

  if (compact) {
    return (
      <Card className={cn('w-full', className)}>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <History className="h-5 w-5" />
            Recent Changes
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredChanges.slice(0, maxItems || 5).map((change) => {
                const changeTypeInfo = formatChangeType(change.change_type)
                return (
                  <div key={change.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Badge className={changeTypeInfo.color}>
                        {changeTypeInfo.label}
                      </Badge>
                      <div>
                        <p className="font-medium text-sm">{change.changed_by_name}</p>
                        <p className="text-xs text-gray-600">
                          {formatDate(change.changed_at)}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">
                        {getChangedFieldsCount(change.changed_fields)} fields
                      </p>
                      <p className="text-xs text-gray-600">
                        v{change.from_version || '0'} → v{change.to_version}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl flex items-center gap-2">
            <History className="h-6 w-6" />
            Change History
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchChanges(currentPage)}
              disabled={isLoading}
            >
              <ArrowUpDown className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>

        {showFilters && (
          <div className="flex flex-wrap gap-4 p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-gray-500" />
              <Input
                placeholder="Search changes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-64"
              />
            </div>

            <Select value={changeTypeFilter} onValueChange={setChangeTypeFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Change Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="INSERT">Created</SelectItem>
                <SelectItem value="UPDATE">Updated</SelectItem>
                <SelectItem value="DELETE">Deleted</SelectItem>
              </SelectContent>
            </Select>

            <Select value={userFilter} onValueChange={setUserFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="User" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Users</SelectItem>
                {getUniqueUsers().map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Date Range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Time</SelectItem>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="week">Last Week</SelectItem>
                <SelectItem value="month">Last Month</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex items-center gap-2">
              <Checkbox
                id="include-conflicts"
                checked={includeConflicts}
                onCheckedChange={setIncludeConflicts}
              />
              <Label htmlFor="include-conflicts" className="text-sm">
                Show conflicts only
              </Label>
            </div>
          </div>
        )}
      </CardHeader>

      <CardContent>
        {error ? (
          <div className="text-center py-8">
            <AlertTriangle className="h-12 w-12 text-red-400 mx-auto mb-4" />
            <p className="text-red-600">{error}</p>
            <Button onClick={() => fetchChanges(currentPage)} className="mt-4">
              Retry
            </Button>
          </div>
        ) : isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <>
            <ScrollArea className="h-96">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Change</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Version</TableHead>
                    <TableHead>Fields</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredChanges.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8">
                        <div className="text-gray-500">
                          <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                          <p>No changes found</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredChanges.map((change) => {
                      const changeTypeInfo = formatChangeType(change.change_type)
                      return (
                        <TableRow key={change.id}>
                          <TableCell>
                            <Badge className={changeTypeInfo.color}>
                              {changeTypeInfo.label}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">{change.changed_by_name}</p>
                              <p className="text-sm text-gray-600">{change.changed_by_email}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="text-sm">{formatDate(change.changed_at)}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              {change.from_version && <span>v{change.from_version}</span>}
                              {change.from_version && <span> → </span>}
                              <span className="font-medium">v{change.to_version}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              {getChangedFieldsCount(change.changed_fields)} changed
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              {change.conflict_with_change_id && (
                                <Badge variant="outline" className="text-orange-600">
                                  <AlertTriangle className="h-3 w-3 mr-1" />
                                  Conflict
                                </Badge>
                              )}
                              {change.conflict_resolution_type && (
                                <Badge variant="outline" className="text-green-600">
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  Resolved
                                </Badge>
                              )}
                              {change.bulk_operation_id && (
                                <Badge variant="outline">
                                  Bulk
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setSelectedChange(change)}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
                                <DialogHeader>
                                  <DialogTitle>Change Details</DialogTitle>
                                </DialogHeader>
                                {selectedChange && (
                                  <ScrollArea className="h-96">
                                    <div className="space-y-6">
                                      {/* Metadata */}
                                      <div className="grid grid-cols-2 gap-4">
                                        <div>
                                          <p className="font-medium">Change Type</p>
                                          <Badge className={changeTypeInfo.color}>
                                            {changeTypeInfo.label}
                                          </Badge>
                                        </div>
                                        <div>
                                          <p className="font-medium">Time</p>
                                          <p className="text-sm">{formatDate(change.changed_at)}</p>
                                        </div>
                                        <div>
                                          <p className="font-medium">User</p>
                                          <p className="text-sm">{change.changed_by_name}</p>
                                          <p className="text-xs text-gray-600">{change.changed_by_email}</p>
                                        </div>
                                        <div>
                                          <p className="font-medium">Version</p>
                                          <p className="text-sm">
                                            {change.from_version ? `v${change.from_version} → ` : ''}v{change.to_version}
                                          </p>
                                        </div>
                                      </div>

                                      {/* Changed Fields */}
                                      <div>
                                        <p className="font-medium mb-2">Changed Fields</p>
                                        <div className="grid grid-cols-2 gap-4">
                                          {Object.entries(change.changed_fields)
                                            .filter(([_, changed]) => changed)
                                            .map(([field, _]) => (
                                              <Badge key={field} variant="outline" className="mr-2">
                                                {field}
                                              </Badge>
                                            ))}
                                        </div>
                                      </div>

                                      {/* Values Comparison */}
                                      {(change.old_values || change.new_values) && (
                                        <div>
                                          <p className="font-medium mb-2">Values</p>
                                          <div className="grid grid-cols-2 gap-4">
                                            {change.old_values && (
                                              <div>
                                                <p className="font-medium text-sm text-red-600 mb-2">Previous Values</p>
                                                <pre className="text-xs bg-red-50 p-3 rounded overflow-auto">
                                                  {JSON.stringify(change.old_values, null, 2)}
                                                </pre>
                                              </div>
                                            )}
                                            {change.new_values && (
                                              <div>
                                                <p className="font-medium text-sm text-green-600 mb-2">New Values</p>
                                                <pre className="text-xs bg-green-50 p-3 rounded overflow-auto">
                                                  {JSON.stringify(change.new_values, null, 2)}
                                                </pre>
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      )}

                                      {/* Context */}
                                      {change.change_context && Object.keys(change.change_context).length > 0 && (
                                        <div>
                                          <p className="font-medium mb-2">Context</p>
                                          <pre className="text-xs bg-gray-50 p-3 rounded overflow-auto">
                                            {JSON.stringify(change.change_context, null, 2)}
                                          </pre>
                                        </div>
                                      )}
                                    </div>
                                  </ScrollArea>
                                )}
                              </DialogContent>
                            </Dialog>
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </ScrollArea>

            {/* Pagination */}
            {hasPagination && (
              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-gray-600">
                  Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, totalItems)} of {totalItems} changes
                </p>
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        onClick={() => currentPage > 1 && fetchChanges(currentPage - 1)}
                        className={currentPage <= 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                      />
                    </PaginationItem>
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      const page = i + 1
                      return (
                        <PaginationItem key={page}>
                          <PaginationLink
                            onClick={() => fetchChanges(page)}
                            isActive={page === currentPage}
                            className="cursor-pointer"
                          >
                            {page}
                          </PaginationLink>
                        </PaginationItem>
                      )
                    })}
                    {totalPages > 5 && (
                      <PaginationItem>
                        <span className="px-2">...</span>
                      </PaginationItem>
                    )}
                    <PaginationItem>
                      <PaginationNext
                        onClick={() => currentPage < totalPages && fetchChanges(currentPage + 1)}
                        className={currentPage >= totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}