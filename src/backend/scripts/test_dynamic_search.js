const axios = require('axios');
const crypto = require('crypto');

const BACKEND_URL = process.env.API_BASE_URL || 'http://localhost:5000/api/v3/chat';

const TEST_CASES = [
  // 1. Brand + Category
  {
    name: 'Brand + Category (ASUS Laptop)',
    message: 'tôi muốn mua laptop asus',
    verify: (res) => {
      const { type, intent, products, filters } = res;
      if (type !== 'product_results') return 'Type must be product_results';
      if (intent !== 'product_search') return 'Intent must be product_search';
      if (filters.brand?.toLowerCase() !== 'asus') return 'Filter brand must be ASUS';
      if (filters.category?.toLowerCase() !== 'laptop') return 'Filter category must be Laptop';
      if (!products || products.length === 0) return 'Should return matching products';
      return null;
    }
  },
  {
    name: 'Brand + Category (Samsung Monitor)',
    message: 'shop có màn hình samsung không',
    verify: (res) => {
      const { type, intent, products, filters } = res;
      if (type !== 'product_results') return 'Type must be product_results';
      if (intent !== 'product_search') return 'Intent must be product_search';
      if (filters.brand?.toLowerCase() !== 'samsung') return 'Filter brand must be Samsung';
      if (filters.category?.toLowerCase() !== 'màn hình') return 'Filter category must be Màn hình';
      return null;
    }
  },

  // 2. Category Only
  {
    name: 'Category Only (Laptop)',
    message: 'tôi muốn mua laptop',
    verify: (res) => {
      const { type, intent, products, filters, quickReplies } = res;
      if (type !== 'product_results') return 'Type must be product_results';
      if (intent !== 'product_search') return 'Intent must be product_search';
      if (filters.category?.toLowerCase() !== 'laptop') return 'Filter category must be Laptop';
      if (!products || products.length === 0) return 'Should return matching products';
      if (!quickReplies || quickReplies.length === 0) return 'Should suggest brand/price filters in quick replies';
      return null;
    }
  },

  // 3. Brand Only
  {
    name: 'Brand Only (ASUS)',
    message: 'cho tôi xem ASUS',
    verify: (res) => {
      const { type, intent, products, filters, quickReplies } = res;
      if (type !== 'product_results') return 'Type must be product_results';
      if (intent !== 'product_search') return 'Intent must be product_search';
      if (filters.brand?.toLowerCase() !== 'asus') return 'Filter brand must be ASUS';
      if (!quickReplies || quickReplies.length === 0) return 'Should suggest categories for ASUS in quick replies';
      return null;
    }
  },

  // 4. Price Filter
  {
    name: 'Price Filter (Laptop under 20m)',
    message: 'laptop dưới 20 triệu',
    verify: (res) => {
      const { type, intent, products, filters } = res;
      if (type !== 'product_results') return 'Type must be product_results';
      if (intent !== 'product_search') return 'Intent must be product_search';
      if (filters.priceMax !== 20000000) return `Filter priceMax must be 20000000, got ${filters.priceMax}`;
      return null;
    }
  },
  {
    name: 'Price Filter (ASUS Laptop between 15m and 25m)',
    message: 'laptop asus từ 15 đến 25 triệu',
    verify: (res) => {
      const { type, intent, products, filters } = res;
      if (type !== 'product_results') return 'Type must be product_results';
      if (intent !== 'product_search') return 'Intent must be product_search';
      if (filters.brand?.toLowerCase() !== 'asus') return 'Filter brand must be ASUS';
      if (filters.priceMin !== 15000000) return `Filter priceMin must be 15000000, got ${filters.priceMin}`;
      if (filters.priceMax !== 25000000) return `Filter priceMax must be 25000000, got ${filters.priceMax}`;
      return null;
    }
  },

  // 5. Advice
  {
    name: 'Advice (Laptop for students)',
    message: 'tư vấn laptop cho sinh viên',
    verify: (res) => {
      const { type, intent } = res;
      // Should route to product_advice or product_search
      if (!['product_advice', 'product_search'].includes(intent)) return `Intent must be product_advice or product_search, got ${intent}`;
      return null;
    }
  },
  {
    name: 'Advice (PC gaming under 20m)',
    message: 'gợi ý PC gaming 20 triệu',
    verify: (res) => {
      const { type, intent } = res;
      if (!['product_advice', 'product_search', 'pc_build'].includes(intent)) return `Intent must be product_advice/search/pc_build, got ${intent}`;
      return null;
    }
  },

  // 6. Fallbacks & Cross-sells (Dell laptop when no Dell laptop exists, or brand is missing)
  {
    name: 'Fallback (Laptop Dell - Dell doesn\'t exist or has no laptops)',
    message: 'tôi muốn mua laptop Dell',
    verify: (res) => {
      const { type, intent, answer, message, quickReplies } = res;
      const text = answer || message || '';
      if (type !== 'product_results') return 'Type must be product_results';
      if (intent !== 'product_search') return 'Intent must be product_search';
      
      const containsDellRefusal = text.includes('chưa có laptop Dell') || 
                                   text.includes('chưa có sản phẩm của thương hiệu Dell') ||
                                   text.includes('chưa có sản phẩm của thương hiệu **Dell**') ||
                                   text.includes('chưa có dòng sản phẩm của thương hiệu Dell') ||
                                   text.includes('chưa có dòng sản phẩm của thương hiệu **Dell**');
                                   
      if (!containsDellRefusal) {
        return `Response text must state that TechStore does not have Dell laptops. Got: "${text}"`;
      }
      return null;
    }
  }
];

async function runTests() {
  console.log('=== STARTING CHATBOT DYNAMIC SEARCH INTEGRATION TESTS ===\n');
  let passedCount = 0;

  for (const tc of TEST_CASES) {
    console.log(`[TEST CASE] ${tc.name}`);
    console.log(`[QUERY] "${tc.message}"`);

    try {
      const sessionId = `guest_${crypto.randomBytes(32).toString('hex')}`;
      const response = await axios.post(BACKEND_URL, {
        message: tc.message,
        sessionId: sessionId
      });

      const data = response.data;
      const errorMsg = tc.verify(data);

      if (errorMsg) {
        console.log(`❌ FAIL: ${errorMsg}`);
        console.log(`[PAYLOAD RECEIVED]:`, JSON.stringify(data, null, 2));
      } else {
        console.log('✅ PASS');
      }
      passedCount += errorMsg ? 0 : 1;

    } catch (error) {
      console.error('❌ ERROR running test case:', error.message);
      if (error.response) {
        console.log('Error status:', error.response.status);
        console.log('Error data:', error.response.data);
      }
    }
    console.log('--------------------------------------------------\n');
  }

  console.log(`=== TEST RESULTS: ${passedCount}/${TEST_CASES.length} PASSED ===`);
  if (passedCount === TEST_CASES.length) {
    console.log('🎉 ALL DYNAMIC SEARCH TESTS PASSED SUCCESSFULLY!');
    process.exit(0);
  } else {
    console.log('⚠️ SOME TESTS FAILED. PLEASE VERIFY RESOLVERS AND AGENT LOGS.');
    process.exit(1);
  }
}

runTests();
