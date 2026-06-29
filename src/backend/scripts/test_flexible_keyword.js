const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const { SemanticSearchService } = require('../services/ai');
const Product = require('../models/Product');

async function debug() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/thietbidientu');
    console.log('MongoDB Connected.');

    const query = 'máy tính để bàn';
    
    console.log('\n--- Inferred category hint ---');
    const hint = SemanticSearchService._extractCategoryHint(query);
    console.log('Hint:', hint);

    const regex = SemanticSearchService._buildCoreCategoryRegex(hint);
    console.log('Regex:', regex);

    const matchPC = await Product.find({ category: regex }).lean();
    console.log('PC Category match count:', matchPC.length);
    console.log('PC Category match names:', matchPC.map(p => p.name));

    console.log('\n--- Testing _queryByFlexibleKeyword directly ---');
    const res = await SemanticSearchService._queryByFlexibleKeyword(query, {}, 5);
    console.log('Result count:', res.length);
    console.log('Results:', res.map(p => p.name));

    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error);
  }
}

debug();
