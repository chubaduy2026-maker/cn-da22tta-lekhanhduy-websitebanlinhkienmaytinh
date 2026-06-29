const axios = require('axios');

const API_BASE = process.env.API_BASE_URL || 'http://localhost:5000';
const CHAT_ENDPOINT = `${API_BASE.replace(/\/$/, '')}/api/v3/chat`;

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function runTests() {
  console.log('🚀 STARTING CHATBOT SYNC & CONTEXT CONTAMINATION TESTS...\n');

  const sessionId = `test_session_${Date.now()}`;

  // Test 1: Category search for Laptop ASUS
  console.log('Test 1: Search Laptop ASUS');
  const res1 = await axios.post(CHAT_ENDPOINT, {
    message: 'cho tôi xem laptop ASUS',
    sessionId,
    userId: 'test_user'
  });
  const body1 = res1.data;
  console.log('Response 1 intent:', body1.intent);
  console.log('Response 1 products count:', body1.products?.length);
  assert(body1.success === true, 'Test 1 failed to return success');
  assert(body1.intent === 'product_search', `Expected intent product_search, got ${body1.intent}`);
  assert(body1.products && body1.products.length > 0, 'No products returned for Laptop ASUS');
  body1.products.forEach(p => {
    console.log(`  - Product: ${p.name} | Category: ${p.category} | Brand: ${p.brand}`);
    assert(p.category === 'Laptop', `Expected category Laptop, got ${p.category}`);
    assert(p.brand.toLowerCase() === 'asus', `Expected brand ASUS, got ${p.brand}`);
  });
  console.log('✅ Test 1 PASSED!\n');

  // Test 2: Search SSD 1TB
  console.log('Test 2: Search SSD 1TB');
  const res2 = await axios.post(CHAT_ENDPOINT, {
    message: 'tôi muốn mua SSD 1TB',
    sessionId,
    userId: 'test_user'
  });
  const body2 = res2.data;
  console.log('Response 2 intent:', body2.intent);
  console.log('Response 2 products count:', body2.products?.length);
  assert(body2.success === true, 'Test 2 failed to return success');
  assert(body2.intent === 'product_search', `Expected intent product_search, got ${body2.intent}`);
  assert(body2.products && body2.products.length > 0, 'No products returned for SSD 1TB');
  body2.products.forEach(p => {
    console.log(`  - Product: ${p.name} | Category: ${p.category} | Brand: ${p.brand}`);
    assert(p.category === 'Ổ cứng', `Expected category Ổ cứng, got ${p.category}`);
    assert(p.name.toLowerCase().includes('ssd'), `Expected product name to contain ssd, got ${p.name}`);
  });
  console.log('✅ Test 2 PASSED!\n');

  // Test 3: Search tản nhiệt nước
  console.log('Test 3: Search tản nhiệt nước');
  const res3 = await axios.post(CHAT_ENDPOINT, {
    message: 'có tản nhiệt nước không',
    sessionId,
    userId: 'test_user'
  });
  const body3 = res3.data;
  console.log('Response 3 intent:', body3.intent);
  console.log('Response 3 products count:', body3.products?.length);
  assert(body3.success === true, 'Test 3 failed to return success');
  assert(body3.products && body3.products.length > 0, 'No products returned for tản nhiệt nước');
  body3.products.forEach(p => {
    console.log(`  - Product: ${p.name} | Category: ${p.category} | Brand: ${p.brand}`);
    assert(p.category === 'Tản nhiệt', `Expected category Tản nhiệt, got ${p.category}`);
    const nameLower = p.name.toLowerCase();
    const isWaterCooler = nameLower.includes('nước') || nameLower.includes('aio') || nameLower.includes('liquid');
    assert(isWaterCooler, `Expected tản nhiệt nước product, got ${p.name}`);
  });
  console.log('✅ Test 3 PASSED!\n');

  // Test 4: Tech knowledge does NOT return product cards
  console.log('Test 4: Tech knowledge "SSD là gì?"');
  const res4 = await axios.post(CHAT_ENDPOINT, {
    message: 'SSD là gì?',
    sessionId,
    userId: 'test_user'
  });
  const body4 = res4.data;
  console.log('Response 4 intent:', body4.intent);
  console.log('Response 4 products count:', body4.products?.length);
  assert(body4.success === true, 'Test 4 failed to return success');
  assert(body4.intent === 'tech_knowledge', `Expected intent tech_knowledge, got ${body4.intent}`);
  assert(!body4.products || body4.products.length === 0, 'Expected products to be empty for tech knowledge query');
  console.log('✅ Test 4 PASSED!\n');

  // Test 5: Topic Shift / Stale context contamination prevention
  console.log('Test 5: Topic shift to general question ("kể chuyện cổ tích")');
  const res5 = await axios.post(CHAT_ENDPOINT, {
    message: 'hãy kể cho tôi nghe 1 câu chuyện cổ tích được không',
    sessionId,
    userId: 'test_user'
  });
  const body5 = res5.data;
  console.log('Response 5 intent:', body5.intent);
  console.log('Response 5 products count:', body5.products?.length);
  console.log('Response 5 answer:', body5.answer);
  assert(body5.success === true, 'Test 5 failed to return success');
  assert(!body5.products || body5.products.length === 0, 'Expected products to be empty for general question query');
  
  const answerLower = body5.answer.toLowerCase();
  const contaminated = ['tản nhiệt', 'laptop', 'vga', 'techstore', 'hotline', 'email'].some(term => answerLower.includes(term));
  assert(!contaminated, 'Response contaminated with stale context terms!');
  console.log('✅ Test 5 PASSED!\n');

  console.log('🎉 ALL TESTS PASSED SUCCESSFULLY!');
}

runTests().catch(err => {
  console.error('\n❌ TEST SUITE FAILED:', err.message);
  if (err.response) {
    console.error('API Response:', err.response.data);
  }
  process.exit(1);
});
