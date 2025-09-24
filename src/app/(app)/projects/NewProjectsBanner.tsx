"use client"
import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Bell } from 'lucide-react'

export default function NewProjectsBanner({ patchParam, onViewNew }: { patchParam?: string; onViewNew: (since?: string) => void }) {
  const [dismissed, setDismissed] = useState(false)

  const { data } = useQuery({
    queryKey: ['new-projects-count', patchParam],
    staleTime: 30000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const params = new URLSearchParams()
      if (patchParam) params.set('patch', patchParam)
      const res = await fetch(`/api/projects/new-count?${params.toString()}`, { cache: 'no-store' })
      if (!res.ok) return { count: 0, since: null }
      return res.json() as Promise<{ count: number; since: string | null }>
    }
  })

  const count = data?.count || 0
  const since = data?.since || undefined

  if (dismissed || count <= 0) return null

  return (
    <Alert className="flex items-center gap-3 bg-white border shadow-sm">
      <Bell className="h-4 w-4" />
      <div className="flex-1">
        <AlertTitle className="text-sm">New projects</AlertTitle>
        <AlertDescription className="text-sm">
          {count} new project{count === 1 ? '' : 's'} added since you last viewed.
        </AlertDescription>
      </div>
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={() => onViewNew(since)}>View new</Button>
        <Button size="sm" variant="outline" onClick={async () => {
          try {
            await fetch('/api/me/last-seen-projects', { method: 'POST' })
          } finally {
            setDismissed(true)
          }
        }}>Dismiss</Button>
      </div>
    </Alert>
  )
}


