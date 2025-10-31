const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

// Supabase configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase configuration. Please check your environment variables.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Required tables for 4-point rating system
const requiredTables = [
  'current_employer_ratings_4point',
  'rating_weight_configs',
  'union_respect_assessments_4point',
  'safety_assessments_4point',
  'subcontractor_assessments_4point',
  'compliance_assessments_4point',
  'organiser_overall_expertise_ratings',
  'expertise_assessment_details_4point'
];

// Required functions
const requiredFunctions = [
  'calculate_weighted_employer_rating_4point',
  'get_rating_weights',
  'update_rating_weights',
  'get_weight_history'
];

async function checkTable(tableName) {
  try {
    const { data, error } = await supabase
      .from(tableName)
      .select('count', { count: 'exact', head: true })
      .limit(1);

    if (error && error.code === '42P01') {
      return { exists: false, error: 'Table does not exist' };
    } else if (error) {
      return { exists: false, error: error.message };
    }

    return { exists: true, count: data?.[0]?.count || 0 };
  } catch (e) {
    return { exists: false, error: e.message };
  }
}

async function checkFunction(functionName) {
  try {
    const { data, error } = await supabase.rpc(functionName, {
      p_employer_id: '00000000-0000-0000-0000-000000000000'
    });

    // Function exists but might return an error for invalid employer ID
    if (error && !error.message.includes('does not exist')) {
      return { exists: true };
    } else if (error) {
      return { exists: false, error: error.message };
    }

    return { exists: true };
  } catch (e) {
    return { exists: false, error: e.message };
  }
}

async function main() {
  console.log('Checking 4-Point Rating System database setup...\n');

  console.log('=== Tables ===');
  let allTablesExist = true;

  for (const table of requiredTables) {
    const result = await checkTable(table);
    if (result.exists) {
      console.log(`✅ ${table} - exists (${result.count || 0} rows)`);
    } else {
      console.log(`❌ ${table} - ${result.error}`);
      allTablesExist = false;
    }
  }

  console.log('\n=== Functions ===');
  let allFunctionsExist = true;

  for (const func of requiredFunctions) {
    const result = await checkFunction(func);
    if (result.exists) {
      console.log(`✅ ${func}() - exists`);
    } else {
      console.log(`❌ ${func}() - ${result.error}`);
      allFunctionsExist = false;
    }
  }

  console.log('\n=== Summary ===');
  if (allTablesExist && allFunctionsExist) {
    console.log('✅ All required tables and functions exist!');
    console.log('The 4-point rating system should work properly.');
  } else {
    console.log('❌ Some tables or functions are missing.');
    console.log('Please run the latest migrations to set up the rating system:');
    console.log('  supabase db push');
    console.log('  or');
    console.log('  supabase migration up');
  }
}

main().catch(console.error);