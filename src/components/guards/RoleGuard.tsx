"use client"
import { ReactNode, useEffect, useState } from "react"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import { AppRole } from "@/constants/roles"

type RoleGuardProps = {
  allow: AppRole[]
  children: ReactNode
  fallback?: ReactNode
}

export default function RoleGuard({ allow, children, fallback }: RoleGuardProps) {
  const [role, setRole] = useState<AppRole | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadRole = async () => {
      try {
        const supabase = getSupabaseBrowserClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          setRole(null)
          setLoading(false)
          return
        }
        const { data } = await supabase.from("profiles").select("role").eq("id", user.id).single()
        setRole((data?.role as AppRole) || null)
      } finally {
        setLoading(false)
      }
    }
    loadRole()
  }, [])

  if (loading) return null
  if (!role || !allow.includes(role)) {
    return (
      <>{fallback ?? <div className="p-6 text-sm text-muted-foreground">You do not have permission to view this page.</div>}</>
    )
  }

  return <>{children}</>
}

