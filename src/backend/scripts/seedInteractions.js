/**
 * seedInteractions.js
 * Đồng bộ dữ liệu từ Orders và Reviews → UserInteraction
 * Mục đích: cung cấp dữ liệu train cho AI (SVD, NCF, Matrix Factorization)
 *
 * Chạy: node scripts/seedInteractions.js
 */

const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/thietbidientu';

const INTERACTION_WEIGHTS = {
  purchase: 5,
  review: 4,
  cart_add: 3,
  wishlist: 3,
  search_click: 2,
  view: 1,
};

mongoose
  .connect(MONGODB_URI)
  .then(async () => {
    console.log('✅ Connected to MongoDB:', MONGODB_URI.split('@')[1] || MONGODB_URI);

    const Order = require('../models/Order');
    const Review = require('../models/Review');
    const UserInteraction = require('../models/UserInteraction');

    let created = 0;
    let skipped = 0;

    // ── 1. Đồng bộ từ Orders (purchase interactions) ──
    console.log('\n📦 Syncing from Orders...');
    const orders = await Order.find({ user: { $exists: true, $ne: null } }).lean();
    console.log(`   Found ${orders.length} orders with user`);

    for (const order of orders) {
      for (const item of order.items || []) {
        if (!item.product) continue;

        const exists = await UserInteraction.findOne({
          user: order.user,
          product: item.product,
          interactionType: 'purchase',
          'metadata.orderId': order._id.toString(),
        });

        if (exists) { skipped++; continue; }

        await UserInteraction.create({
          user: order.user,
          product: item.product,
          interactionType: 'purchase',
          weight: INTERACTION_WEIGHTS.purchase,
          source: 'direct',
          metadata: { orderId: order._id.toString() },
          createdAt: order.createdAt || new Date(),
          updatedAt: order.createdAt || new Date(),
        });
        created++;
      }
    }

    // ── 2. Đồng bộ từ Reviews (review interactions) ──
    console.log('\n⭐ Syncing from Reviews...');
    const reviews = await Review.find({ user: { $exists: true, $ne: null } }).lean();
    console.log(`   Found ${reviews.length} reviews with user`);

    for (const review of reviews) {
      if (!review.product) continue;

      const exists = await UserInteraction.findOne({
        user: review.user,
        product: review.product,
        interactionType: 'review',
        'metadata.reviewId': review._id.toString(),
      });

      if (exists) { skipped++; continue; }

      await UserInteraction.create({
        user: review.user,
        product: review.product,
        interactionType: 'review',
        weight: INTERACTION_WEIGHTS.review,
        source: 'direct',
        metadata: { reviewId: review._id.toString(), rating: review.rating },
        createdAt: review.createdAt || new Date(),
        updatedAt: review.createdAt || new Date(),
      });
      created++;
    }

    const total = await UserInteraction.countDocuments();
    console.log(`\n✅ Done! Created: ${created} | Skipped (already exist): ${skipped}`);
    console.log(`📊 Total UserInteractions in DB: ${total}`);
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Error:', err.message);
    process.exit(1);
  });
