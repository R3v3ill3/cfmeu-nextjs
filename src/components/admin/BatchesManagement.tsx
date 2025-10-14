'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { BatchesTable } from '@/components/batches/BatchesTable'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle } from 'lucide-react'

interface Batch {
  id: string
  original_file_name: string
  total_pages: number
  total_projects: number
  projects_completed: number
  status: string
  error_message: string | null
  created_at: string
  processing_started_at: string | null
  processing_completed_at: string | null
}

export function BatchesManagement() {
  const [batches, setBatches] = useState<Batch[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchBatches() {
      try {
        setIsLoading(true)
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
          setError('Not authenticated')
          return
        }

        const { data, error: fetchError } = await supabase
          .from('batch_uploads')
          .select(
            `
            id,
            original_file_name,
            total_pages,
            total_projects,
            projects_completed,
            status,
            error_message,
            created_at,
            processing_started_at,
            processing_completed_at
          `
          )
          .order('created_at', { ascending: false })

        if (fetchError) {
          setError(fetchError.message)
          return
        }

        setBatches(data || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch batches')
      } finally {
        setIsLoading(false)
      }
    }

    fetchBatches()
  }, [])

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-96 mt-2" />
        </CardHeader>
        <CardContent className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Error Loading Batches</CardTitle>
          <CardDescription>Failed to load batch uploads</CardDescription>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Batch Uploads</h3>
        <p className="text-sm text-muted-foreground">
          View and manage all batch upload history
        </p>
      </div>
      <BatchesTable batches={batches} />
    </div>
  )
}
