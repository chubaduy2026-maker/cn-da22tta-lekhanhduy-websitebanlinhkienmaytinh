/**
 * test-intent-router.js — Intent Router Verification Script
 * Tests the regex fallback intent detection to verify correct routing.
 * Run: node test-intent-router.js
 */

// Import directly (no DB connection needed for regex fallback)
const { detectIntentFallback, normalizeText } = require('./src/utils/chatbotIntent');

const TEST_CASES = [
  // ── Tech Knowledge (MUST NOT be product_search) ──
  { input: 'SSD là gì?', expected: 'tech_knowledge' },
  { input: 'RAM DDR5 khác DDR4 thế nào?', expected: 'tech_compare' },
  { input: 'CPU Intel Core i7 thế hệ 14 có gì mới?', expected: 'tech_knowledge' },
  { input: 'NVMe là gì và tại sao nhanh hơn SATA?', expected: 'tech_knowledge' },
  { input: 'GPU hoạt động như thế nào?', expected: 'tech_knowledge' },
  { input: 'SSD NVMe khác SSD SATA gì?', expected: 'tech_compare' },
  { input: 'Mainboard là gì?', expected: 'tech_knowledge' },
  { input: 'Laptop gaming khác laptop văn phòng chỗ nào?', expected: 'tech_compare' },
  { input: 'VGA có tác dụng gì?', expected: 'tech_knowledge' },
  { input: 'RAM có ưu điểm gì?', expected: 'advice_explanation' },
  { input: 'Tại sao GPU NVIDIA tốt hơn?', expected: 'tech_knowledge' },
  { input: 'HDD và SSD khác nhau ở điểm nào?', expected: 'tech_compare' },
  { input: 'CPU là gì và cách hoạt động', expected: 'tech_knowledge' },
  { input: 'theo bạn nên sử dụng ổ cứng ssd hay hdd', expected: 'tech_compare' },
  { input: 'nên mua ssd hay hdd', expected: 'tech_compare' },

  // ── Product Search (MUST be product_search) ──
  { input: 'Tìm laptop Dell', expected: 'product_search' },
  { input: 'Tôi muốn mua laptop ASUS', expected: 'product_search' },
  { input: 'Tìm SSD 1TB', expected: 'product_search' },
  { input: 'Shop có RAM Corsair không?', expected: 'product_search' },
  { input: 'Cho xem chuột Logitech', expected: 'product_search' },
  { input: 'Tìm bàn phím DareU', expected: 'product_search' },
  { input: 'cho tôi xem sản phẩm HDD xịn nhất đang có ở cửa hàng', expected: 'product_search' },
  { input: 'Giá laptop HP bao nhiêu?', expected: 'product_price_stock' },
  { input: 'Laptop', expected: 'product_search' },
  { input: 'ASUS', expected: 'product_search' },
  { input: 'Màn hình Samsung', expected: 'product_search' },

  // ── Product Advice ──
  { input: 'Tư vấn laptop cho sinh viên', expected: 'product_advice' },
  { input: 'Laptop nào phù hợp để chơi game?', expected: 'product_advice' },
  { input: 'Gợi ý laptop cho thiết kế đồ họa', expected: 'product_advice' },

  // ── Product Compare (specific models) ──
  { input: 'So sánh RTX 4060 và RTX 4070', expected: 'product_compare' },
  { input: 'So sánh laptop ASUS TUF A15 và MSI Pulse 15', expected: 'product_compare' },

  // ── PC Build ──
  { input: 'Build PC gaming 25 triệu', expected: 'pc_build' },
  { input: 'Gợi ý cấu hình PC văn phòng', expected: 'pc_build' },

  // ── General Question / Policy ──
  { input: 'Chính sách bảo hành của TechStore', expected: 'policy_question' },
  { input: 'Cách đổi trả sản phẩm', expected: 'policy_question' },
  { input: 'Phí giao hàng bao nhiêu?', expected: 'policy_question' },
  { input: 'Thủ đô Nhật Bản là gì?', expected: 'general_question' },

  // ── Greeting / Social ──
  { input: 'Xin chào', expected: 'greeting' },
  { input: 'Hello', expected: 'greeting' },
  { input: 'Cảm ơn bạn', expected: 'thanks' },
  { input: 'Tạm biệt', expected: 'goodbye' },
  { input: 'Hôm nay tôi buồn quá', expected: 'small_talk' },
  { input: 'Bạn là ai?', expected: 'small_talk' },

  // ── Unsupported ──
  { input: 'Cách hack wifi', expected: 'unsupported' },
];

// Run tests
let passed = 0;
let failed = 0;
const failures = [];

console.log('═══════════════════════════════════════════════════');
console.log('  TechStore Intent Router — Verification Test');
console.log('═══════════════════════════════════════════════════\n');

for (const tc of TEST_CASES) {
  const actual = detectIntentFallback(tc.input);
  const ok = actual === tc.expected;
  
  if (ok) {
    passed++;
    console.log(`  ✅ "${tc.input}" → ${actual}`);
  } else {
    failed++;
    failures.push({ input: tc.input, expected: tc.expected, actual });
    console.log(`  ❌ "${tc.input}" → ${actual} (expected: ${tc.expected})`);
  }
}

console.log('\n═══════════════════════════════════════════════════');
console.log(`  Results: ${passed} passed, ${failed} failed / ${TEST_CASES.length} total`);
console.log('═══════════════════════════════════════════════════');

if (failures.length > 0) {
  console.log('\n  ❌ FAILED CASES:');
  for (const f of failures) {
    console.log(`    "${f.input}": got "${f.actual}", expected "${f.expected}"`);
  }
}

process.exit(failed > 0 ? 1 : 0);
