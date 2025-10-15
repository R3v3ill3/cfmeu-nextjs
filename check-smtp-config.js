// Check if SMTP is configured in Supabase
// This queries Supabase Management API to see auth settings

const SUPABASE_PROJECT_REF = 'jzuoawqxqmrsftbtjkzv';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function checkSMTPConfig() {
  try {
    // Try to get auth config from Supabase
    const response = await fetch(
      `https://${SUPABASE_PROJECT_REF}.supabase.co/rest/v1/rpc/get_auth_config`,
      {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      console.log('❌ Could not fetch auth config via API');
      console.log('Status:', response.status);
    } else {
      const data = await response.json();
      console.log('✅ Auth config:', JSON.stringify(data, null, 2));
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
  
  console.log('\n📋 NEXT STEPS:');
  console.log('Since we can\'t easily verify SMTP config programmatically,');
  console.log('you need to check in Supabase Dashboard:');
  console.log('\n1. Log into https://supabase.com/dashboard');
  console.log('2. Select "organising database" project');
  console.log('3. Look for Authentication/Auth settings');
  console.log('4. Find SMTP/Email settings section');
  console.log('5. Verify these are filled in:');
  console.log('   - SMTP Host: smtp.office365.com');
  console.log('   - SMTP Port: 587');
  console.log('   - SMTP User: (your email)');
  console.log('   - SMTP Pass: (your password)');
  console.log('\n⚠️  If they\'re blank, that\'s your problem!');
}

checkSMTPConfig();

