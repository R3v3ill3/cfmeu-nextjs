import { supabase } from "@/integrations/supabase/client";
import { TRADE_STAGE_MAPPING } from "@/constants/trades";

export interface TradeAnalysisResult {
  currentTradeTypes: Record<string, number>;
  employersByTradeType: Record<string, Array<{ id: string; name: string; count: number }>>;
  suggestedMappings: Array<{
    employerId: string;
    employerName: string;
    currentTradeType: string;
    suggestedTradeType: string;
    confidence: 'high' | 'medium' | 'low';
    reason: string;
  }>;
  unmappedEmployers: Array<{ id: string; name: string; tradeType: string }>;
}

/**
 * Analyze current trade type assignments and suggest improvements
 */
export async function analyzeTradeAssignments(): Promise<TradeAnalysisResult> {
  console.log('🔍 Starting trade assignment analysis...');
  
  // Get all project contractor trades with employer info
  const { data: projectTrades } = await supabase
    .from('project_contractor_trades')
    .select(`
      id,
      trade_type,
      employer_id,
      employers (
        id,
        name
      )
    `);

  // Get all site contractor trades with employer info
  const { data: siteTrades } = await supabase
    .from('site_contractor_trades')
    .select(`
      id,
      trade_type,
      employer_id,
      employers (
        id,
        name
      )
    `);

  const allTrades = [
    ...(projectTrades || []),
    ...(siteTrades || [])
  ];

  // Analyze current trade type distribution
  const currentTradeTypes: Record<string, number> = {};
  const employersByTradeType: Record<string, Array<{ id: string; name: string; count: number }>> = {};
  const employerTradeCount: Record<string, Record<string, number>> = {};

  allTrades.forEach(trade => {
    const tradeType = trade.trade_type;
    const employer = trade.employers;
    
    if (!employer) return;
    
    // Count trade types
    currentTradeTypes[tradeType] = (currentTradeTypes[tradeType] || 0) + 1;
    
    // Count employer assignments per trade type
    if (!employerTradeCount[employer.id]) {
      employerTradeCount[employer.id] = {};
    }
    employerTradeCount[employer.id][tradeType] = (employerTradeCount[employer.id][tradeType] || 0) + 1;
  });

  // Build employers by trade type
  Object.entries(employerTradeCount).forEach(([employerId, tradeCounts]) => {
    Object.entries(tradeCounts).forEach(([tradeType, count]) => {
      if (!employersByTradeType[tradeType]) {
        employersByTradeType[tradeType] = [];
      }
      
      const employer = allTrades.find(t => t.employers?.id === employerId)?.employers;
      if (employer) {
        employersByTradeType[tradeType].push({
          id: employerId,
          name: employer.name,
          count
        });
      }
    });
  });

  // Generate suggested mappings
  const suggestedMappings: TradeAnalysisResult['suggestedMappings'] = [];
  const unmappedEmployers: TradeAnalysisResult['unmappedEmployers'] = [];

  // Get unique employers
  const uniqueEmployers = Array.from(new Map(
    allTrades
      .filter(t => t.employers)
      .map(t => [t.employers.id, t.employers])
  ).values());

  uniqueEmployers.forEach(employer => {
    const employerTrades = Object.keys(employerTradeCount[employer.id] || {});
    const primaryTrade = employerTrades.reduce((a, b) => 
      employerTradeCount[employer.id][a] > employerTradeCount[employer.id][b] ? a : b
    );

    // Skip if already well-mapped
    if (primaryTrade && !['general_construction', 'other', 'labour_hire'].includes(primaryTrade)) {
      return;
    }

    const suggestion = suggestTradeTypeFromName(employer.name);
    
    if (suggestion) {
      suggestedMappings.push({
        employerId: employer.id,
        employerName: employer.name,
        currentTradeType: primaryTrade,
        suggestedTradeType: suggestion.tradeType,
        confidence: suggestion.confidence,
        reason: suggestion.reason
      });
    } else {
      unmappedEmployers.push({
        id: employer.id,
        name: employer.name,
        tradeType: primaryTrade
      });
    }
  });

  console.log(`📊 Analysis complete:`);
  console.log(`- ${Object.keys(currentTradeTypes).length} different trade types in use`);
  console.log(`- ${suggestedMappings.length} suggested mappings`);
  console.log(`- ${unmappedEmployers.length} unmapped employers`);

  return {
    currentTradeTypes,
    employersByTradeType,
    suggestedMappings,
    unmappedEmployers
  };
}

/**
 * Suggest trade type based on employer name
 */
function suggestTradeTypeFromName(employerName: string): {
  tradeType: string;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
} | null {
  const name = employerName.toLowerCase();

  // High confidence matches
  if (name.includes('concrete') || name.includes('concreting')) {
    return { tradeType: 'concreting', confidence: 'high', reason: 'Name contains "concrete"' };
  }
  if (name.includes('steel') && (name.includes('fix') || name.includes('rein'))) {
    return { tradeType: 'reinforcing_steel', confidence: 'high', reason: 'Name contains steel fixing/reinforcing terms' };
  }
  if (name.includes('scaffold')) {
    return { tradeType: 'scaffolding', confidence: 'high', reason: 'Name contains "scaffold"' };
  }
  if (name.includes('crane') && name.includes('tower')) {
    return { tradeType: 'tower_crane', confidence: 'high', reason: 'Name contains "tower crane"' };
  }
  if (name.includes('demolition') || name.includes('demo')) {
    return { tradeType: 'demolition', confidence: 'high', reason: 'Name contains demolition terms' };
  }

  // Medium confidence matches
  if (name.includes('steel') && name.includes('struct')) {
    return { tradeType: 'structural_steel', confidence: 'medium', reason: 'Name contains structural steel terms' };
  }
  if (name.includes('crane')) {
    return { tradeType: 'mobile_crane', confidence: 'medium', reason: 'Name contains "crane"' };
  }
  if (name.includes('form')) {
    return { tradeType: 'form_work', confidence: 'medium', reason: 'Name contains "form"' };
  }
  if (name.includes('brick')) {
    return { tradeType: 'bricklaying', confidence: 'medium', reason: 'Name contains "brick"' };
  }
  if (name.includes('electric')) {
    return { tradeType: 'electrical', confidence: 'medium', reason: 'Name contains "electric"' };
  }
  if (name.includes('plumb')) {
    return { tradeType: 'plumbing', confidence: 'medium', reason: 'Name contains "plumb"' };
  }
  if (name.includes('carpen') || name.includes('joiner')) {
    return { tradeType: 'carpentry', confidence: 'medium', reason: 'Name contains carpentry terms' };
  }
  if (name.includes('paint')) {
    return { tradeType: 'painting', confidence: 'medium', reason: 'Name contains "paint"' };
  }
  if (name.includes('plaster')) {
    return { tradeType: 'plastering', confidence: 'medium', reason: 'Name contains "plaster"' };
  }

  // Low confidence matches
  if (name.includes('waterproof')) {
    return { tradeType: 'waterproofing', confidence: 'low', reason: 'Name contains "waterproof"' };
  }
  if (name.includes('tile') || name.includes('tiling')) {
    return { tradeType: 'tiling', confidence: 'low', reason: 'Name contains tiling terms' };
  }
  if (name.includes('floor')) {
    return { tradeType: 'flooring', confidence: 'low', reason: 'Name contains "floor"' };
  }
  if (name.includes('roof')) {
    return { tradeType: 'roofing', confidence: 'low', reason: 'Name contains "roof"' };
  }
  if (name.includes('window') || name.includes('glazing')) {
    return { tradeType: 'windows', confidence: 'low', reason: 'Name contains window/glazing terms' };
  }
  if (name.includes('facade')) {
    return { tradeType: 'facade', confidence: 'low', reason: 'Name contains "facade"' };
  }
  if (name.includes('kitchen')) {
    return { tradeType: 'kitchens', confidence: 'low', reason: 'Name contains "kitchen"' };
  }
  if (name.includes('landscape')) {
    return { tradeType: 'landscaping', confidence: 'low', reason: 'Name contains "landscape"' };
  }
  if (name.includes('clean')) {
    return { tradeType: 'cleaning', confidence: 'low', reason: 'Name contains "clean"' };
  }

  return null;
}

/**
 * Apply suggested mappings to the database
 */
export async function applyTradeMappings(mappings: Array<{
  employerId: string;
  newTradeType: string;
}>): Promise<{ success: number; errors: string[] }> {
  console.log(`🔧 Applying ${mappings.length} trade mappings...`);
  
  let success = 0;
  const errors: string[] = [];

  for (const mapping of mappings) {
    try {
      // Update project_contractor_trades
      const { error: projectError } = await supabase
        .from('project_contractor_trades')
        .update({ 
          trade_type: mapping.newTradeType,
          stage: TRADE_STAGE_MAPPING[mapping.newTradeType] || 'other'
        })
        .eq('employer_id', mapping.employerId);

      if (projectError) {
        errors.push(`Project trades update failed for employer ${mapping.employerId}: ${projectError.message}`);
        continue;
      }

      // Update site_contractor_trades
      const { error: siteError } = await supabase
        .from('site_contractor_trades')
        .update({ trade_type: mapping.newTradeType })
        .eq('employer_id', mapping.employerId);

      if (siteError) {
        errors.push(`Site trades update failed for employer ${mapping.employerId}: ${siteError.message}`);
        continue;
      }

      success++;
    } catch (error) {
      errors.push(`Unexpected error for employer ${mapping.employerId}: ${error}`);
    }
  }

  console.log(`✅ Applied ${success} mappings successfully`);
  if (errors.length > 0) {
    console.error(`❌ ${errors.length} errors occurred:`, errors);
  }

  return { success, errors };
}

/**
 * Generate a report of the current state
 */
export function generateAnalysisReport(analysis: TradeAnalysisResult): string {
  let report = '# Trade Assignment Analysis Report\n\n';
  
  report += '## Current Trade Type Distribution\n';
  Object.entries(analysis.currentTradeTypes)
    .sort(([,a], [,b]) => b - a)
    .forEach(([tradeType, count]) => {
      report += `- ${tradeType}: ${count} assignments\n`;
    });
  
  report += '\n## Suggested Mappings\n';
  analysis.suggestedMappings
    .sort((a, b) => {
      const confidenceOrder = { high: 3, medium: 2, low: 1 };
      return confidenceOrder[b.confidence] - confidenceOrder[a.confidence];
    })
    .forEach(mapping => {
      report += `- **${mapping.employerName}** (${mapping.confidence} confidence)\n`;
      report += `  - Current: ${mapping.currentTradeType} → Suggested: ${mapping.suggestedTradeType}\n`;
      report += `  - Reason: ${mapping.reason}\n\n`;
    });
  
  report += '\n## Unmapped Employers\n';
  analysis.unmappedEmployers.forEach(employer => {
    report += `- ${employer.name} (currently: ${employer.tradeType})\n`;
  });
  
  return report;
}
