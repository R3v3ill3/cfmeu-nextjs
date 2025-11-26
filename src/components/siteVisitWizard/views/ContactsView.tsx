"use client"

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useToast } from '@/hooks/use-toast'
import { WizardButton } from '../shared/WizardButton'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select'
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { 
  User, 
  Phone, 
  Mail, 
  Plus, 
  Pencil,
  Loader2,
  ExternalLink,
} from 'lucide-react'

interface ContactsViewProps {
  projectId: string
  mainJobSiteId?: string | null
}

interface SiteContact {
  id: string
  name: string
  role: string
  phone: string | null
  email: string | null
  notes: string | null
}

const CONTACT_ROLES = [
  { value: 'project_manager', label: 'Project Manager' },
  { value: 'site_manager', label: 'Site Manager' },
  { value: 'site_delegate', label: 'Site Delegate' },
  { value: 'site_hsr', label: 'Site HSR' },
  { value: 'foreman', label: 'Foreman' },
  { value: 'other', label: 'Other' },
]

export function ContactsView({ projectId, mainJobSiteId }: ContactsViewProps) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [editingContact, setEditingContact] = useState<SiteContact | null>(null)
  
  // Fetch contacts
  const { data: contacts = [], isLoading } = useQuery({
    queryKey: ['wizard-site-contacts', projectId, mainJobSiteId],
    queryFn: async () => {
      // Get job site IDs for this project
      const { data: sites } = await supabase
        .from('job_sites')
        .select('id')
        .eq('project_id', projectId)
      
      const siteIds = sites?.map(s => s.id) || []
      if (siteIds.length === 0) return []
      
      const { data, error } = await supabase
        .from('site_contacts')
        .select('id, name, role, phone, email, notes')
        .in('job_site_id', siteIds)
        .order('role', { ascending: true })
      
      if (error) throw error
      return (data || []) as SiteContact[]
    },
    staleTime: 30000,
  })
  
  // Get the primary job site ID
  const { data: primarySiteId } = useQuery({
    queryKey: ['wizard-primary-site', projectId, mainJobSiteId],
    queryFn: async () => {
      if (mainJobSiteId) return mainJobSiteId
      
      const { data } = await supabase
        .from('job_sites')
        .select('id')
        .eq('project_id', projectId)
        .limit(1)
        .single()
      
      return data?.id || null
    },
    enabled: !mainJobSiteId,
  })
  
  const effectiveSiteId = mainJobSiteId || primarySiteId
  
  // Add/update contact mutation
  const contactMutation = useMutation({
    mutationFn: async (contact: {
      id?: string
      name: string
      role: string
      phone?: string
      email?: string
      notes?: string
    }) => {
      if (!effectiveSiteId) throw new Error('No job site found')
      
      if (contact.id) {
        // Update
        const { error } = await supabase
          .from('site_contacts')
          .update({
            name: contact.name,
            role: contact.role,
            phone: contact.phone || null,
            email: contact.email || null,
            notes: contact.notes || null,
          })
          .eq('id', contact.id)
        
        if (error) throw error
      } else {
        // Insert
        const { error } = await supabase
          .from('site_contacts')
          .insert({
            job_site_id: effectiveSiteId,
            name: contact.name,
            role: contact.role,
            phone: contact.phone || null,
            email: contact.email || null,
            notes: contact.notes || null,
          })
        
        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wizard-site-contacts', projectId] })
      toast({
        title: editingContact ? 'Contact updated' : 'Contact added',
        description: 'Site contact has been saved.',
      })
      setShowAddDialog(false)
      setEditingContact(null)
    },
    onError: (error) => {
      toast({
        title: 'Error saving contact',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      })
    },
  })
  
  const getRoleLabel = (role: string) => {
    return CONTACT_ROLES.find(r => r.value === role)?.label || role
  }
  
  const handleCall = (phone: string) => {
    window.location.href = `tel:${phone}`
  }
  
  const handleEmail = (email: string) => {
    window.location.href = `mailto:${email}`
  }
  
  return (
    <div className="p-4 space-y-4 pb-safe-bottom">
      {/* Header with add button */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">
          Site Contacts ({contacts.length})
        </h2>
        <WizardButton
          variant="primary"
          size="sm"
          onClick={() => setShowAddDialog(true)}
          icon={<Plus className="h-4 w-4" />}
        >
          Add Contact
        </WizardButton>
      </div>
      
      {/* Contacts list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : contacts.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <User className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No contacts yet</p>
          <p className="text-sm text-gray-400 mt-1">
            Add site contacts to track key people
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {contacts.map((contact) => (
            <div 
              key={contact.id}
              className="bg-white rounded-xl border border-gray-200 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-gray-900 truncate">
                      {contact.name}
                    </h3>
                    <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs font-medium rounded-full">
                      {getRoleLabel(contact.role)}
                    </span>
                  </div>
                  
                  {/* Contact actions */}
                  <div className="flex flex-wrap gap-2 mt-3">
                    {contact.phone && (
                      <button
                        onClick={() => handleCall(contact.phone!)}
                        className={cn(
                          'inline-flex items-center gap-1.5 px-3 py-2',
                          'bg-green-50 text-green-700 rounded-lg text-sm font-medium',
                          'hover:bg-green-100 active:bg-green-200 transition-colors'
                        )}
                      >
                        <Phone className="h-4 w-4" />
                        {contact.phone}
                      </button>
                    )}
                    {contact.email && (
                      <button
                        onClick={() => handleEmail(contact.email!)}
                        className={cn(
                          'inline-flex items-center gap-1.5 px-3 py-2',
                          'bg-blue-50 text-blue-700 rounded-lg text-sm font-medium',
                          'hover:bg-blue-100 active:bg-blue-200 transition-colors'
                        )}
                      >
                        <Mail className="h-4 w-4" />
                        Email
                      </button>
                    )}
                  </div>
                  
                  {contact.notes && (
                    <p className="text-sm text-gray-500 mt-2">
                      {contact.notes}
                    </p>
                  )}
                </div>
                
                <button
                  onClick={() => {
                    setEditingContact(contact)
                    setShowAddDialog(true)
                  }}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <Pencil className="h-4 w-4 text-gray-500" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      
      {/* Add/Edit Contact Dialog */}
      <ContactFormDialog
        open={showAddDialog}
        onOpenChange={(open) => {
          setShowAddDialog(open)
          if (!open) setEditingContact(null)
        }}
        contact={editingContact}
        onSubmit={(data) => contactMutation.mutate(data)}
        isSubmitting={contactMutation.isPending}
      />
    </div>
  )
}

// Contact form dialog
function ContactFormDialog({
  open,
  onOpenChange,
  contact,
  onSubmit,
  isSubmitting,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  contact: SiteContact | null
  onSubmit: (data: {
    id?: string
    name: string
    role: string
    phone?: string
    email?: string
    notes?: string
  }) => void
  isSubmitting: boolean
}) {
  const [name, setName] = useState(contact?.name || '')
  const [role, setRole] = useState(contact?.role || 'site_manager')
  const [phone, setPhone] = useState(contact?.phone || '')
  const [email, setEmail] = useState(contact?.email || '')
  const [notes, setNotes] = useState(contact?.notes || '')
  
  // Reset form when contact changes
  useState(() => {
    if (contact) {
      setName(contact.name)
      setRole(contact.role)
      setPhone(contact.phone || '')
      setEmail(contact.email || '')
      setNotes(contact.notes || '')
    } else {
      setName('')
      setRole('site_manager')
      setPhone('')
      setEmail('')
      setNotes('')
    }
  })
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    
    onSubmit({
      id: contact?.id,
      name: name.trim(),
      role,
      phone: phone.trim() || undefined,
      email: email.trim() || undefined,
      notes: notes.trim() || undefined,
    })
  }
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg mx-4">
        <DialogHeader>
          <DialogTitle>
            {contact ? 'Edit Contact' : 'Add Contact'}
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="contact-name">Name *</Label>
            <Input
              id="contact-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter name"
              required
              className="h-12"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="contact-role">Role *</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger id="contact-role" className="h-12">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CONTACT_ROLES.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="contact-phone">Phone</Label>
            <Input
              id="contact-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Enter phone number"
              className="h-12"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="contact-email">Email</Label>
            <Input
              id="contact-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter email address"
              className="h-12"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="contact-notes">Notes</Label>
            <Textarea
              id="contact-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any notes..."
              rows={3}
            />
          </div>
          
          <div className="flex gap-3 pt-2">
            <WizardButton
              type="button"
              variant="outline"
              size="md"
              fullWidth
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </WizardButton>
            <WizardButton
              type="submit"
              variant="primary"
              size="md"
              fullWidth
              loading={isSubmitting}
              disabled={!name.trim()}
            >
              {contact ? 'Save Changes' : 'Add Contact'}
            </WizardButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

