export interface PatchMatch {
  id: string;
  name: string;
  code?: string;
  confidence: 'exact' | 'high' | 'medium' | 'low';
  similarity: number;
  distance?: number;
}

export interface GeoJSONFeature {
  type: 'Feature';
  geometry: {
    type: string;
    coordinates: number[][][];
  };
  properties: {
    fid: number;
    patch_id: string;
    patch_name: string;
    coordinator?: string;
    [key: string]: any;
  };
}

export interface ParsedPatch {
  fid: number;
  patch_id: string;
  patch_name: string;
  coordinator?: string;
  geometry: string; // WKT format for PostGIS
  original_geometry: any; // Keep original GeoJSON geometry
  status: 'new' | 'existing' | 'manual_match' | 'multiple_match' | 'unmapped';
  existing_patch_ids?: string[]; // For one-to-many mappings
  match_confidence?: 'exact' | 'high' | 'medium' | 'low';
  match_similarity?: number;
  suggested_matches?: PatchMatch[];
  mapping_notes?: string; // For user notes about the mapping
  is_mapped: boolean; // Whether this feature has been mapped to any patch
  can_clear_match: boolean; // Whether this match can be cleared/decoupled
}

export interface PatchMapping {
  feature_id: number;
  patch_ids: string[];
  mapping_type: 'one_to_one' | 'one_to_many' | 'many_to_one' | 'unmapped';
  confidence: 'exact' | 'high' | 'medium' | 'low';
  similarity: number;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface DecoupledMapping {
  feature_id: number;
  patch_ids: string[];
  decoupled_at: string;
  reason: string;
}

// Enhanced string similarity function for patch matching
function calculateSimilarity(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) return 1.0;
  
  // Check for exact match first
  if (str1.toLowerCase() === str2.toLowerCase()) return 1.0;
  
  // Check for partial matches (one string contains the other)
  if (longer.toLowerCase().includes(shorter.toLowerCase())) {
    return 0.8; // High confidence for partial matches
  }
  
  // Check for number pattern matches (e.g., "patch100" vs "Sydney 100")
  const numbers1 = (str1.match(/\d+/g) || []) as string[];
  const numbers2 = (str2.match(/\d+/g) || []) as string[];
  if (numbers1.length > 0 && numbers2.length > 0) {
    const commonNumbers = numbers1.filter(n => numbers2.includes(n));
    if (commonNumbers.length > 0) {
      // If numbers match, give higher similarity
      const baseSimilarity = 0.6;
      const numberBonus = 0.2;
      return Math.min(0.9, baseSimilarity + numberBonus);
    }
  }
  
  // Check for common patch patterns
  const patterns = [
    { pattern: /patch\s*(\d+)/i, replacement: 'Sydney $1' },
    { pattern: /area\s*(\d+)/i, replacement: 'Sydney $1' },
    { pattern: /zone\s*(\d+)/i, replacement: 'Sydney $1' }
  ];
  
  for (const { pattern, replacement } of patterns) {
    if (pattern.test(str1) && replacement.replace('$1', str1.match(pattern)?.[1] || '') === str2) {
      return 0.85; // High confidence for pattern matches
    }
    if (pattern.test(str2) && replacement.replace('$1', str2.match(pattern)?.[1] || '') === str1) {
      return 0.85; // High confidence for pattern matches
    }
  }
  
  // Fall back to Levenshtein distance
  const editDistance = levenshteinDistance(longer, shorter);
  const baseSimilarity = (longer.length - editDistance) / longer.length;
  
  // Boost similarity for shorter strings to catch more matches
  const lengthBoost = Math.min(0.3, (10 - longer.length) * 0.05);
  return Math.min(1.0, baseSimilarity + lengthBoost);
}

function levenshteinDistance(str1: string, str2: string): number {
  const matrix = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
}

export function normalizePatchName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ');
}

export function findBestPatchMatches(
  patchName: string, 
  existingPatches: Array<{id: string, name: string, code?: string}>
): PatchMatch[] {
  const normalizedSearchName = normalizePatchName(patchName);
  
  const matches: PatchMatch[] = [];
  
  for (const patch of existingPatches) {
    const normalizedPatchName = normalizePatchName(patch.name);
    
    // Check for exact match first
    if (normalizedSearchName === normalizedPatchName) {
      matches.push({
        id: patch.id,
        name: patch.name,
        code: patch.code,
        confidence: 'exact',
        similarity: 1.0,
        distance: 0
      });
      continue;
    }
    
    // Calculate similarity
    const similarity = calculateSimilarity(normalizedSearchName, normalizedPatchName);
    
    // Lower threshold to catch more potential matches - even partial matches
    if (similarity > 0.2) { // Reduced from 0.3 to 0.2 (20%) to catch more matches
      const confidence = similarity >= 0.9 ? 'high' : 
                       similarity >= 0.6 ? 'medium' : 'low'; // Lowered thresholds for better matching
      
      matches.push({
        id: patch.id,
        name: patch.name,
        code: patch.code,
        confidence,
        similarity,
        distance: 1 - similarity
      });
    }
  }
  
  // Sort by confidence and similarity
  return matches.sort((a, b) => {
    const confidenceOrder = { exact: 0, high: 1, medium: 2, low: 3 };
    const confidenceDiff = confidenceOrder[a.confidence] - confidenceOrder[b.confidence];
    if (confidenceDiff !== 0) return confidenceDiff;
    return b.similarity - a.similarity;
  });
}

export function convertToWKT(geometry: any): string {
  if (geometry.type === 'Polygon') {
    // Convert single Polygon to MultiPolygon format for database compatibility
    const coords = geometry.coordinates[0]; // Outer ring
    const points = coords.map((coord: number[]) => `${coord[0]} ${coord[1]}`).join(', ');
    const wkt = `MULTIPOLYGON(((${points})))`;
    
    // Debug logging
    console.log(`Converting Polygon to WKT:`, {
      originalType: geometry.type,
      coordinateCount: coords.length,
      firstCoord: coords[0],
      lastCoord: coords[coords.length - 1],
      wkt: wkt,
      wktLength: wkt.length
    });
    
    return wkt;
  }
  if (geometry.type === 'MultiPolygon') {
    const polygons = geometry.coordinates.map((polygon: number[][][]) => {
      const coords = polygon[0]; // Outer ring of each polygon
      const points = coords.map((coord: number[]) => `${coord[0]} ${coord[1]}`).join(', ');
      return `(${points})`;
    }).join(', ');
    const wkt = `MULTIPOLYGON(${polygons})`;
    
    // Debug logging
    console.log(`Converting MultiPolygon to WKT:`, {
      originalType: geometry.type,
      polygonCount: geometry.coordinates.length,
      wkt: wkt,
      wktLength: wkt.length
    });
    
    return wkt;
  }
  throw new Error(`Unsupported geometry type: ${geometry.type}`);
}

export function parsePatchesWithFuzzyMatching(
  features: GeoJSONFeature[],
  existingPatches: Array<{id: string, name: string, code?: string, type?: string}>
): ParsedPatch[] {
  
  const patches: ParsedPatch[] = [];
  
  for (const feature of features) {
    const { fid, patch_id, patch_name, coordinator } = feature.properties;
    
    // Convert coordinates to WKT format for PostGIS
    const wkt = convertToWKT(feature.geometry);
    
    // Find potential matches using fuzzy logic
    const matches = findBestPatchMatches(patch_name, existingPatches);
    
    let status: ParsedPatch['status'] = 'new';
    let existing_patch_ids: string[] = [];
    let match_confidence: 'exact' | 'high' | 'medium' | 'low' | undefined;
    let match_similarity: number | undefined;
    
    if (matches.length > 0) {
      const bestMatch = matches[0];
      
      if (bestMatch.confidence === 'exact') {
        status = 'existing';
        existing_patch_ids = [bestMatch.id];
        match_confidence = bestMatch.confidence;
        match_similarity = bestMatch.similarity;
      } else if (bestMatch.confidence === 'high' || bestMatch.confidence === 'medium' || bestMatch.confidence === 'low') {
        status = 'manual_match';
        existing_patch_ids = [bestMatch.id]; // Set the existing patch ID for manual matches
        match_confidence = bestMatch.confidence;
        match_similarity = bestMatch.similarity;
      }
    } else {
      // No automatic matches found - allow manual selection
      status = 'manual_match';
      existing_patch_ids = [];
      match_confidence = undefined;
      match_similarity = undefined;
    }
    
    const patch: ParsedPatch = {
      fid,
      patch_id,
      patch_name,
      coordinator,
      geometry: wkt,
      original_geometry: feature.geometry,
      status,
      existing_patch_ids,
      match_confidence,
      match_similarity,
      suggested_matches: matches,
      is_mapped: status !== 'new',
      can_clear_match: status === 'manual_match' || status === 'existing'
    };
    
    patches.push(patch);
  }
  
  return patches;
}

/**
 * Clear/decouple a match between a feature and existing patches
 */
export function clearPatchMatch(patch: ParsedPatch): ParsedPatch {
  return {
    ...patch,
    status: 'new',
    existing_patch_ids: [],
    match_confidence: undefined,
    match_similarity: undefined,
    is_mapped: false,
    can_clear_match: false,
    mapping_notes: patch.mapping_notes ? `${patch.mapping_notes} [Match cleared at ${new Date().toISOString()}]` : `Match cleared at ${new Date().toISOString()}`
  };
}

/**
 * Create a many-to-one mapping (multiple features to one patch)
 */
export function createManyToOneMapping(
  features: ParsedPatch[],
  targetPatchId: string,
  targetPatchName: string
): ParsedPatch[] {
  return features.map(feature => ({
    ...feature,
    status: 'manual_match',
    existing_patch_ids: [targetPatchId],
    match_confidence: 'medium',
    match_similarity: 0.7,
    is_mapped: true,
    can_clear_match: true,
    mapping_notes: `Many-to-one mapping to ${targetPatchName}`
  }));
}

/**
 * Create a one-to-many mapping (one feature to multiple patches)
 */
export function createOneToManyMapping(
  feature: ParsedPatch,
  targetPatchIds: string[],
  targetPatchNames: string[]
): ParsedPatch {
  return {
    ...feature,
    status: 'multiple_match',
    existing_patch_ids: targetPatchIds,
    match_confidence: 'medium',
    match_similarity: 0.7,
    is_mapped: true,
    can_clear_match: true,
    mapping_notes: `One-to-many mapping to: ${targetPatchNames.join(', ')}`
  };
}
