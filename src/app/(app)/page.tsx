import React, { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { DesktopDashboardView } from "@/components/dashboard/DesktopDashboardView"

export const dynamic = 'force-dynamic'

// Ensure React and hooks are globally available for Vercel serverless environment
if (typeof globalThis !== 'undefined') {
  if (!globalThis.React) {
    globalThis.React = React;
  }
  // Ensure hooks are available on global React
  if (globalThis.React) {
    globalThis.React.useState = useState;
    globalThis.React.useEffect = useEffect;
    globalThis.React.useCallback = useCallback;
    globalThis.React.useMemo = useMemo;
    globalThis.React.useRef = useRef;
  }
}
if (typeof global !== 'undefined') {
  if (!global.React) {
    global.React = React;
  }
  // Ensure hooks are available on global React
  if (global.React) {
    global.React.useState = useState;
    global.React.useEffect = useEffect;
    global.React.useCallback = useCallback;
    global.React.useMemo = useMemo;
    global.React.useRef = useRef;
  }
}

export default function DashboardPage() {
  // Temporarily always show desktop view to eliminate mobile detection issues
  return <DesktopDashboardView />
}

