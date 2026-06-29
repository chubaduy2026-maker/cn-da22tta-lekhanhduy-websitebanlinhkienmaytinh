/* eslint-disable no-console */
require('dotenv').config();

const mongoose = require('mongoose');
const Product = require('../models/Product');
const SearchContext = require('../src/utils/SearchContext');
const { detectIntentFallback } = require('../src/utils/chatbotIntent');
const ProductSearchAgent = require('../services/ai/agents/ProductSearchAgent');
const PCBuilderAgent = require('../services/ai/agents/PCBuilderAgent');
const ResponseValidator = require('../services/ai/tools/ResponseValidator');
const priceResolver = require('../src/utils/priceResolver');

ProductSearchAgent._generateAnswer = async (message, products, history, params) =>
  ProductSearchAgent._buildFallbackAnswer(products, params);

function priceOf(product) {
  return Number(product?.salePrice || product?.price || 0);
}

function resultLine(pass, label, detail = '') {
  const status = pass ? 'PASS' : 'FAIL';
  console.log(`[${status}] ${label}${detail ? ` -> ${detail}` : ''}`);
  return pass;
}

async function run() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    throw new Error('Missing MONGODB_URI/MONGO_URI in backend .env');
  }

  await mongoose.connect(uri);
  console.log('[SETUP] Connected to MongoDB');

  const checks = [];

  const pcOver40Message = 'cho toi cac bo pc tren 40 trieu di';
  const pcOver40Intent = detectIntentFallback(pcOver40Message);
  const pcOver40Context = await SearchContext.build(pcOver40Message, pcOver40Intent, 'test_pc_over_40');
  const pcOver40Result = await PCBuilderAgent.execute({
    message: pcOver40Message,
    history: [],
    context: { searchContext: pcOver40Context }
  });
  const pcOver40Prices = pcOver40Result.products.map(priceOf);
  checks.push(resultLine(
    pcOver40Intent === 'pc_build',
    'Intent: "bo pc tren 40 trieu" routes to pc_build',
    pcOver40Intent
  ));
  checks.push(resultLine(
    pcOver40Prices.length === 0 || pcOver40Prices.every(price => price >= 40000000),
    'PC over 40m returns only products >= 40m',
    `${pcOver40Prices.length} product(s)`
  ));

  const build30Message = 'Build PC gaming 30 trieu';
  const build30Intent = detectIntentFallback(build30Message);
  const build30Context = await SearchContext.build(build30Message, build30Intent, 'test_build_30');
  const build30Result = await PCBuilderAgent.execute({
    message: build30Message,
    history: [],
    context: { searchContext: build30Context }
  });
  const build30Prices = build30Result.products.map(priceOf);
  checks.push(resultLine(
    build30Intent === 'pc_build',
    'Intent: "Build PC gaming 30 trieu" routes to pc_build',
    build30Intent
  ));
  checks.push(resultLine(
    build30Prices.length === 0 || build30Prices.every(price => price <= 30000000),
    'Build PC 30m returns no product above 30m',
    `${build30Prices.length} product(s)`
  ));
  checks.push(resultLine(
    /30\.000\.000/.test(build30Result.answer) && !/20\.000\.000/.test(build30Result.answer),
    'Build PC 30m response text mentions 30m, not stale 20m',
    build30Result.answer.split('\n')[0]
  ));
  checks.push(resultLine(
    !/duoi hoac qua|dưới hoặc quá/i.test(build30Result.answer),
    'Build PC response never says "duoi hoac qua"'
  ));

  const staleHistoryResult = await PCBuilderAgent.execute({
    message: build30Message,
    history: [{ role: 'user', content: 'toi can mua bo pc duoi 20 trieu' }],
    context: { searchContext: build30Context }
  });
  const staleHistoryPrices = staleHistoryResult.products.map(priceOf);
  checks.push(resultLine(
    staleHistoryPrices.length === 0 || staleHistoryPrices.every(price => price <= 30000000),
    'Current 30m budget overrides previous 20m history',
    staleHistoryResult.answer.split('\n')[0]
  ));
  checks.push(resultLine(
    /30\.000\.000/.test(staleHistoryResult.answer) && !/20\.000\.000/.test(staleHistoryResult.answer),
    'Stale history response text uses 30m, not 20m'
  ));

  const searchPcUnder20Message = 'toi muon mua pc gaming duoi 20 trieu';
  const searchPcContext = await SearchContext.build(searchPcUnder20Message, 'product_search', 'test_search_pc_under_20');
  const searchPcResult = await ProductSearchAgent.execute({
    message: searchPcUnder20Message,
    history: [],
    context: { searchContext: searchPcContext },
    intent: 'product_search'
  });
  const searchPcPrices = searchPcResult.products.map(priceOf);
  checks.push(resultLine(
    searchPcPrices.length === 0 || searchPcPrices.every(price => price <= 20000000),
    'ProductSearch PC under 20m respects max budget',
    `${searchPcPrices.length} product(s)`
  ));

  const speakerIntent = detectIntentFallback('loa ngoai va loa trong laptop cai nao sai on hon');
  checks.push(resultLine(
    speakerIntent === 'tech_compare',
    'Speaker comparison is tech_compare, not product search',
    speakerIntent
  ));

  const expensivePc = await Product.findOne({ category: /^PC$/i, price: { $gt: 30000000 } }).lean();
  if (expensivePc) {
    const validated = ResponseValidator.validate({
      text: 'Test products',
      products: [{
        id: String(expensivePc._id),
        name: expensivePc.name,
        category: expensivePc.category,
        brand: expensivePc.brand,
        price: expensivePc.price,
        salePrice: expensivePc.salePrice
      }],
      intent: 'pc_build',
      context: build30Context
    });
    checks.push(resultLine(
      validated.products.length === 0,
      'ResponseValidator removes PC product above 30m budget',
      expensivePc.name
    ));
  } else {
    console.log('[SKIP] No expensive PC product found for validator over-budget check');
  }

  const parserCases = [
    ['30 triệu', { targetPrice: 30000000 }],
    ['15tr', { targetPrice: 15000000 }],
    ['dưới 20 triệu', { priceMax: 20000000 }],
    ['trên 10 triệu', { priceMin: 10000000 }],
    ['khoảng 30 triệu', { targetPrice: 30000000 }],
    ['tầm 30 triệu', { targetPrice: 30000000 }],
    ['từ 15 đến 25 triệu', { priceMin: 15000000, priceMax: 25000000 }]
  ];

  for (const [input, expected] of parserCases) {
    const parsed = priceResolver.resolvePrice(input);
    const pass = Object.entries(expected).every(([key, value]) => parsed[key] === value);
    checks.push(resultLine(
      pass,
      `Budget parser: "${input}"`,
      JSON.stringify(parsed)
    ));
  }

  const pc25Context = await SearchContext.build('PC gaming tầm 25 triệu', 'pc_build', 'test_pc_25');
  checks.push(resultLine(
    pc25Context.targetPrice === 25000000 && pc25Context.priceMax === 25000000,
    'SearchContext pc_build "tam 25 trieu" sets target and max to 25m',
    JSON.stringify({
      targetPrice: pc25Context.targetPrice,
      priceMax: pc25Context.priceMax,
      priceMin: pc25Context.priceMin
    })
  ));

  const pcRangeContext = await SearchContext.build('PC từ 15 đến 25 triệu', 'pc_build', 'test_pc_range');
  checks.push(resultLine(
    pcRangeContext.priceMin === 15000000 && pcRangeContext.priceMax === 25000000,
    'SearchContext PC range 15-25m parses min/max',
    JSON.stringify({
      priceMin: pcRangeContext.priceMin,
      priceMax: pcRangeContext.priceMax
    })
  ));

  const failed = checks.filter(Boolean).length !== checks.length;
  console.log(`[SUMMARY] ${checks.filter(Boolean).length}/${checks.length} checks passed`);
  if (failed) process.exitCode = 1;
}

run()
  .catch((error) => {
    console.error('[ERROR]', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => {});
  });
