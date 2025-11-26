"use client"

import { useState, useEffect, useRef, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'
import { WizardButton } from '../shared/WizardButton'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { ContactActions } from '@/components/ui/ContactActions'
import { 
  User, 
  Phone, 
  Mail, 
  Loader2,
  CheckCircle,
  AlertCircle,
} from 'lucide-react'

interface ContactsViewProps {
  projectId: string
  mainJobSiteId?: string | null
}

// The 4 fixed roles that match the mapping sheet
type RoleKey = "project_manager" | "site_manager" | "site_delegate" | "site_hsr"

const ROLE_LABELS: Record<RoleKey, string> = {
  project_manager: "Project Manager",
  site_manager: "Site Manager",
  site_delegate: "Site Delegate",
  site_hsr: "Site HSR",
}

const FIXED_ROLES: RoleKey[] = ["project_manager", "site_manager", "site_delegate", "site_hsr"]

type ContactRow = {
  id?: string
  role: RoleKey
  name: string
  email: string
  phone: string
}

export function ContactsView({ projectId, mainJobSiteId }: ContactsViewProps) {
  const queryClient = useQueryClient()
  const [rows, setRows] = useState<Record<RoleKey, ContactRow>>({
    project_manager: { role: "project_manager", name: "", email: "", phone: "" },
    site_manager: { role: "site_manager", name: "", email: "", phone: "" },
    site_delegate: { role: "site_delegate", name: "", email: "", phone: "" },
    site_hsr: { role: "site_hsr", name: "", email: "", phone: "" },
  })
  const [saving, setSaving] = useState<RoleKey | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Get the effective site ID
  const { data: effectiveSiteId, isLoading: loadingSiteId } = useQuery({
    queryKey: ['wizard-effective-site', projectId, mainJobSiteId],
    queryFn: async () => {
      if (mainJobSiteId) return mainJobSiteId
      
      const { data } = await supabase
        .from('job_sites')
        .select('id')
        .eq('project_id', projectId)
        .limit(1)
        .maybeSingle()
      
      return data?.id || null
    },
  })

  // Load existing contacts
  useEffect(() => {
    const load = async () => {
      if (!effectiveSiteId) return
      
      const { data, error } = await supabase
        .from("site_contacts")
        .select("id, role, name, email, phone")
        .eq("job_site_id", effectiveSiteId)
      
      if (error) {
        toast.error(error.message)
        return
      }
      
      const map = { ...rows } as Record<RoleKey, ContactRow>
      ;(data || []).forEach((r: any) => {
        const key = r.role as RoleKey
        if (FIXED_ROLES.includes(key)) {
          map[key] = {
            id: r.id as string,
            role: key,
            name: r.name || "",
            email: r.email || "",
            phone: r.phone || "",
          }
        }
      })
      setRows(map)
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveSiteId])

  // Persist changes with debounce
  const persist = useCallback(async (role: RoleKey, patch: Partial<ContactRow>) => {
    if (!effectiveSiteId) return
    
    setSaving(role)
    const row = rows[role]
    const updatedRow = { ...row, ...patch }
    
    try {
      if (row.id) {
        // Update existing
        const { error } = await supabase
          .from("site_contacts")
          .update({
            name: updatedRow.name || null,
            email: updatedRow.email || null,
            phone: updatedRow.phone || null,
          })
          .eq("id", row.id)
        
        if (error) throw error
      } else if (updatedRow.name || updatedRow.email || updatedRow.phone) {
        // Insert new only if there's some data
        const { data, error } = await supabase
          .from("site_contacts")
          .insert({
            job_site_id: effectiveSiteId,
            role,
            name: updatedRow.name || null,
            email: updatedRow.email || null,
            phone: updatedRow.phone || null,
          })
          .select("id")
          .single()
        
        if (error) throw error
        
        // Update local state with new ID
        setRows(prev => ({
          ...prev,
          [role]: { ...updatedRow, id: data.id }
        }))
      }
      
      queryClient.invalidateQueries({ queryKey: ['wizard-site-contacts', projectId] })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save contact')
    } finally {
      setSaving(null)
    }
  }, [effectiveSiteId, rows, queryClient, projectId])

  // Handle field change with debounce
  const handleFieldChange = (role: RoleKey, field: 'name' | 'email' | 'phone', value: string) => {
    // Update local state immediately
    setRows(prev => ({
      ...prev,
      [role]: { ...prev[role], [field]: value }
    }))
    
    // Debounce the persist
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      persist(role, { [field]: value })
    }, 800)
  }

  const isLoading = loadingSiteId

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    )
  }

  if (!effectiveSiteId) {
    return (
      <div className="p-4 text-center py-12">
        <AlertCircle className="h-12 w-12 text-amber-500 mx-auto mb-3" />
        <p className="text-gray-600 font-medium">No job site found</p>
        <p className="text-sm text-gray-500 mt-1">
          This project doesn&apos;t have a job site configured yet.
        </p>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4 pb-safe-bottom">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">
          Site Contacts
        </h2>
        {saving && (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Saving...
          </div>
        )}
      </div>

      {/* Fixed Role Cards */}
      <div className="space-y-3">
        {FIXED_ROLES.map((role) => {
          const row = rows[role]
          const hasData = row.name || row.email || row.phone
          
          return (
            <div 
              key={role}
              className={cn(
                "bg-white rounded-xl border p-4",
                hasData ? "border-gray-200" : "border-dashed border-gray-300"
              )}
            >
              {/* Role header */}
              <div className="flex items-center gap-2 mb-3">
                <span className={cn(
                  "px-2.5 py-1 rounded-full text-xs font-semibold",
                  hasData 
                    ? "bg-blue-100 text-blue-700" 
                    : "bg-gray-100 text-gray-500"
                )}>
                  {ROLE_LABELS[role]}
                </span>
                {hasData && row.id && (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                )}
              </div>

              {/* Contact fields */}
              <div className="space-y-3">
                {/* Name */}
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Name
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      type="text"
                      value={row.name}
                      onChange={(e) => handleFieldChange(role, 'name', e.target.value)}
                      placeholder={`Enter ${ROLE_LABELS[role].toLowerCase()} name`}
                      className="pl-10 h-12 text-base"
                    />
                  </div>
                </div>

                {/* Phone */}
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Phone
                  </label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        type="tel"
                        value={row.phone}
                        onChange={(e) => handleFieldChange(role, 'phone', e.target.value)}
                        placeholder="Enter phone number"
                        className="pl-10 h-12 text-base"
                      />
                    </div>
                    {row.phone && (
                      <a
                        href={`tel:${row.phone}`}
                        className={cn(
                          "flex items-center justify-center w-12 h-12",
                          "bg-green-500 text-white rounded-xl",
                          "hover:bg-green-600 active:bg-green-700 transition-colors"
                        )}
                      >
                        <Phone className="h-5 w-5" />
                      </a>
                    )}
                  </div>
                </div>

                {/* Email */}
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Email
                  </label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        type="email"
                        value={row.email}
                        onChange={(e) => handleFieldChange(role, 'email', e.target.value)}
                        placeholder="Enter email address"
                        className="pl-10 h-12 text-base"
                      />
                    </div>
                    {row.email && (
                      <a
                        href={`mailto:${row.email}`}
                        className={cn(
                          "flex items-center justify-center w-12 h-12",
                          "bg-blue-500 text-white rounded-xl",
                          "hover:bg-blue-600 active:bg-blue-700 transition-colors"
                        )}
                      >
                        <Mail className="h-5 w-5" />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Summary */}
      <div className="bg-gray-50 rounded-xl p-4 mt-6">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">Contacts filled:</span>
          <span className="font-semibold text-gray-900">
            {FIXED_ROLES.filter(role => rows[role].name || rows[role].phone || rows[role].email).length} / {FIXED_ROLES.length}
          </span>
        </div>
      </div>
    </div>
  )
}
