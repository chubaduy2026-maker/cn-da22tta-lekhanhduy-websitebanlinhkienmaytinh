const axios = require('axios');
require('dotenv').config();

async function testGroq() {
  const apiKey = process.env.GROQ_API_KEY;
  const model = process.env.GROQ_MODEL || 'llama-3.1-8b-instant';
  console.log('Testing Groq with key:', apiKey ? apiKey.slice(0, 10) + '...' : 'none');
  console.log('Model:', model);

  try {
    const response = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: model,
        messages: [
          { role: 'user', content: 'SSD NVMe là gì và khác SSD thường thế nào? Trả lời rất ngắn gọn.' }
        ]
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('Success! Response:');
    console.log(response.data.choices[0].message.content);
  } catch (error) {
    console.error('Groq test failed:', error.response ? error.response.data : error.message);
  }
}

testGroq();
