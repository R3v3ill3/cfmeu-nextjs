'use client'

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { HelpCircle, Search, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useHelpContext } from '@/context/HelpContext'
import { AppRole } from '@/constants/roles'

interface HelpTip {
  id: string
  title: string
  level: number
  content: string
  routeMatches: string[]
  keywords: string[]
}

interface HelpSearchResult {
  id: string
  title: string
  snippet: string
  routeMatches: string[]
}

function buildQueryParams(route: string, role?: AppRole | null) {
  const params = new URLSearchParams()
  params.set('route', route || '/')
  if (role) params.set('role', role)
  return params.toString()
}

async function fetchTips(route: string, role?: AppRole | null): Promise<HelpTip[]> {
  const qp = buildQueryParams(route, role)
  const res = await fetch(`/api/help/tips?${qp}`)
  if (!res.ok) {
    throw new Error('Failed to load help tips')
  }
  const data = await res.json()
  return data.tips ?? []
}

async function searchHelp(query: string): Promise<HelpSearchResult[]> {
  const res = await fetch(`/api/help/search?q=${encodeURIComponent(query)}`)
  if (!res.ok) {
    throw new Error('Failed to search help content')
  }
  const data = await res.json()
  return data.results ?? []
}

export function HelpLauncher({ triggerVariant = 'ghost', size = 'icon' }: { triggerVariant?: 'default' | 'outline' | 'ghost'; size?: 'default' | 'icon' | 'sm' }) {
  const { scope } = useHelpContext()
  const [open, setOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'tips' | 'search'>('tips')
  const [query, setQuery] = useState('')

  const trimmedQuery = query.trim()
  const isSearchReady = trimmedQuery.length >= 2

  const tipsQuery = useQuery({
    queryKey: ['help', 'tips', scope.page, scope.role],
    queryFn: () => fetchTips(scope.page, scope.role),
    enabled: open,
    staleTime: 1000 * 60 * 5
  })

  const searchQuery = useQuery({
    queryKey: ['help', 'search', trimmedQuery],
    queryFn: () => searchHelp(trimmedQuery),
    enabled: open && isSearchReady,
    keepPreviousData: true
  })

  const shouldShowSearchResults = useMemo(() => activeTab === 'search' && isSearchReady, [activeTab, isSearchReady])

  return (
    <Dialog open={open} onOpenChange={(next) => {
      setOpen(next)
      if (!next) {
        setActiveTab('tips')
        setQuery('')
      }
    }}>
      <DialogTrigger asChild>
        <Button variant={triggerVariant} size={size} aria-label="Open contextual help">
          <HelpCircle className={size === 'icon' ? 'h-5 w-5' : 'h-4 w-4'} />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Need help?</DialogTitle>
          <DialogDescription>
            Contextual tips for <span className="font-medium">{scope.page}</span>
            {scope.role ? ` · role: ${scope.role.replace('_', ' ')}` : ''}
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2 mb-3">
          <Button
            variant={activeTab === 'tips' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveTab('tips')}
          >
            Tips
          </Button>
          <Button
            variant={activeTab === 'search' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveTab('search')}
          >
            Search
          </Button>
        </div>

        {activeTab === 'search' && (
          <div className="mb-4 space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search the user guide"
                className="pl-9"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Enter at least two characters to search the full user guide.
            </p>
          </div>
        )}

        <ScrollArea className="max-h-72 pr-2">
          {activeTab === 'tips' && (
            <div className="space-y-4">
              {tipsQuery.isLoading && (
                <div className="flex items-center justify-center py-6 text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading tips...
                </div>
              )}
              {tipsQuery.isError && (
                <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                  Unable to load contextual tips. Please try again later.
                </div>
              )}
              {tipsQuery.isSuccess && tipsQuery.data.length === 0 && (
                <div className="rounded-md border border-muted p-3 text-sm text-muted-foreground">
                  No contextual tips available yet for this page.
                </div>
              )}
              {tipsQuery.isSuccess && tipsQuery.data.length > 0 && (
                tipsQuery.data.map((tip) => (
                  <article key={tip.id} className="rounded-lg border border-muted bg-white p-4 shadow-sm">
                    <header className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-sm font-semibold text-foreground">{tip.title}</h3>
                      <div className="flex flex-wrap gap-1">
                        {tip.routeMatches.slice(0, 2).map((route) => (
                          <Badge key={route} variant="secondary">
                            {route === '/' ? 'Dashboard' : route.replace('/', '')}
                          </Badge>
                        ))}
                      </div>
                    </header>
                    <p className="text-sm text-muted-foreground whitespace-pre-line">
                      {tip.content.trim().slice(0, 320)}{tip.content.length > 320 ? '…' : ''}
                    </p>
                  </article>
                ))
              )}
            </div>
          )}

          {shouldShowSearchResults && (
            <div className="space-y-4">
              {searchQuery.isLoading && (
                <div className="flex items-center justify-center py-6 text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Searching…
                </div>
              )}
              {searchQuery.isError && (
                <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                  Unable to search help content right now.
                </div>
              )}
              {searchQuery.isSuccess && searchQuery.data.length === 0 && (
                <div className="rounded-md border border-muted p-3 text-sm text-muted-foreground">
                  No results found. Try a different search term.
                </div>
              )}
              {searchQuery.isSuccess && searchQuery.data.length > 0 && (
                searchQuery.data.map((result) => (
                  <article key={result.id} className="rounded-lg border border-muted bg-white p-4 shadow-sm">
                    <header className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-sm font-semibold text-foreground">{result.title}</h3>
                      <div className="flex flex-wrap gap-1">
                        {result.routeMatches.slice(0, 2).map((route) => (
                          <Badge key={route} variant="outline">
                            {route === '/' ? 'Dashboard' : route.replace('/', '')}
                          </Badge>
                        ))}
                      </div>
                    </header>
                    <p className="text-sm text-muted-foreground whitespace-pre-line">
                      {result.snippet.trim()}{result.snippet.length >= 240 ? '…' : ''}
                    </p>
                  </article>
                ))
              )}
            </div>
          )}
        </ScrollArea>

        <DialogFooter className="flex-col items-start gap-2 sm:flex-row sm:justify-between">
          <p className="text-xs text-muted-foreground">
            Tip data sourced from the in-app user guide. More AI assistance coming soon.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setActiveTab('search')
              setQuery('')
            }}
          >
            Explore guide
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
