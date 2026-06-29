const axios = require('axios');

const API_BASE = process.env.RAG_API_BASE || 'http://localhost:5000';
const ENDPOINT = `${API_BASE.replace(/\/$/, '')}/api/ai/rag-local/chat`;

const QUESTIONS = [
  'Nguon 750W co du cho RTX 4070 khong?',
  'Main H610 co nen lap i7 13700K khong?',
  'Tu van build PC gaming tam 20 trieu cho game FPS',
];

async function run() {
  const results = [];

  for (const question of QUESTIONS) {
    const startedAt = Date.now();
    try {
      const response = await axios.post(
        ENDPOINT,
        {
          message: question,
          topK: 4,
          candidateK: 8,
          history: [],
        },
        {
          timeout: 120000,
          headers: { 'Content-Type': 'application/json' },
        }
      );

      const data = response.data || {};
      results.push({
        question,
        ok: Boolean(data.success),
        latencyMs: Date.now() - startedAt,
        retrievalCount: data?.retrieval?.count ?? 0,
        source: data?.source || 'unknown',
        answerPreview: String(data?.answer || '').slice(0, 180),
      });
    } catch (error) {
      results.push({
        question,
        ok: false,
        latencyMs: Date.now() - startedAt,
        error: error?.response?.data?.message || error.message,
      });
    }
  }

  console.log(JSON.stringify({ endpoint: ENDPOINT, results }, null, 2));
}

run();
