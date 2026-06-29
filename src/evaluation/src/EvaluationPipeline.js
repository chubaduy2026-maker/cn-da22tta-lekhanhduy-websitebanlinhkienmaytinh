/**
 * EvaluationPipeline.js
 * TechStore AI Evaluation - Orchestration Pipeline
 * =================================================
 * Sends each test question to the chatbot API,
 * collects answers + retrieved context, then scores
 * all 4 metrics for every question.
 */

const axios  = require('axios');
const crypto = require('crypto');
const config = require('../config');
const MetricsCalculator = require('./MetricsCalculator');

class EvaluationPipeline {

  constructor() {
    this.apiBase = config.API_BASE_URL;
    this.endpoint = `${this.apiBase}${config.CHAT_ENDPOINT}`;
    this.timeout = config.REQUEST_TIMEOUT_MS;
    this.delay = config.DELAY_BETWEEN_REQUESTS_MS;
  }

  _createGuestSessionId() {
    return `guest_${crypto.randomBytes(32).toString('hex')}`;
  }

  _createGuestUserId() {
    return `guest_eval_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }

  /**
   * Run the full pipeline for a list of test cases.
   * @param {Array} testCases - Array of benchmark test cases
   * @param {Object} options  - { limit, category, verbose }
   * @returns {Array} results - Per-question evaluation results
   */
  async run(testCases, options = {}) {
    let cases = [...testCases];

    // Filter by category if specified
    if (options.category) {
      cases = cases.filter(tc => tc.category === options.category);
      console.log(`\n🔍 Filtered to category: "${options.category}" → ${cases.length} cases`);
    }

    // Limit number of questions if specified
    if (options.limit && options.limit < cases.length) {
      cases = cases.slice(0, options.limit);
      console.log(`⚙️  Running limited evaluation: ${cases.length} questions`);
    }

    console.log(`\n📋 Starting evaluation of ${cases.length} questions...\n`);
    console.log(`${'─'.repeat(60)}`);

    const results = [];
    const total = cases.length;

    for (let i = 0; i < cases.length; i++) {
      const testCase = cases[i];
      process.stdout.write(`[${i + 1}/${total}] ${testCase.id} - ${testCase.question.substring(0, 45)}...`);

      const result = await this._evaluateQuestion(testCase);
      results.push(result);

      if (result.error) {
        console.log(` ❌ ERROR`);
      } else {
        const avg = (
          result.metrics.retrieval_accuracy.score +
          result.metrics.answer_correctness.score +
          result.metrics.faithfulness.score
        ) / 3;
        console.log(` ✅ avg=${(avg * 100).toFixed(0)}% | ${result.metrics.latency.latencySeconds}s`);
      }

      // Rate limiting delay between requests
      if (i < cases.length - 1) {
        await this._sleep(this.delay);
      }
    }

    console.log(`${'─'.repeat(60)}`);
    console.log(`✔️  Evaluation complete.\n`);
    return results;
  }

  /**
   * Evaluate a single test case against the chatbot API.
   * @param {Object} testCase
   * @returns {Object} result with metrics
   */
  async _evaluateQuestion(testCase) {
    const startTime = Date.now();

    try {
      // ── Step 1: Call the chatbot API ──────────────────────────
      const sessionId = this._createGuestSessionId();
      const userId = this._createGuestUserId();
      const response = await axios.post(
        this.endpoint,
        {
          message: testCase.question,
          sessionId,
          userId
        },
        {
          timeout: this.timeout,
          headers: { 'Content-Type': 'application/json' }
        }
      );

      const latencyMs = Date.now() - startTime;
      const data = response.data;

      // Extract chatbot answer and retrieved products (RAG context)
      const chatbotAnswer = String(data?.data?.text || data?.answer || '').trim();
      const retrievedProducts = Array.isArray(data?.data?.products)
        ? data.data.products
        : (Array.isArray(data?.products) ? data.products : []);

      // ── Step 2: Calculate all 4 metrics ──────────────────────
      const retrievalAccuracy = MetricsCalculator.calculateRetrievalAccuracy(
        retrievedProducts,
        testCase.relevant_product_categories
      );

      const answerCorrectness = MetricsCalculator.calculateAnswerCorrectness(
        chatbotAnswer,
        testCase.ground_truth_answer,
        testCase.expected_keywords
      );

      const faithfulness = MetricsCalculator.calculateFaithfulness(
        chatbotAnswer,
        retrievedProducts
      );

      const latency = MetricsCalculator.calculateLatency(latencyMs);

      // ── Step 3: Return structured result ─────────────────────
      return {
        id: testCase.id,
        category: testCase.category,
        difficulty: testCase.difficulty,
        question: testCase.question,
        ground_truth: testCase.ground_truth_answer,
        chatbot_answer: chatbotAnswer,
        retrieved_product_count: retrievedProducts.length,
        metrics: {
          retrieval_accuracy: retrievalAccuracy,
          answer_correctness: answerCorrectness,
          faithfulness: faithfulness,
          latency: latency
        },
        api_metadata: {
          intent: data?.metadata?.intent,
          confidence: data?.metadata?.confidence,
          agent: data?.metadata?.agent,
          sessionId: data?.sessionId || sessionId
        },
        error: null
      };

    } catch (err) {
      const latencyMs = Date.now() - startTime;
      return {
        id: testCase.id,
        category: testCase.category,
        difficulty: testCase.difficulty,
        question: testCase.question,
        ground_truth: testCase.ground_truth_answer,
        chatbot_answer: null,
        retrieved_product_count: 0,
        metrics: {
          retrieval_accuracy: { score: 0, reason: 'API error' },
          answer_correctness: { score: 0, reason: 'API error' },
          faithfulness:       { score: 0, reason: 'API error' },
          latency:            MetricsCalculator.calculateLatency(latencyMs)
        },
        api_metadata: {},
        error: err?.response?.data?.message
          || err?.response?.data?.data?.text
          || err.message
      };
    }
  }

  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = new EvaluationPipeline();
