"use client"

import { MobileLayout } from '@/components/mobile/shared/MobileOptimizationProvider'
import { ReactNode } from 'react'
import { useRouter } from 'next/navigation'

export default function ProjectsLayout({
  children,
}: {
  children: ReactNode
}) {
  const router = useRouter()

  const handleBack = () => {
    router.back()
  }

  return (
    <MobileLayout
      title="Projects"
      showBackButton={true}
      onBack={handleBack}
    >
      {children}
    </MobileLayout>
  )
}
