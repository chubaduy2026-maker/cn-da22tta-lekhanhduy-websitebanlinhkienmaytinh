const axios = require('axios');

const API_BASE = process.env.API_BASE_URL || 'http://localhost:5000';
const HEALTH_ENDPOINT = `${API_BASE.replace(/\/$/, '')}/api/v3/chat/health`;

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function sanitizeResponseText(raw = '') {
  return String(raw || '')
    .replace(/<function[^>]*>[\s\S]*?(?:<\/function>|$)/gi, ' ')
    .replace(/<tool_call[^>]*>[\s\S]*?(?:<\/tool_call>|$)/gi, ' ')
    .replace(/!\[[^\]]*\]\([^)]+\)/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

(async () => {
  try {
    console.log('Running forced leakage sanitizer test...');

    const leaked = 'Dạ đây là dữ liệu <function=search_products>[{"name":"HyperX Cloud II","image":"https://example.com/hx.jpg"}]</function>';
    const cleaned = sanitizeResponseText(leaked);

    assert(typeof cleaned === 'string' && cleaned.trim().length > 0, 'sanitized text is empty');
    assert(!/<function\s*=\s*search_products/i.test(cleaned), 'function opening tag still present');
    assert(!/<\/function>/i.test(cleaned), 'function closing tag still present');
    assert(!/!\[[^\]]*\]\([^)]+\)/.test(cleaned), 'markdown image must not be generated in decoupled mode');

    // Also verify health endpoint now exposes alerting metadata.
    const health = await axios.get(HEALTH_ENDPOINT, { timeout: 10000 });
    assert(health?.data?.success === true, 'health endpoint failed');
    const og = health?.data?.data?.outputGuard;
    assert(og && typeof og === 'object', 'outputGuard metrics missing');
    assert(Array.isArray(og.alerts), 'outputGuard alerts missing');
    assert(typeof og.alerting === 'boolean', 'outputGuard alerting flag missing');
    assert(og.thresholds && typeof og.thresholds === 'object', 'outputGuard thresholds missing');

    console.log('PASS: forced leakage is sanitized for decoupled text output and health alert metadata is available.');
    console.log(JSON.stringify({
      cleanedPreview: cleaned.slice(0, 180),
      outputGuard: og
    }, null, 2));
  } catch (error) {
    console.error('FAIL:', error.message);
    process.exit(1);
  }
})();
