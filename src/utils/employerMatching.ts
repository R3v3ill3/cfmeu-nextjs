import { supabase } from '@/integrations/supabase/client';
import { normalizeEmployerName } from '@/lib/employers/normalize';

export interface EmployerMatchingOptions {
  confidenceThreshold: number;
  allowFuzzyMatching: boolean;
  requireUserConfirmation: boolean;
}

export interface EmployerMatch {
  id: string;
  name: string;
  confidence: 'exact' | 'high' | 'medium' | 'low';
  distance: number;
  score: number; // Raw similarity score 0-1
}

export interface EmployerMatchResult {
  match: EmployerMatch | null;
  candidates: EmployerMatch[]; // Alternative matches for user review
  searchQuery: string;
  normalizedQuery: string;
}

// Legacy export retained for backwards compatibility
export const normalizeCompanyName = (name: string): string =>
  normalizeEmployerName(name).normalized;

// Calculate similarity between two strings using Levenshtein distance
function calculateSimilarity(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) return 1.0;
  
  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

function levenshteinDistance(str1: string, str2: string): number {
  const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
  
  for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
  for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;
  
  for (let j = 1; j <= str2.length; j++) {
    for (let i = 1; i <= str1.length; i++) {
      const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1,     // deletion
        matrix[j - 1][i] + 1,     // insertion
        matrix[j - 1][i - 1] + indicator // substitution
      );
    }
  }
  
  return matrix[str2.length][str1.length];
}

// Enhanced token-based matching for better fuzzy search
function tokenBasedSimilarity(query: string, target: string): number {
  const queryTokens = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
  const targetTokens = target.toLowerCase().split(/\s+/).filter(t => t.length > 2);
  
  if (queryTokens.length === 0 || targetTokens.length === 0) return 0;
  
  let matches = 0;
  for (const queryToken of queryTokens) {
    for (const targetToken of targetTokens) {
      if (queryToken === targetToken) {
        matches += 1;
      } else if (targetToken.includes(queryToken) || queryToken.includes(targetToken)) {
        matches += 0.7;
      } else if (calculateSimilarity(queryToken, targetToken) > 0.8) {
        matches += 0.5;
      }
    }
  }
  
  return matches / Math.max(queryTokens.length, targetTokens.length);
}

// Create a comprehensive matching score combining multiple techniques
function calculateMatchScore(query: string, target: string): number {
  const normalizedQuery = normalizeCompanyName(query);
  const normalizedTarget = normalizeCompanyName(target);
  
  // Exact match gets perfect score
  if (normalizedQuery === normalizedTarget) return 1.0;
  
  // Multiple scoring methods
  const levenshteinScore = calculateSimilarity(normalizedQuery, normalizedTarget);
  const tokenScore = tokenBasedSimilarity(query, target);
  const containsScore = normalizedTarget.includes(normalizedQuery) || normalizedQuery.includes(normalizedTarget) ? 0.9 : 0;
  
  // Weighted combination
  return Math.max(
    levenshteinScore * 0.4 + tokenScore * 0.5 + containsScore * 0.1,
    containsScore // Ensure substring matches get good scores
  );
}

// Convert score to confidence level
function getConfidenceLevel(score: number): EmployerMatch['confidence'] {
  if (score >= 0.95) return 'exact';
  if (score >= 0.85) return 'high';
  if (score >= 0.70) return 'medium';
  return 'low';
}

/**
 * Advanced employer matching with multiple algorithms and confidence scoring
 * Enhanced to include alias matching with appropriate weighting
 */
export async function matchEmployerAdvanced(
  companyName: string,
  options: EmployerMatchingOptions = {
    confidenceThreshold: 0.75,
    allowFuzzyMatching: true,
    requireUserConfirmation: false
  },
  includeAliases: boolean = true,
  aliasMatchMode: 'any' | 'authoritative' | 'canonical' = 'any'
): Promise<EmployerMatchResult> {
  if (!companyName || companyName.trim().length === 0) {
    return {
      match: null,
      candidates: [],
      searchQuery: companyName,
      normalizedQuery: ''
    };
  }

  const normalizedQuery = normalizeCompanyName(companyName);

  try {
    let exactMatches: any[] = [];
    let aliasMatches: any[] = [];
    let fuzzyMatches: any[] = [];

    // Step 1: Search for exact employer name matches
    const { data: exactEmployerMatches, error: exactError } = await supabase
      .rpc('search_employers_by_exact_name', { name_query: companyName.trim() });

    if (exactError) {
      console.error('Exact match query failed:', exactError);
    } else {
      exactMatches = exactEmployerMatches || [];
      // Mark these as canonical name matches
      exactMatches = exactMatches.map(match => ({
        ...match,
        match_type: 'canonical_name' as const,
        match_details: {
          canonical_name: match.name,
          matched_alias: null,
          query: companyName,
          external_id_match: null
        }
      }));
    }

    // Step 2: Search for alias matches if enabled
    if (includeAliases) {
      const { data: employerAliasMatches, error: aliasError } = await supabase
        .rpc('search_employers_by_alias', {
          alias_query: companyName.trim(),
          p_match_mode: aliasMatchMode
        });

      if (aliasError) {
        console.error('Alias search failed:', aliasError);
      } else {
        aliasMatches = employerAliasMatches || [];
        // Mark these as alias matches
        aliasMatches = aliasMatches.map(match => ({
          ...match,
          match_type: 'alias' as const,
          match_details: {
            canonical_name: match.name,
            matched_alias: match.matched_alias,
            query: companyName,
            external_id_match: null
          }
        }));
      }
    }

    // Step 3: Fuzzy search using token-based approach for employer names
    if (options.allowFuzzyMatching) {
      const tokens = normalizedQuery.split(/\s+/).filter(t => t.length >= 2);

      if (tokens.length > 0) {
        // Build OR query for fuzzy matching
        const orParts: string[] = [];
        tokens.forEach(token => {
          if (token.length >= 2) {
            orParts.push(`name.ilike.*${token}*`);
          }
        });

        if (orParts.length > 0) {
          const orQuery = orParts.join(',');
          const { data: fuzzyData, error: fuzzyError } = await supabase
            .from('employers')
            .select('id, name, address_line_1, suburb, state')
            .or(orQuery)
            .limit(50); // Reasonable limit for performance

          if (fuzzyError) {
            console.warn('Fuzzy search failed:', fuzzyError);
          } else {
            fuzzyMatches = fuzzyData || [];
            // Mark these as fuzzy matches
            fuzzyMatches = fuzzyMatches.map(match => ({
              ...match,
              match_type: 'canonical_name' as const,
              match_details: {
                canonical_name: match.name,
                matched_alias: null,
                query: companyName,
                external_id_match: null
              }
            }));
          }
        }
      }
    }

    // Step 4: Combine and deduplicate results, prioritizing exact > alias > fuzzy
    const allMatches = [...exactMatches, ...aliasMatches, ...fuzzyMatches];
    const uniqueMatches = allMatches.filter((match, index, arr) =>
      index === arr.findIndex(m => m.id === match.id)
    );

    // Step 5: Score all matches with enhanced algorithm
    const scoredMatches: EmployerMatch[] = uniqueMatches.map(employer => {
      let baseScore = calculateMatchScore(companyName, employer.name);

      // Apply scoring bonuses based on match type
      if (employer.match_type === 'canonical_name') {
        // Exact or fuzzy name match - no bonus, base score stands
      } else if (employer.match_type === 'alias') {
        // Alias match - boost confidence but cap at high
        baseScore = Math.min(baseScore * 1.1, 0.94); // Cap just below 'exact'
      }

      return {
        id: employer.id,
        name: employer.name,
        confidence: getConfidenceLevel(baseScore),
        distance: 1 - baseScore,
        score: baseScore
      };
    });

    // Sort by score descending, then by match type priority
    scoredMatches.sort((a, b) => {
      const scoreDiff = b.score - a.score;
      if (Math.abs(scoreDiff) > 0.01) {
        return scoreDiff;
      }

      // If scores are very close, prioritize exact matches over aliases
      const aMatch = uniqueMatches.find(m => m.id === a.id);
      const bMatch = uniqueMatches.find(m => m.id === b.id);

      const priority = { canonical_name: 3, alias: 2, external_id: 1 };
      const aPriority = priority[aMatch?.match_type as keyof typeof priority] || 0;
      const bPriority = priority[bMatch?.match_type as keyof typeof priority] || 0;

      return bPriority - aPriority;
    });

    // Find the best match that meets threshold
    const bestMatch = scoredMatches.find(match => match.score >= options.confidenceThreshold);

    // Return candidates for user review (top 5, excluding the selected match)
    const candidates = scoredMatches
      .filter(match => match.id !== bestMatch?.id)
      .slice(0, 5);

    return {
      match: bestMatch || null,
      candidates,
      searchQuery: companyName,
      normalizedQuery
    };

  } catch (error) {
    console.error('Employer matching failed:', error);
    return {
      match: null,
      candidates: [],
      searchQuery: companyName,
      normalizedQuery
    };
  }
}

/**
 * Find the best employer match with alias support
 * Optimized for quick lookup with high confidence matching
 */
export async function findBestEmployerMatch(
  companyName: string,
  includeAliases: boolean = true,
  confidenceThreshold: number = 0.85
): Promise<EmployerMatch | null> {
  if (!companyName || companyName.trim().length === 0) {
    return null;
  }

  const options: EmployerMatchingOptions = {
    confidenceThreshold,
    allowFuzzyMatching: true,
    requireUserConfirmation: false
  };

  const result = await matchEmployerAdvanced(companyName, options, includeAliases, 'any');
  return result.match;
}

/**
 * Batch match multiple employers efficiently with alias support
 */
export async function batchMatchEmployers(
  companyNames: string[],
  options: EmployerMatchingOptions,
  includeAliases: boolean = true
): Promise<Record<string, EmployerMatchResult>> {
  const results: Record<string, EmployerMatchResult> = {};

  // Process in batches to avoid overwhelming the database
  const batchSize = 10;
  for (let i = 0; i < companyNames.length; i += batchSize) {
    const batch = companyNames.slice(i, i + batchSize);

    const batchResults = await Promise.all(
      batch.map(async (companyName) => {
        const result = await matchEmployerAdvanced(companyName, options, includeAliases, 'any');
        return { companyName, result };
      })
    );

    batchResults.forEach(({ companyName, result }) => {
      results[companyName] = result;
    });

    // Small delay between batches to be respectful of database
    if (i + batchSize < companyNames.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  return results;
}

/**
 * Get matching statistics for a batch of results
 */
export function getMatchingStatistics(results: Record<string, EmployerMatchResult>) {
  const total = Object.keys(results).length;
  let exactMatches = 0;
  let highConfidence = 0;
  let mediumConfidence = 0;
  let lowConfidence = 0;
  let noMatches = 0;

  Object.values(results).forEach(result => {
    if (!result.match) {
      noMatches++;
    } else {
      switch (result.match.confidence) {
        case 'exact':
          exactMatches++;
          break;
        case 'high':
          highConfidence++;
          break;
        case 'medium':
          mediumConfidence++;
          break;
        case 'low':
          lowConfidence++;
          break;
      }
    }
  });

  return {
    total,
    exactMatches,
    highConfidence,
    mediumConfidence,
    lowConfidence,
    noMatches,
    matchedTotal: total - noMatches,
    matchRate: total > 0 ? ((total - noMatches) / total) * 100 : 0
  };
}
