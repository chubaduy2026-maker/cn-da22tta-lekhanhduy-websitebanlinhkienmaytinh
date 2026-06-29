const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const { SemanticSearchService } = require('../services/ai');

async function debug() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/thietbidientu');
    console.log('MongoDB Connected.');

    const query = 'máy tính để bàn';
    
    console.log(`\n--- Testing SemanticSearchService.searchProducts with: "${query}" ---`);
    const searchRes = await SemanticSearchService.searchProducts({ keyword: query, limit: 5 });
    console.log('Mode:', searchRes.mode);
    console.log('Exact Match:', searchRes.exactMatch);
    console.log('Count:', searchRes.products?.length);
    console.log('Products:', searchRes.products?.map(p => ({ name: p.name, category: p.category })));

    console.log(`\n--- Testing SemanticSearchService.smartHybridSearch with: "${query}" ---`);
    const hybridRes = await SemanticSearchService.smartHybridSearch({ raw_query: query }, { limit: 5 });
    console.log('Match Level:', hybridRes.match_level);
    console.log('Count:', hybridRes.results?.length);
    console.log('Products:', hybridRes.results?.map(p => ({ name: p.name, category: p.category })));

    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error);
  }
}

debug();
