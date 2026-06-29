const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

async function testGemini() {
  const apiKey = process.env.GEMINI_API_KEY;
  const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  console.log('Testing Gemini with key:', apiKey ? apiKey.slice(0, 10) + '...' : 'none');
  console.log('Model:', modelName);

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: modelName });
    const result = await model.generateContent('Hello');
    console.log('Success! Response:', result.response.text());
  } catch (error) {
    console.error('Gemini test failed:', error.message);
  }
}

testGemini();
