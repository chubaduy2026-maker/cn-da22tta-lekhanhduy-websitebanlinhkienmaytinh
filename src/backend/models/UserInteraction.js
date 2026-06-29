/**
 * UserInteraction Model
 * Lưu trữ tất cả tương tác của user với sản phẩm để phục vụ Collaborative Filtering
 * 
 * @module models/UserInteraction
 * @description Schema cho AI Recommendation System - Thu thập dữ liệu hành vi người dùng
 */
const mongoose = require('mongoose');

const userInteractionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
    index: true
  },
  // Loại tương tác với trọng số khác nhau cho recommendation
  interactionType: {
    type: String,
    required: true,
    enum: ['view', 'cart_add', 'wishlist', 'purchase', 'review', 'search_click'],
    index: true
  },
  // Trọng số tương tác (implicit rating)
  // view: 1, cart_add: 3, wishlist: 3, purchase: 5, review: 4, search_click: 2
  weight: {
    type: Number,
    required: true,
    default: 1
  },
  // Session ID để tracking journey
  sessionId: {
    type: String,
    index: true
  },
  // Thời gian xem (cho view interaction)
  viewDuration: {
    type: Number, // seconds
    default: 0
  },
  // Nguồn tương tác
  source: {
    type: String,
    enum: ['homepage', 'search', 'category', 'recommendation', 'cart', 'direct'],
    default: 'direct'
  },
  // Metadata bổ sung
  metadata: {
    searchQuery: String,      // Query nếu từ search
    categoryId: String,       // Category nếu từ category page
    recommendationType: String, // Loại recommendation nếu click từ gợi ý
    position: Number          // Vị trí trong danh sách (để đánh giá CTR)
  },
  // Device info
  deviceType: {
    type: String,
    enum: ['desktop', 'mobile', 'tablet'],
    default: 'desktop'
  }
}, {
  timestamps: true
});

// Compound indexes cho query hiệu quả
userInteractionSchema.index({ user: 1, product: 1 });
userInteractionSchema.index({ user: 1, interactionType: 1 });
userInteractionSchema.index({ product: 1, interactionType: 1 });
userInteractionSchema.index({ createdAt: -1 });

// Static method: Lấy interaction matrix cho Collaborative Filtering
userInteractionSchema.statics.getInteractionMatrix = async function(options = {}) {
  const { 
    minInteractions = 2, 
    interactionTypes = ['view', 'cart_add', 'purchase', 'review'],
    timeRange = 90 // days
  } = options;

  const dateThreshold = new Date();
  dateThreshold.setDate(dateThreshold.getDate() - timeRange);

  const interactions = await this.aggregate([
    {
      $match: {
        interactionType: { $in: interactionTypes },
        createdAt: { $gte: dateThreshold }
      }
    },
    {
      $group: {
        _id: { user: '$user', product: '$product' },
        totalWeight: { $sum: '$weight' },
        interactionCount: { $sum: 1 },
        lastInteraction: { $max: '$createdAt' }
      }
    },
    {
      $group: {
        _id: '$_id.user',
        interactions: {
          $push: {
            product: '$_id.product',
            score: '$totalWeight',
            count: '$interactionCount'
          }
        },
        totalInteractions: { $sum: '$interactionCount' }
      }
    },
    {
      $match: {
        totalInteractions: { $gte: minInteractions }
      }
    }
  ]);

  return interactions;
};

// Static method: Lấy top products được tương tác nhiều nhất
userInteractionSchema.statics.getPopularProducts = async function(limit = 20, timeRange = 30) {
  const dateThreshold = new Date();
  dateThreshold.setDate(dateThreshold.getDate() - timeRange);

  return this.aggregate([
    {
      $match: {
        createdAt: { $gte: dateThreshold }
      }
    },
    {
      $group: {
        _id: '$product',
        totalWeight: { $sum: '$weight' },
        uniqueUsers: { $addToSet: '$user' },
        viewCount: {
          $sum: { $cond: [{ $eq: ['$interactionType', 'view'] }, 1, 0] }
        },
        purchaseCount: {
          $sum: { $cond: [{ $eq: ['$interactionType', 'purchase'] }, 1, 0] }
        }
      }
    },
    {
      $addFields: {
        uniqueUserCount: { $size: '$uniqueUsers' },
        score: {
          $add: [
            '$totalWeight',
            { $multiply: [{ $size: '$uniqueUsers' }, 2] }
          ]
        }
      }
    },
    {
      $sort: { score: -1 }
    },
    {
      $limit: limit
    }
  ]);
};

// Instance method: Tính trọng số dựa trên loại tương tác
userInteractionSchema.pre('save', function(next) {
  const weights = {
    'view': 1,
    'search_click': 2,
    'cart_add': 3,
    'wishlist': 3,
    'review': 4,
    'purchase': 5
  };
  
  this.weight = weights[this.interactionType] || 1;
  
  // Bonus weight cho view duration dài
  if (this.interactionType === 'view' && this.viewDuration > 30) {
    this.weight += Math.min(Math.floor(this.viewDuration / 30), 3);
  }
  
  next();
});

module.exports = mongoose.model('UserInteraction', userInteractionSchema);
