"use client"
import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { supabase } from "@/integrations/supabase/client"
import { toast } from "sonner"

interface QuickAddWorkerModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  employerId: string
  jobSiteId?: string | null
  onAdded?: () => void
}

export function QuickAddWorkerModal({ open, onOpenChange, employerId, jobSiteId = null, onAdded }: QuickAddWorkerModalProps) {
  const [firstName, setFirstName] = useState("")
  const [surname, setSurname] = useState("")
  const [membership, setMembership] = useState<"member" | "potential" | "non_member" | "declined">("non_member")
  const [saving, setSaving] = useState(false)

  const reset = () => {
    setFirstName("")
    setSurname("")
    setMembership("non_member")
  }

  const handleSave = async () => {
    if (!firstName.trim() || !surname.trim()) {
      toast.error("First name and surname are required")
      return
    }
    try {
      setSaving(true)
      const { data: inserted, error } = await supabase
        .from("workers")
        .insert({ first_name: firstName.trim(), surname: surname.trim(), union_membership_status: membership })
        .select("id")
        .single()
      if (error) throw error
      const newWorkerId = inserted?.id as string
      const today = new Date().toISOString().slice(0, 10)
      const { error: plError } = await supabase
        .from("worker_placements")
        .insert({ worker_id: newWorkerId, employer_id: employerId, job_site_id: jobSiteId || null, employment_status: "permanent", start_date: today })
      if (plError) throw plError
      toast.success("Worker created and assigned")
      onOpenChange(false)
      reset()
      onAdded?.()
    } catch (e) {
      console.error(e)
      toast.error("Failed to add worker")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v) }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add worker</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">First name</Label>
              <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Jane" />
            </div>
            <div>
              <Label className="text-xs">Surname</Label>
              <Input value={surname} onChange={(e) => setSurname(e.target.value)} placeholder="Doe" />
            </div>
          </div>
          <div>
            <Label className="text-xs">Membership</Label>
            <Select value={membership} onValueChange={(v) => setMembership(v as any)}>
              <SelectTrigger>
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="member">Member</SelectItem>
                <SelectItem value="potential">Potential</SelectItem>
                <SelectItem value="non_member">Non-member</SelectItem>
                <SelectItem value="declined">Declined</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

