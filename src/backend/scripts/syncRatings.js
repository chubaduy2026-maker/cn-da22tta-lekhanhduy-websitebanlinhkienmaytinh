const mongoose = require('mongoose');
require('dotenv').config({ path: '../.env' });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/techstore';

mongoose.connect(MONGODB_URI)
  .then(async () => {
    console.log('✅ Connected to MongoDB');
    
    const Review = require('../models/Review');
    const Product = require('../models/Product');
    
    const products = await Product.find({});
    let updated = 0;

    for (const product of products) {
      const stats = await Review.aggregate([
        { 
          $match: { 
            product: product._id,
            status: 'approved'
          } 
        },
        {
          $group: {
            _id: null,
            averageRating: { $avg: '$rating' },
            totalReviews: { $sum: 1 }
          }
        }
      ]);

      const rating = stats.length > 0 ? Math.round(stats[0].averageRating * 10) / 10 : 0;
      const reviewCount = stats.length > 0 ? stats[0].totalReviews : 0;

      await Product.findByIdAndUpdate(product._id, { 
        rating: rating,
        reviewCount: reviewCount
      });
      updated++;
      console.log(`📊 ${product.name.substring(0, 50)}... - Rating: ${rating} (${reviewCount} reviews)`);
    }

    console.log(`\n✅ Done! Updated ${updated} products`);
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Error:', err);
    process.exit(1);
  });
