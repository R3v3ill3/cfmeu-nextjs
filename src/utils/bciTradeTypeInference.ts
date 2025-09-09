/**
 * Utility functions for inferring trade types from company names
 * Used in BCI project imports and other company classification scenarios
 */

export type TradeType = 
  | 'scaffolding'
  | 'form_work'
  | 'reinforcing_steel'
  | 'concrete'
  | 'crane_and_rigging'
  | 'plant_and_equipment'
  | 'electrical'
  | 'plumbing'
  | 'carpentry'
  | 'painting'
  | 'flooring'
  | 'roofing'
  | 'glazing'
  | 'landscaping'
  | 'demolition'
  | 'earthworks'
  | 'structural_steel'
  | 'mechanical_services'
  | 'fire_protection'
  | 'security_systems'
  | 'cleaning'
  | 'traffic_management'
  | 'waste_management'
  | 'general_construction'
  | 'other'
  | 'tower_crane'
  | 'mobile_crane'
  | 'post_tensioning'
  | 'concreting'
  | 'steel_fixing'
  | 'bricklaying'
  | 'traffic_control'
  | 'labour_hire'
  | 'windows'
  | 'waterproofing'
  | 'plastering'
  | 'edge_protection'
  | 'hoist'
  | 'kitchens'
  | 'tiling'
  | 'piling'
  | 'excavations'
  | 'facade'
  | 'final_clean';

/**
 * Infer trade type from company name using keyword matching
 * @param companyName - The company name to analyze
 * @returns The inferred trade type or 'general_construction' as default
 */
export function inferTradeTypeFromCompanyName(companyName: string): TradeType {
  if (!companyName) return 'general_construction';
  
  const name = companyName.toLowerCase();
  
  // Crane and rigging companies
  if (name.includes('crane') || name.includes('rigging') || name.includes('lift')) {
    if (name.includes('tower')) return 'tower_crane';
    if (name.includes('mobile')) return 'mobile_crane';
    return 'crane_and_rigging';
  }
  
  // Electrical companies
  if (name.includes('electrical') || name.includes('electric') || name.includes('power')) {
    return 'electrical';
  }
  
  // Plumbing companies
  if (name.includes('plumbing') || name.includes('plumber') || name.includes('pipe')) {
    return 'plumbing';
  }
  
  // Concrete and formwork companies - Enhanced formwork matching
  if (
    name.includes('concrete') ||
    name.includes('concreting') ||
    name.includes('formwork') ||
    name.includes('form work') ||
    name.includes('form-work') ||
    name.includes('formworker') ||
    name.includes('form worker') ||
    name.includes('farmwork') // Common misspelling
  ) {
    // Prioritise explicit formwork indicators with better pattern matching
    if (
      name.includes('formwork') ||
      name.includes('form work') ||
      name.includes('form-work') ||
      name.includes('formworker') ||
      name.includes('form worker') ||
      name.includes('farmwork') || // Common misspelling/typo
      /form\s*work/i.test(name) // Regex for variations with spaces
    ) {
      return 'form_work';
    }
    if (name.includes('post') && name.includes('tension')) return 'post_tensioning';
    if (name.includes('steel') && name.includes('fix')) return 'steel_fixing';
    return 'concrete';
  }
  
  // Steel companies
  if (name.includes('steel') || name.includes('structural')) {
    if (name.includes('fix')) return 'steel_fixing';
    return 'structural_steel';
  }
  
  // Roofing companies
  if (name.includes('roof') || name.includes('roofing')) {
    return 'roofing';
  }
  
  // Scaffolding companies
  if (name.includes('scaffold') || name.includes('scaffolding')) {
    return 'scaffolding';
  }
  
  // Painting companies
  if (name.includes('paint') || name.includes('painting')) {
    return 'painting';
  }
  
  // Carpentry companies
  if (name.includes('carpent') || name.includes('joinery') || name.includes('timber')) {
    return 'carpentry';
  }
  
  // Flooring companies
  if (name.includes('floor') || name.includes('flooring') || name.includes('tiling')) {
    if (name.includes('tile')) return 'tiling';
    return 'flooring';
  }
  
  // Windows and glazing companies
  if (name.includes('window') || name.includes('glaz') || name.includes('glass')) {
    return 'windows';
  }
  
  // Waterproofing companies
  if (name.includes('waterproof') || name.includes('water proof')) {
    return 'waterproofing';
  }
  
  // Plastering companies
  if (name.includes('plaster') || name.includes('plastering')) {
    return 'plastering';
  }
  
  // Edge protection companies
  if (name.includes('edge') && name.includes('protection')) {
    return 'edge_protection';
  }
  
  // Hoist companies
  if (name.includes('hoist') || name.includes('elevator')) {
    return 'hoist';
  }
  
  // Kitchen companies
  if (name.includes('kitchen') || name.includes('cabinet')) {
    return 'kitchens';
  }
  
  // Piling companies
  if (name.includes('pile') || name.includes('piling')) {
    return 'piling';
  }
  
  // Excavation companies
  if (name.includes('excavation') || name.includes('excavate') || name.includes('dig')) {
    return 'excavations';
  }
  
  // Facade companies
  if (name.includes('facade') || name.includes('cladding')) {
    return 'facade';
  }
  
  // Final cleaning companies
  if (name.includes('clean') && (name.includes('final') || name.includes('end'))) {
    return 'final_clean';
  }
  
  // Demolition companies
  if (name.includes('demolition') || name.includes('demolish')) {
    return 'demolition';
  }
  
  // Earthworks companies
  if (name.includes('earthwork') || name.includes('earth work') || name.includes('grading')) {
    return 'earthworks';
  }
  
  // Mechanical services companies
  if (name.includes('mechanical') || name.includes('hvac') || name.includes('air conditioning')) {
    return 'mechanical_services';
  }
  
  // Fire protection companies
  if (name.includes('fire') && (name.includes('protection') || name.includes('sprinkler'))) {
    return 'fire_protection';
  }
  
  // Security systems companies
  if (name.includes('security') || name.includes('alarm') || name.includes('cctv')) {
    return 'security_systems';
  }
  
  // Cleaning companies
  if (name.includes('clean') || name.includes('cleaning')) {
    return 'cleaning';
  }
  
  // Traffic management companies
  if (name.includes('traffic') && (name.includes('management') || name.includes('control'))) {
    return 'traffic_management';
  }
  
  // Waste management companies
  if (name.includes('waste') || name.includes('rubbish') || name.includes('garbage')) {
    return 'waste_management';
  }
  
  // Plant and equipment companies
  if (name.includes('plant') || name.includes('equipment') || name.includes('machinery')) {
    return 'plant_and_equipment';
  }
  
  // Labour hire companies
  if (name.includes('labour') || name.includes('labor') || name.includes('hire') || name.includes('recruitment')) {
    return 'labour_hire';
  }
  
  // Default to general construction
  return 'general_construction';
}

/**
 * Get a human-readable label for a trade type
 * @param tradeType - The trade type enum value
 * @returns A human-readable label
 */
export function getTradeTypeLabel(tradeType: TradeType): string {
  const labels: Record<TradeType, string> = {
    scaffolding: 'Scaffolding',
    form_work: 'Form Work',
    reinforcing_steel: 'Reinforcing Steel',
    concrete: 'Concrete',
    crane_and_rigging: 'Crane & Rigging',
    plant_and_equipment: 'Plant & Equipment',
    electrical: 'Electrical',
    plumbing: 'Plumbing',
    carpentry: 'Carpentry',
    painting: 'Painting',
    flooring: 'Flooring',
    roofing: 'Roofing',
    glazing: 'Glazing',
    landscaping: 'Landscaping',
    demolition: 'Demolition',
    earthworks: 'Earthworks',
    structural_steel: 'Structural Steel',
    mechanical_services: 'Mechanical Services',
    fire_protection: 'Fire Protection',
    security_systems: 'Security Systems',
    cleaning: 'Cleaning',
    traffic_management: 'Traffic Management',
    waste_management: 'Waste Management',
    general_construction: 'General Construction',
    other: 'Other',
    tower_crane: 'Tower Crane',
    mobile_crane: 'Mobile Crane',
    post_tensioning: 'Post Tensioning',
    concreting: 'Concreting',
    steel_fixing: 'Steel Fixing',
    bricklaying: 'Bricklaying',
    traffic_control: 'Traffic Control',
    labour_hire: 'Labour Hire',
    windows: 'Windows',
    waterproofing: 'Waterproofing',
    plastering: 'Plastering',
    edge_protection: 'Edge Protection',
    hoist: 'Hoist',
    kitchens: 'Kitchens',
    tiling: 'Tiling',
    piling: 'Piling',
    excavations: 'Excavations',
    facade: 'Facade',
    final_clean: 'Final Clean'
  };
  
  return labels[tradeType] || 'Unknown Trade';
}

/**
 * Get trade type categories for grouping
 * @returns Object mapping trade types to their categories
 */
export function getTradeTypeCategories(): Record<string, TradeType[]> {
  return {
    'Structural': ['concrete', 'structural_steel', 'steel_fixing', 'reinforcing_steel', 'form_work'],
    'Cranes & Lifting': ['tower_crane', 'mobile_crane', 'crane_and_rigging', 'hoist'],
    'Mechanical & Electrical': ['electrical', 'plumbing', 'mechanical_services', 'fire_protection', 'security_systems'],
    'Finishing': ['carpentry', 'painting', 'flooring', 'roofing', 'glazing', 'windows', 'tiling', 'plastering', 'waterproofing'],
    'Site Services': ['scaffolding', 'cleaning', 'traffic_management', 'waste_management', 'labour_hire'],
    'Specialist': ['demolition', 'earthworks', 'excavations', 'piling', 'facade', 'edge_protection', 'final_clean'],
    'Equipment': ['plant_and_equipment', 'post_tensioning'],
    'General': ['general_construction', 'other']
  };
}

/**
 * Infer trade type directly from CSV Role text using a richer synonym set.
 * Prefer this over company name when CSV Role is present.
 */
export function inferTradeTypeFromCsvRole(csvRole: string): TradeType | null {
  if (!csvRole) return null;
  const role = csvRole.toLowerCase();
  const has = (p: string | RegExp) => (typeof p === 'string' ? role.includes(p) : p.test(role));

  // Specific before general
  if (has('post tension')) return 'post_tensioning';
  if (has('steel fix')) return 'steel_fixing';
  if (has('formwork') || has('form work') || has('form-work') || has('form worker') || has('farmwork') || /form\s*work/i.test(role)) return 'form_work';
  if (has('earthwork') || has('earth moving') || has('earthmoving')) return 'earthworks';
  if (has('excavat')) return 'excavations';
  if (has('piling')) return 'piling';
  if (has('traffic control')) return 'traffic_control';
  if (has('traffic')) return 'traffic_management';
  if (has('waste')) return 'waste_management';
  if (has('plant') || has('equipment') || has('hire')) return 'plant_and_equipment';
  if (has('crane')) return 'crane_and_rigging';
  if (has('elect')) return 'electrical';
  if (has('plumb')) return 'plumbing';
  if (has('mechanical') || has('hvac')) return 'mechanical_services';
  if (has('fire')) return 'fire_protection';
  if (has('security') || has('alarm') || has('cctv')) return 'security_systems';
  if (has('scaffold')) return 'scaffolding';
  if (has('roof')) return 'roofing';
  if (has('paint')) return 'painting';
  if (has('carpent') || has('joinery')) return 'carpentry';
  if (has('glaz') || has('window') || has('facade') || has('cladding')) return 'facade';
  if (has('floor') || has('tiling')) return 'flooring';
  if (has('tile')) return 'tiling';
  if (has('waterproof')) return 'waterproofing';
  if (has('plaster')) return 'plastering';
  if (has('edge protection')) return 'edge_protection';
  if (has('hoist') || has('mast climber')) return 'hoist';
  if (has('kitchen') || has('cabinet')) return 'kitchens';
  if (has('demolit')) return 'demolition';
  if (has('clean') && (has('final') || has('end'))) return 'final_clean';
  if (has('clean')) return 'cleaning';
  if (has('labour') || has('labor') || has('hire') || has('recruitment')) return 'labour_hire';
  if (has('concrete')) return 'concrete';
  if (has('steel') || has('structural')) return 'structural_steel';

  return null;
}

/**
 * Check if a company name suggests a specific trade type with confidence
 * @param companyName - The company name to analyze
 * @param tradeType - The trade type to check for
 * @returns Confidence score from 0 to 1
 */
export function getTradeTypeConfidence(companyName: string, tradeType: TradeType): number {
  if (!companyName) return 0;
  
  const name = companyName.toLowerCase();
  const inferredType = inferTradeTypeFromCompanyName(companyName);
  
  // Exact match gets highest confidence
  if (inferredType === tradeType) return 1.0;
  
  // Check for partial matches
  const tradeTypeKeywords: Record<TradeType, string[]> = {
    scaffolding: ['scaffold'],
    electrical: ['electrical', 'electric', 'power'],
    plumbing: ['plumbing', 'plumber', 'pipe'],
    concrete: ['concrete', 'concreting'],
    structural_steel: ['steel', 'structural'],
    // Add more keyword mappings as needed
    // ... other trade types
  } as Record<TradeType, string[]>;
  
  const keywords = tradeTypeKeywords[tradeType] || [];
  if (keywords.length === 0) return 0;
  
  // Check if any keywords are present
  const hasKeywords = keywords.some(keyword => name.includes(keyword));
  if (hasKeywords) return 0.7;
  
  return 0;
}
