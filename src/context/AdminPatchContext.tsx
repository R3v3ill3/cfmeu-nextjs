"use client"

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react"
import { useUserRole } from "@/hooks/useUserRole"

const STORAGE_KEY = "cfmeu-admin-patch-selection"

interface AdminPatchContextValue {
  selectedPatchIds: string[] | null
  setSelectedPatchIds: (ids: string[] | null) => void
  clearSelection: () => void
  isInitialized: boolean
  isAdmin: boolean
}

const AdminPatchContext = createContext<AdminPatchContextValue | undefined>(undefined)

export function AdminPatchProvider({ children }: { children: ReactNode }) {
  const { role, isLoading: isLoadingRole } = useUserRole()
  const isAdmin = role === "admin"
  const [selectedPatchIds, setSelectedPatchIdsState] = useState<string[] | null>(null)
  const [isInitialized, setIsInitialized] = useState(false)

  // Initialize from localStorage on mount (only for admins)
  useEffect(() => {
    if (isLoadingRole) return

    if (isAdmin && typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem(STORAGE_KEY)
        if (stored) {
          const parsed = JSON.parse(stored)
          if (Array.isArray(parsed) && parsed.length > 0) {
            setSelectedPatchIdsState(parsed)
          }
        }
      } catch (err) {
        console.error("[AdminPatchContext] Error loading from localStorage:", err)
      }
    }

    setIsInitialized(true)
  }, [isAdmin, isLoadingRole])

  // Persist to localStorage whenever selection changes (only for admins)
  useEffect(() => {
    if (!isInitialized || !isAdmin) return

    if (typeof window !== "undefined") {
      try {
        if (selectedPatchIds && selectedPatchIds.length > 0) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(selectedPatchIds))
        } else {
          localStorage.removeItem(STORAGE_KEY)
        }
      } catch (err) {
        console.error("[AdminPatchContext] Error saving to localStorage:", err)
      }
    }
  }, [selectedPatchIds, isInitialized, isAdmin])

  const setSelectedPatchIds = useCallback((ids: string[] | null) => {
    setSelectedPatchIdsState(ids)
  }, [])

  const clearSelection = useCallback(() => {
    setSelectedPatchIdsState(null)
    if (typeof window !== "undefined") {
      localStorage.removeItem(STORAGE_KEY)
    }
  }, [])

  const value: AdminPatchContextValue = {
    selectedPatchIds,
    setSelectedPatchIds,
    clearSelection,
    isInitialized,
    isAdmin,
  }

  return <AdminPatchContext.Provider value={value}>{children}</AdminPatchContext.Provider>
}

export function useAdminPatchContext() {
  const context = useContext(AdminPatchContext)
  if (context === undefined) {
    throw new Error("useAdminPatchContext must be used within AdminPatchProvider")
  }
  return context
}

