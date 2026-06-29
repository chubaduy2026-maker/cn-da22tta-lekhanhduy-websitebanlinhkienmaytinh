const { GoogleGenerativeAI } = require('@google/generative-ai');

const FALLBACK_TEXT = 'Xin lỗi, hệ thống trả lời tự động hiện tạm thời không khả dụng. Vui lòng thử lại sau hoặc hỏi theo cách ngắn gọn hơn.';

async function callGemini(prompt) {
  if (!process.env.GEMINI_API_KEY) {
    console.warn('callGemini: GEMINI_API_KEY missing — trying Groq fallback');
    try {
      return await callGroq(prompt);
    } catch (groqErr) {
      console.error('Groq fallback failed:', groqErr.message);
      return FALLBACK_TEXT;
    }
  }

  const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  console.log('GEMINI_MODEL:', modelName);
  console.log('HAS_GEMINI_KEY:', !!process.env.GEMINI_API_KEY);

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: modelName });
    const result = await model.generateContent(prompt);

    const text = typeof result?.response?.text === 'function'
      ? result.response.text()
      : (result?.response?.text || result?.response || '');

    return String(text || '').trim();
  } catch (err) {
    const msg = String(err?.message || err || '').toLowerCase();
    console.error('callGemini error:', err?.message || err);
    if (msg.includes('403') || msg.includes('permission denied') || msg.includes('consumer_suspended') || msg.includes('suspended')) {
      console.warn('Gemini API key appears suspended or unauthorized — trying Groq fallback.');
      try {
        return await callGroq(prompt);
      } catch (groqErr) {
        console.error('Groq fallback failed:', groqErr.message);
        return FALLBACK_TEXT;
      }
    }

    try {
      console.warn('Attempting Groq fallback for Gemini error:', err.message);
      return await callGroq(prompt);
    } catch (groqErr) {
      console.error('Groq fallback also failed:', groqErr.message);
      throw err;
    }
  }
}

async function callGroq(prompt) {
  const axios = require('axios');
  const apiKey = process.env.GROQ_API_KEY;
  const model = process.env.GROQ_MODEL || 'llama-3.1-8b-instant';
  if (!apiKey) {
    throw new Error('GROQ_API_KEY is missing in env');
  }

  const response = await axios.post(
    'https://api.groq.com/openai/v1/chat/completions',
    {
      model: model,
      messages: [
        { role: 'user', content: prompt }
      ]
    },
    {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    }
  );
  return String(response.data?.choices?.[0]?.message?.content || '').trim();
}

module.exports = {
  callGemini
};

