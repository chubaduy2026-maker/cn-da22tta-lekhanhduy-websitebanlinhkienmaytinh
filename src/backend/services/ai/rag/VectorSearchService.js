/**
 * Vector Search Service
 * Performs semantic vector search against Atlas Vector Search indexes.
 * Uses MongoDB M0 compatible $vectorSearch with graceful fallback.
 * 
 * @module services/ai/rag/VectorSearchService
 */
const KnowledgeDocument = require('../../../models/KnowledgeDocument');
const ProductEmbedding = require('../../../models/ProductEmbedding');
const Product = require('../../../models/Product');
const EmbeddingService = require('./EmbeddingService');

class VectorSearchService {
  constructor() {
    this.knowledgeIndexName = process.env.MONGODB_KNOWLEDGE_VECTOR_INDEX || 'knowledge_embedding_index';
    this.productIndexName = process.env.MONGODB_PRODUCT_VECTOR_INDEX || 'product_embedding_index';
  }

  isAvailable() {
    return EmbeddingService.isAvailable();
  }

  /**
   * Semantic search: embed query then find similar documents
   * @param {string} query - User query text
   * @param {Object} options - Search options
   * @returns {Promise<Object[]>} Ranked results with text and similarity score
   */
  async search(query, options = {}) {
    const {
      limit = 5,
      minSimilarity = 0.3,
      category = null,
      categories = null
    } = options;

    try {
      const queryEmbedding = await EmbeddingService.embedText(query);

      const filter = { status: 'completed' };
      if (category) {
        filter.category = category;
      }
      if (Array.isArray(categories) && categories.length > 0) {
        filter.category = { $in: categories };
      }

      const numCandidates = Math.max(limit * 8, 40);

      const atlasResults = await KnowledgeDocument.aggregate([
        {
          $vectorSearch: {
            index: this.knowledgeIndexName,
            path: 'embedding',
            queryVector: queryEmbedding,
            numCandidates,
            limit,
            filter
          }
        },
        {
          $project: {
            _id: 1,
            text: 1,
            source: 1,
            category: 1,
            metadata: 1,
            chunkIndex: 1,
            similarity: { $meta: 'vectorSearchScore' }
          }
        }
      ]);

      return atlasResults.filter((doc) => (doc.similarity || 0) >= minSimilarity);
    } catch (error) {
      console.warn('Atlas knowledge vector search failed, fallback to in-app cosine:', error.message);
      const queryEmbedding = await EmbeddingService.embedText(query);
      return KnowledgeDocument.findSimilar(queryEmbedding, {
        limit,
        minSimilarity,
        category,
        categories
      });
    }
  }

  /**
   * Hybrid search: combine vector similarity with keyword matching
   * @param {string} query - User query
   * @param {Object} options - Search options
   * @returns {Promise<Object[]>} Merged and ranked results
   */
  async hybridSearch(query, options = {}) {
    const {
      limit = 5,
      minSimilarity = 0.25,
      category = null,
      categories = null,
      vectorWeight = 0.7,
      keywordWeight = 0.3
    } = options;

    // Parallel: vector search + keyword search
    const [vectorResults, keywordResults] = await Promise.all([
      this.search(query, { limit: limit * 2, minSimilarity, category, categories }),
      this._keywordSearch(query, { limit: limit * 2, category, categories })
    ]);

    // Merge results
    const scored = new Map();

    for (const r of vectorResults) {
      const id = r._id.toString();
      scored.set(id, {
        ...r,
        vectorScore: r.similarity,
        keywordScore: 0,
        finalScore: r.similarity * vectorWeight
      });
    }

    for (const r of keywordResults) {
      const id = r._id.toString();
      if (scored.has(id)) {
        const existing = scored.get(id);
        existing.keywordScore = r.keywordScore;
        existing.finalScore += r.keywordScore * keywordWeight;
      } else {
        scored.set(id, {
          ...r,
          vectorScore: 0,
          keywordScore: r.keywordScore,
          finalScore: r.keywordScore * keywordWeight
        });
      }
    }

    return Array.from(scored.values())
      .sort((a, b) => b.finalScore - a.finalScore)
      .slice(0, limit);
  }

  /**
   * Keyword-based search using MongoDB text index
   * @private
   */
  async _keywordSearch(query, options = {}) {
    const { limit = 10, category = null, categories = null } = options;
    
    const filter = { status: 'completed' };
    if (category) filter.category = category;
    if (categories && categories.length > 0) filter.category = { $in: categories };

    // Use regex for flexible matching (text index may not exist)
    const words = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    if (words.length === 0) return [];

    const regexPattern = words.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
    filter.text = { $regex: regexPattern, $options: 'i' };

    const docs = await KnowledgeDocument.find(filter)
      .select('text source category metadata chunkIndex')
      .limit(limit)
      .lean();

    // Score based on keyword match density
    return docs.map(doc => {
      const textLower = doc.text.toLowerCase();
      const matchCount = words.reduce((count, word) => {
        const regex = new RegExp(word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
        const matches = textLower.match(regex);
        return count + (matches ? matches.length : 0);
      }, 0);
      const keywordScore = Math.min(matchCount / (words.length * 3), 1.0);
      return { ...doc, keywordScore };
    });
  }

  /**
   * Semantic product search using ProductEmbedding collection
   * @param {string} query - User query
   * @param {Object} options - Search options
   * @returns {Promise<Object[]>} Products ranked by similarity
   */
  async searchProducts(query, options = {}) {
    const {
      limit = 10,
      minSimilarity = 0.4,
      category = null,
      brand = null,
      excludeProductIds = []
    } = options;

    const queryEmbedding = await EmbeddingService.embedText(query);
    return this.searchSimilarProducts(queryEmbedding, limit, {
      minSimilarity,
      excludeProductIds,
      category,
      brand
    });
  }

  /**
   * Atlas vector search for products.
   * Required by new RAG flow to replace brute-force in RAM.
   *
   * @param {number[]} queryVector
   * @param {number} limit
   * @param {object} options
   */
  async searchSimilarProducts(queryVector, limit = 10, options = {}) {
    const {
      minSimilarity = 0.35,
      excludeProductIds = [],
      category = null,
      brand = null
    } = options;

    if (!Array.isArray(queryVector) || queryVector.length === 0) {
      return [];
    }

    const filter = { status: 'completed' };
    if (category) {
      filter['metadata.category'] = category;
    }
    if (brand) {
      filter['metadata.brand'] = brand;
    }
    if (excludeProductIds.length > 0) {
      filter.product = {
        $nin: excludeProductIds
      };
    }

    try {
      const numCandidates = Math.max(limit * 8, 50);
      const hits = await ProductEmbedding.aggregate([
        {
          $vectorSearch: {
            index: this.productIndexName,
            path: 'embedding',
            queryVector,
            numCandidates,
            limit,
            filter
          }
        },
        {
          $project: {
            product: 1,
            metadata: 1,
            similarity: { $meta: 'vectorSearchScore' }
          }
        }
      ]);

      const filtered = hits.filter((item) => (item.similarity || 0) >= minSimilarity);
      const ids = filtered.map((item) => item.product).filter(Boolean);

      const products = await Product.find({ _id: { $in: ids }, stock: { $gt: 0 } })
        .select('name description brand category price salePrice image images rating reviewCount stock specifications')
        .lean();

      const byId = new Map(products.map((p) => [String(p._id), p]));

      return filtered
        .map((row) => {
          const product = byId.get(String(row.product));
          if (!product) {
            return null;
          }
          return {
            product,
            score: row.similarity,
            matchType: 'atlas-vector'
          };
        })
        .filter(Boolean);
    } catch (error) {
      console.warn('Atlas product vector search failed, fallback to brute-force query:', error.message);
      const fallback = await ProductEmbedding.findSimilarProducts(queryVector, {
        limit,
        minSimilarity,
        excludeProductIds,
        category,
        brand
      });

      const ids = fallback.map((item) => item.product).filter(Boolean);
      const products = await Product.find({ _id: { $in: ids }, stock: { $gt: 0 } })
        .select('name description brand category price salePrice image images rating reviewCount stock specifications')
        .lean();
      const byId = new Map(products.map((p) => [String(p._id), p]));

      return fallback
        .map((row) => {
          const product = byId.get(String(row.product));
          if (!product) {
            return null;
          }
          return {
            product,
            score: row.similarity,
            matchType: 'fallback-cosine'
          };
        })
        .filter(Boolean);
    }
  }

  /**
   * Get statistics about the knowledge base
   * @returns {Promise<Object>}
   */
  async getStats() {
    const [total, byCategory, bySource] = await Promise.all([
      KnowledgeDocument.countDocuments({ status: 'completed' }),
      KnowledgeDocument.aggregate([
        { $match: { status: 'completed' } },
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]),
      KnowledgeDocument.aggregate([
        { $match: { status: 'completed' } },
        { $group: { _id: '$source', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 20 }
      ])
    ]);

    return { total, byCategory, bySource };
  }
}

module.exports = new VectorSearchService();
