const axios = require('axios');

const API_BASE = process.env.API_BASE_URL || 'http://localhost:5000';
const CHAT_ENDPOINT = `${API_BASE.replace(/\/$/, '')}/api/v3/chat`;
const HEALTH_ENDPOINT = `${API_BASE.replace(/\/$/, '')}/api/v3/chat/health`;
const RESET_ENDPOINT = `${API_BASE.replace(/\/$/, '')}/api/v3/chat/health/reset`;

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function sendMessage(message, sessionId) {
  const response = await axios.post(CHAT_ENDPOINT, {
    message,
    sessionId,
    newChat: true
  }, {
    timeout: 25000,
    headers: {
      'Content-Type': 'application/json'
    }
  });

  return response.data;
}

async function tryPrimeTraffic() {
  try {
    await sendMessage('show image headset', 'reset-check-1');
  } catch (error) {
    // Priming traffic is optional for reset validation.
  }
}

(async () => {
  try {
    console.log('Running output guard reset test...');

    await tryPrimeTraffic();

    const healthBefore = await axios.get(HEALTH_ENDPOINT, { timeout: 10000 });
    const beforeStats = healthBefore?.data?.data?.outputGuard;
    assert(beforeStats && typeof beforeStats.totalResponses === 'number', 'missing outputGuard stats before reset');

    const reset = await axios.post(RESET_ENDPOINT, {}, {
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    assert(reset?.data?.success === true, 'reset endpoint failed');

    const healthAfter = await axios.get(HEALTH_ENDPOINT, { timeout: 10000 });
    const afterStats = healthAfter?.data?.data?.outputGuard;
    assert(afterStats && typeof afterStats.totalResponses === 'number', 'missing outputGuard stats after reset');
    assert(afterStats.totalResponses === 0, 'totalResponses was not reset to 0');
    assert(afterStats.sanitizedResponses === 0, 'sanitizedResponses was not reset to 0');
    assert(afterStats.fallbackResponses === 0, 'fallbackResponses was not reset to 0');
    assert(afterStats.leakageDetected === 0, 'leakageDetected was not reset to 0');

    console.log('PASS: output guard counters reset endpoint works.');
    console.log(JSON.stringify({
      before: beforeStats,
      after: afterStats
    }, null, 2));
  } catch (error) {
    console.error('FAIL:', error.message);
    process.exit(1);
  }
})();
