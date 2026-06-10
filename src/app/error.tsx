"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Home, RefreshCw, AlertTriangle } from "lucide-react"
import * as Sentry from "@sentry/nextjs"

/**
 * Route-segment error boundary for the whole app.
 *
 * Before this existed there were ZERO error.tsx files, so any uncaught render
 * error in any page white-screened the entire app (especially bad on mobile
 * PWA, where users perceived it as "the app crashed / lost connection").
 * This keeps the failure contained, reports it to Sentry, and gives field
 * organisers a recovery path that does not destroy their session.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const router = useRouter()

  useEffect(() => {
    console.error("[AppError] Route error boundary caught:", error)
    Sentry.captureException(error, {
      tags: { boundary: "app-error" },
      extra: {
        digest: error.digest,
        pathname: typeof window !== "undefined" ? window.location?.pathname : null,
      },
    })
  }, [error])

  const handleHome = () => {
    router.push("/")
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-12 text-center">
        <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center mb-6">
          <AlertTriangle className="w-10 h-10 text-red-600" />
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Something went wrong
        </h1>

        <p className="text-gray-600 mb-8 max-w-sm">
          An unexpected error occurred while loading this page. Your work and
          sign-in are safe — try again, or return to the dashboard.
        </p>

        {/* Action buttons - large tap targets for mobile */}
        <div className="w-full max-w-xs space-y-3">
          <Button
            onClick={reset}
            className="w-full h-12 text-base font-medium touch-manipulation"
            size="lg"
          >
            <RefreshCw className="w-5 h-5 mr-2" />
            Try Again
          </Button>

          <Button
            onClick={handleHome}
            variant="outline"
            className="w-full h-12 text-base font-medium touch-manipulation"
            size="lg"
          >
            <Home className="w-5 h-5 mr-2" />
            Go to Home
          </Button>
        </div>

        {error.digest && (
          <p className="text-xs text-gray-400 mt-8">
            Error reference: {error.digest}
          </p>
        )}
      </main>

      <footer className="pb-safe px-6 py-4 text-center">
        <p className="text-xs text-gray-400">CFMEU Organising Database</p>
      </footer>
    </div>
  )
}
