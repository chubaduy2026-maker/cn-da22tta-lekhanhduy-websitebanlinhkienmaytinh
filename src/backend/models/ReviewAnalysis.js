/**
 * ReviewAnalysis Model
 * Lưu trữ kết quả phân tích NLP của reviews
 * 
 * @module models/ReviewAnalysis
 * @description Schema cho AI NLP - Sentiment Analysis và Spam Detection
 */
const mongoose = require('mongoose');

const reviewAnalysisSchema = new mongoose.Schema({
  review: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Review',
    required: true,
    unique: true,
    index: true
  },
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
    index: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  // === SENTIMENT ANALYSIS ===
  sentiment: {
    // Label phân loại
    label: {
      type: String,
      enum: ['positive', 'neutral', 'negative'],
      required: true
    },
    // Score từ -1 (rất negative) đến 1 (rất positive)
    score: {
      type: Number,
      required: true,
      min: -1,
      max: 1
    },
    // Confidence của prediction (0-1)
    confidence: {
      type: Number,
      required: true,
      min: 0,
      max: 1
    },
    // Phân phối xác suất cho mỗi class
    probabilities: {
      positive: { type: Number, default: 0 },
      neutral: { type: Number, default: 0 },
      negative: { type: Number, default: 0 }
    }
  },

  // === ASPECT-BASED SENTIMENT ===
  // Phân tích sentiment theo từng khía cạnh của sản phẩm
  aspectSentiments: [{
    aspect: {
      type: String,
      enum: ['quality', 'price', 'performance', 'design', 'durability', 'service', 'shipping', 'packaging', 'other']
    },
    sentiment: {
      type: String,
      enum: ['positive', 'neutral', 'negative']
    },
    score: Number,
    keywords: [String] // Các từ khóa liên quan đến aspect
  }],

  // === SPAM DETECTION ===
  spamAnalysis: {
    isSpam: {
      type: Boolean,
      default: false
    },
    spamScore: {
      type: Number,
      min: 0,
      max: 1,
      default: 0
    },
    spamReasons: [{
      type: String,
      enum: [
        'duplicate_content',      // Nội dung trùng lặp
        'promotional_language',   // Ngôn ngữ quảng cáo
        'irrelevant_content',     // Nội dung không liên quan
        'excessive_caps',         // Quá nhiều chữ hoa
        'suspicious_pattern',     // Pattern đáng nghi
        'new_account_bulk',       // Account mới đánh giá nhiều
        'rating_mismatch',        // Rating không khớp với nội dung
        'offensive_language',     // Ngôn ngữ xúc phạm
        'url_spam',              // Chứa URL spam
        'fake_review_pattern'    // Pattern của fake review
      ]
    }],
    flags: {
      containsUrl: { type: Boolean, default: false },
      allCaps: { type: Boolean, default: false },
      excessiveEmoji: { type: Boolean, default: false },
      shortLength: { type: Boolean, default: false },
      copyPaste: { type: Boolean, default: false }
    }
  },

  // === TEXT ANALYSIS ===
  textAnalysis: {
    // Số từ trong review
    wordCount: { type: Number, default: 0 },
    // Số câu
    sentenceCount: { type: Number, default: 0 },
    // Độ dài trung bình của câu
    avgSentenceLength: { type: Number, default: 0 },
    // Từ khóa chính được trích xuất
    keywords: [String],
    // Named entities (tên sản phẩm, thương hiệu, etc.)
    entities: [{
      text: String,
      type: {
        type: String,
        enum: ['product', 'brand', 'feature', 'person', 'location', 'other']
      }
    }],
    // Ngôn ngữ của review
    language: {
      type: String,
      default: 'vi'
    },
    // Độ phức tạp ngôn ngữ (readability score)
    readabilityScore: { type: Number, default: 0 }
  },

  // === QUALITY METRICS ===
  qualityMetrics: {
    // Điểm chất lượng tổng thể của review (0-100)
    overallScore: { type: Number, default: 50 },
    // Review có hữu ích không
    isHelpful: { type: Boolean, default: false },
    // Review có chi tiết không
    isDetailed: { type: Boolean, default: false },
    // Review có cảm xúc thực không
    isAuthentic: { type: Boolean, default: true },
    // Consistency với rating
    ratingContentConsistency: { type: Number, min: 0, max: 1, default: 1 }
  },

  // === PROCESSING INFO ===
  processing: {
    model: {
      type: String,
      enum: ['rule-based', 'naive-bayes', 'svm', 'lstm', 'bert', 'phobert', 'custom'],
      default: 'rule-based'
    },
    modelVersion: { type: String, default: '1.0' },
    processedAt: { type: Date, default: Date.now },
    processingTime: { type: Number, default: 0 }, // milliseconds
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed'],
      default: 'pending'
    },
    errorMessage: String
  },

  // === MODERATION ===
  moderation: {
    // Cần review bởi admin không
    needsReview: { type: Boolean, default: false },
    // Đã được admin review chưa
    reviewed: { type: Boolean, default: false },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: Date,
    // Action được thực hiện
    action: {
      type: String,
      enum: ['approved', 'rejected', 'flagged', 'none'],
      default: 'none'
    },
    notes: String
  }
}, {
  timestamps: true
});

// Indexes
reviewAnalysisSchema.index({ 'sentiment.label': 1 });
reviewAnalysisSchema.index({ 'sentiment.score': 1 });
reviewAnalysisSchema.index({ 'spamAnalysis.isSpam': 1 });
reviewAnalysisSchema.index({ 'qualityMetrics.overallScore': -1 });
reviewAnalysisSchema.index({ 'processing.status': 1 });

// Static method: Lấy thống kê sentiment cho sản phẩm
reviewAnalysisSchema.statics.getProductSentimentStats = async function(productId) {
  const stats = await this.aggregate([
    {
      $match: {
        product: new mongoose.Types.ObjectId(productId),
        'processing.status': 'completed',
        'spamAnalysis.isSpam': false
      }
    },
    {
      $group: {
        _id: '$sentiment.label',
        count: { $sum: 1 },
        avgScore: { $avg: '$sentiment.score' },
        avgConfidence: { $avg: '$sentiment.confidence' }
      }
    }
  ]);

  const result = {
    positive: { count: 0, avgScore: 0, avgConfidence: 0 },
    neutral: { count: 0, avgScore: 0, avgConfidence: 0 },
    negative: { count: 0, avgScore: 0, avgConfidence: 0 },
    total: 0,
    overallSentimentScore: 0
  };

  let totalWeightedScore = 0;
  let totalCount = 0;

  stats.forEach(s => {
    result[s._id] = {
      count: s.count,
      avgScore: s.avgScore,
      avgConfidence: s.avgConfidence
    };
    totalWeightedScore += s.avgScore * s.count;
    totalCount += s.count;
  });

  result.total = totalCount;
  result.overallSentimentScore = totalCount > 0 ? totalWeightedScore / totalCount : 0;

  return result;
};

// Static method: Lấy reviews cần moderation
reviewAnalysisSchema.statics.getReviewsNeedingModeration = async function(options = {}) {
  const { limit = 20, skip = 0 } = options;
  
  return this.find({
    'moderation.needsReview': true,
    'moderation.reviewed': false
  })
  .populate('review')
  .populate('product', 'name')
  .populate('user', 'name email')
  .sort({ createdAt: -1 })
  .skip(skip)
  .limit(limit);
};

module.exports = mongoose.model('ReviewAnalysis', reviewAnalysisSchema);
