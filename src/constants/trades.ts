
/**
 * Trade options aligned with the `trade_type` enum in the database
 * (based on mappings used in contractor data processing).
 * Adjust labels as needed.
 */
export type TradeOption = { value: string; label: string };

export const TRADE_OPTIONS: TradeOption[] = [
  { value: 'tower_crane', label: 'Tower Crane' },
  { value: 'mobile_crane', label: 'Mobile Crane' },
  { value: 'demolition', label: 'Demolition' },
  { value: 'piling', label: 'Piling' },
  { value: 'excavations', label: 'Excavations' },
  { value: 'scaffolding', label: 'Scaffolding' },
  { value: 'post_tensioning', label: 'Post-Tensioning' },
  { value: 'concreting', label: 'Concreting' },
  { value: 'form_work', label: 'Formwork' },
  { value: 'steel_fixing', label: 'Steel Fixing' },
  { value: 'bricklaying', label: 'Bricklaying' },
  { value: 'traffic_control', label: 'Traffic Control' },
  { value: 'labour_hire', label: 'Labour Hire' },
  { value: 'carpentry', label: 'Carpentry' },
  { value: 'windows', label: 'Windows / Facade' },
  { value: 'facade', label: 'Facade' },
  { value: 'painting', label: 'Painting' },
  { value: 'waterproofing', label: 'Waterproofing' },
  { value: 'plastering', label: 'Plastering' },
  { value: 'edge_protection', label: 'Edge Protection' },
  { value: 'hoist', label: 'Hoist' },
  { value: 'kitchens', label: 'Kitchens' },
  { value: 'tiling', label: 'Tiling' },
  { value: 'cleaning', label: 'Cleaning' },
  { value: 'final_clean', label: 'Final Clean' },
  { value: 'flooring', label: 'Flooring' },
  { value: 'structural_steel', label: 'Structural Steel' },
  { value: 'landscaping', label: 'Landscaping' },
];
