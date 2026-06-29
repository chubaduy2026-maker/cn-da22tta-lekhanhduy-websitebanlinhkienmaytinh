const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: false // Optional: để tracking review từ đơn hàng nào
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  comment: {
    type: String,
    required: true,
    trim: true,
    maxlength: 1000
  },
  images: [{
    type: String // URLs của ảnh đánh giá
  }],
  helpful: {
    type: Number,
    default: 0 // Số người thấy đánh giá hữu ích
  },
  helpfulBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  verified: {
    type: Boolean,
    default: false // True nếu user đã mua sản phẩm
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'approved' // Có thể thêm moderation nếu cần
  },
  // Phản hồi tự động từ admin/shop
  adminReply: {
    content: {
      type: String,
      default: ''
    },
    repliedAt: {
      type: Date
    },
    repliedBy: {
      type: String,
      default: 'TechStore'
    }
  }
}, {
  timestamps: true
});

// Index để tìm reviews theo product và user nhanh
reviewSchema.index({ product: 1, user: 1 });
reviewSchema.index({ product: 1, createdAt: -1 });

// Virtual để populate user info
reviewSchema.virtual('userInfo', {
  ref: 'User',
  localField: 'user',
  foreignField: '_id',
  justOne: true
});

module.exports = mongoose.model('Review', reviewSchema);
