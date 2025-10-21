/**
 * @deprecated This constant is being replaced by the dynamic useKeyContractorTrades hook
 * 
 * MIGRATION IN PROGRESS:
 * This file now serves as a fallback for the dynamic key trades system.
 * New code should use the useKeyContractorTrades hook instead:
 * 
 * import { useKeyContractorTradesArray } from '@/hooks/useKeyContractorTrades'
 * 
 * For non-React contexts, use getKeyContractorTradesFromCache with QueryClient
 * 
 * This fallback list will be removed once all code is migrated to the dynamic system.
 */

/**
 * Fallback list of key contractor trades
 * Used only when database is unavailable or during initial load
 * @deprecated Use useKeyContractorTrades hook instead
 */
export const KEY_CONTRACTOR_TRADES_FALLBACK = [
  'demolition',
  'piling',
  'concrete',
  'scaffolding',
  'form_work',
  'tower_crane',
  'mobile_crane',
  'labour_hire',
  'earthworks',
  'traffic_control',
] as const

/**
 * @deprecated Use KEY_CONTRACTOR_TRADES_FALLBACK or useKeyContractorTrades hook
 */
export const KEY_CONTRACTOR_TRADES = KEY_CONTRACTOR_TRADES_FALLBACK

export type KeyContractorTrade = typeof KEY_CONTRACTOR_TRADES_FALLBACK[number]

/**
 * @deprecated Use useKeyContractorTradesSet hook instead
 */
export const KEY_CONTRACTOR_TRADES_SET = new Set<string>(KEY_CONTRACTOR_TRADES_FALLBACK)

// Re-export hook for convenience
export { 
  useKeyContractorTrades,
  useKeyContractorTradesArray,
  useKeyContractorTradesSet,
  getKeyContractorTradesFromCache
} from '@/hooks/useKeyContractorTrades'


