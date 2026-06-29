require('dotenv').config();
const mongoose = require('mongoose');
const Product = require('../models/Product');

async function testRealQuery() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected\n');
    
    const query = "laptop gaming dưới 30 triệu";
    const category = "laptop";
    const minPrice = 27000000;
    const maxPrice = 33000000;
    
    // Test 1: HybridSearchEngine _keywordSearch simulation
    console.log('=== Test 1: Keyword Search (HybridSearchEngine logic) ===');
    const filter1 = {
      $text: { $search: query },
      stock: { $gt: 0 },
      category: new RegExp(category, 'i'),
      price: { $gte: minPrice, $lte: maxPrice }
    };
    
    try {
      const products1 = await Product.find(filter1, { score: { $meta: 'textScore' } })
        .sort({ score: { $meta: 'textScore' } })
        .limit(10)
        .lean();
      console.log(`Found: ${products1.length} products`);
      products1.forEach(p => console.log(`  - ${p.name}: ${(p.price/1000000).toFixed(1)}tr (score: ${p.score.toFixed(2)})`));
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
    }
    
    // Test 2: Without text search (just filters)
    console.log('\n=== Test 2: Without Text Search (filters only) ===');
    const filter2 = {
      stock: { $gt: 0 },
      category: /laptop/i,
      price: { $gte: minPrice, $lte: maxPrice }
    };
    
    const products2 = await Product.find(filter2).limit(10).lean();
    console.log(`Found: ${products2.length} products`);
    products2.forEach(p => console.log(`  - ${p.name}: ${(p.price/1000000).toFixed(1)}tr`));
    
    // Test 3: Simpler text search
    console.log('\n=== Test 3: Text Search "gaming" only ===');
    const filter3 = {
      $text: { $search: 'gaming' },
      category: /laptop/i,
      price: { $gte: minPrice, $lte: maxPrice }
    };
    
    try {
      const products3 = await Product.find(filter3, { score: { $meta: 'textScore' } })
        .sort({ score: { $meta: 'textScore' } })
        .limit(10)
        .lean();
      console.log(`Found: ${products3.length} products`);
      products3.forEach(p => console.log(`  - ${p.name}: ${(p.price/1000000).toFixed(1)}tr`));
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
    }
    
    // Test 4: All gaming laptops (no price filter)
    console.log('\n=== Test 4: All Gaming Laptops (no price limit) ===');
    const filter4 = {
      $text: { $search: 'gaming' },
      category: /laptop/i,
      stock: { $gt: 0 }
    };
    
    try {
      const products4 = await Product.find(filter4, { score: { $meta: 'textScore' } })
        .sort({ score: { $meta: 'textScore' } })
        .limit(10)
        .select('name price')
        .lean();
      console.log(`Found: ${products4.length} products`);
      products4.forEach(p => console.log(`  - ${p.name}: ${(p.price/1000000).toFixed(1)}tr`));
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

testRealQuery();
