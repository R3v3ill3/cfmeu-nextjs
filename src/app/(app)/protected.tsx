'use client'

import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { useEffect } from 'react'
import type { ReactNode } from 'react'

export default function Protected({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/auth')
    }
  }, [loading, user, router])

  if (loading) return null
  if (!user) return null
  return <>{children}</>
}

