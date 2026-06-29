const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const Product = require('../models/Product');

async function debug() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/thietbidientu');
    console.log('MongoDB Connected.');

    const count = await Product.countDocuments({});
    console.log(`Total Products: ${count}`);

    const inStock = await Product.countDocuments({ stock: { $gt: 0 } });
    console.log(`Products with stock > 0: ${inStock}`);

    const zeroStock = await Product.countDocuments({ stock: 0 });
    console.log(`Products with stock === 0: ${zeroStock}`);

    const missingStock = await Product.countDocuments({ stock: { $exists: false } });
    console.log(`Products missing stock field: ${missingStock}`);

    const categories = await Product.distinct('category');
    console.log('Distinct Categories:', categories);

    const pcProducts = await Product.find({ 
      $or: [
        { name: /máy tính/i },
        { category: /pc/i },
        { name: /pc/i }
      ]
    }).limit(10).lean();
    
    console.log('PC/Desktop products in DB:', pcProducts.map(p => ({
      name: p.name,
      category: p.category,
      stock: p.stock,
      isActive: p.isActive
    })));

    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error);
  }
}

debug();
