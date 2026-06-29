#!/usr/bin/env node
/**
 * run_evaluation.js
 * TechStore AI Chatbot - Main Evaluation Entry Point
 * ===================================================
 * Usage:
 *   node run_evaluation.js
 *   node run_evaluation.js --limit 10
 *   node run_evaluation.js --category product_query
 *   node run_evaluation.js --limit 5 --category tech_explanation
 *   node run_evaluation.js --help
 */

const path = require('path');
const fs   = require('fs');

const EvaluationPipeline = require('./src/EvaluationPipeline');
const ReportGenerator    = require('./src/ReportGenerator');
const config             = require('./config');

// ─────────────────────────────────────────────────────────────
// PARSE CLI ARGUMENTS
// ─────────────────────────────────────────────────────────────
function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { limit: null, category: null, help: false };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--help' || args[i] === '-h') {
      opts.help = true;
    } else if (args[i] === '--limit' && args[i + 1]) {
      opts.limit = parseInt(args[++i]);
    } else if (args[i] === '--category' && args[i + 1]) {
      opts.category = args[++i];
    }
  }
  return opts;
}

function printHelp() {
  console.log(`
TechStore AI Chatbot - Evaluation Script
─────────────────────────────────────────
Usage:
  node run_evaluation.js [options]

Options:
  --limit <n>          Evaluate only the first N questions
  --category <name>    Evaluate only one category:
                         product_query
                         product_comparison
                         tech_explanation
                         recommendation
                         general_technical
  --help               Show this help message

Examples:
  node run_evaluation.js                            # Full 100-question evaluation
  node run_evaluation.js --limit 10                 # Quick test with 10 questions
  node run_evaluation.js --category product_query   # Only product queries
  node run_evaluation.js --limit 5 --category recommendation
  `);
}

// ─────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────
async function main() {
  const opts = parseArgs();

  if (opts.help) {
    printHelp();
    process.exit(0);
  }

  console.log('');
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║     TECHSTORE AI CHATBOT — EVALUATION SYSTEM v1.0       ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log(`  API Target  : ${config.API_BASE_URL}${config.CHAT_ENDPOINT}`);
  console.log(`  Timeout     : ${config.REQUEST_TIMEOUT_MS / 1000}s per question`);
  console.log(`  Delay       : ${config.DELAY_BETWEEN_REQUESTS_MS}ms between requests`);

  // Load dataset
  const datasetPath = path.resolve(__dirname, config.DATASET_PATH);
  if (!fs.existsSync(datasetPath)) {
    console.error(`\n❌ Dataset not found at: ${datasetPath}`);
    console.error('   Make sure dataset/benchmark_dataset.json exists.\n');
    process.exit(1);
  }

  let dataset;
  try {
    dataset = JSON.parse(fs.readFileSync(datasetPath, 'utf8'));
    console.log(`  Dataset     : ${dataset.length} questions loaded from benchmark_dataset.json`);
  } catch (e) {
    console.error(`\n❌ Failed to parse dataset: ${e.message}\n`);
    process.exit(1);
  }

  if (opts.limit)    console.log(`  Limit       : ${opts.limit} questions`);
  if (opts.category) console.log(`  Category    : ${opts.category}`);

  // Run evaluation pipeline
  const results = await EvaluationPipeline.run(dataset, {
    limit: opts.limit,
    category: opts.category,
    verbose: true
  });

  // Generate and save report
  const summary = ReportGenerator.generate(results);

  // Exit code: 0 if all metrics pass thresholds, 1 otherwise
  const t = config.THRESHOLDS;
  const m = summary.metrics;
  const allPassed = (
    m.retrieval_accuracy.average >= t.retrieval_accuracy &&
    m.answer_correctness.average >= t.answer_correctness &&
    m.faithfulness.average       >= t.faithfulness       &&
    m.latency.average_seconds    <= t.latency_seconds
  );

  if (allPassed) {
    console.log('✅ All metrics passed their thresholds!\n');
    process.exit(0);
  } else {
    console.log('⚠️  One or more metrics did not meet threshold requirements.\n');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('\n❌ Unhandled error:', err.message);
  process.exit(1);
});
