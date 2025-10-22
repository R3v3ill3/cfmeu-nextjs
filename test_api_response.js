// Diagnostic script to check what the employers API is actually returning
// Run with: node test_api_response.js

const API_URL = 'http://localhost:3000/api/employers?page=1&pageSize=3';

async function testApi() {
  console.log('🔍 Testing employers API endpoint...\n');
  console.log('URL:', API_URL);

  try {
    const response = await fetch(API_URL, {
      headers: {
        'Content-Type': 'application/json',
      }
    });

    if (!response.ok) {
      console.error('❌ API returned error:', response.status, response.statusText);
      const text = await response.text();
      console.error('Response:', text);
      return;
    }

    const data = await response.json();

    console.log('\n✅ API Response Structure:');
    console.log('- Total employers:', data.employers?.length || 0);
    console.log('- Pagination:', data.pagination);
    console.log('- Debug info:', data.debug);

    if (data.employers && data.employers.length > 0) {
      console.log('\n📋 First employer data structure:');
      const first = data.employers[0];

      console.log('\nBasic fields:');
      console.log('  id:', first.id);
      console.log('  name:', first.name);
      console.log('  employer_type:', first.employer_type);

      console.log('\n🏴 EBA Status Fields (CRITICAL):');
      console.log('  enterprise_agreement_status:', first.enterprise_agreement_status);
      console.log('  eba_status_source:', first.eba_status_source);
      console.log('  eba_status_updated_at:', first.eba_status_updated_at);
      console.log('  eba_status_notes:', first.eba_status_notes);

      console.log('\n📊 Related data:');
      console.log('  company_eba_records (count):', first.company_eba_records?.length || 0);
      console.log('  worker_placements (count):', first.worker_placements?.length || 0);
      console.log('  project_assignments (count):', first.project_assignments?.length || 0);

      console.log('\n🔧 Enhanced data:');
      console.log('  projects:', first.projects?.length || 0);
      console.log('  organisers:', first.organisers?.length || 0);
      console.log('  incolink_id:', first.incolink_id || 'null');

      console.log('\n📝 Full first employer object:');
      console.log(JSON.stringify(first, null, 2));
    } else {
      console.log('\n⚠️ No employers returned');
    }

  } catch (error) {
    console.error('❌ Error testing API:', error.message);
    if (error.cause) {
      console.error('Cause:', error.cause);
    }
  }
}

testApi();
