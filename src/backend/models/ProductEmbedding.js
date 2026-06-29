/**
 * ProductEmbedding Model
 * Lưu trữ vector embeddings của sản phẩm cho Semantic Search và Content-based Filtering
 * 
 * @module models/ProductEmbedding
 * @description Schema cho AI Semantic Search - Vector embeddings
 */
const mongoose = require('mongoose');

const productEmbeddingSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
    unique: true,
    index: true
  },
  // Text được sử dụng để tạo embedding
  sourceText: {
    type: String,
    required: true
  },
  // Vector embedding (dimension tùy thuộc vào model)
  // Sử dụng Mixed type để lưu array of numbers
  embedding: {
    type: [Number],
    required: true,
    validate: {
      validator: function(v) {
        return v.length > 0 && v.length <= 4096;
      },
      message: 'Embedding dimension phải từ 1 đến 4096'
    }
  },
  // Dimension của vector
  dimension: {
    type: Number,
    required: true
  },
  // Model được sử dụng để tạo embedding
  embeddingModel: {
    type: String,
    required: true,
    enum: ['tfidf', 'word2vec', 'fasttext', 'sentence-transformer', 'openai-ada-002', 'gemini-embedding-001', 'custom'],
    default: 'tfidf'
  },
  // Category embedding (cho content-based filtering)
  categoryEmbedding: {
    type: [Number],
    default: []
  },
  // Feature embedding từ specifications
  specificationEmbedding: {
    type: [Number],
    default: []
  },
  // Normalized embedding (L2 normalized cho cosine similarity)
  normalizedEmbedding: {
    type: [Number],
    default: []
  },
  // Metadata
  metadata: {
    productName: String,
    category: String,
    brand: String,
    priceRange: String, // 'budget', 'mid-range', 'high-end', 'premium'
    specifications: mongoose.Schema.Types.Mixed
  },
  // Thống kê
  stats: {
    searchHits: { type: Number, default: 0 },
    recommendationHits: { type: Number, default: 0 },
    lastAccessed: { type: Date, default: Date.now }
  },
  // Version để track update
  version: {
    type: Number,
    default: 1
  },
  // Trạng thái embedding
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'pending'
  },
  // Error message nếu failed
  errorMessage: String
}, {
  timestamps: true
});

// Indexes cho vector search (khi sử dụng MongoDB Atlas Vector Search)
productEmbeddingSchema.index({ 'metadata.category': 1 });
productEmbeddingSchema.index({ 'metadata.brand': 1 });
productEmbeddingSchema.index({ status: 1 });
productEmbeddingSchema.index({ embeddingModel: 1 });

// Static method: Cosine similarity giữa 2 vectors
productEmbeddingSchema.statics.cosineSimilarity = function(vecA, vecB) {
  if (vecA.length !== vecB.length) {
    throw new Error('Vectors must have same dimension');
  }
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  
  if (normA === 0 || normB === 0) return 0;
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
};

// Static method: Tìm sản phẩm tương tự bằng embedding
productEmbeddingSchema.statics.findSimilarProducts = async function(queryEmbedding, options = {}) {
  const {
    limit = 10,
    minSimilarity = 0.5,
    excludeProductIds = [],
    category = null,
    brand = null
  } = options;

  const matchStage = {
    status: 'completed'
  };
  
  if (excludeProductIds.length > 0) {
    matchStage.product = { $nin: excludeProductIds.map(id => new mongoose.Types.ObjectId(id)) };
  }
  if (category) {
    matchStage['metadata.category'] = category;
  }
  if (brand) {
    matchStage['metadata.brand'] = brand;
  }

  // Lấy tất cả embeddings phù hợp
  const embeddings = await this.find(matchStage)
    .select('product embedding metadata')
    .lean();

  // Tính similarity và sort
  const similarities = embeddings.map(emb => ({
    product: emb.product,
    metadata: emb.metadata,
    similarity: this.cosineSimilarity(queryEmbedding, emb.embedding)
  }));

  // Filter và sort
  return similarities
    .filter(s => s.similarity >= minSimilarity)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);
};

// Static method: L2 normalize vector
productEmbeddingSchema.statics.normalizeVector = function(vector) {
  const norm = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
  if (norm === 0) return vector;
  return vector.map(val => val / norm);
};

// Pre-save hook: Tự động tính normalized embedding
productEmbeddingSchema.pre('save', function(next) {
  if (this.isModified('embedding') && this.embedding.length > 0) {
    const norm = Math.sqrt(this.embedding.reduce((sum, val) => sum + val * val, 0));
    if (norm > 0) {
      this.normalizedEmbedding = this.embedding.map(val => val / norm);
    }
    this.dimension = this.embedding.length;
  }
  next();
});

module.exports = mongoose.model('ProductEmbedding', productEmbeddingSchema);
