import { TRADE_OPTIONS, TRADE_STAGE_MAPPING } from '@/constants/trades';

export type TradeStage = 'early_works' | 'structure' | 'finishing' | 'other';

/**
 * Get the human-readable label for a trade type
 */
export function getTradeLabel(tradeValue: string): string {
  const trade = TRADE_OPTIONS.find(t => t.value === tradeValue);
  return trade?.label || startCase(tradeValue);
}

/**
 * Get the stage for a given trade type
 */
export function getTradeStage(tradeValue: string): TradeStage {
  return TRADE_STAGE_MAPPING[tradeValue] || 'other';
}

/**
 * Get all trade types for a specific stage
 */
export function getTradesByStage(stage: TradeStage): string[] {
  return Object.entries(TRADE_STAGE_MAPPING)
    .filter(([, tradeStage]) => tradeStage === stage)
    .map(([tradeValue]) => tradeValue);
}

/**
 * Get trade options grouped by stage
 */
export function getTradeOptionsByStage() {
  const groups: Record<TradeStage, Array<{ value: string; label: string }>> = {
    early_works: [],
    structure: [],
    finishing: [],
    other: [],
  };

  TRADE_OPTIONS.forEach(trade => {
    const stage = getTradeStage(trade.value);
    groups[stage].push(trade);
  });

  return groups;
}

/**
 * Convert snake_case to Start Case
 */
export function startCase(str: string): string {
  return str
    .replace(/_/g, ' ')
    .replace(/\b\w/g, char => char.toUpperCase());
}

/**
 * Validate if a trade type exists in our enum
 */
export function isValidTradeType(tradeValue: string): boolean {
  return TRADE_OPTIONS.some(t => t.value === tradeValue);
}

/**
 * Get stage display name
 */
export function getStageLabel(stage: TradeStage): string {
  const labels: Record<TradeStage, string> = {
    early_works: 'Early Works',
    structure: 'Structure',
    finishing: 'Finishing',
    other: 'Other',
  };
  return labels[stage];
}

/**
 * Get all available stages
 */
export function getAllStages(): TradeStage[] {
  return ['early_works', 'structure', 'finishing', 'other'];
}

/**
 * Create a trade options map for quick lookups
 */
export function createTradeOptionsMap(): Map<string, string> {
  return new Map(TRADE_OPTIONS.map(t => [t.value, t.label]));
}

/**
 * Get trade types that commonly work together (for suggestions)
 */
export function getRelatedTrades(tradeValue: string): string[] {
  const stage = getTradeStage(tradeValue);
  return getTradesByStage(stage).filter(t => t !== tradeValue);
}

/**
 * Search trade options by partial name match
 */
export function searchTradeOptions(query: string): Array<{ value: string; label: string }> {
  const lowerQuery = query.toLowerCase();
  return TRADE_OPTIONS.filter(trade => 
    trade.label.toLowerCase().includes(lowerQuery) ||
    trade.value.toLowerCase().includes(lowerQuery)
  );
}

/**
 * Get all available trade types (values only)
 */
export function getAllTradeTypes(): string[] {
  return TRADE_OPTIONS.map(trade => trade.value);
}

/**
 * Get the human-readable label for a trade type (alias for getTradeLabel)
 */
export function getTradeTypeLabel(tradeValue: string): string {
  return getTradeLabel(tradeValue);
}

/**
 * Export the TradeType from constants for type safety
 */
export type TradeType = string; // This matches the trade_type enum values
