
/**
 * Canonical trade options aligned with the `trade_type` enum in the database.
 * Complete list of 53 trade types including 10 new types added for BCI import compatibility.
 * This is the single source of truth for all trade type mappings across the application.
 */
export type TradeOption = { value: string; label: string };

export const TRADE_OPTIONS: TradeOption[] = [
  // Crane & Rigging
  { value: 'tower_crane', label: 'Tower Crane' },
  { value: 'mobile_crane', label: 'Mobile Crane' },
  { value: 'crane_and_rigging', label: 'Crane & Rigging' },
  
  // Early Works
  { value: 'demolition', label: 'Demolition' },
  { value: 'earthworks', label: 'Earthworks' },
  { value: 'piling', label: 'Piling' },
  { value: 'excavations', label: 'Excavations' },
  { value: 'scaffolding', label: 'Scaffolding' },
  { value: 'traffic_control', label: 'Traffic Control' },
  { value: 'traffic_management', label: 'Traffic Management' },
  { value: 'waste_management', label: 'Waste Management' },
  { value: 'cleaning', label: 'Cleaning' },
  { value: 'final_clean', label: 'Final Clean' },
  
  // Structure
  { value: 'concrete', label: 'Concrete' },
  { value: 'concreting', label: 'Concreting' },
  { value: 'form_work', label: 'Formwork' },
  { value: 'reinforcing_steel', label: 'Reinforcing Steel' },
  { value: 'steel_fixing', label: 'Steel Fixing' },
  { value: 'post_tensioning', label: 'Post-Tensioning' },
  { value: 'structural_steel', label: 'Structural Steel' },
  { value: 'bricklaying', label: 'Bricklaying' },
  { value: 'foundations', label: 'Foundations' }, // NEW
  
  // Finishing
  { value: 'carpentry', label: 'Carpentry' },
  { value: 'electrical', label: 'Electrical' },
  { value: 'plumbing', label: 'Plumbing' },
  { value: 'painting', label: 'Painting' },
  { value: 'plastering', label: 'Plastering' },
  { value: 'waterproofing', label: 'Waterproofing' },
  { value: 'tiling', label: 'Tiling' },
  { value: 'flooring', label: 'Flooring' },
  { value: 'roofing', label: 'Roofing' },
  { value: 'windows', label: 'Windows' },
  { value: 'facade', label: 'Facade' },
  { value: 'glazing', label: 'Glazing' },
  { value: 'kitchens', label: 'Kitchens' },
  { value: 'landscaping', label: 'Landscaping' },
  { value: 'insulation', label: 'Insulation' }, // NEW
  { value: 'internal_walls', label: 'Internal Walls' }, // NEW
  { value: 'ceilings', label: 'Ceilings' }, // NEW
  { value: 'stairs_balustrades', label: 'Stairs & Balustrades' }, // NEW
  
  // Services & Equipment
  { value: 'mechanical_services', label: 'Mechanical Services' },
  { value: 'fire_protection', label: 'Fire Protection' },
  { value: 'security_systems', label: 'Security Systems' },
  { value: 'plant_and_equipment', label: 'Plant & Equipment' },
  { value: 'hoist', label: 'Hoist' },
  { value: 'edge_protection', label: 'Edge Protection' },
  { value: 'building_services', label: 'Building Services' }, // NEW
  
  // Specialized
  { value: 'civil_infrastructure', label: 'Civil Infrastructure' }, // NEW
  { value: 'fitout', label: 'Fitout' }, // NEW
  { value: 'technology', label: 'Technology' }, // NEW
  { value: 'pools', label: 'Swimming Pools' }, // NEW
  { value: 'pipeline', label: 'Pipeline' }, // NEW
  
  // General
  { value: 'labour_hire', label: 'Labour Hire' },
  { value: 'general_construction', label: 'General Construction' },
  { value: 'other', label: 'Other' },
];

/**
 * Trade to stage mapping for consistent categorization across the application
 */
export const TRADE_STAGE_MAPPING: Record<string, 'early_works' | 'structure' | 'finishing' | 'other'> = {
  // Early Works
  'demolition': 'early_works',
  'earthworks': 'early_works',
  'piling': 'early_works',
  'excavations': 'early_works',
  'scaffolding': 'early_works',
  'traffic_control': 'early_works',
  'traffic_management': 'early_works',
  'waste_management': 'early_works',
  'cleaning': 'early_works',
  'labour_hire': 'early_works',
  
  // Structure
  'tower_crane': 'structure',
  'mobile_crane': 'structure',
  'crane_and_rigging': 'structure',
  'concrete': 'structure',
  'concreting': 'structure',
  'form_work': 'structure',
  'reinforcing_steel': 'structure',
  'steel_fixing': 'structure',
  'post_tensioning': 'structure',
  'structural_steel': 'structure',
  'bricklaying': 'structure',
  'foundations': 'structure',
  
  // Finishing
  'carpentry': 'finishing',
  'electrical': 'finishing',
  'plumbing': 'finishing',
  'mechanical_services': 'finishing',
  'painting': 'finishing',
  'plastering': 'finishing',
  'waterproofing': 'finishing',
  'tiling': 'finishing',
  'flooring': 'finishing',
  'roofing': 'finishing',
  'windows': 'finishing',
  'facade': 'finishing',
  'glazing': 'finishing',
  'kitchens': 'finishing',
  'landscaping': 'finishing',
  'final_clean': 'finishing',
  'insulation': 'finishing',
  'internal_walls': 'finishing',
  'ceilings': 'finishing',
  'stairs_balustrades': 'finishing',
  'fire_protection': 'finishing',
  'security_systems': 'finishing',
  'building_services': 'finishing',
  'fitout': 'finishing',
  'technology': 'finishing',
  
  // Other
  'plant_and_equipment': 'other',
  'hoist': 'other',
  'edge_protection': 'other',
  'civil_infrastructure': 'other',
  'pools': 'other',
  'pipeline': 'other',
  'general_construction': 'other',
  'other': 'other',
};
