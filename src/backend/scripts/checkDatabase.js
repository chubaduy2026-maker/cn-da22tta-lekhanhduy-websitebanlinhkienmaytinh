require('dotenv').config();
const mongoose = require('mongoose');
const Product = require('../models/Product');

async function checkDatabase() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');
    
    const count = await Product.countDocuments();
    const laptops = await Product.countDocuments({ category: 'laptop' });
    const laptopsInRange = await Product.countDocuments({ 
      category: 'laptop', 
      price: { $gte: 27000000, $lte: 33000000 } 
    });
    
    console.log('📊 Database Stats:');
    console.log('  Total products:', count);
    console.log('  Laptops:', laptops);
    console.log('  Laptops 27-33 triệu:', laptopsInRange);
    
    const samples = await Product.find({ 
      category: 'laptop', 
      price: { $gte: 27000000, $lte: 33000000 } 
    }).limit(5).select('name price category');
    
    console.log('\n📦 Sample products (27-33tr):');
    if (samples.length === 0) {
      console.log('  ❌ No products found!');
    } else {
      samples.forEach(p => {
        console.log(`  - ${p.name}: ${(p.price/1000000).toFixed(1)} triệu`);
      });
    }
    
    // Check ProductSearchAgent query logic
    const allLaptops = await Product.find({ category: 'laptop' }).limit(3).select('name price');
    console.log('\n📦 All laptops (first 3):');
    allLaptops.forEach(p => {
      console.log(`  - ${p.name}: ${(p.price/1000000).toFixed(1)} triệu`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkDatabase();
