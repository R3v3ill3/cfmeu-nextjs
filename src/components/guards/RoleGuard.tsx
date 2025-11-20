"use client"

import { ReactNode } from "react"
import { Loader2 } from "lucide-react"
import { AppRole } from "@/constants/roles"
import { useAuth } from "@/hooks/useAuth"
import { useUserRole } from "@/hooks/useUserRole"

type RoleGuardProps = {
  allow: AppRole[]
  children: ReactNode
  fallback?: ReactNode
}

export default function RoleGuard({ allow, children, fallback }: RoleGuardProps) {
  const { user, loading: authLoading } = useAuth()
  const { role, isLoading: roleLoading, error, refetch } = useUserRole()

  const loadingState = (
    <div className="flex items-center gap-2 rounded-md border border-dashed border-border/60 bg-muted/30 p-4 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      Checking permissions…
    </div>
  )

  if (authLoading || roleLoading) {
    return loadingState
  }

  if (error) {
    console.error("[RoleGuard] Failed to resolve user role", {
      error,
      userId: user?.id,
      allow,
      timestamp: new Date().toISOString(),
    })
    return (
      <div className="space-y-3 rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
        <div className="font-medium">We couldn’t confirm your access.</div>
        <p className="text-destructive/80">
          Please try again in a moment. If the problem persists, contact an administrator.
        </p>
        <button
          type="button"
          onClick={() => refetch()}
          className="text-xs font-semibold text-destructive underline-offset-4 hover:underline"
        >
          Retry permission check
        </button>
      </div>
    )
  }

  if (!user) {
    return (
      <>
        {fallback ?? (
          <div className="rounded-md border border-border/60 bg-muted/30 p-4 text-sm text-muted-foreground">
            Please sign in to view this content.
          </div>
        )}
      </>
    )
  }

  if (!role || !allow.includes(role as AppRole)) {
    return (
      <>
        {fallback ?? (
          <div className="rounded-md border border-border/60 bg-muted/30 p-4 text-sm text-muted-foreground">
            You do not have permission to view this page.
          </div>
        )}
      </>
    )
  }

  return <>{children}</>
}