/**
 * Evaluation System Configuration
 * TechStore AI Chatbot - RAG Evaluation
 */

module.exports = {
  // Backend API endpoint
  API_BASE_URL: 'http://localhost:5000',
  CHAT_ENDPOINT: '/api/v3/chat',

  // Evaluation settings
  CONCURRENCY: 3,           // Parallel requests
  REQUEST_TIMEOUT_MS: 30000, // 30s per question
  DELAY_BETWEEN_REQUESTS_MS: 500, // Rate limiting

  // Scoring thresholds (minimum acceptable scores)
  THRESHOLDS: {
    retrieval_accuracy: 0.70,   // 70%
    answer_correctness: 0.60,   // 60%
    faithfulness: 0.70,         // 70%
    latency_seconds: 5.0        // 5 seconds max
  },

  // Output paths
  RESULTS_DIR: './results',
  DATASET_PATH: './dataset/benchmark_dataset.json'
};
