"use client"

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  Edit2,
  Trash2,
  Eye,
  Clock,
  User,
  Database,
  FileText,
  TrendingUp,
  MoreHorizontal,
  CheckCircle2,
  AlertCircle
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface EmployerAlias {
  id: string
  alias: string
  alias_normalized: string
  is_authoritative: boolean
  source_system?: string
  source_identifier?: string
  collected_at?: string
  collected_by?: string
  created_at: string
  created_by?: string
  notes?: string
  match_count?: number
  last_used_at?: string
}

interface AliasDisplayProps {
  alias: EmployerAlias
  showFullDetails?: boolean
  compact?: boolean
  onEdit?: (alias: EmployerAlias) => void
  onDelete?: (alias: EmployerAlias) => void
  onView?: (alias: EmployerAlias) => void
  onToggleStatus?: (alias: EmployerAlias) => void
  className?: string
}

export function AliasDisplay({
  alias,
  showFullDetails = false,
  compact = false,
  onEdit,
  onDelete,
  onView,
  onToggleStatus,
  className = ""
}: AliasDisplayProps) {
  const [showTooltip, setShowTooltip] = useState(false)

  const getSourceIcon = (source?: string) => {
    switch (source) {
      case 'manual': return <User className="h-3 w-3" />
      case 'bulk_import': return <Database className="h-3 w-3" />
      case 'scanned_document': return <FileText className="h-3 w-3" />
      default: return <Database className="h-3 w-3" />
    }
  }

  const getSourceLabel = (source?: string) => {
    switch (source) {
      case 'manual': return 'Manual'
      case 'bulk_import': return 'Bulk Import'
      case 'scanned_document': return 'Scanned Document'
      default: return 'System'
    }
  }

  const formatLastUsed = (date?: string) => {
    if (!date) return 'Never used'
    const used = new Date(date)
    const now = new Date()
    const daysAgo = Math.floor((now.getTime() - used.getTime()) / (1000 * 60 * 60 * 24))

    if (daysAgo === 0) return 'Used today'
    if (daysAgo === 1) return 'Used yesterday'
    if (daysAgo < 7) return `Used ${daysAgo} days ago`
    if (daysAgo < 30) return `Used ${Math.floor(daysAgo / 7)} weeks ago`
    return `Used ${Math.floor(daysAgo / 30)} months ago`
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString()
  }

  const getConfidenceColor = (matchCount?: number) => {
    if (!matchCount || matchCount === 0) return 'text-gray-500'
    if (matchCount >= 10) return 'text-green-600'
    if (matchCount >= 5) return 'text-blue-600'
    if (matchCount >= 1) return 'text-yellow-600'
    return 'text-gray-500'
  }

  const getConfidenceLabel = (matchCount?: number) => {
    if (!matchCount || matchCount === 0) return 'Unused'
    if (matchCount >= 10) return 'Highly Used'
    if (matchCount >= 5) return 'Well Used'
    if (matchCount >= 1) return 'Recently Used'
    return 'Unused'
  }

  if (compact) {
    return (
      <TooltipProvider>
        <Tooltip open={showTooltip} onOpenChange={setShowTooltip}>
          <TooltipTrigger asChild>
            <div
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs ${
                alias.is_authoritative
                  ? 'bg-green-100 text-green-800 border border-green-200'
                  : 'bg-gray-100 text-gray-600 border border-gray-200'
              } ${className}`}
            >
              <span className="font-medium truncate max-w-[120px]">{alias.alias}</span>
              {alias.match_count && alias.match_count > 0 && (
                <Badge variant="secondary" className="h-4 px-1 text-[10px]">
                  {alias.match_count}
                </Badge>
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs">
            <div className="space-y-1">
              <div className="font-medium">{alias.alias}</div>
              <div className="text-xs text-gray-500">
                Status: {alias.is_authoritative ? 'Active' : 'Inactive'}
              </div>
              {alias.match_count !== undefined && (
                <div className="text-xs text-gray-500">
                  Used {alias.match_count} time{alias.match_count !== 1 ? 's' : ''}
                </div>
              )}
              {alias.source_system && (
                <div className="text-xs text-gray-500">
                  Source: {getSourceLabel(alias.source_system)}
                </div>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return (
    <div
      className={`border rounded-lg p-3 ${
        alias.is_authoritative
          ? 'bg-white border-gray-200'
          : 'bg-gray-50 border-gray-300 opacity-75'
      } ${className}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center gap-2 mb-2">
            <span className="font-medium truncate">{alias.alias}</span>
            <Badge
              variant={alias.is_authoritative ? "default" : "secondary"}
              className="text-xs"
            >
              {alias.is_authoritative ? (
                <CheckCircle2 className="h-3 w-3 mr-1" />
              ) : (
                <AlertCircle className="h-3 w-3 mr-1" />
              )}
              {alias.is_authoritative ? 'Active' : 'Inactive'}
            </Badge>
            {alias.match_count !== undefined && alias.match_count > 0 && (
              <Badge variant="outline" className="text-xs gap-1">
                <TrendingUp className="h-3 w-3" />
                <span className={getConfidenceColor(alias.match_count)}>
                  {getConfidenceLabel(alias.match_count)}
                </span>
              </Badge>
            )}
          </div>

          {/* Usage Stats */}
          {alias.match_count !== undefined && (
            <div className="flex items-center gap-2 text-xs text-gray-600 mb-2">
              <div className="flex items-center gap-1">
                <TrendingUp className="h-3 w-3" />
                <span>{alias.match_count} match{alias.match_count !== 1 ? 'es' : ''}</span>
              </div>
              {alias.last_used_at && (
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  <span>{formatLastUsed(alias.last_used_at)}</span>
                </div>
              )}
            </div>
          )}

          {/* Provenance */}
          <div className="flex items-center gap-3 text-xs text-gray-500 mb-2">
            <div className="flex items-center gap-1">
              {getSourceIcon(alias.source_system)}
              <span>{getSourceLabel(alias.source_system)}</span>
            </div>
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              <span>Created {formatDate(alias.created_at)}</span>
            </div>
            {alias.created_by && (
              <div className="flex items-center gap-1">
                <User className="h-3 w-3" />
                <span>By {alias.created_by}</span>
              </div>
            )}
          </div>

          {/* Notes */}
          {alias.notes && (
            <div className="text-sm text-gray-600 mb-2">
              {alias.notes}
            </div>
          )}

          {/* Additional Details (when showFullDetails is true) */}
          {showFullDetails && (
            <div className="space-y-1 mt-3 pt-3 border-t border-gray-200">
              <div className="text-xs text-gray-500">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="font-medium">Normalized:</span>
                    <div className="font-mono bg-gray-100 px-1 py-0.5 rounded mt-1">
                      {alias.alias_normalized}
                    </div>
                  </div>
                  {alias.source_identifier && (
                    <div>
                      <span className="font-medium">Source ID:</span>
                      <div className="bg-gray-100 px-1 py-0.5 rounded mt-1 truncate">
                        {alias.source_identifier}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              {alias.collected_at && (
                <div className="text-xs text-gray-500">
                  <span className="font-medium">Collected:</span> {formatDate(alias.collected_at)}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 ml-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {onView && (
                <DropdownMenuItem onClick={() => onView(alias)}>
                  <Eye className="h-4 w-4 mr-2" />
                  View Details
                </DropdownMenuItem>
              )}
              {onEdit && (
                <DropdownMenuItem onClick={() => onEdit(alias)}>
                  <Edit2 className="h-4 w-4 mr-2" />
                  Edit
                </DropdownMenuItem>
              )}
              {onToggleStatus && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => onToggleStatus(alias)}>
                    {alias.is_authoritative ? (
                      <>
                        <AlertCircle className="h-4 w-4 mr-2" />
                        Deactivate
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        Activate
                      </>
                    )}
                  </DropdownMenuItem>
                </>
              )}
              {onDelete && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => onDelete(alias)}
                    className="text-red-600 focus:text-red-600"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  )
}

// List component for displaying multiple aliases
interface AliasListProps {
  aliases: EmployerAlias[]
  loading?: boolean
  emptyMessage?: string
  onEdit?: (alias: EmployerAlias) => void
  onDelete?: (alias: EmployerAlias) => void
  onView?: (alias: EmployerAlias) => void
  onToggleStatus?: (alias: EmployerAlias) => void
  showFullDetails?: boolean
  compact?: boolean
}

export function AliasList({
  aliases,
  loading = false,
  emptyMessage = "No aliases found",
  onEdit,
  onDelete,
  onView,
  onToggleStatus,
  showFullDetails = false,
  compact = false
}: AliasListProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-sm text-gray-500">Loading aliases...</div>
      </div>
    )
  }

  if (aliases.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="text-gray-400 mb-2">
          <Database className="h-12 w-12 mx-auto" />
        </div>
        <p className="text-gray-500">{emptyMessage}</p>
      </div>
    )
  }

  if (compact) {
    return (
      <div className="flex flex-wrap gap-2">
        {aliases.map((alias) => (
          <AliasDisplay
            key={alias.id}
            alias={alias}
            compact
            onEdit={onEdit}
            onDelete={onDelete}
            onView={onView}
            onToggleStatus={onToggleStatus}
          />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {aliases.map((alias) => (
        <AliasDisplay
          key={alias.id}
          alias={alias}
          showFullDetails={showFullDetails}
          onEdit={onEdit}
          onDelete={onDelete}
          onView={onView}
          onToggleStatus={onToggleStatus}
        />
      ))}
    </div>
  )
}