/**
 * @deprecated This file is deprecated - use @/constants/keyContractorTrades instead
 * 
 * This file was created during the Add Employer feature implementation but
 * duplicates keyContractorTrades.ts. All imports should be updated to use:
 * 
 * import { useKeyContractorTrades } from '@/hooks/useKeyContractorTrades'
 * or
 * import { KEY_CONTRACTOR_TRADES_FALLBACK } from '@/constants/keyContractorTrades'
 * 
 * This file will be removed in a future update.
 */

// Re-export from canonical location
export {
  KEY_CONTRACTOR_TRADES,
  KEY_CONTRACTOR_TRADES_FALLBACK,
  KEY_CONTRACTOR_TRADES_SET,
  type KeyContractorTrade,
  useKeyContractorTrades,
  useKeyContractorTradesArray,
  useKeyContractorTradesSet,
  getKeyContractorTradesFromCache
} from '@/constants/keyContractorTrades'

/**
 * @deprecated Use useKeyContractorTradesSet().has() instead
 */
export function isKeyContractorTrade(tradeValue: string): boolean {
  return KEY_CONTRACTOR_TRADES.includes(tradeValue as any);
}

