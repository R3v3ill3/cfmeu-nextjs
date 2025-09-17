// Quick test script to verify patch filtering is working
const fetch = require('node-fetch');

async function testPatchFiltering() {
  try {
    console.log('🧪 Testing patch filtering fix...\n');
    
    // First, test API without filters
    console.log('1️⃣ Testing API without filters...');
    const response1 = await fetch('http://localhost:3000/api/projects?pageSize=3');
    const data1 = await response1.json();
    
    if (response1.ok) {
      console.log('✅ Basic API works');
      console.log(`   Found ${data1.pagination.totalCount} total projects`);
      console.log(`   Debug: ${JSON.stringify(data1.debug)}`);
    } else {
      console.log('❌ Basic API failed:', data1);
      return;
    }
    
    // Test with a fake patch ID (should return 0 projects but not crash)
    console.log('\n2️⃣ Testing with non-existent patch ID...');
    const response2 = await fetch('http://localhost:3000/api/projects?patch=non-existent-patch&pageSize=3');
    const data2 = await response2.json();
    
    if (response2.ok) {
      console.log('✅ Fake patch filtering handled gracefully');
      console.log(`   Found ${data2.pagination.totalCount} projects (expected 0)`);
      console.log(`   Debug: ${JSON.stringify(data2.debug)}`);
    } else {
      console.log('❌ Fake patch filtering failed:', data2);
    }
    
    // Test with multiple fake patches
    console.log('\n3️⃣ Testing with multiple non-existent patch IDs...');
    const response3 = await fetch('http://localhost:3000/api/projects?patch=fake1,fake2,fake3&pageSize=3');
    const data3 = await response3.json();
    
    if (response3.ok) {
      console.log('✅ Multiple fake patches handled gracefully');
      console.log(`   Found ${data3.pagination.totalCount} projects (expected 0)`);
      console.log(`   Debug: ${JSON.stringify(data3.debug)}`);
    } else {
      console.log('❌ Multiple fake patches failed:', data3);
    }
    
    console.log('\n🎉 Patch filtering test complete!');
    
  } catch (error) {
    console.error('❌ Test failed with error:', error);
  }
}

testPatchFiltering();
