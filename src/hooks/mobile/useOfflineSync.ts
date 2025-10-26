"use client"

import { useState, useEffect, useCallback } from "react"
import { useToast } from "@/hooks/use-toast"

interface OfflineSyncOptions {
  storageKey?: string
  syncEndpoint?: string
  autoSync?: boolean
  syncInterval?: number
  maxRetries?: number
}

interface SyncOperation {
  id: string
  type: 'create' | 'update' | 'delete'
  endpoint: string
  data: any
  timestamp: number
  retries: number
}

interface UseOfflineSyncReturn<T> {
  data: T[] | null
  loading: boolean
  error: string | null
  isOnline: boolean
  pendingSync: number
  syncInProgress: boolean
  lastSync: Date | null
  addItem: (item: T) => Promise<void>
  updateItem: (id: string, updates: Partial<T>) => Promise<void>
  deleteItem: (id: string) => Promise<void>
  forceSync: () => Promise<void>
  clearPendingSync: () => void
}

export function useOfflineSync<T extends { id: string }>(
  initialData: T[] = [],
  options: OfflineSyncOptions = {}
): UseOfflineSyncReturn<T> {
  const {
    storageKey = 'offline-sync-data',
    syncEndpoint,
    autoSync = true,
    syncInterval = 30000, // 30 seconds
    maxRetries = 3,
  } = options

  const { toast } = useToast()
  const [data, setData] = React.useState<T[]>(initialData)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [isOnline, setIsOnline] = React.useState(
    typeof navigator !== "undefined" ? navigator.onLine : true
  )
  const [pendingOperations, setPendingOperations] = React.useState<SyncOperation[]>([])
  const [syncInProgress, setSyncInProgress] = React.useState(false)
  const [lastSync, setLastSync] = React.useState<Date | null>(null)

  // Load data from localStorage on mount
  React.useEffect(() => {
    if (typeof window === "undefined") return

    try {
      const storedData = localStorage.getItem(`${storageKey}-data`)
      const storedOperations = localStorage.getItem(`${storageKey}-operations`)
      const storedLastSync = localStorage.getItem(`${storageKey}-last-sync`)

      if (storedData) {
        setData(JSON.parse(storedData))
      }
      if (storedOperations) {
        setPendingOperations(JSON.parse(storedOperations))
      }
      if (storedLastSync) {
        setLastSync(new Date(storedLastSync))
      }
    } catch (error) {
      console.error("Error loading offline data:", error)
    }
  }, [storageKey])

  // Save data to localStorage whenever it changes
  React.useEffect(() => {
    if (typeof window === "undefined") return

    try {
      localStorage.setItem(`${storageKey}-data`, JSON.stringify(data))
      localStorage.setItem(
        `${storageKey}-operations`,
        JSON.stringify(pendingOperations)
      )
      if (lastSync) {
        localStorage.setItem(`${storageKey}-last-sync`, lastSync.toISOString())
      }
    } catch (error) {
      console.error("Error saving offline data:", error)
    }
  }, [data, pendingOperations, lastSync, storageKey])

  // Monitor online status
  React.useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true)
      if (autoSync && pendingOperations.length > 0) {
        syncPendingOperations()
      }
    }

    const handleOffline = () => {
      setIsOnline(false)
    }

    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)

    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
    }
  }, [autoSync, pendingOperations.length])

  // Auto-sync when online
  React.useEffect(() => {
    if (!autoSync || !isOnline || !syncEndpoint) return

    const interval = setInterval(() => {
      if (pendingOperations.length > 0) {
        syncPendingOperations()
      }
    }, syncInterval)

    return () => clearInterval(interval)
  }, [autoSync, isOnline, syncEndpoint, syncInterval, pendingOperations.length])

  // Sync pending operations
  const syncPendingOperations = React.useCallback(async () => {
    if (!isOnline || !syncEndpoint || pendingOperations.length === 0) return

    setSyncInProgress(true)
    setError(null)

    try {
      const operationsToSync = [...pendingOperations]
      const successfulOperations: string[] = []

      for (const operation of operationsToSync) {
        try {
          const response = await fetch(`${syncEndpoint}/${operation.endpoint}`, {
            method: operation.type === 'create' ? 'POST' :
                    operation.type === 'update' ? 'PUT' : 'DELETE',
            headers: {
              'Content-Type': 'application/json',
            },
            body: operation.type !== 'delete' ? JSON.stringify(operation.data) : undefined,
          })

          if (response.ok) {
            successfulOperations.push(operation.id)
          } else {
            throw new Error(`Sync failed for operation ${operation.id}`)
          }
        } catch (error) {
          console.error(`Failed to sync operation ${operation.id}:`, error)

          // Increment retry count
          const updatedOperations = pendingOperations.map(op =>
            op.id === operation.id
              ? { ...op, retries: op.retries + 1 }
              : op
          )

          // Remove operations that have exceeded max retries
          const filteredOperations = updatedOperations.filter(
            op => op.retries < maxRetries
          )

          setPendingOperations(filteredOperations)
        }
      }

      // Remove successfully synced operations
      setPendingOperations(prev =>
        prev.filter(op => !successfulOperations.includes(op.id))
      )

      if (successfulOperations.length > 0) {
        setLastSync(new Date())
        toast({
          title: "Sync completed",
          description: `Successfully synced ${successfulOperations.length} item(s)`,
        })
      }
    } catch (error) {
      console.error("Sync failed:", error)
      setError("Failed to sync data")
      toast({
        title: "Sync failed",
        description: "Some changes could not be synced. They will be retried later.",
        variant: "destructive",
      })
    } finally {
      setSyncInProgress(false)
    }
  }, [isOnline, syncEndpoint, pendingOperations, maxRetries, toast])

  // Add item (creates locally and queues for sync)
  const addItem = React.useCallback(async (item: T) => {
    const newId = `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const newItem = { ...item, id: newId } as T

    // Add to local data immediately
    setData(prev => [...prev, newItem])

    // Queue for sync if endpoint is available
    if (syncEndpoint) {
      const operation: SyncOperation = {
        id: `op-${Date.now()}`,
        type: 'create',
        endpoint: '',
        data: newItem,
        timestamp: Date.now(),
        retries: 0,
      }

      setPendingOperations(prev => [...prev, operation])

      // Try to sync immediately if online
      if (isOnline) {
        setTimeout(() => syncPendingOperations(), 100)
      }
    }

    toast({
      title: "Item added",
      description: isOnline ? "Changes will be synced automatically" : "Changes will sync when online",
    })
  }, [syncEndpoint, isOnline, syncPendingOperations, toast])

  // Update item (updates locally and queues for sync)
  const updateItem = React.useCallback(async (id: string, updates: Partial<T>) => {
    // Update local data immediately
    setData(prev =>
      prev.map(item => item.id === id ? { ...item, ...updates } : item)
    )

    // Queue for sync if endpoint is available and item isn't a local-only item
    if (syncEndpoint && !id.startsWith('local-')) {
      const operation: SyncOperation = {
        id: `op-${Date.now()}`,
        type: 'update',
        endpoint: id,
        data: updates,
        timestamp: Date.now(),
        retries: 0,
      }

      setPendingOperations(prev => [...prev, operation])

      // Try to sync immediately if online
      if (isOnline) {
        setTimeout(() => syncPendingOperations(), 100)
      }
    }

    toast({
      title: "Item updated",
      description: isOnline ? "Changes will be synced automatically" : "Changes will sync when online",
    })
  }, [syncEndpoint, isOnline, syncPendingOperations, toast])

  // Delete item (deletes locally and queues for sync)
  const deleteItem = React.useCallback(async (id: string) => {
    // Remove from local data immediately
    setData(prev => prev.filter(item => item.id !== id))

    // Queue for sync if endpoint is available and item isn't a local-only item
    if (syncEndpoint && !id.startsWith('local-')) {
      const operation: SyncOperation = {
        id: `op-${Date.now()}`,
        type: 'delete',
        endpoint: id,
        data: null,
        timestamp: Date.now(),
        retries: 0,
      }

      setPendingOperations(prev => [...prev, operation])

      // Try to sync immediately if online
      if (isOnline) {
        setTimeout(() => syncPendingOperations(), 100)
      }
    }

    toast({
      title: "Item deleted",
      description: isOnline ? "Changes will be synced automatically" : "Changes will sync when online",
    })
  }, [syncEndpoint, isOnline, syncPendingOperations, toast])

  // Force sync
  const forceSync = React.useCallback(async () => {
    await syncPendingOperations()
  }, [syncPendingOperations])

  // Clear pending sync operations
  const clearPendingSync = React.useCallback(() => {
    setPendingOperations([])
    if (typeof window !== "undefined") {
      localStorage.removeItem(`${storageKey}-operations`)
    }
    toast({
      title: "Pending sync cleared",
      description: "All pending operations have been cleared",
    })
  }, [storageKey, toast])

  return {
    data,
    loading,
    error,
    isOnline,
    pendingSync: pendingOperations.length,
    syncInProgress,
    lastSync,
    addItem,
    updateItem,
    deleteItem,
    forceSync,
    clearPendingSync,
  }
}