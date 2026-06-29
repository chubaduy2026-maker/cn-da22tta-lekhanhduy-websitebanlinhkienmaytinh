require('dotenv').config();
const router = require('../services/ai/core/AIRouter');
const ResponseValidator = require('../services/ai/tools/ResponseValidator');

const testText1 = "Hệ thống chưa có dữ liệu cụ thể để so sánh ổ cứng SSD và HDD.";
const testText2 = "Xin lỗi, chúng tôi không đủ dữ liệu.";
const testText3 = "Không tìm thấy thông tin nào về sản phẩm này.";
const testText4 = "SSD là linh kiện lưu trữ tốc độ cao.";

console.log("=== Testing AIRouter._evaluateRagConfidence ===");
const conf1 = router._evaluateRagConfidence({ answer: testText1, sources: [{ similarity: 0.49 }] });
console.log(`Text: "${testText1}"`);
console.log(`- hasInsufficientSignal: ${conf1.hasInsufficientSignal} (Expected: true)`);
console.log(`- pass: ${conf1.pass} (Expected: false)`);

const conf2 = router._evaluateRagConfidence({ answer: testText2, sources: [{ similarity: 0.49 }] });
console.log(`Text: "${testText2}"`);
console.log(`- hasInsufficientSignal: ${conf2.hasInsufficientSignal} (Expected: true)`);
console.log(`- pass: ${conf2.pass} (Expected: false)`);

const conf3 = router._evaluateRagConfidence({ answer: testText4, sources: [{ similarity: 0.49 }] });
console.log(`Text: "${testText4}"`);
console.log(`- hasInsufficientSignal: ${conf3.hasInsufficientSignal} (Expected: false)`);
console.log(`- pass: ${conf3.pass} (Expected: true)`);


console.log("\n=== Testing ResponseValidator._isSayingNotEnoughData ===");
const val1 = ResponseValidator._isSayingNotEnoughData(testText1);
console.log(`Text: "${testText1}" -> isSayingNotEnoughData: ${val1} (Expected: true)`);

const val2 = ResponseValidator._isSayingNotEnoughData(testText2);
console.log(`Text: "${testText2}" -> isSayingNotEnoughData: ${val2} (Expected: true)`);

const val3 = ResponseValidator._isSayingNotEnoughData(testText3);
console.log(`Text: "${testText3}" -> isSayingNotEnoughData: ${val3} (Expected: true)`);

const val4 = ResponseValidator._isSayingNotEnoughData(testText4);
console.log(`Text: "${testText4}" -> isSayingNotEnoughData: ${val4} (Expected: false)`);

if (conf1.hasInsufficientSignal && !conf1.pass && conf2.hasInsufficientSignal && !conf2.pass && !conf3.hasInsufficientSignal && conf3.pass && val1 && val2 && val3 && !val4) {
  console.log("\n✅ ALL INTEGRATION TESTS PASSED!");
  process.exit(0);
} else {
  console.log("\n❌ SOME INTEGRATION TESTS FAILED!");
  process.exit(1);
}
