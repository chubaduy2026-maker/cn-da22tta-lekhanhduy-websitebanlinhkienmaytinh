/**
 * RecommendationLog Model
 * Lưu trữ logs recommendation cho A/B Testing và performance tracking
 */
const mongoose = require('mongoose');

const recommendationLogSchema = new mongoose.Schema({
  // User info
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },
  sessionId: {
    type: String,
    index: true
  },
  
  // Request info
  requestType: {
    type: String,
    enum: ['user', 'product', 'cart', 'trending', 'search'],
    required: true,
    index: true
  },
  
  // Input
  inputProductId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product'
  },
  inputCartProductIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product'
  }],
  
  // Output
  recommendations: [{
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product'
    },
    score: Number,
    position: Number,
    sources: [String]
  }],
  
  // Model info
  modelSources: [String],
  abVariant: {
    type: String,
    enum: ['A', 'B', 'C', null],
    default: null
  },
  
  // Performance
  latencyMs: {
    type: Number,
    default: 0
  },
  
  // User response (tracking)
  clickedProducts: [{
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product'
    },
    position: Number,
    clickedAt: Date
  }],
  
  // Conversion
  converted: {
    type: Boolean,
    default: false
  },
  conversionProductId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product'
  },
  
  // Metrics
  ctr: {
    type: Number, // Click-through rate
    default: 0
  }
}, {
  timestamps: true
});

// Indexes
recommendationLogSchema.index({ createdAt: -1 });
recommendationLogSchema.index({ requestType: 1, createdAt: -1 });
recommendationLogSchema.index({ abVariant: 1, createdAt: -1 });
recommendationLogSchema.index({ user: 1, requestType: 1 });

// Static: Get A/B test results
recommendationLogSchema.statics.getABTestResults = async function(days = 30) {
  const dateThreshold = new Date();
  dateThreshold.setDate(dateThreshold.getDate() - days);
  
  return this.aggregate([
    {
      $match: {
        createdAt: { $gte: dateThreshold },
        abVariant: { $ne: null }
      }
    },
    {
      $group: {
        _id: '$abVariant',
        totalRequests: { $sum: 1 },
        totalClicks: { $sum: { $size: { $ifNull: ['$clickedProducts', []] } } },
        totalConversions: { $sum: { $cond: ['$converted', 1, 0] } },
        avgLatency: { $avg: '$latencyMs' }
      }
    },
    {
      $addFields: {
        ctr: { $cond: [{ $gt: ['$totalRequests', 0] }, { $divide: ['$totalClicks', '$totalRequests'] }, 0] },
        conversionRate: { $cond: [{ $gt: ['$totalRequests', 0] }, { $divide: ['$totalConversions', '$totalRequests'] }, 0] }
      }
    },
    { $sort: { conversionRate: -1 } }
  ]);
};

// Static: Get model performance metrics
recommendationLogSchema.statics.getModelPerformance = async function(days = 7) {
  const dateThreshold = new Date();
  dateThreshold.setDate(dateThreshold.getDate() - days);
  
  return this.aggregate([
    {
      $match: { createdAt: { $gte: dateThreshold } }
    },
    {
      $unwind: { path: '$modelSources', preserveNullAndEmptyArrays: true }
    },
    {
      $group: {
        _id: '$modelSources',
        totalUsed: { $sum: 1 },
        avgLatency: { $avg: '$latencyMs' },
        totalClicks: { $sum: { $size: { $ifNull: ['$clickedProducts', []] } } },
        totalConversions: { $sum: { $cond: ['$converted', 1, 0] } }
      }
    },
    {
      $addFields: {
        ctr: { $cond: [{ $gt: ['$totalUsed', 0] }, { $divide: ['$totalClicks', '$totalUsed'] }, 0] }
      }
    },
    { $sort: { ctr: -1 } }
  ]);
};

module.exports = mongoose.model('RecommendationLog', recommendationLogSchema);
