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
  return (
    <div className="min-h-screen bg-gray-50">
      {children}
    </div>
  )
}

