"use client"

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ConfidenceIndicator } from './ConfidenceIndicator'
import { Plus, Edit2, X } from 'lucide-react'
import { SITE_CONTACT_ROLES } from '@/utils/siteContactRole'

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

type ContactDecision = {
  role: string
  action: 'update' | 'skip' | 'edit'
  name: string
  email: string
  phone: string
  existingId: string | null
  confidence: number
  isEditing: boolean
  isNew?: boolean
}

export function SiteContactsReview({
  extractedContacts,
  existingContacts,
  confidence,
  onDecisionsChange,
  allowProjectCreation = false,
}: SiteContactsReviewProps) {
  const [decisions, setDecisions] = useState<ContactDecision[]>([])
  const [showAddContact, setShowAddContact] = useState(false)
  const [newContactRole, setNewContactRole] = useState<string>('')

  // Initialize decisions - include all existing contacts and extracted contacts
  useEffect(() => {
    const allRoles = new Set<string>()
    
    // Add all existing contact roles
    existingContacts.forEach(contact => allRoles.add(contact.role))
    
    // Add all extracted contact roles
    extractedContacts.forEach(contact => allRoles.add(contact.role))
    
    // Create decisions for all roles
    const initial: ContactDecision[] = Array.from(allRoles).map(role => {
      const existing = existingContacts.find(e => e.role === role)
      const extractedIndex = extractedContacts.findIndex(e => e.role === role)
      const extracted = extractedIndex >= 0 ? extractedContacts[extractedIndex] : null
      
      // Determine if we should update based on extracted data
      const hasNewData = !!(extracted?.name || extracted?.email || extracted?.phone)
      const shouldUpdate = hasNewData && (!existing || !existing.name)

      return {
        role,
        action: shouldUpdate ? 'update' : 'skip',
        name: shouldUpdate ? (extracted?.name ?? '') : (existing?.name ?? ''),
        email: shouldUpdate ? (extracted?.email ?? '') : (existing?.email ?? ''),
        phone: shouldUpdate ? (extracted?.phone ?? '') : (existing?.phone ?? ''),
        existingId: existing?.id || null,
        confidence: extractedIndex >= 0 ? (confidence[extractedIndex] || 0) : 0,
        isEditing: false,
        isNew: false,
      }
    })
    
    setDecisions(initial)
  }, [extractedContacts, existingContacts, confidence])

  // Notify parent of all decisions that should be applied (update or edit actions)
  useEffect(() => {
    const changes = decisions.filter(d => d.action === 'update' || d.action === 'edit')
    onDecisionsChange(changes)
  }, [decisions, onDecisionsChange])

  const handleToggleImport = (index: number) => {
    setDecisions(prev => {
      const updated = [...prev]
      const decision = updated[index]
      
      if (decision.action === 'update') {
        // Toggle to skip
        updated[index] = {
          ...decision,
          action: 'skip',
          isEditing: false,
        }
      } else {
        // Toggle to update (enable editing)
        updated[index] = {
          ...decision,
          action: 'update',
          isEditing: true,
        }
      }
      
      return updated
    })
  }

  const handleToggleEdit = (index: number) => {
    setDecisions(prev => {
      const updated = [...prev]
      const decision = updated[index]
      
      if (decision.isEditing) {
        // Stop editing - if it was a manual edit, mark as 'edit' action
        updated[index] = {
          ...decision,
          isEditing: false,
          action: decision.action === 'skip' && (decision.name || decision.email || decision.phone) 
            ? 'edit' 
            : decision.action,
        }
      } else {
        // Start editing
        updated[index] = {
          ...decision,
          isEditing: true,
          action: decision.action === 'skip' ? 'edit' : decision.action,
        }
      }
      
      return updated
    })
  }

  const handleFieldChange = (index: number, field: 'name' | 'email' | 'phone', value: string) => {
    setDecisions(prev => {
      const updated = [...prev]
      updated[index] = {
        ...updated[index],
        [field]: value,
        // If manually editing a skipped contact, mark as edit action
        action: updated[index].action === 'skip' ? 'edit' : updated[index].action,
        isEditing: true,
      }
      return updated
    })
  }

  const handleAddContact = () => {
    if (!newContactRole) return
    
    // Check if role already exists
    const existingDecision = decisions.find(d => d.role === newContactRole)
    if (existingDecision) {
      // If exists, just enable editing
      const index = decisions.indexOf(existingDecision)
      handleToggleEdit(index)
      setShowAddContact(false)
      setNewContactRole('')
      return
    }
    
    // Add new contact
    const newDecision: ContactDecision = {
      role: newContactRole,
      action: 'update',
      name: '',
      email: '',
      phone: '',
      existingId: null,
      confidence: 0,
      isEditing: true,
      isNew: true,
    }
    
    setDecisions(prev => [...prev, newDecision])
    setShowAddContact(false)
    setNewContactRole('')
  }

  const handleRemoveContact = (index: number) => {
    setDecisions(prev => {
      const decision = prev[index]
      // If it's a new contact, remove it completely
      if (decision.isNew) {
        return prev.filter((_, i) => i !== index)
      }
      // Otherwise, mark as skip
      return prev.map((d, i) => 
        i === index 
          ? { ...d, action: 'skip', isEditing: false, name: '', email: '', phone: '' }
          : d
      )
    })
  }

  const availableRoles = SITE_CONTACT_ROLES.filter(
    role => !decisions.some(d => d.role === role)
  )

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Site Contacts</CardTitle>
          {availableRoles.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAddContact(true)}
              disabled={showAddContact}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Contact
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {showAddContact && (
          <div className="mb-4 p-4 border rounded-lg bg-gray-50">
            <div className="flex items-center gap-2">
              <Select value={newContactRole} onValueChange={setNewContactRole}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {availableRoles.map(role => (
                    <SelectItem key={role} value={role}>
                      {ROLE_LABELS[role] || role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={handleAddContact} disabled={!newContactRole}>
                Add
              </Button>
              <Button variant="ghost" onClick={() => { setShowAddContact(false); setNewContactRole('') }}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
        
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">Import</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead className="w-24">Confidence</TableHead>
              <TableHead className="w-32">Actions</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {decisions.map((decision, index) => {
              const existing = existingContacts.find(e => e.role === decision.role)
              const isEditable = decision.isEditing || decision.action === 'update'

              return (
                <TableRow key={`${decision.role}-${index}`}>
                  <TableCell>
                    <Checkbox
                      checked={decision.action === 'update'}
                      onCheckedChange={() => handleToggleImport(index)}
                    />
                  </TableCell>
                  <TableCell className="font-medium">
                    {ROLE_LABELS[decision.role] || decision.role}
                  </TableCell>
                  <TableCell>
                    {isEditable ? (
                      <Input
                        value={decision.name ?? ''}
                        onChange={(e) => handleFieldChange(index, 'name', e.target.value)}
                        placeholder="Name"
                        className="min-w-[200px]"
                      />
                    ) : (
                      <span className="text-gray-600">
                        {existing?.name || decision.name || '—'}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {isEditable ? (
                      <Input
                        type="email"
                        value={decision.email ?? ''}
                        onChange={(e) => handleFieldChange(index, 'email', e.target.value)}
                        placeholder="Email"
                        className="min-w-[200px]"
                      />
                    ) : (
                      <span className="text-gray-600">
                        {existing?.email || decision.email || '—'}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {isEditable ? (
                      <Input
                        value={decision.phone ?? ''}
                        onChange={(e) => handleFieldChange(index, 'phone', e.target.value)}
                        placeholder="Phone"
                        className="min-w-[160px]"
                      />
                    ) : (
                      <span className="text-gray-600">
                        {existing?.phone || decision.phone || '—'}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {decision.confidence > 0 && (
                      <ConfidenceIndicator confidence={decision.confidence} size="sm" />
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {!isEditable && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleEdit(index)}
                          title="Edit contact"
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                      )}
                      {decision.isNew && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveContact(index)}
                          title="Remove contact"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {decision.action === 'update' || decision.action === 'edit' ? (
                      <Badge variant="default">
                        {decision.isNew ? 'Will create' : 'Will update'}
                      </Badge>
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
