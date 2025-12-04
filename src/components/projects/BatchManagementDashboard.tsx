'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Loader2,
  RefreshCw,
  Search,
  Filter,
  Eye,
  XCircle,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Calendar,
  FileText,
  Activity,
  TrendingUp,
  Zap,
  BarChart3,
} from 'lucide-react'
import { toast } from 'sonner'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { AdaptivePoller } from '@/lib/performance/adaptivePolling'

interface BatchUpload {
  id: string
  original_file_name: string
  original_file_size_bytes: number
  total_pages: number
  total_projects: number
  total_scans: number
  projects_completed: number
  status: 'pending' | 'processing' | 'completed' | 'partial' | 'failed'
  error_message?: string
  created_at: string
  updated_at: string
  uploaded_by: string
  processing_duration_ms?: number
  performance_metrics?: {
    memory_peak_mb: number
    network_requests: number
    optimization_enabled: boolean
  }
}

interface BatchManagementDashboardProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function BatchManagementDashboard({ open, onOpenChange }: BatchManagementDashboardProps) {
  const router = useRouter()
  const [batches, setBatches] = useState<BatchUpload[]>([])
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [selectedBatch, setSelectedBatch] = useState<BatchUpload | null>(null)
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(true)

  const supabase = getSupabaseBrowserClient()
  const adaptivePollerRef = useRef<AdaptivePoller | null>(null)

  const fetchBatches = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        toast.error('User not authenticated')
        return
      }

      let query = supabase
        .from('batch_uploads')
        .select('*')
        .eq('uploaded_by', user.id)
        .order('created_at', { ascending: false })
        .limit(50)

      // Apply status filter
      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter)
      }

      // Apply search filter
      if (searchTerm) {
        query = query.ilike('original_file_name', `%${searchTerm}%`)
      }

      const { data, error } = await query

      if (error) {
        console.error('Error fetching batches:', error)
        toast.error('Failed to fetch batch uploads')
        return
      }

      setBatches(data || [])
    } catch (error) {
      console.error('Error in fetchBatches:', error)
      toast.error('Failed to fetch batch uploads')
    }
  }, [supabase, searchTerm, statusFilter])

  const refreshBatches = useCallback(() => {
    setLoading(true)
    fetchBatches().finally(() => setLoading(false))
  }, [fetchBatches])

  const startAutoRefresh = useCallback(() => {
    if (!autoRefresh || adaptivePollerRef.current) return

    adaptivePollerRef.current = new AdaptivePoller({
      initialInterval: 5000, // 5 seconds
      maxInterval: 30000,    // 30 seconds max
      fastInterval: 5000,    // 5 seconds when there's activity
      idleInterval: 15000,   // 15 seconds when idle
      maxAttempts: 1000,     // Very high for continuous monitoring
    })

    // Monitor for active batches
    const pollFn = async () => {
      await fetchBatches()
      return batches // Return current batches for activity checking
    }

    const checkActivity = (currentBatches: BatchUpload[]) => {
      return currentBatches.some(batch =>
        batch.status === 'pending' || batch.status === 'processing'
      )
    }

    adaptivePollerRef.current.start(
      pollFn,
      () => false, // Never stop automatically
      checkActivity
    )
  }, [autoRefresh, fetchBatches, batches])

  const stopAutoRefresh = useCallback(() => {
    if (adaptivePollerRef.current) {
      adaptivePollerRef.current.stop()
      adaptivePollerRef.current = null
    }
  }, [])

  const retryFailedBatch = async (batchId: string) => {
    try {
      const response = await fetch('/api/projects/batch-upload/retry-failed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batchId }),
      })

      if (!response.ok) {
        throw new Error('Failed to retry batch')
      }

      toast.success('Batch retry initiated')
      refreshBatches()
    } catch (error) {
      console.error('Error retrying batch:', error)
      toast.error('Failed to retry batch')
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-100 text-green-800"><CheckCircle2 className="h-3 w-3 mr-1" />Completed</Badge>
      case 'processing':
        return <Badge className="bg-blue-100 text-blue-800"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Processing</Badge>
      case 'partial':
        return <Badge className="bg-yellow-100 text-yellow-800"><AlertTriangle className="h-3 w-3 mr-1" />Partial</Badge>
      case 'failed':
        return <Badge className="bg-red-100 text-red-800"><XCircle className="h-3 w-3 mr-1" />Failed</Badge>
      case 'pending':
        return <Badge className="bg-gray-100 text-gray-800"><Clock className="h-3 w-3 mr-1" />Pending</Badge>
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }

  const formatFileSize = (bytes: number) => {
    const MB = 1024 * 1024
    if (bytes < MB) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / MB).toFixed(1)} MB`
  }

  const formatDuration = (ms?: number) => {
    if (!ms) return 'N/A'
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return minutes > 0 ? `${minutes}m ${remainingSeconds}s` : `${seconds}s`
  }

  const calculateStats = () => {
    const total = batches.length
    const completed = batches.filter(b => b.status === 'completed').length
    const processing = batches.filter(b => b.status === 'processing').length
    const failed = batches.filter(b => b.status === 'failed').length
    const successRate = total > 0 ? (completed / total) * 100 : 0

    return { total, completed, processing, failed, successRate }
  }

  useEffect(() => {
    if (open) {
      refreshBatches()
    }
  }, [open, refreshBatches])

  useEffect(() => {
    if (autoRefresh && open) {
      startAutoRefresh()
    } else {
      stopAutoRefresh()
    }

    return () => {
      stopAutoRefresh()
    }
  }, [autoRefresh, open, startAutoRefresh, stopAutoRefresh])

  const stats = calculateStats()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Batch Management Dashboard
          </DialogTitle>
          <DialogDescription>
            Monitor and manage your batch upload history and performance
          </DialogDescription>
        </DialogHeader>

        {/* Stats Overview */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-blue-500" />
                <div>
                  <p className="text-sm font-medium">{stats.total}</p>
                  <p className="text-xs text-muted-foreground">Total Batches</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <div>
                  <p className="text-sm font-medium">{stats.completed}</p>
                  <p className="text-xs text-muted-foreground">Completed</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-blue-500" />
                <div>
                  <p className="text-sm font-medium">{stats.processing}</p>
                  <p className="text-xs text-muted-foreground">Processing</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <XCircle className="h-4 w-4 text-red-500" />
                <div>
                  <p className="text-sm font-medium">{stats.failed}</p>
                  <p className="text-xs text-muted-foreground">Failed</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-green-500" />
                <div>
                  <p className="text-sm font-medium">{stats.successRate.toFixed(1)}%</p>
                  <p className="text-xs text-muted-foreground">Success Rate</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters and Controls */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by filename..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="processing">Processing</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="partial">Partial</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={autoRefresh ? 'bg-green-50 border-green-200' : ''}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${autoRefresh ? 'animate-spin' : ''}`} />
              Auto Refresh
            </Button>

            <Button variant="outline" size="sm" onClick={refreshBatches} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              Refresh
            </Button>
          </div>
        </div>

        {/* Batches Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Filename</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {batches.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No batch uploads found
                    </TableCell>
                  </TableRow>
                ) : (
                  batches.map((batch) => (
                    <TableRow key={batch.id}>
                      <TableCell>
                        <div className="max-w-[200px] truncate" title={batch.original_file_name}>
                          {batch.original_file_name}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {batch.total_pages} pages • {batch.total_projects} projects
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(batch.status)}</TableCell>
                      <TableCell>
                        <div className="w-[100px]">
                          <Progress
                            value={batch.total_scans > 0 ? (batch.projects_completed / batch.total_scans) * 100 : 0}
                            className="h-2"
                          />
                          <div className="text-xs text-muted-foreground mt-1">
                            {batch.projects_completed}/{batch.total_scans}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatFileSize(batch.original_file_size_bytes)}
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatDuration(batch.processing_duration_ms)}
                      </TableCell>
                      <TableCell className="text-sm">
                        {new Date(batch.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedBatch(batch)
                              setDetailDialogOpen(true)
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>

                          {batch.status === 'failed' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => retryFailedBatch(batch.id)}
                              title="Retry failed batch"
                            >
                              <RefreshCw className="h-4 w-4" />
                            </Button>
                          )}

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => router.push(`/projects/batches/${batch.id}`)}
                          >
                            <FileText className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Performance Summary */}
        {batches.some(b => b.performance_metrics) && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Zap className="h-4 w-4" />
                Performance Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="font-medium">Average Processing Time</p>
                  <p className="text-muted-foreground">
                    {formatDuration(
                      batches
                        .filter(b => b.processing_duration_ms)
                        .reduce((sum, b) => sum + (b.processing_duration_ms || 0), 0) /
                      batches.filter(b => b.processing_duration_ms).length
                    )}
                  </p>
                </div>
                <div>
                  <p className="font-medium">Peak Memory Usage</p>
                  <p className="text-muted-foreground">
                    {Math.max(...batches.map(b => b.performance_metrics?.memory_peak_mb || 0)).toFixed(1)} MB
                  </p>
                </div>
                <div>
                  <p className="font-medium">Optimization Usage</p>
                  <p className="text-muted-foreground">
                    {batches.filter(b => b.performance_metrics?.optimization_enabled).length} / {batches.length} batches
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Batch Detail Dialog */}
        <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Batch Details</DialogTitle>
              <DialogDescription>
                Detailed information about this batch upload
              </DialogDescription>
            </DialogHeader>

            {selectedBatch && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium">Batch ID</p>
                    <p className="text-sm text-muted-foreground font-mono">{selectedBatch.id}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Status</p>
                    <div className="mt-1">{getStatusBadge(selectedBatch.status)}</div>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Filename</p>
                    <p className="text-sm text-muted-foreground">{selectedBatch.original_file_name}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">File Size</p>
                    <p className="text-sm text-muted-foreground">{formatFileSize(selectedBatch.original_file_size_bytes)}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Progress</p>
                    <div className="mt-1">
                      <Progress
                        value={selectedBatch.total_scans > 0 ? (selectedBatch.projects_completed / selectedBatch.total_scans) * 100 : 0}
                        className="h-2 mb-1"
                      />
                      <p className="text-xs text-muted-foreground">
                        {selectedBatch.projects_completed} / {selectedBatch.total_scans} scans completed
                      </p>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Duration</p>
                    <p className="text-sm text-muted-foreground">{formatDuration(selectedBatch.processing_duration_ms)}</p>
                  </div>
                </div>

                {selectedBatch.error_message && (
                  <div className="p-3 bg-destructive/10 text-destructive rounded-lg">
                    <p className="text-sm font-medium">Error Message</p>
                    <p className="text-sm">{selectedBatch.error_message}</p>
                  </div>
                )}

                {selectedBatch.performance_metrics && (
                  <div className="border-t pt-4">
                    <p className="text-sm font-medium mb-2">Performance Metrics</p>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Peak Memory Usage</p>
                        <p>{selectedBatch.performance_metrics.memory_peak_mb.toFixed(1)} MB</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Network Requests</p>
                        <p>{selectedBatch.performance_metrics.network_requests}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Optimization Enabled</p>
                        <p>{selectedBatch.performance_metrics.optimization_enabled ? 'Yes' : 'No'}</p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-4">
                  <Button variant="outline" onClick={() => setDetailDialogOpen(false)}>
                    Close
                  </Button>
                  <Button onClick={() => router.push(`/projects/batches/${selectedBatch.id}`)}>
                    View Full Details
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  )
}