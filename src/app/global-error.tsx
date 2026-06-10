"use client"

import { useEffect } from "react"
import * as Sentry from "@sentry/nextjs"

/**
 * Last-resort error boundary — catches errors thrown by the ROOT layout
 * itself (providers, auth bootstrap), which app/error.tsx cannot catch.
 * Must render its own <html>/<body> because the root layout has crashed.
 *
 * Uses inline styles only: when the root layout fails, the Tailwind
 * stylesheet may not have loaded.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("[GlobalError] Root layout error:", error)
    Sentry.captureException(error, { tags: { boundary: "global-error" } })
  }, [error])

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#ffffff",
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        }}
      >
        <div style={{ textAlign: "center", padding: "24px", maxWidth: "360px" }}>
          <h1 style={{ fontSize: "22px", color: "#111827", marginBottom: "8px" }}>
            Something went wrong
          </h1>
          <p style={{ fontSize: "15px", color: "#4b5563", marginBottom: "24px" }}>
            The app hit an unexpected error. Reloading usually fixes this — your
            sign-in is safe.
          </p>
          <button
            onClick={reset}
            style={{
              display: "block",
              width: "100%",
              minHeight: "48px",
              backgroundColor: "#111827",
              color: "#ffffff",
              border: "none",
              borderRadius: "8px",
              fontSize: "16px",
              fontWeight: 600,
              cursor: "pointer",
              marginBottom: "12px",
            }}
          >
            Try Again
          </button>
          <button
            onClick={() => window.location.reload()}
            style={{
              display: "block",
              width: "100%",
              minHeight: "48px",
              backgroundColor: "#ffffff",
              color: "#111827",
              border: "1px solid #d1d5db",
              borderRadius: "8px",
              fontSize: "16px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Reload App
          </button>
          {error.digest && (
            <p style={{ fontSize: "12px", color: "#9ca3af", marginTop: "24px" }}>
              Error reference: {error.digest}
            </p>
          )}
        </div>
      </body>
    </html>
  )
}
