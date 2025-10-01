"use client"

import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Building2, AlertCircle, Plus, Search } from 'lucide-react'
import { supabase } from '@/integrations/supabase/client'
import { ConfidenceIndicator } from './ConfidenceIndicator'
import { EmployerMatchDialog } from './EmployerMatchDialog'
import { findBestEmployerMatch } from '@/utils/fuzzyMatching'

interface SubcontractorsReviewProps {
  extractedSubcontractors: Array<{
    stage: string
    trade: string
    company?: string
    eba?: boolean
  }>
  projectId: string
  confidence: number[]
  onDecisionsChange: (decisions: any[]) => void
}

const STAGE_LABELS: Record<string, string> = {
  early_works: 'Early Works',
  structure: 'Structure',
  finishing: 'Finishing',
  other: 'Other',
}

export function SubcontractorsReview({
  extractedSubcontractors,
  projectId,
  confidence,
  onDecisionsChange,
}: SubcontractorsReviewProps) {
  const [decisions, setDecisions] = useState<any[]>([])
  const [matchDialogOpen, setMatchDialogOpen] = useState(false)
  const [selectedSubcontractor, setSelectedSubcontractor] = useState<any>(null)

  // Fetch all employers for matching
  const { data: allEmployers = [] } = useQuery({
    queryKey: ['employers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('employers')
        .select('id, name, enterprise_agreement_status')
        .order('name')

      if (error) throw error
      return data || []
    },
  })

  // Initialize decisions with fuzzy matching
  useEffect(() => {
    const initial = extractedSubcontractors.map((sub, index) => {
      if (!sub.company) {
        return {
          ...sub,
          action: 'skip',
          matchedEmployer: null,
          matchConfidence: 0,
          confidence: confidence[index] || 0,
        }
      }

      // Attempt fuzzy match
      const match = findBestEmployerMatch(sub.company, allEmployers)

      return {
        ...sub,
        action: match && match.confidence === 'exact' ? 'import' : 'review',
        matchedEmployer: match || null,
        matchConfidence: match ? (match.confidence === 'exact' ? 1.0 : match.confidence === 'high' ? 0.8 : 0.6) : 0,
        confidence: confidence[index] || 0,
        needsReview: !match || match.confidence !== 'exact',
      }
    })
    setDecisions(initial)
  }, [extractedSubcontractors, allEmployers, confidence])

  // Notify parent
  useEffect(() => {
    onDecisionsChange(decisions.filter(d => d.action === 'import' && d.matchedEmployer))
  }, [decisions, onDecisionsChange])

  const handleToggle = (index: number) => {
    setDecisions(prev => {
      const updated = [...prev]
      updated[index].action = updated[index].action === 'import' ? 'skip' : 'import'
      return updated
    })
  }

  const handleOpenMatchDialog = (index: number) => {
    setSelectedSubcontractor({ ...decisions[index], index })
    setMatchDialogOpen(true)
  }

  const handleMatchConfirm = (employerId: string, employerName: string, isNewEmployer: boolean) => {
    if (selectedSubcontractor === null) return

    setDecisions(prev => {
      const updated = [...prev]
      updated[selectedSubcontractor.index] = {
        ...updated[selectedSubcontractor.index],
        action: 'import',
        matchedEmployer: {
          id: employerId,
          name: employerName,
          confidence: 'exact',
        },
        matchConfidence: 1.0,
        isNewEmployer,
        needsReview: false,
      }
      return updated
    })

    setMatchDialogOpen(false)
    setSelectedSubcontractor(null)
  }

  const needsReviewCount = decisions.filter(d => d.needsReview).length

  return (
    <div className="space-y-4">
      {needsReviewCount > 0 && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {needsReviewCount} subcontractor{needsReviewCount > 1 ? 's' : ''} need manual employer matching review.
            Click "Review Match" to confirm or change the suggested employer.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Subcontractors</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">Import</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead>Trade</TableHead>
                  <TableHead>Scanned Company</TableHead>
                  <TableHead>Matched Employer</TableHead>
                  <TableHead>EBA</TableHead>
                  <TableHead className="w-24">Confidence</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {decisions.map((decision, index) => (
                  <TableRow key={index} className={decision.needsReview ? 'bg-yellow-50' : ''}>
                    <TableCell>
                      <Checkbox
                        checked={decision.action === 'import'}
                        onCheckedChange={() => handleToggle(index)}
                        disabled={!decision.matchedEmployer}
                      />
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {STAGE_LABELS[decision.stage] || decision.stage}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">{decision.trade}</TableCell>
                    <TableCell>
                      {decision.company || <span className="text-gray-400">—</span>}
                    </TableCell>
                    <TableCell>
                      {decision.matchedEmployer ? (
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-gray-400" />
                          <span>{decision.matchedEmployer.name}</span>
                          {decision.isNewEmployer && (
                            <Badge variant="secondary" className="text-xs">New</Badge>
                          )}
                        </div>
                      ) : decision.company ? (
                        <span className="text-orange-600 text-sm">No match found</span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {decision.eba !== null && decision.eba !== undefined ? (
                        <Badge variant={decision.eba ? 'default' : 'secondary'}>
                          {decision.eba ? 'Yes' : 'No'}
                        </Badge>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <ConfidenceIndicator confidence={decision.confidence} size="sm" />
                    </TableCell>
                    <TableCell>
                      {decision.company && (
                        <Button
                          variant={decision.needsReview ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => handleOpenMatchDialog(index)}
                        >
                          {decision.needsReview ? (
                            <>
                              <AlertCircle className="h-3 w-3 mr-1" />
                              Review Match
                            </>
                          ) : (
                            <>
                              <Search className="h-3 w-3 mr-1" />
                              Change
                            </>
                          )}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Employer Match Dialog */}
      {matchDialogOpen && selectedSubcontractor && (
        <EmployerMatchDialog
          open={matchDialogOpen}
          onOpenChange={setMatchDialogOpen}
          companyName={selectedSubcontractor.company}
          suggestedMatch={selectedSubcontractor.matchedEmployer}
          allEmployers={allEmployers}
          onConfirm={handleMatchConfirm}
        />
      )}
    </div>
  )
}
