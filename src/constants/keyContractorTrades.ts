export const KEY_CONTRACTOR_TRADES = [
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

export type KeyContractorTrade = typeof KEY_CONTRACTOR_TRADES[number]

export const KEY_CONTRACTOR_TRADES_SET = new Set<string>(KEY_CONTRACTOR_TRADES)


