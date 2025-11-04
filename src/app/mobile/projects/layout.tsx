import { MobileLayout } from '@/components/mobile/shared/MobileOptimizationProvider'
import { ReactNode } from 'react'

export default async function ProjectsLayout({
  children,
}: {
  children: ReactNode
}) {
  return (
    <MobileLayout
      title="Projects"
      showBackButton={true}
      onBack={() => window.history.back()}
    >
      {children}
    </MobileLayout>
  )
}