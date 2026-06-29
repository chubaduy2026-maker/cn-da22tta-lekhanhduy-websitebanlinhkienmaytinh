require('dotenv').config();
const mongoose = require('mongoose');
const Product = require('../models/Product');

async function testSearch() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');
    
    // Test 1: Simple category match (case insensitive)
    console.log('Test 1: Category RegExp match');
    const laptops1 = await Product.find({ 
      category: /laptop/i 
    }).limit(3).select('name price category');
    console.log(`  Found: ${laptops1.length} products`);
    laptops1.forEach(p => console.log(`    - ${p.name} [${p.category}]`));
    
    // Test 2: With price filter
    console.log('\nTest 2: Category + Price filter');
    const laptops2 = await Product.find({ 
      category: /laptop/i,
      price: { $gte: 27000000, $lte: 33000000 }
    }).limit(3).select('name price category');
    console.log(`  Found: ${laptops2.length} products`);
    laptops2.forEach(p => console.log(`    - ${p.name}: ${(p.price/1000000).toFixed(1)}tr`));
    
    // Test 3: Text search
    console.log('\nTest 3: Text search "gaming"');
    try {
      const laptops3 = await Product.find({ 
        $text: { $search: 'gaming' },
        category: /laptop/i
      }).limit(3).select('name price category');
      console.log(`  Found: ${laptops3.length} products`);
      laptops3.forEach(p => console.log(`    - ${p.name}`));
    } catch (error) {
      console.log(`  ❌ Text search error: ${error.message}`);
    }
    
    // Test 4: Check stock field
    console.log('\nTest 4: Products with stock > 0');
    const inStock = await Product.countDocuments({ 
      category: /laptop/i,
      stock: { $gt: 0 }
    });
    console.log(`  Found: ${inStock} laptops in stock`);
    
    // Test 5: Products without stock filter
    console.log('\nTest 5: All laptops (no stock filter)');
    const allLaptops = await Product.countDocuments({ 
      category: /laptop/i
    });
    console.log(`  Found: ${allLaptops} laptops total`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

testSearch();
