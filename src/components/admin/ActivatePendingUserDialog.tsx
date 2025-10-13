"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle, CheckCircle2, Loader2, User, Mail, Shield, MapPin } from "lucide-react"
import { convertTestingToProductionEmail } from "@/utils/emailConversion"

interface PendingUser {
  id: string
  email: string
  full_name: string | null
  role: string
  assigned_patch_ids: string[]
  status: string
}

interface ActivatePendingUserDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  pendingUser: PendingUser | null
  onSuccess: () => void
}

interface ActivationResult {
  pending_user_id: string
  activated_user_id: string
  pending_email: string
  activated_email: string
  role: string
  full_name: string
  hierarchy_migrated: {
    role_hierarchy_created: number
    lead_draft_links_created: number
    draft_links_updated: number
    links_deactivated: number
  }
  patches_migrated: number
  invalid_patches_cleaned: number
}

export default function ActivatePendingUserDialog({
  open,
  onOpenChange,
  pendingUser,
  onSuccess,
}: ActivatePendingUserDialogProps) {
  const [activatedEmail, setActivatedEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<ActivationResult | null>(null)

  // Reset state when dialog opens/closes
  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen && pendingUser) {
      setActivatedEmail(convertTestingToProductionEmail(pendingUser.email))
      setError(null)
      setSuccess(null)
    } else if (!newOpen) {
      setActivatedEmail("")
      setError(null)
      setSuccess(null)
    }
    onOpenChange(newOpen)
  }

  const handleActivate = async () => {
    if (!pendingUser) return

    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/admin/activate-pending-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pendingEmail: pendingUser.email,
          activatedEmail: activatedEmail,
        }),
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to activate user')
      }

      setSuccess(result.data)
      setTimeout(() => {
        onSuccess()
        handleOpenChange(false)
      }, 3000)
    } catch (err: any) {
      console.error('Error activating user:', err)
      setError(err.message || 'Failed to activate user')
    } finally {
      setLoading(false)
    }
  }

  if (!pendingUser) return null

  const totalHierarchyChanges = success
    ? (success.hierarchy_migrated?.role_hierarchy_created || 0) +
      (success.hierarchy_migrated?.lead_draft_links_created || 0) +
      (success.hierarchy_migrated?.draft_links_updated || 0)
    : 0

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle>
            {success ? 'User Activated Successfully!' : 'Activate Pending User'}
          </DialogTitle>
          <DialogDescription>
            {success
              ? 'The user has been successfully activated with all relationships migrated.'
              : 'This will activate the pending user and migrate all hierarchies and patch assignments.'}
          </DialogDescription>
        </DialogHeader>

        {success ? (
          <div className="space-y-4 py-4">
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                User successfully activated and all data migrated.
              </AlertDescription>
            </Alert>

            <div className="space-y-3 text-sm">
              <div className="flex items-start gap-2">
                <User className="h-4 w-4 mt-0.5 text-muted-foreground" />
                <div>
                  <div className="font-medium">{success.full_name}</div>
                  <div className="text-muted-foreground">{success.activated_email}</div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-muted-foreground" />
                <div>
                  <span className="font-medium">Role:</span>{' '}
                  <span className="capitalize">{success.role.replace('_', ' ')}</span>
                </div>
              </div>

              {totalHierarchyChanges > 0 && (
                <div className="flex items-start gap-2">
                  <User className="h-4 w-4 mt-0.5 text-muted-foreground" />
                  <div>
                    <span className="font-medium">Hierarchy Relationships:</span>{' '}
                    {totalHierarchyChanges} migrated
                    <div className="text-xs text-muted-foreground mt-1">
                      {success.hierarchy_migrated.role_hierarchy_created > 0 && (
                        <div>• {success.hierarchy_migrated.role_hierarchy_created} role hierarchy links</div>
                      )}
                      {success.hierarchy_migrated.lead_draft_links_created > 0 && (
                        <div>• {success.hierarchy_migrated.lead_draft_links_created} lead-draft links</div>
                      )}
                      {success.hierarchy_migrated.draft_links_updated > 0 && (
                        <div>• {success.hierarchy_migrated.draft_links_updated} draft links updated</div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {success.patches_migrated > 0 && (
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <span className="font-medium">Patch Assignments:</span>{' '}
                    {success.patches_migrated} migrated
                  </div>
                </div>
              )}

              {success.invalid_patches_cleaned > 0 && (
                <div className="text-xs text-amber-600">
                  Note: {success.invalid_patches_cleaned} invalid patch reference(s) were cleaned
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="pending-email">Pending User Email</Label>
              <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-md">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{pendingUser.email}</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="full-name">Full Name</Label>
              <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-md">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{pendingUser.full_name || '—'}</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-md">
                <Shield className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm capitalize">{pendingUser.role.replace('_', ' ')}</span>
              </div>
            </div>

            {pendingUser.assigned_patch_ids && pendingUser.assigned_patch_ids.length > 0 && (
              <div className="space-y-2">
                <Label>Patch Assignments</Label>
                <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-md">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{pendingUser.assigned_patch_ids.length} patch(es)</span>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="activated-email">
                Activated User Email{' '}
                <span className="text-muted-foreground font-normal">(can be edited)</span>
              </Label>
              <Input
                id="activated-email"
                type="email"
                value={activatedEmail}
                onChange={(e) => setActivatedEmail(e.target.value)}
                placeholder="user@cfmeu.org"
                disabled={loading}
              />
              <p className="text-xs text-muted-foreground">
                The user must have already signed in with this email to create their profile.
              </p>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>This will:</strong>
                <ul className="list-disc list-inside mt-2 text-sm space-y-1">
                  <li>Transfer the role to the activated user</li>
                  <li>Migrate all hierarchy relationships</li>
                  <li>Migrate all patch assignments</li>
                  <li>Archive the pending user record</li>
                </ul>
                <p className="mt-2 text-sm font-medium">This action cannot be undone.</p>
              </AlertDescription>
            </Alert>
          </div>
        )}

        <DialogFooter>
          {success ? (
            <Button onClick={() => handleOpenChange(false)} className="w-full">
              Close
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button onClick={handleActivate} disabled={loading || !activatedEmail}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {loading ? 'Activating...' : 'Activate User'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

