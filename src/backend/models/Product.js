const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true,
    default: ''
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  salePrice: {
    type: Number,
    min: 0,
    default: null
  },
  costPrice: {
    type: Number,
    min: 0,
    default: 0
  },
  originalPrice: {
    type: Number,
    min: 0
  },
  category: {
    type: String,
    required: true
  },
  subcategory: {
    type: [String],
    default: []
  },
  brand: {
    type: String,
    default: ''
  },

  // ── Ảnh ─────────────────────────────────────────────────
  image: {
    type: String,
    default: null
  },
  imageUrl: {
    type: String,
    default: null
  },
  imageAlt: {
    type: String,
    default: ''
  },
  images: {
    type: [String],
    default: []
  },

  // ── Kho hàng ─────────────────────────────────────────────
  stock: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },

  // ── Thông số kỹ thuật ─────────────────────────────────────
  specifications: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },

  // ── Trường bổ sung cho AI/Embedding ─────────────────────
  // Text ghép để tạo embedding (tự động hoặc thủ công)
  embeddingText: {
    type: String,
    default: ''
  },
  // Highlights: mảng điểm mạnh ngắn gọn
  highlights: {
    type: [String],
    default: []
  },
  // Use-case tags: ['gaming', 'office', 'student', ...]
  useCase: {
    type: [String],
    default: []
  },

  // ── Hiển thị ─────────────────────────────────────────────
  isActive: {
    type: Boolean,
    default: true
  },
  isFeatured: {
    type: Boolean,
    default: false
  },
  productUrl: {
    type: String,
    default: null
  },

  // ── Đánh giá ─────────────────────────────────────────────
  rating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },
  reviewCount: {
    type: Number,
    default: 0
  },
  reviews: [{
    user: String,
    comment: String,
    rating: Number,
    date: { type: Date, default: Date.now }
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// ── Virtuals ───────────────────────────────────────────────

// displayPrice: ưu tiên salePrice, fallback price
productSchema.virtual('displayPrice').get(function () {
  return this.salePrice || this.price || 0;
});

// primaryImage: ưu tiên imageUrl → image → images[0] → null
productSchema.virtual('primaryImage').get(function () {
  return this.imageUrl || this.image || (this.images?.[0] || null);
});

// ── Pre-save hooks ─────────────────────────────────────────

// Tự động sync imageUrl ↔ image
productSchema.pre('save', function (next) {
  if (!this.imageUrl && this.image) {
    this.imageUrl = this.image;
  } else if (!this.image && this.imageUrl) {
    this.image = this.imageUrl;
  }

  // Tự động tạo productUrl
  if (!this.productUrl && this._id) {
    this.productUrl = `/product/${this._id}`;
  }

  // Tự động tạo embeddingText nếu chưa có
  if (!this.embeddingText) {
    const specs = this.specifications
      ? Object.entries(this.specifications)
          .map(([k, v]) => `${k}: ${v}`)
          .join(', ')
      : '';
    this.embeddingText = [
      this.name,
      this.brand,
      this.category,
      this.description,
      specs
    ].filter(Boolean).join(' | ');
  }

  next();
});

// ── Indexes ────────────────────────────────────────────────
productSchema.index({ name: 'text', description: 'text', brand: 'text', embeddingText: 'text' });
productSchema.index({ category: 1 });
productSchema.index({ brand: 1 });
productSchema.index({ price: 1 });
productSchema.index({ salePrice: 1 });
productSchema.index({ rating: -1 });
productSchema.index({ isActive: 1 });
productSchema.index({ isFeatured: 1 });
productSchema.index({ useCase: 1 });

module.exports = mongoose.model('Product', productSchema);
