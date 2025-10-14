"use client"

import { useState } from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { AlertTriangle, ExternalLink, Building2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useNavigationLoading } from '@/hooks/useNavigationLoading'

interface ProjectMatch {
  id: string
  name: string
  approval_status: 'active' | 'pending' | 'rejected'
  value: number | null
  address: string | null
  builder_name: string | null
  created_at: string
  match_type: 'exact' | 'fuzzy'
  similarity_score?: number
}

interface DuplicateCheckResult {
  has_exact_matches: boolean
  has_fuzzy_matches: boolean
  exact_matches: ProjectMatch[]
  fuzzy_matches: ProjectMatch[]
  searched_name: string
}

interface DuplicateProjectWarningProps {
  duplicateCheck: DuplicateCheckResult
  onLinkToProject: (projectId: string) => void
  onProceedAnyway: () => void
  showDialog?: boolean
}

export function DuplicateProjectWarning({
  duplicateCheck,
  onLinkToProject,
  onProceedAnyway,
  showDialog = false,
}: DuplicateProjectWarningProps) {
  const router = useRouter()
  const { startNavigation } = useNavigationLoading()
  const [isDialogOpen, setIsDialogOpen] = useState(showDialog)

  const matches = duplicateCheck.has_exact_matches
    ? duplicateCheck.exact_matches
    : duplicateCheck.fuzzy_matches

  const matchType = duplicateCheck.has_exact_matches ? 'exact' : 'similar'

  const handleViewProject = (projectId: string) => {
    startNavigation(`/projects/${projectId}`)
    setTimeout(() => router.push(`/projects/${projectId}`), 50)
  }

  const formatValue = (value: number | null) => {
    if (!value) return 'N/A'
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
      maximumFractionDigits: 0,
    }).format(value)
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-AU', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  if (matches.length === 0) return null

  return (
    <>
      {/* Inline Alert */}
      <Alert className="border-orange-500 bg-orange-50">
        <AlertTriangle className="h-4 w-4 text-orange-600" />
        <AlertTitle className="text-orange-900">
          {duplicateCheck.has_exact_matches
            ? 'Exact Match Found'
            : 'Similar Projects Found'}
        </AlertTitle>
        <AlertDescription className="text-orange-800">
          {duplicateCheck.has_exact_matches ? (
            <>
              A project with this exact name already exists. Consider linking to
              the existing project instead of creating a duplicate.
            </>
          ) : (
            <>
              We found {matches.length} project{matches.length > 1 ? 's' : ''}{' '}
              with similar names. Please review to avoid creating a duplicate.
            </>
          )}
          <Button
            variant="link"
            className="h-auto p-0 ml-2 text-orange-700 font-semibold"
            onClick={() => setIsDialogOpen(true)}
          >
            Review matches →
          </Button>
        </AlertDescription>
      </Alert>

      {/* Detailed Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-600" />
              {matchType === 'exact'
                ? 'Exact Project Name Match'
                : 'Similar Projects Found'}
            </DialogTitle>
            <DialogDescription>
              {matchType === 'exact' ? (
                <>
                  A project with the name &quot;{duplicateCheck.searched_name}&quot; already
                  exists. You can link this scan to the existing project or proceed
                  with creating a new one.
                </>
              ) : (
                <>
                  We found {matches.length} project{matches.length > 1 ? 's' : ''}{' '}
                  with similar names. Review them to decide if you want to link to
                  an existing project or create a new one.
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-4">
            {matches.map((match) => (
              <Card key={match.id} className="border-2">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-lg">{match.name}</h3>
                        <Badge
                          variant={
                            match.approval_status === 'active'
                              ? 'default'
                              : match.approval_status === 'pending'
                              ? 'secondary'
                              : 'outline'
                          }
                        >
                          {match.approval_status}
                        </Badge>
                        {match.match_type === 'fuzzy' && match.similarity_score && (
                          <Badge variant="outline">
                            {Math.round(match.similarity_score * 100)}% match
                          </Badge>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-gray-600">
                        {match.value && (
                          <div>
                            <span className="font-medium">Value:</span>{' '}
                            {formatValue(match.value)}
                          </div>
                        )}
                        {match.builder_name && (
                          <div>
                            <span className="font-medium">Builder:</span>{' '}
                            {match.builder_name}
                          </div>
                        )}
                        {match.address && (
                          <div className="col-span-2">
                            <span className="font-medium">Address:</span>{' '}
                            {match.address}
                          </div>
                        )}
                        <div>
                          <span className="font-medium">Created:</span>{' '}
                          {formatDate(match.created_at)}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleViewProject(match.id)}
                      >
                        <ExternalLink className="h-3 w-3 mr-1" />
                        View
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => {
                          onLinkToProject(match.id)
                          setIsDialogOpen(false)
                        }}
                      >
                        <Building2 className="h-3 w-3 mr-1" />
                        Link to This
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <DialogFooter className="flex items-center justify-between">
            <p className="text-sm text-gray-600">
              {matchType === 'exact'
                ? 'Creating a duplicate may cause confusion.'
                : 'If none match, you can proceed with creating a new project.'}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  onProceedAnyway()
                  setIsDialogOpen(false)
                }}
              >
                Create New Project Anyway
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
