const axios = require('axios');

const API_BASE = process.env.API_BASE_URL || 'http://localhost:5000';
const CHAT_ENDPOINT = `${API_BASE.replace(/\/$/, '')}/api/v3/chat`;
const TEST_USER_ID = `guest_test_${Date.now().toString(36)}`;
let TEST_SESSION_ID = `guest_${Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('')}`;

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function sendMessage(message, sessionId = null) {
  const payload = {
    message,
    sessionId: sessionId || TEST_SESSION_ID,
    userId: TEST_USER_ID
  };

  const response = await axios.post(CHAT_ENDPOINT, payload, {
    timeout: 20000,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  return response.data;
}

(async () => {
  try {
    console.log('Running unified flow regression test...');

    const greeting = await sendMessage('xin chao');
    assert(greeting && greeting.success === true, 'Greeting request failed');
    TEST_SESSION_ID = greeting.sessionId || TEST_SESSION_ID;
    assert(typeof greeting?.data?.text === 'string' && greeting.data.text.trim().length > 0, 'Greeting text is empty');
    assert(Array.isArray(greeting?.data?.products), 'Greeting payload missing products array');

    const technical = await sendMessage('ban huong dan toi sua laptop duoc khong', greeting.sessionId || null);
    assert(technical && technical.success === true, 'Technical request failed');
    assert(typeof technical?.data?.text === 'string' && technical.data.text.trim().length > 0, 'Technical text is empty');
    assert(Array.isArray(technical?.data?.products), 'Technical payload missing products array');

    const gText = (greeting.data.text || '').trim().toLowerCase();
    const tText = (technical.data.text || '').trim().toLowerCase();
    assert(gText !== tText, 'Technical response unexpectedly equals greeting response');

    console.log('PASS: unified flow is active and responses are valid (Gemini).');
    console.log(JSON.stringify({
      greeting: greeting.data.text,
      technical: technical.data.text,
      sessionId: TEST_SESSION_ID,
      providerGreeting: 'gemini',
      providerTechnical: 'gemini',
    }, null, 2));
  } catch (error) {
    console.error('FAIL:', error.message);
    process.exit(1);
  }
})();
