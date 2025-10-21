'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Search, Building2, MapPin, Phone, Tag, Link2, UserCheck, XCircle, Loader2 } from 'lucide-react'
import type { MatchSearchResult } from '@/types/pendingEmployerReview'
import { useAliasAwareEmployerSearch } from '@/hooks/useAliasAwareEmployerSearch'

interface EbaEmployerMatchDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  pendingEmployerName: string
  onSelectMatch: (employerId: string) => void
  onCreateNew: () => void
  onSkip: () => void
}

export function EbaEmployerMatchDialog({
  open,
  onOpenChange,
  pendingEmployerName,
  onSelectMatch,
  onCreateNew,
  onSkip,
}: EbaEmployerMatchDialogProps) {
  const [searchQuery, setSearchQuery] = useState(pendingEmployerName)
  const [{ results, isSearching, hasSearched, error }, { search, clear }] =
    useAliasAwareEmployerSearch({ limit: 40, includeAliases: true, aliasMatchMode: 'any' })

  // Reset search state when dialog opens with new employer
  useEffect(() => {
    if (open && pendingEmployerName) {
      setSearchQuery(pendingEmployerName)
      search(pendingEmployerName)
    } else if (!open) {
      clear()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clear, open, pendingEmployerName, search])

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    search(searchQuery)
  }

  const handleSelectMatch = (employerId: string) => {
    onSelectMatch(employerId)
    onOpenChange(false)
  }

  const handleCreateNew = () => {
    onCreateNew()
    onOpenChange(false)
  }

  const handleSkip = () => {
    onSkip()
    onOpenChange(false)
  }

  const renderMatchBadges = (result: MatchSearchResult) => {
    const badges: JSX.Element[] = []

    switch (result.matchType) {
      case 'canonical_name':
        badges.push(
          <Badge key="canonical" variant="default" className="bg-green-600">
            Name Match
          </Badge>
        )
        break
      case 'alias':
        badges.push(
          <Badge key="alias" variant="secondary" className="flex items-center gap-1">
            <Tag className="h-3 w-3" /> Alias
          </Badge>
        )
        break
      case 'external_id':
        badges.push(
          <Badge key="external" variant="outline" className="flex items-center gap-1">
            <Link2 className="h-3 w-3" /> External ID
          </Badge>
        )
        break
      case 'abn':
        badges.push(
          <Badge key="abn" variant="outline">
            ABN Match
          </Badge>
        )
        break
    }

    badges.push(
      <Badge
        key="score"
        variant={result.searchScore >= 90 ? 'default' : result.searchScore >= 70 ? 'secondary' : 'outline'}
        className={result.searchScore >= 90 ? 'bg-emerald-500' : undefined}
      >
        Score {Math.round(result.searchScore)}
      </Badge>
    )

    if (result.enterprise_agreement_status) {
      badges.push(
        <Badge key="eba" variant="outline" className="flex items-center gap-1 border-green-500 text-green-700">
          <UserCheck className="h-3 w-3" /> EBA
        </Badge>
      )
    }

    return badges
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Match Employer: {pendingEmployerName}</DialogTitle>
          <DialogDescription>
            Search for an existing employer to link, or create a new record
          </DialogDescription>
        </DialogHeader>

        {/* Search Form */}
        <form onSubmit={handleSearchSubmit} className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Search by name or ABN..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1"
            />
            <Button type="submit" disabled={isSearching}>
              {isSearching ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
            </Button>
          </div>
        </form>

        {/* Search Results */}
        <div className="space-y-3 min-h-[200px]">
          {isSearching && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          )}

          {!isSearching && hasSearched && results.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <XCircle className="h-12 w-12 text-gray-400 mb-3" />
              <p className="text-gray-600 font-medium">No matching employers found</p>
              <p className="text-sm text-gray-500 mt-1">
                Try a different search term or create a new employer
              </p>
            </div>
          )}

          {!isSearching && error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {!isSearching && results.length > 0 && (
            <>
              <p className="text-sm text-gray-600 font-medium">
                Found {results.length} matching employer{results.length !== 1 ? 's' : ''}
              </p>
              
              {results.map((result) => (
                <div
                  key={result.id}
                  className="border rounded-lg p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => handleSelectMatch(result.id)}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <Building2 className="h-4 w-4 text-gray-400" />
                        <h3 className="font-medium">{result.name}</h3>
                        {renderMatchBadges(result)}
                      </div>
                      
                      {result.abn && (
                        <p className="text-sm text-gray-500">ABN: {result.abn}</p>
                      )}
                      
                      {(result.address_line_1 || result.suburb || result.state) && (
                        <div className="flex items-center gap-1 mt-1 text-sm text-gray-600">
                          <MapPin className="h-3 w-3" />
                          <span>
                            {[result.address_line_1, result.suburb, result.state, result.postcode]
                              .filter(Boolean)
                              .join(', ')}
                          </span>
                        </div>
                      )}
                      
                      {result.phone && (
                        <div className="flex items-center gap-1 mt-1 text-sm text-gray-600">
                          <Phone className="h-3 w-3" />
                          <span>{result.phone}</span>
                        </div>
                      )}

                      {result.matchType === 'alias' && result.matchedAlias && (
                        <p className="text-xs text-gray-500">Matched alias: {result.matchedAlias}</p>
                      )}
                      {result.aliases && result.aliases.length > 0 && (
                        <p className="text-xs text-gray-500">
                          Known aliases: {result.aliases.slice(0, 3).map((alias) => alias.alias).join(', ')}
                          {result.aliases.length > 3 && '…'}
                        </p>
                      )}
                      {result.externalIdMatch && (
                        <p className="text-xs text-gray-500">Matched via {result.externalIdMatch.toUpperCase()} ID</p>
                      )}
                    </div>
                    
                    <Button size="sm" onClick={() => handleSelectMatch(result.id)}>
                      Select Match
                    </Button>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>

        <DialogFooter className="flex justify-between items-center">
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleSkip}>
              Skip for Now
            </Button>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateNew} className="bg-green-600 hover:bg-green-700">
              Create New Employer
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

