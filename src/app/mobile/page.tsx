"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { MobileLoadingState } from "@/components/mobile/shared/MobileOptimizationProvider"

export default function MobileRedirectPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace("/")
  }, [router])

  return <MobileLoadingState message="Loading CFMEU app..." />
}