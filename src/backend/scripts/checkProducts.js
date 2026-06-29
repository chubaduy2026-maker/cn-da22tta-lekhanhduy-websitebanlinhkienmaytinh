const mongoose = require('mongoose');
const Product = require('../models/Product');
require('dotenv').config();

const checkProducts = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/thietbidientu');
    console.log('✅ Connected to MongoDB');
    
    const products = await Product.find().select('name brand category price stock');
    
    console.log('\n📦 TOTAL PRODUCTS:', products.length);
    console.log('\n📋 PRODUCT LIST:');
    console.log('='.repeat(100));
    
    products.forEach((product, index) => {
      console.log(`${index + 1}. ${product.name}`);
      console.log(`   Brand: ${product.brand || 'N/A'}`);
      console.log(`   Category: ${product.category || 'N/A'}`);
      console.log(`   Price: ${product.price?.toLocaleString('vi-VN')} đ`);
      console.log(`   Stock: ${product.stock}`);
      console.log('-'.repeat(100));
    });
    
    // Group by category
    const byCategory = {};
    products.forEach(p => {
      const cat = p.category || 'Uncategorized';
      if (!byCategory[cat]) byCategory[cat] = [];
      byCategory[cat].push(p.name);
    });
    
    console.log('\n📊 PRODUCTS BY CATEGORY:');
    console.log('='.repeat(100));
    Object.keys(byCategory).forEach(cat => {
      console.log(`\n${cat} (${byCategory[cat].length} products):`);
      byCategory[cat].forEach(name => console.log(`  - ${name}`));
    });
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

checkProducts();
