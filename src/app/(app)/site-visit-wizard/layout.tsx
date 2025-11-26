import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Site Visit Wizard | CFMEU',
  description: 'Quick site visit recording and project actions',
}

export default function SiteVisitWizardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // The parent (app) layout already provides auth and other providers
  // This layout just adds metadata and can customize the wrapper if needed
  return (
    <div className="min-h-screen bg-gray-50">
      {children}
    </div>
  )
}

