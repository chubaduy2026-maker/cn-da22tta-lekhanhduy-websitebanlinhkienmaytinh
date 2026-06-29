const mongoose = require('mongoose');
const Category = require('../models/Category');
require('dotenv').config();

const checkCategories = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/thietbidientu');
    console.log('✅ Connected to MongoDB\n');
    
    // Danh sách danh mục từ hình ảnh
    const expectedCategories = [
      'Laptop',
      'PC',
      'Màn hình',
      'Mainboard',
      'CPU',
      'VGA',
      'RAM',
      'Ổ cứng',
      'Case',
      'Tản nhiệt',
      'Nguồn',
      'Bàn phím',
      'Chuột',
      'Ghế',
      'Tai nghe',
      'Loa',
      'Console',
      'Phụ kiện',
      'Thiết bị văn phòng'
    ];
    
    const categories = await Category.find().select('name');
    const existingCategories = categories.map(c => c.name);
    
    console.log('📋 CATEGORIES IN DATABASE:', existingCategories.length);
    existingCategories.forEach(cat => console.log(`  ✓ ${cat}`));
    
    console.log('\n📋 EXPECTED CATEGORIES FROM IMAGES:', expectedCategories.length);
    expectedCategories.forEach(cat => console.log(`  • ${cat}`));
    
    console.log('\n❌ MISSING CATEGORIES:');
    const missing = expectedCategories.filter(cat => !existingCategories.includes(cat));
    if (missing.length === 0) {
      console.log('  None! All categories exist.');
    } else {
      missing.forEach(cat => console.log(`  - ${cat}`));
    }
    
    console.log('\n✨ EXTRA CATEGORIES (not in image list):');
    const extra = existingCategories.filter(cat => !expectedCategories.includes(cat));
    if (extra.length === 0) {
      console.log('  None!');
    } else {
      extra.forEach(cat => console.log(`  + ${cat}`));
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

checkCategories();
