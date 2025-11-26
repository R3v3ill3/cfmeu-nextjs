"use client"

import { Suspense } from 'react'
import { SiteVisitWizard } from '@/components/siteVisitWizard/SiteVisitWizard'
import { AuthProvider } from '@/hooks/useAuth'
import { Loader2 } from 'lucide-react'

function WizardLoadingFallback() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <p className="text-gray-600 font-medium">Loading Site Visit Wizard...</p>
      </div>
    </div>
  )
}

export default function SiteVisitWizardPage() {
  return (
    <AuthProvider>
      <Suspense fallback={<WizardLoadingFallback />}>
        <SiteVisitWizard />
      </Suspense>
    </AuthProvider>
  )
}

