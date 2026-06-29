/**
 * KnowledgeDocument Model
 * Stores chunked documents with vector embeddings for RAG system
 */
const mongoose = require('mongoose');

const knowledgeDocumentSchema = new mongoose.Schema({
  // The text content of this chunk
  text: {
    type: String,
    required: true
  },
  // Vector embedding (Gemini embedding-001: 3072 dimensions)
  embedding: {
    type: [Number],
    required: true,
    validate: {
      validator: function(v) {
        return v.length > 0 && v.length <= 4096;
      },
      message: 'Embedding dimension must be between 1 and 4096'
    }
  },
  // Source file name or URL
  source: {
    type: String,
    required: true,
    index: true
  },
  // Knowledge category
  category: {
    type: String,
    required: true,
    enum: [
      'technology', 'networking', 'programming', 'hardware',
      'software', 'ai_ml', 'security', 'cloud',
      'mobile', 'gaming', 'product_spec', 'general'
    ],
    index: true
  },
  // Source type
  sourceType: {
    type: String,
    enum: ['pdf', 'markdown', 'text', 'json', 'webpage', 'manual'],
    default: 'text'
  },
  // Chunk metadata
  chunkIndex: {
    type: Number,
    default: 0
  },
  totalChunks: {
    type: Number,
    default: 1
  },
  // Embedding model used
  embeddingModel: {
    type: String,
    default: 'gemini-embedding-001'
  },
  // Dimension of the embedding vector
  dimension: {
    type: Number,
    default: 3072
  },
  // Additional metadata
  metadata: {
    title: String,
    author: String,
    language: { type: String, default: 'vi' },
    wordCount: Number,
    tags: [String]
  },
  // Processing status
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'completed'
  },
  errorMessage: String
}, {
  timestamps: true
});

// Indexes
knowledgeDocumentSchema.index({ category: 1, status: 1 });
knowledgeDocumentSchema.index({ source: 1, chunkIndex: 1 });
knowledgeDocumentSchema.index({ 'metadata.tags': 1 });
knowledgeDocumentSchema.index({ status: 1 });

/**
 * Cosine similarity between two vectors
 */
knowledgeDocumentSchema.statics.cosineSimilarity = function(vecA, vecB) {
  if (!vecA || !vecB || vecA.length !== vecB.length) return 0;

  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dot += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
};

/**
 * Find similar documents by embedding vector
 */
knowledgeDocumentSchema.statics.findSimilar = async function(queryEmbedding, options = {}) {
  const {
    limit = 5,
    minSimilarity = 0.3,
    category = null,
    categories = null,
    excludeIds = []
  } = options;

  const filter = { status: 'completed' };
  if (category) filter.category = category;
  if (categories && categories.length > 0) filter.category = { $in: categories };
  if (excludeIds.length > 0) {
    filter._id = { $nin: excludeIds.map(id => new mongoose.Types.ObjectId(id)) };
  }

  const docs = await this.find(filter)
    .select('text embedding source category metadata chunkIndex')
    .lean();

  const results = docs.map(doc => ({
    _id: doc._id,
    text: doc.text,
    source: doc.source,
    category: doc.category,
    metadata: doc.metadata,
    chunkIndex: doc.chunkIndex,
    similarity: this.cosineSimilarity(queryEmbedding, doc.embedding)
  }));

  return results
    .filter(r => r.similarity >= minSimilarity)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);
};

module.exports = mongoose.model('KnowledgeDocument', knowledgeDocumentSchema);
