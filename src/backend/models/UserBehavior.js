const mongoose = require('mongoose');

const userBehaviorSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true,
    default: null
  },
  sessionId: {
    type: String,
    required: true,
    index: true
  },
  eventType: {
    type: String,
    required: true,
    enum: [
      'search_keyword',
      'view_product',
      'click_product',
      'add_to_cart',
      'purchase_product',
      'chatbot_message',
      'recommendation_click',
      'recommendation_impression'
    ],
    index: true
  },
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    index: true,
    default: null
  },
  keyword: {
    type: String,
    trim: true,
    default: ''
  },
  category: {
    type: String,
    trim: true,
    default: ''
  },
  brand: {
    type: String,
    trim: true,
    default: ''
  },
  price: {
    type: Number,
    default: 0
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
});

// Compound indexes to optimize user profile analysis queries
userBehaviorSchema.index({ userId: 1, eventType: 1, createdAt: -1 });
userBehaviorSchema.index({ sessionId: 1, eventType: 1, createdAt: -1 });

module.exports = mongoose.model('UserBehavior', userBehaviorSchema);
