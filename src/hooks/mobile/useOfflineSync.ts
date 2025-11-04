"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
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
  priority: number
  batchId?: string
}

interface SyncLock {
  id: string
  operationId: string
  timestamp: number
}

interface SyncQueue {
  pending: SyncOperation[]
  inProgress: SyncOperation[]
  completed: string[]
  failed: SyncOperation[]
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
  const [data, setData] = useState<T[]>(initialData)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true
  )

  // Concurrency control refs
  const syncLockRef = useRef<Map<string, SyncLock>>(new Map())
  const operationQueueRef = useRef<SyncQueue>({
    pending: [],
    inProgress: [],
    completed: [],
    failed: []
  })
  const syncInProgressRef = useRef(false)
  const batchCounterRef = useRef(0)

  // State variables
  const [pendingOperations, setPendingOperations] = useState<SyncOperation[]>([])
  const [syncInProgress, setSyncInProgress] = useState(false)
  const [lastSync, setLastSync] = useState<Date | null>(null)

  // Utility functions for concurrency control
  const acquireSyncLock = useCallback((operationId: string): boolean => {
    const existingLock = syncLockRef.current.get(operationId)
    const now = Date.now()

    // Check if lock exists and is not expired (5 minutes)
    if (existingLock && (now - existingLock.timestamp) < 5 * 60 * 1000) {
      return false
    }

    // Acquire lock
    syncLockRef.current.set(operationId, {
      id: `lock-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      operationId,
      timestamp: now
    })

    return true
  }, [])

  const releaseSyncLock = useCallback((operationId: string): void => {
    syncLockRef.current.delete(operationId)
  }, [])

  const addToQueue = useCallback((operation: SyncOperation, priority: number = 0): void => {
    const queue = operationQueueRef.current

    // Check if operation already exists
    const existingIndex = queue.pending.findIndex(op => op.id === operation.id)
    if (existingIndex !== -1) {
      // Update existing operation
      queue.pending[existingIndex] = { ...operation, priority }
    } else {
      // Add new operation with priority
      queue.pending.push({ ...operation, priority })
    }

    // Sort by priority (higher first) and timestamp
    queue.pending.sort((a, b) => {
      if (a.priority !== b.priority) {
        return b.priority - a.priority
      }
      return a.timestamp - b.timestamp
    })
  }, [])

  const getNextBatch = useCallback((batchSize: number = 5): SyncOperation[] => {
    const queue = operationQueueRef.current
    const batch: SyncOperation[] = []

    while (batch.length < batchSize && queue.pending.length > 0) {
      const operation = queue.pending.shift()
      if (operation && acquireSyncLock(operation.id)) {
        batch.push(operation)
        queue.inProgress.push(operation)
      }
    }

    return batch
  }, [acquireSyncLock])

  const markOperationCompleted = useCallback((operationId: string, success: boolean): void => {
    const queue = operationQueueRef.current
    const inProgressIndex = queue.inProgress.findIndex(op => op.id === operationId)

    if (inProgressIndex !== -1) {
      const operation = queue.inProgress.splice(inProgressIndex, 1)[0]
      releaseSyncLock(operationId)

      if (success) {
        queue.completed.push(operationId)
      } else {
        operation.retries += 1
        if (operation.retries < maxRetries) {
          // Re-queue with lower priority
          addToQueue(operation, Math.max(0, operation.priority - 1))
        } else {
          queue.failed.push(operation)
        }
      }
    }
  }, [releaseSyncLock, addToQueue, maxRetries])

  // Load data from localStorage on mount
  useEffect(() => {
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
  useEffect(() => {
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
  useEffect(() => {
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
  useEffect(() => {
    if (!autoSync || !isOnline || !syncEndpoint) return

    const interval = setInterval(() => {
      if (pendingOperations.length > 0) {
        syncPendingOperations()
      }
    }, syncInterval)

    return () => clearInterval(interval)
  }, [autoSync, isOnline, syncEndpoint, syncInterval, pendingOperations.length])

  // Sync pending operations with batch processing and concurrency control
  const syncPendingOperations = useCallback(async () => {
    if (!isOnline || !syncEndpoint || syncInProgressRef.current) return

    const queue = operationQueueRef.current
    if (queue.pending.length === 0) return

    syncInProgressRef.current = true
    setSyncInProgress(true)
    setError(null)

    try {
      let totalProcessed = 0
      let batchId = `batch-${batchCounterRef.current++}`
      let successfulInBatch = 0

      // Process operations in batches
      while (queue.pending.length > 0) {
        const batch = getNextBatch(5) // Process up to 5 operations concurrently
        if (batch.length === 0) break

        // Assign batch ID for tracking
        batch.forEach(op => op.batchId = batchId)

        // Process batch concurrently
        const batchPromises = batch.map(async (operation) => {
          try {
            const response = await fetch(`${syncEndpoint}/${operation.endpoint}`, {
              method: operation.type === 'create' ? 'POST' :
                      operation.type === 'update' ? 'PUT' : 'DELETE',
              headers: {
                'Content-Type': 'application/json',
                'X-Batch-Id': batchId,
                'X-Operation-Id': operation.id,
              },
              body: operation.type !== 'delete' ? JSON.stringify(operation.data) : undefined,
            })

            if (response.ok) {
              markOperationCompleted(operation.id, true)
              return { success: true, operationId: operation.id }
            } else {
              throw new Error(`HTTP ${response.status}: ${response.statusText}`)
            }
          } catch (error) {
            console.error(`Failed to sync operation ${operation.id}:`, error)
            markOperationCompleted(operation.id, false)
            return {
              success: false,
              operationId: operation.id,
              error: error instanceof Error ? error.message : 'Unknown error'
            }
          }
        })

        // Wait for batch to complete
        const batchResults = await Promise.allSettled(batchPromises)
        successfulInBatch = batchResults.filter(result =>
          result.status === 'fulfilled' && result.value.success
        ).length

        totalProcessed += batch.length

        // Update state for UI
        setPendingOperations([
          ...queue.pending,
          ...queue.inProgress,
          ...queue.failed
        ])

        // Brief delay between batches to prevent overwhelming the server
        if (queue.pending.length > 0) {
          await new Promise(resolve => setTimeout(resolve, 200))
        }
      }

      // Update last sync timestamp
      setLastSync(new Date())

      // Show success toast if operations were completed
      if (totalProcessed > 0) {
        toast({
          title: "Sync completed",
          description: `Successfully synced ${successfulInBatch} of ${totalProcessed} item(s)`,
        })
      }

      // Clean up old completed operations (keep last 100)
      if (queue.completed.length > 100) {
        queue.completed = queue.completed.slice(-100)
      }

    } catch (error) {
      console.error("Batch sync failed:", error)
      setError("Failed to sync data")
      toast({
        title: "Sync failed",
        description: "Some changes could not be synced. They will be retried later.",
        variant: "destructive",
      })
    } finally {
      syncInProgressRef.current = false
      setSyncInProgress(false)

      // Update final state
      setPendingOperations([
        ...queue.pending,
        ...queue.inProgress,
        ...queue.failed
      ])
    }
  }, [isOnline, syncEndpoint, getNextBatch, markOperationCompleted, toast])

  // Add item (creates locally and queues for sync)
  const addItem = useCallback(async (item: T) => {
    const newId = `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const newItem = { ...item, id: newId } as T

    // Add to local data immediately
    setData(prev => [...prev, newItem])

    // Queue for sync if endpoint is available
    if (syncEndpoint) {
      const operation: SyncOperation = {
        id: `op-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: 'create',
        endpoint: '',
        data: newItem,
        timestamp: Date.now(),
        retries: 0,
        priority: 1, // Higher priority for creates
      }

      // Add to queue with priority
      addToQueue(operation, 1)

      // Update pending operations for UI
      setPendingOperations([
        ...operationQueueRef.current.pending,
        ...operationQueueRef.current.inProgress,
        ...operationQueueRef.current.failed
      ])

      // Try to sync immediately if online
      if (isOnline && !syncInProgressRef.current) {
        setTimeout(() => syncPendingOperations(), 100)
      }
    }

    toast({
      title: "Item added",
      description: isOnline ? "Changes will be synced automatically" : "Changes will sync when online",
    })
  }, [syncEndpoint, isOnline, syncPendingOperations, addToQueue, toast])

  // Update item (updates locally and queues for sync)
  const updateItem = useCallback(async (id: string, updates: Partial<T>) => {
    // Update local data immediately
    setData(prev =>
      prev.map(item => item.id === id ? { ...item, ...updates } : item)
    )

    // Queue for sync if endpoint is available and item isn't a local-only item
    if (syncEndpoint && !id.startsWith('local-')) {
      const operation: SyncOperation = {
        id: `op-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: 'update',
        endpoint: id,
        data: updates,
        timestamp: Date.now(),
        retries: 0,
        priority: 2, // Medium priority for updates
      }

      // Add to queue with priority
      addToQueue(operation, 2)

      // Update pending operations for UI
      setPendingOperations([
        ...operationQueueRef.current.pending,
        ...operationQueueRef.current.inProgress,
        ...operationQueueRef.current.failed
      ])

      // Try to sync immediately if online
      if (isOnline && !syncInProgressRef.current) {
        setTimeout(() => syncPendingOperations(), 100)
      }
    }

    toast({
      title: "Item updated",
      description: isOnline ? "Changes will be synced automatically" : "Changes will sync when online",
    })
  }, [syncEndpoint, isOnline, syncPendingOperations, addToQueue, toast])

  // Delete item (deletes locally and queues for sync)
  const deleteItem = useCallback(async (id: string) => {
    // Remove from local data immediately
    setData(prev => prev.filter(item => item.id !== id))

    // Queue for sync if endpoint is available and item isn't a local-only item
    if (syncEndpoint && !id.startsWith('local-')) {
      const operation: SyncOperation = {
        id: `op-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: 'delete',
        endpoint: id,
        data: null,
        timestamp: Date.now(),
        retries: 0,
        priority: 3, // Lower priority for deletes
      }

      // Add to queue with priority
      addToQueue(operation, 3)

      // Update pending operations for UI
      setPendingOperations([
        ...operationQueueRef.current.pending,
        ...operationQueueRef.current.inProgress,
        ...operationQueueRef.current.failed
      ])

      // Try to sync immediately if online
      if (isOnline && !syncInProgressRef.current) {
        setTimeout(() => syncPendingOperations(), 100)
      }
    }

    toast({
      title: "Item deleted",
      description: isOnline ? "Changes will be synced automatically" : "Changes will sync when online",
    })
  }, [syncEndpoint, isOnline, syncPendingOperations, addToQueue, toast])

  // Force sync
  const forceSync = useCallback(async () => {
    await syncPendingOperations()
  }, [syncPendingOperations])

  // Clear pending sync operations
  const clearPendingSync = useCallback(() => {
    // Clear queue
    operationQueueRef.current = {
      pending: [],
      inProgress: [],
      completed: [],
      failed: []
    }

    // Clear locks
    syncLockRef.current.clear()

    // Update state
    setPendingOperations([])

    // Clear localStorage
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