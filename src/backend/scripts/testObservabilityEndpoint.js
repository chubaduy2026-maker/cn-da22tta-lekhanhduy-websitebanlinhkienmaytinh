const axios = require('axios');

const API_BASE = process.env.API_BASE_URL || 'http://localhost:5000';
const OBSERVABILITY_ENDPOINT = `${API_BASE.replace(/\/$/, '')}/api/v3/chat/observability`;

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

(async () => {
  try {
    console.log('Running observability endpoint test...');

    const response = await axios.get(OBSERVABILITY_ENDPOINT, { timeout: 10000 });
    const payload = response.data;

    assert(payload?.success === true, 'observability request failed');
    const data = payload?.data || {};

    assert(typeof data.level === 'string', 'missing observability level');
    assert(typeof data.timestamp === 'string', 'missing observability timestamp');
    assert(typeof data.uptimeSeconds === 'number', 'missing uptimeSeconds');
    assert(data.process && typeof data.process.pid === 'number', 'missing process.pid');
    assert(data.outputGuard && typeof data.outputGuard === 'object', 'missing outputGuard metrics');
    assert(data.router && typeof data.router === 'object', 'missing router metrics');
    assert(Array.isArray(data.actions), 'missing actions list');

    console.log('PASS: observability endpoint is available and returns expected shape.');
    console.log(JSON.stringify({
      level: data.level,
      outputGuardAlerting: data.outputGuard.alerting,
      actions: data.actions
    }, null, 2));
  } catch (error) {
    console.error('FAIL:', error.message);
    process.exit(1);
  }
})();
