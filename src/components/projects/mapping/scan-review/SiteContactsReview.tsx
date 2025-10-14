"use client"

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { ConfidenceIndicator } from './ConfidenceIndicator'

interface SiteContactsReviewProps {
  extractedContacts: Array<{
    role: string
    name?: string
    email?: string
    phone?: string
  }>
  existingContacts: Array<{
    id: string
    role: string
    name: string
    email?: string
    phone?: string
  }>
  confidence: number[]
  onDecisionsChange: (decisions: any[]) => void
  allowProjectCreation?: boolean
}

const ROLE_LABELS: Record<string, string> = {
  project_manager: 'Project Manager',
  site_manager: 'Site Manager',
  site_delegate: 'Site Delegate',
  site_hsr: 'Site HSR',
}

export function SiteContactsReview({
  extractedContacts,
  existingContacts,
  confidence,
  onDecisionsChange,
  allowProjectCreation = false,
}: SiteContactsReviewProps) {
  const [decisions, setDecisions] = useState<any[]>([])

  // Initialize decisions
  useEffect(() => {
    const initial = extractedContacts.map((extracted, index) => {
      const existing = existingContacts.find(e => e.role === extracted.role)
      
      // Determine if we should update
      const hasNewData = !!(extracted.name || extracted.email || extracted.phone)
      const shouldUpdate = hasNewData && (!existing || !existing.name)

      return {
        role: extracted.role,
        action: shouldUpdate ? 'update' : 'skip',
        name: shouldUpdate ? extracted.name ?? '' : existing?.name ?? '',
        email: shouldUpdate ? extracted.email ?? '' : existing?.email ?? '',
        phone: shouldUpdate ? extracted.phone ?? '' : existing?.phone ?? '',
        existingId: existing?.id || null,
        confidence: confidence[index] || 0,
      }
    })
    setDecisions(initial)
  }, [extractedContacts, existingContacts, confidence])

  // Notify parent
  useEffect(() => {
    onDecisionsChange(decisions.filter(d => d.action === 'update'))
  }, [decisions, onDecisionsChange])

  const handleToggle = (index: number) => {
    setDecisions(prev => {
      const updated = [...prev]
      updated[index].action = updated[index].action === 'update' ? 'skip' : 'update'
      return updated
    })
  }

  const handleFieldChange = (index: number, field: string, value: string) => {
    setDecisions(prev => {
      const updated = [...prev]
      updated[index][field] = value
      return updated
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Site Contacts</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">Import</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead className="w-24">Confidence</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {decisions.map((decision, index) => {
              const extracted = extractedContacts[index]
              const existing = existingContacts.find(e => e.role === decision.role)

              return (
                <TableRow key={decision.role}>
                  <TableCell>
                    <Checkbox
                      checked={decision.action === 'update'}
                      onCheckedChange={() => handleToggle(index)}
                    />
                  </TableCell>
                  <TableCell className="font-medium">
                    {ROLE_LABELS[decision.role] || decision.role}
                  </TableCell>
                  <TableCell>
                    {decision.action === 'update' ? (
                      <Input
                        value={decision.name ?? ''}
                        onChange={(e) => handleFieldChange(index, 'name', e.target.value)}
                        placeholder="Name"
                        className="min-w-[200px]"
                      />
                    ) : (
                      <span className="text-gray-600">
                        {existing?.name || '—'}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {decision.action === 'update' ? (
                      <Input
                        type="email"
                        value={decision.email ?? ''}
                        onChange={(e) => handleFieldChange(index, 'email', e.target.value)}
                        placeholder="Email"
                        className="min-w-[200px]"
                      />
                    ) : (
                      <span className="text-gray-600">
                        {existing?.email || '—'}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {decision.action === 'update' ? (
                      <Input
                        value={decision.phone ?? ''}
                        onChange={(e) => handleFieldChange(index, 'phone', e.target.value)}
                        placeholder="Phone"
                        className="min-w-[160px]"
                      />
                    ) : (
                      <span className="text-gray-600">
                        {existing?.phone || '—'}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <ConfidenceIndicator confidence={decision.confidence} size="sm" />
                  </TableCell>
                  <TableCell>
                    {decision.action === 'update' ? (
                      <Badge variant="default">Will update</Badge>
                    ) : existing ? (
                      <Badge variant="outline">Keep existing</Badge>
                    ) : (
                      <Badge variant="secondary">Skip</Badge>
                    )}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
