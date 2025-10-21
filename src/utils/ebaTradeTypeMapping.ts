/**
 * EBA Trade Import - Trade Type Mapping
 * 
 * Maps PDF filename patterns from EBA trade PDFs to database trade_type enum values.
 * These PDFs are categorized by trade and contain employers with active EBAs.
 */

export type TradeType = 
  | 'bricklaying'
  | 'civil_infrastructure'
  | 'cleaning'
  | 'head_contractor'
  | 'concrete'
  | 'form_work'
  | 'internal_walls'
  | 'labour_hire'
  | 'mobile_crane'
  | 'painting'
  | 'scaffolding'
  | 'steel_fixing'
  | 'post_tensioning'
  | 'tower_crane'
  | 'general_construction'
  | 'traffic_control'
  | 'waterproofing'

/**
 * Maps friendly trade names (from PDF filenames) to database trade_type enum
 */
export const EBA_TRADE_MAP: Record<string, TradeType> = {
  'Bricklaying': 'bricklaying',
  'Civil': 'civil_infrastructure',
  'Cleaning': 'cleaning',
  'Commercial Builders': 'head_contractor',
  'Concrete': 'concrete',
  'Formwork': 'form_work',
  'Gyprock': 'internal_walls',
  'Labour Hire': 'labour_hire',
  'Mobile Cranes': 'mobile_crane',
  'Painting': 'painting',
  'Scaffolding': 'scaffolding',
  'Steelfixing': 'steel_fixing',
  'Stress': 'post_tensioning',
  'Tower Crane': 'tower_crane',
  'Trade': 'general_construction',
  'Traffic': 'traffic_control',
  'Waterproofing': 'waterproofing',
}

/**
 * Extracts trade label from EBA PDF filename
 * Expected format: "TradeName as of DD.MM.YY.pdf"
 * 
 * @param filename - The PDF filename
 * @returns The trade label (e.g., "Bricklaying")
 */
export function extractTradeLabelFromFilename(filename: string): string {
  const base = filename.replace(/\.pdf$/i, '')
  const [label] = base.split(/\s+as\s+of\s+/i)
  return label.trim()
}

/**
 * Maps a PDF filename to a database trade_type enum value
 * 
 * @param filename - The PDF filename
 * @returns The trade_type enum value or null if no match found
 */
export function mapFilenameToTradeType(filename: string): TradeType | null {
  const tradeLabel = extractTradeLabelFromFilename(filename)
  return EBA_TRADE_MAP[tradeLabel] || null
}

/**
 * Gets a human-readable label for a trade type
 */
export function getTradeLabelFromType(tradeType: TradeType): string {
  const entry = Object.entries(EBA_TRADE_MAP).find(([_, type]) => type === tradeType)
  return entry ? entry[0] : tradeType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
}

/**
 * Gets all available trade types for dropdown selection
 */
export function getAllTradeOptions(): Array<{ value: TradeType; label: string }> {
  return Object.entries(EBA_TRADE_MAP).map(([label, value]) => ({
    value,
    label,
  }))
}


