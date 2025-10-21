import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useMemo } from 'react'

export interface KeyContractorTrade {
  id: string
  trade_type: string
  display_order: number
  is_active: boolean
  notes?: string | null
  added_at: string
  updated_at?: string | null
}

/**
 * Hook to fetch key contractor trades from database
 * Replaces hard-coded KEY_CONTRACTOR_TRADES constant
 * 
 * Features:
 * - 5-minute stale time for caching
 * - Automatic refetch on window focus
 * - Returns array of trade_type strings for easy consumption
 */
export function useKeyContractorTrades() {
  return useQuery({
    queryKey: ['key-contractor-trades'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('key_contractor_trades')
        .select('id, trade_type, display_order, is_active, notes, added_at, updated_at')
        .eq('is_active', true)
        .order('display_order')
      
      if (error) {
        console.error('Error fetching key contractor trades:', error)
        throw error
      }
      
      return (data || []) as KeyContractorTrade[]
    },
    staleTime: 5 * 60 * 1000, // 5 minutes - balance between freshness and performance
    gcTime: 10 * 60 * 1000, // 10 minutes in cache
    refetchOnWindowFocus: true, // Refetch when user returns to app
    refetchOnMount: true, // Always check on component mount
  })
}

/**
 * Hook that returns just the trade_type strings as an array
 * Most common usage pattern - direct replacement for hard-coded arrays
 * 
 * Example usage:
 *   const keyTrades = useKeyContractorTradesArray()
 *   // Returns: ['demolition', 'piling', 'concrete', ...]
 */
export function useKeyContractorTradesArray() {
  const { data = [], isLoading, error } = useKeyContractorTrades()
  
  const tradeTypes = useMemo(
    () => data.map(trade => trade.trade_type),
    [data]
  )
  
  return { 
    trades: tradeTypes, 
    isLoading, 
    error,
    count: tradeTypes.length 
  }
}

/**
 * Hook that returns a Set of trade types for O(1) lookups
 * Best for checking if a trade is a key trade
 * 
 * Example usage:
 *   const keyTradesSet = useKeyContractorTradesSet()
 *   if (keyTradesSet.has('scaffolding')) { ... }
 */
export function useKeyContractorTradesSet() {
  const { data = [], isLoading, error } = useKeyContractorTrades()
  
  const tradeSet = useMemo(
    () => new Set(data.map(trade => trade.trade_type)),
    [data]
  )
  
  return { 
    tradeSet, 
    isLoading, 
    error,
    has: (tradeType: string) => tradeSet.has(tradeType)
  }
}

/**
 * Hook for admin operations on key trades
 * Only works for users with admin role
 */
export function useKeyContractorTradesAdmin() {
  const queryClient = useQueryClient()
  
  const addTrade = useMutation({
    mutationFn: async ({ trade_type, display_order, notes }: { 
      trade_type: string
      display_order?: number
      notes?: string 
    }) => {
      const response = await fetch('/api/admin/key-trades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trade_type, display_order, notes })
      })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to add trade')
      }
      
      return response.json()
    },
    onSuccess: () => {
      // Invalidate and refetch
      queryClient.invalidateQueries({ queryKey: ['key-contractor-trades'] })
    }
  })
  
  const removeTrade = useMutation({
    mutationFn: async ({ trade_type, id }: { trade_type?: string, id?: string }) => {
      const response = await fetch('/api/admin/key-trades', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trade_type, id })
      })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to remove trade')
      }
      
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['key-contractor-trades'] })
    }
  })
  
  const reorderTrades = useMutation({
    mutationFn: async (trades: Array<{ id: string, display_order: number }>) => {
      const response = await fetch('/api/admin/key-trades', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trades })
      })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to reorder trades')
      }
      
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['key-contractor-trades'] })
    }
  })
  
  return {
    addTrade,
    removeTrade,
    reorderTrades
  }
}

/**
 * Synchronous helper for getting key trades from React Query cache
 * Only use when you need immediate access and can handle stale data
 * 
 * Returns fallback array if cache is empty (to prevent crashes)
 */
export function getKeyContractorTradesFromCache(queryClient: any): string[] {
  const cached = queryClient.getQueryData<KeyContractorTrade[]>(['key-contractor-trades'])
  
  if (cached && cached.length > 0) {
    return cached.map(t => t.trade_type)
  }
  
  // Fallback to current hard-coded list if cache is empty
  // This ensures the app doesn't break during initial load
  return [
    'demolition',
    'piling', 
    'concrete',
    'scaffolding',
    'form_work',
    'tower_crane',
    'mobile_crane',
    'labour_hire',
    'earthworks',
    'traffic_control'
  ]
}

/**
 * Helper to check if a trade type is a key contractor trade
 * Uses synchronous cache lookup for performance
 */
export function isKeyContractorTrade(tradeType: string, queryClient: any): boolean {
  const keyTrades = getKeyContractorTradesFromCache(queryClient)
  return keyTrades.includes(tradeType)
}


