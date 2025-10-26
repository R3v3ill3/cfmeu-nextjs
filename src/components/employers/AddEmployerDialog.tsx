"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/integrations/supabase/client"
import { Loader2 } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { TradeCapabilitiesSelector } from "./TradeCapabilitiesSelector"

type EmployerType = "builder" | "principal_contractor" | "large_contractor" | "small_contractor" | "individual"
type RoleTag = "builder" | "head_contractor"

interface AddEmployerDialogProps {
  isOpen: boolean
  onClose: () => void
  onEmployerCreated?: (employerId: string) => void
}

export function AddEmployerDialog({ isOpen, onClose, onEmployerCreated }: AddEmployerDialogProps) {
  const { toast } = useToast()
  const [isCreating, setIsCreating] = useState(false)
  const [formData, setFormData] = useState({
    name: "",
    employer_type: "" as EmployerType | "",
    abn: "",
    website: "",
    email: "",
    phone: "",
    estimated_worker_count: "",
    notes: ""
  })
  const [roleTags, setRoleTags] = useState<RoleTag[]>([])
  const [tradeCapabilities, setTradeCapabilities] = useState<string[]>([])

  const handleClose = () => {
    if (!isCreating) {
      setFormData({
        name: "",
        employer_type: "",
        abn: "",
        website: "",
        email: "",
        phone: "",
        estimated_worker_count: "",
        notes: ""
      })
      setRoleTags([])
      setTradeCapabilities([])
      onClose()
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.name.trim()) {
      toast({
        title: "Validation error",
        description: "Employer name is required",
        variant: "destructive"
      })
      return
    }

    if (!formData.employer_type) {
      toast({
        title: "Validation error",
        description: "Employer type is required",
        variant: "destructive"
      })
      return
    }

    setIsCreating(true)

    try {
      const insertData: any = {
        name: formData.name.trim(),
        employer_type: formData.employer_type,
      }

      // Add optional fields only if they have values
      if (formData.abn.trim()) insertData.abn = formData.abn.trim()
      if (formData.website.trim()) insertData.website = formData.website.trim()
      if (formData.email.trim()) insertData.email = formData.email.trim()
      if (formData.phone.trim()) insertData.phone = formData.phone.trim()
      if (formData.estimated_worker_count) {
        const count = parseInt(formData.estimated_worker_count)
        if (!isNaN(count) && count > 0) {
          insertData.estimated_worker_count = count
        }
      }
      if (formData.notes.trim()) insertData.notes = formData.notes.trim()

      const { data, error } = await supabase
        .from("employers")
        .insert(insertData)
        .select("id")
        .single()

      if (error) throw error

      // Save role tags using the categories API
      if (roleTags.length > 0 && data) {
        for (const tag of roleTags) {
          try {
            const response = await fetch(`/api/eba/employers/${data.id}/categories`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ type: 'contractor_role', code: tag })
            })
            if (!response.ok) {
              const errorText = await response.text()
              console.error(`Failed to add role tag ${tag}:`, errorText)
            }
          } catch (error) {
            console.error(`Failed to add role tag ${tag}:`, error)
            // Don't fail the whole operation, just log it
          }
        }
      }

      // Save trade capabilities using the categories API
      if (tradeCapabilities.length > 0 && data) {
        for (const trade of tradeCapabilities) {
          try {
            const response = await fetch(`/api/eba/employers/${data.id}/categories`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ type: 'trade', code: trade })
            })
            if (!response.ok) {
              const errorText = await response.text()
              console.error(`Failed to add trade capability ${trade}:`, errorText)
            }
          } catch (error) {
            console.error(`Failed to add trade capability ${trade}:`, error)
            // Don't fail the whole operation, just log it
          }
        }
      }

      toast({
        title: "Success",
        description: `${formData.name} has been created successfully`,
      })

      // Reset form
      setFormData({
        name: "",
        employer_type: "",
        abn: "",
        website: "",
        email: "",
        phone: "",
        estimated_worker_count: "",
        notes: ""
      })
      setRoleTags([])
      setTradeCapabilities([])

      if (onEmployerCreated && data) {
        onEmployerCreated(data.id)
      }

      onClose()
    } catch (error: any) {
      console.error("Error creating employer:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to create employer",
        variant: "destructive"
      })
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto max-lg:max-w-[95vw] max-lg:max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="max-lg:text-lg max-lg:leading-tight max-lg:break-words max-lg:hyphens-auto">Add New Employer</DialogTitle>
          <DialogDescription className="max-lg:text-sm">
            Create a new employer record in the system. Required fields are marked with *.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <Label htmlFor="name">Employer Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., ABC Construction Pty Ltd"
                disabled={isCreating}
                required
              />
            </div>

            <div className="md:col-span-2">
              <Label htmlFor="employer_type">Employer Type *</Label>
              <Select
                value={formData.employer_type}
                onValueChange={(value) => setFormData(prev => ({ ...prev, employer_type: value as EmployerType }))}
                disabled={isCreating}
                required
              >
                <SelectTrigger id="employer_type">
                  <SelectValue placeholder="Select employer type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="builder">Builder</SelectItem>
                  <SelectItem value="principal_contractor">Principal Contractor</SelectItem>
                  <SelectItem value="large_contractor">Large Contractor</SelectItem>
                  <SelectItem value="small_contractor">Small Contractor</SelectItem>
                  <SelectItem value="individual">Individual</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="md:col-span-2">
              <Label>Employer Roles (Optional)</Label>
              <div className="flex gap-6 pt-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="role-builder"
                    checked={roleTags.includes('builder')}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setRoleTags([...roleTags, 'builder'])
                      } else {
                        setRoleTags(roleTags.filter(t => t !== 'builder'))
                      }
                    }}
                    disabled={isCreating}
                  />
                  <label
                    htmlFor="role-builder"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                  >
                    Builder
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="role-head-contractor"
                    checked={roleTags.includes('head_contractor')}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setRoleTags([...roleTags, 'head_contractor'])
                      } else {
                        setRoleTags(roleTags.filter(t => t !== 'head_contractor'))
                      }
                    }}
                    disabled={isCreating}
                  />
                  <label
                    htmlFor="role-head-contractor"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                  >
                    Head Contractor
                  </label>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                These tags help prioritize this employer in project assignments
              </p>
            </div>

            <div className="md:col-span-2">
              <TradeCapabilitiesSelector
                selectedTrades={tradeCapabilities}
                onChange={setTradeCapabilities}
                disabled={isCreating}
              />
            </div>

            <div>
              <Label htmlFor="abn">ABN</Label>
              <Input
                id="abn"
                value={formData.abn}
                onChange={(e) => setFormData(prev => ({ ...prev, abn: e.target.value }))}
                placeholder="e.g., 12 345 678 901"
                disabled={isCreating}
              />
            </div>

            <div>
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                placeholder="e.g., 03 9123 4567"
                disabled={isCreating}
              />
            </div>

            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                placeholder="e.g., contact@company.com"
                disabled={isCreating}
              />
            </div>

            <div>
              <Label htmlFor="website">Website</Label>
              <Input
                id="website"
                type="url"
                value={formData.website}
                onChange={(e) => setFormData(prev => ({ ...prev, website: e.target.value }))}
                placeholder="e.g., https://example.com"
                disabled={isCreating}
              />
            </div>

            <div>
              <Label htmlFor="estimated_worker_count">Estimated Worker Count</Label>
              <Input
                id="estimated_worker_count"
                type="number"
                min="0"
                value={formData.estimated_worker_count}
                onChange={(e) => setFormData(prev => ({ ...prev, estimated_worker_count: e.target.value }))}
                placeholder="e.g., 50"
                disabled={isCreating}
              />
            </div>

            <div className="md:col-span-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Additional notes or information about this employer..."
                disabled={isCreating}
                rows={3}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isCreating}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isCreating}
            >
              {isCreating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Employer"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

