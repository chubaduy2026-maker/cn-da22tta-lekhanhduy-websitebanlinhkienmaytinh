const axios = require('axios');

const API_BASE = process.env.API_BASE_URL || 'http://localhost:5000';
const CHAT_ENDPOINT = `${API_BASE.replace(/\/$/, '')}/api/v3/chat`;
const HEALTH_ENDPOINT = `${API_BASE.replace(/\/$/, '')}/api/v3/chat/health`;

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function send(message, sessionId = null) {
  const response = await axios.post(CHAT_ENDPOINT, {
    message,
    sessionId,
    newChat: true
  }, {
    timeout: 25000,
    headers: { 'Content-Type': 'application/json' }
  });

  return response.data;
}

(async () => {
  try {
    console.log('Running output-guard regression test...');

    const imageCase = await send('show image headset', 'output-guard-1');
    assert(imageCase?.success === true, 'image case request failed');

    const imageText = String(imageCase?.data?.text || '');
    assert(!/<function\s*=\s*search_products/i.test(imageText), 'function leakage still present in text');
    assert(!/<\/function>/i.test(imageText), 'closing function tag still present in text');
    assert(!/!\[[^\]]*\]\([^)]+\)/.test(imageText), 'markdown image hallucination should be removed from text');

    const hasProductsArray = Array.isArray(imageCase?.data?.products);
    const productCount = hasProductsArray ? imageCase.data.products.length : 0;
    assert(hasProductsArray, 'image case must return products array');

    const normalCase = await send('toi can tai nghe bluetooth duoi 3 trieu', 'output-guard-2');
    assert(normalCase?.success === true, 'normal case request failed');

    const normalText = String(normalCase?.data?.text || '');
    assert(!/<function\s*=\s*search_products/i.test(normalText), 'normal case leaked function tag');
    assert(Array.isArray(normalCase?.data?.products), 'normal case must return products array');

    const health = await axios.get(HEALTH_ENDPOINT, { timeout: 10000 });
    assert(health?.data?.success === true, 'health endpoint failed');
    assert(health?.data?.data?.outputGuard, 'health missing outputGuard stats');

    console.log('PASS: output guard is active.');
    console.log(JSON.stringify({
      responseShapeImage: Object.keys(imageCase?.data || {}),
      responseShapeNormal: Object.keys(normalCase?.data || {}),
      productCount,
      outputGuard: health.data.data.outputGuard
    }, null, 2));
  } catch (error) {
    console.error('FAIL:', error.message);
    process.exit(1);
  }
})();
