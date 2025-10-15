#!/usr/bin/env node
/**
 * Test script to verify JWT token validation
 * Run with: node test-auth.js <your-jwt-token>
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing required environment variables');
  console.error('   Set: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_KEY');
  process.exit(1);
}

async function testAuth(jwt) {
  console.log('🔍 Testing JWT Token Validation\n');
  console.log('Environment:');
  console.log(`  SUPABASE_URL: ${SUPABASE_URL}`);
  console.log(`  ANON_KEY: ${SUPABASE_ANON_KEY.substring(0, 20)}...`);
  console.log(`  SERVICE_KEY: ${SUPABASE_SERVICE_KEY.substring(0, 20)}...`);
  console.log(`  JWT: ${jwt ? jwt.substring(0, 50) + '...' : 'NOT PROVIDED'}\n`);

  // Test 1: Service role client
  console.log('📋 Test 1: Service Role Client');
  console.log('-'.repeat(60));
  try {
    const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { persistSession: false }
    });
    
    const { data, error } = await serviceClient
      .from('profiles')
      .select('count', { count: 'exact', head: true });
    
    if (error) {
      console.log('❌ Service role query failed:', error.message);
    } else {
      console.log('✅ Service role connection works');
    }
  } catch (err) {
    console.log('❌ Service role error:', err.message);
  }

  if (!jwt) {
    console.log('\n⚠️  No JWT token provided. Cannot test user authentication.');
    console.log('Usage: node test-auth.js <your-jwt-token>');
    console.log('\nTo get a token:');
    console.log('1. Open browser console on your app');
    console.log('2. Run: (await supabase.auth.getSession()).data.session.access_token');
    console.log('3. Copy the token and pass it to this script');
    return;
  }

  // Test 2: User client with JWT (current method)
  console.log('\n📋 Test 2: User Client with JWT in Headers (Current Method)');
  console.log('-'.repeat(60));
  try {
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false },
      global: { headers: { Authorization: `Bearer ${jwt}` } }
    });

    const { data: authData, error: authError } = await userClient.auth.getUser();
    
    if (authError) {
      console.log('❌ auth.getUser() failed:', authError.message);
      console.log('   This is the problem! The worker cannot validate user tokens.');
    } else if (!authData?.user) {
      console.log('❌ auth.getUser() returned no user');
    } else {
      console.log('✅ auth.getUser() succeeded');
      console.log(`   User ID: ${authData.user.id}`);
      console.log(`   Email: ${authData.user.email}`);
      
      // Now try to get profile
      const { data: profile, error: profileError } = await userClient
        .from('profiles')
        .select('role')
        .eq('id', authData.user.id)
        .maybeSingle();
      
      if (profileError) {
        console.log('❌ Profile query failed:', profileError.message);
      } else if (!profile) {
        console.log('⚠️  No profile found for user');
      } else {
        console.log(`✅ Profile found, role: ${profile.role}`);
      }
    }
  } catch (err) {
    console.log('❌ User client error:', err.message);
  }

  // Test 3: Alternative method - set session directly
  console.log('\n📋 Test 3: User Client with setSession (Alternative Method)');
  console.log('-'.repeat(60));
  try {
    const userClient2 = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false }
    });

    // Try to set the session with the JWT
    const { data: sessionData, error: sessionError } = await userClient2.auth.setSession({
      access_token: jwt,
      refresh_token: '' // We don't have this in the worker context
    });

    if (sessionError) {
      console.log('❌ setSession() failed:', sessionError.message);
    } else if (!sessionData?.user) {
      console.log('❌ setSession() returned no user');
    } else {
      console.log('✅ setSession() succeeded');
      console.log(`   User ID: ${sessionData.user.id}`);
      console.log(`   Email: ${sessionData.user.email}`);
    }
  } catch (err) {
    console.log('❌ setSession error:', err.message);
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ Test complete\n');
}

const jwt = process.argv[2];
testAuth(jwt).catch(console.error);

