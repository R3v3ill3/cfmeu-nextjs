#!/usr/bin/env tsx

/**
 * Trade Migration Analysis and Application Script
 * 
 * Run this after applying the SQL migrations to analyze and fix trade assignments
 * 
 * Usage:
 *   npm run migrate-trades
 */

import { analyzeTradeAssignments, applyTradeMappings, generateAnalysisReport } from '../src/utils/tradeMigrationAnalysis';

async function main() {
  console.log('🚀 Starting trade migration analysis...\n');
  
  try {
    // Step 1: Analyze current state
    console.log('📊 Analyzing current trade assignments...');
    const analysis = await analyzeTradeAssignments();
    
    // Step 2: Generate report
    console.log('\n📋 Generating analysis report...');
    const report = generateAnalysisReport(analysis);
    console.log('\n' + report);
    
    // Step 3: Apply high-confidence mappings automatically
    const highConfidenceMappings = analysis.suggestedMappings
      .filter(m => m.confidence === 'high')
      .map(m => ({
        employerId: m.employerId,
        newTradeType: m.suggestedTradeType
      }));
    
    if (highConfidenceMappings.length > 0) {
      console.log(`\n🔧 Applying ${highConfidenceMappings.length} high-confidence mappings...`);
      const result = await applyTradeMappings(highConfidenceMappings);
      
      console.log(`✅ Successfully applied ${result.success} mappings`);
      if (result.errors.length > 0) {
        console.error(`❌ ${result.errors.length} errors:`, result.errors);
      }
    } else {
      console.log('\n💡 No high-confidence mappings found to apply automatically.');
    }
    
    // Step 4: Show medium/low confidence suggestions for manual review
    const manualReviewMappings = analysis.suggestedMappings
      .filter(m => m.confidence !== 'high');
    
    if (manualReviewMappings.length > 0) {
      console.log(`\n🔍 ${manualReviewMappings.length} mappings require manual review:`);
      manualReviewMappings.forEach(mapping => {
        console.log(`  - ${mapping.employerName}: ${mapping.currentTradeType} → ${mapping.suggestedTradeType} (${mapping.confidence})`);
        console.log(`    Reason: ${mapping.reason}`);
      });
      
      console.log('\n💡 To apply these mappings, use the admin interface or update them manually.');
    }
    
    // Final summary
    console.log('\n📈 Migration Summary:');
    console.log(`- Total trade types in use: ${Object.keys(analysis.currentTradeTypes).length}`);
    console.log(`- High-confidence mappings applied: ${highConfidenceMappings.length}`);
    console.log(`- Mappings requiring review: ${manualReviewMappings.length}`);
    console.log(`- Unmapped employers: ${analysis.unmappedEmployers.length}`);
    
    console.log('\n✅ Trade migration analysis complete!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
