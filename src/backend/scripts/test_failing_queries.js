require('dotenv').config();
const mongoose = require('mongoose');
const { SemanticSearchService } = require('../services/ai');

async function test() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/thietbidientu');
    console.log('Connected to MongoDB');
    
    const queries = [
      'cần tìm máy tính làm đồ họa render mượt mà',
      'laptop văn phòng mỏng nhẹ pin trâu giá rẻ',
      'tai nghe gaming chụp tai cách âm tốt'
    ];
    
    for (const q of queries) {
      console.log(`\n======================= QUERY: "${q}" =======================`);
      const res = await SemanticSearchService.searchProducts({ keyword: q, limit: 3 });
      console.log('Mode:', res.mode || 'default/atlas');
      console.log('Exact Match:', res.exactMatch);
      console.log('Error:', res.error || 'None');
      console.log('Result Count:', res.products ? res.products.length : 0);
      if (res.products && res.products.length > 0) {
        res.products.forEach(p => {
          console.log(` - ${p.name} (${p.category})`);
        });
      }
    }
    
    await mongoose.disconnect();
  } catch (error) {
    console.error('Test script crashed:', error);
  }
}

test();
