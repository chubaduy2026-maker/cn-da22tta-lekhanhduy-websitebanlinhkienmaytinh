/**
 * ReportGenerator.js
 * TechStore AI Evaluation - Report & Statistics Generator
 * ========================================================
 * Aggregates per-question results and produces:
 *   - Console summary table
 *   - JSON report file
 *   - Plain-text report file
 */

const fs   = require('fs');
const path = require('path');
const config = require('../config');

class ReportGenerator {

  /**
   * Generate full report from evaluation results.
   * @param {Array} results - Output from EvaluationPipeline.run()
   * @returns {Object} summary statistics
   */
  generate(results) {
    const summary = this._computeSummary(results);
    this._printConsoleReport(summary, results);
    this._saveReports(summary, results);
    return summary;
  }

  // ─────────────────────────────────────────────────────────────
  // SUMMARY COMPUTATION
  // ─────────────────────────────────────────────────────────────
  _computeSummary(results) {
    const valid = results.filter(r => !r.error);
    const failed = results.filter(r => r.error);

    const avg = (arr) => arr.length === 0 ? 0 : arr.reduce((s, v) => s + v, 0) / arr.length;

    const raScores  = valid.map(r => r.metrics.retrieval_accuracy.score);
    const acScores  = valid.map(r => r.metrics.answer_correctness.score);
    const ffScores  = valid.map(r => r.metrics.faithfulness.score);
    const latMs     = valid.map(r => r.metrics.latency.latencyMs);

    // Per-category breakdown
    const categories = [...new Set(results.map(r => r.category))];
    const categoryStats = {};
    for (const cat of categories) {
      const catResults = valid.filter(r => r.category === cat);
      categoryStats[cat] = {
        count: catResults.length,
        retrieval_accuracy: avg(catResults.map(r => r.metrics.retrieval_accuracy.score)),
        answer_correctness: avg(catResults.map(r => r.metrics.answer_correctness.score)),
        faithfulness:       avg(catResults.map(r => r.metrics.faithfulness.score)),
        avg_latency_ms:     avg(catResults.map(r => r.metrics.latency.latencyMs))
      };
    }

    // Pass/Fail per threshold
    const thresholds = config.THRESHOLDS;
    const passedRA = valid.filter(r => r.metrics.retrieval_accuracy.score >= thresholds.retrieval_accuracy).length;
    const passedAC = valid.filter(r => r.metrics.answer_correctness.score >= thresholds.answer_correctness).length;
    const passedFF = valid.filter(r => r.metrics.faithfulness.score >= thresholds.faithfulness).length;
    const passedLT = valid.filter(r => r.metrics.latency.latencySeconds <= thresholds.latency_seconds).length;

    // Worst performing questions (bottom 5 by answer correctness)
    const worstQuestions = [...valid]
      .sort((a, b) => a.metrics.answer_correctness.score - b.metrics.answer_correctness.score)
      .slice(0, 5)
      .map(r => ({
        id: r.id,
        question: r.question.substring(0, 60) + '...',
        answer_correctness: r.metrics.answer_correctness.score
      }));

    return {
      total_questions: results.length,
      successful: valid.length,
      failed: failed.length,
      metrics: {
        retrieval_accuracy: {
          average: avg(raScores),
          passed: passedRA,
          pass_rate: valid.length > 0 ? passedRA / valid.length : 0
        },
        answer_correctness: {
          average: avg(acScores),
          passed: passedAC,
          pass_rate: valid.length > 0 ? passedAC / valid.length : 0
        },
        faithfulness: {
          average: avg(ffScores),
          passed: passedFF,
          pass_rate: valid.length > 0 ? passedFF / valid.length : 0
        },
        latency: {
          average_ms: avg(latMs),
          average_seconds: avg(latMs) / 1000,
          passed: passedLT,
          pass_rate: valid.length > 0 ? passedLT / valid.length : 0,
          min_ms: Math.min(...latMs),
          max_ms: Math.max(...latMs)
        }
      },
      category_breakdown: categoryStats,
      worst_questions: worstQuestions,
      thresholds_used: thresholds,
      generated_at: new Date().toISOString()
    };
  }

  // ─────────────────────────────────────────────────────────────
  // CONSOLE OUTPUT
  // ─────────────────────────────────────────────────────────────
  _printConsoleReport(summary, results) {
    const m = summary.metrics;
    const pct = (v) => `${(v * 100).toFixed(1)}%`;

    console.log('\n');
    console.log('═'.repeat(60));
    console.log('       TECHSTORE AI CHATBOT - EVALUATION REPORT');
    console.log('═'.repeat(60));
    console.log(`  Total Questions   : ${summary.total_questions}`);
    console.log(`  Successful        : ${summary.successful}`);
    if (summary.failed > 0)
    console.log(`  Failed (API Error): ${summary.failed}`);
    console.log('─'.repeat(60));
    console.log('  METRIC RESULTS');
    console.log('─'.repeat(60));
    console.log(`  Retrieval Accuracy  : ${pct(m.retrieval_accuracy.average)}   (${m.retrieval_accuracy.passed}/${summary.successful} passed threshold ≥${pct(config.THRESHOLDS.retrieval_accuracy)})`);
    console.log(`  Answer Correctness  : ${pct(m.answer_correctness.average)}   (${m.answer_correctness.passed}/${summary.successful} passed threshold ≥${pct(config.THRESHOLDS.answer_correctness)})`);
    console.log(`  Faithfulness        : ${pct(m.faithfulness.average)}   (${m.faithfulness.passed}/${summary.successful} passed threshold ≥${pct(config.THRESHOLDS.faithfulness)})`);
    console.log(`  Average Latency     : ${m.latency.average_seconds.toFixed(2)} seconds   (min: ${(m.latency.min_ms/1000).toFixed(2)}s, max: ${(m.latency.max_ms/1000).toFixed(2)}s)`);
    console.log('─'.repeat(60));
    console.log('  CATEGORY BREAKDOWN');
    console.log('─'.repeat(60));
    for (const [cat, stats] of Object.entries(summary.category_breakdown)) {
      console.log(`  ${cat.padEnd(25)} | RA:${pct(stats.retrieval_accuracy)} AC:${pct(stats.answer_correctness)} FF:${pct(stats.faithfulness)}`);
    }
    console.log('─'.repeat(60));
    console.log('  WORST PERFORMING QUESTIONS (by Answer Correctness)');
    console.log('─'.repeat(60));
    summary.worst_questions.forEach((q, i) => {
      console.log(`  ${i+1}. [${q.id}] ${q.question} → ${pct(q.answer_correctness)}`);
    });
    console.log('═'.repeat(60));
    console.log(`  Report generated at: ${summary.generated_at}`);
    console.log('═'.repeat(60) + '\n');
  }

  // ─────────────────────────────────────────────────────────────
  // FILE SAVING
  // ─────────────────────────────────────────────────────────────
  _saveReports(summary, results) {
    const resultsDir = path.resolve(__dirname, '..', 'results');
    if (!fs.existsSync(resultsDir)) fs.mkdirSync(resultsDir, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);

    // JSON report
    const jsonPath = path.join(resultsDir, `report_${timestamp}.json`);
    fs.writeFileSync(jsonPath, JSON.stringify({ summary, results }, null, 2), 'utf8');
    console.log(`📄 JSON report saved: ${jsonPath}`);

    // Plain-text report
    const txtPath = path.join(resultsDir, `report_${timestamp}.txt`);
    const m = summary.metrics;
    const pct = (v) => `${(v * 100).toFixed(1)}%`;
    const txt = [
      'TECHSTORE AI CHATBOT - EVALUATION REPORT',
      '='.repeat(50),
      `Generated: ${summary.generated_at}`,
      '',
      `Total Questions    : ${summary.total_questions}`,
      `Successful         : ${summary.successful}`,
      `Failed (API Error) : ${summary.failed}`,
      '',
      'METRICS',
      '-'.repeat(50),
      `Retrieval Accuracy : ${pct(m.retrieval_accuracy.average)}`,
      `Answer Correctness : ${pct(m.answer_correctness.average)}`,
      `Faithfulness       : ${pct(m.faithfulness.average)}`,
      `Average Latency    : ${m.latency.average_seconds.toFixed(2)} seconds`,
      '',
      'CATEGORY BREAKDOWN',
      '-'.repeat(50),
      ...Object.entries(summary.category_breakdown).map(([cat, s]) =>
        `${cat}: RA=${pct(s.retrieval_accuracy)} AC=${pct(s.answer_correctness)} FF=${pct(s.faithfulness)} Latency=${(s.avg_latency_ms/1000).toFixed(2)}s`
      )
    ].join('\n');
    fs.writeFileSync(txtPath, txt, 'utf8');
    console.log(`📄 Text report saved: ${txtPath}\n`);
  }
}

module.exports = new ReportGenerator();
