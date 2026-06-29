const { ChromaClient } = require('chromadb');
const { GoogleGenerativeAIEmbeddings } = require('@langchain/google-genai');

const Product = require('../../models/Product');

class ChromaRetrievalService {
  constructor() {
    this.knowledgeCollectionName = process.env.CHROMA_KNOWLEDGE_COLLECTION || 'techstore_knowledge';
    this.productCollectionName = process.env.CHROMA_PRODUCT_COLLECTION || 'techstore_products';
    this.embeddingModel = process.env.CHROMA_EMBEDDING_MODEL || process.env.GEMINI_EMBEDDING_MODEL || 'embedding-001';
    this.apiKey = process.env.GEMINI_API_KEY || '';
    this.embeddings = null;
    this.client = null;
  }

  async _getEmbeddings() {
    if (this.embeddings) {
      return this.embeddings;
    }

    if (!this.apiKey) {
      throw new Error('GEMINI_API_KEY is missing');
    }

    this.embeddings = new GoogleGenerativeAIEmbeddings({
      apiKey: this.apiKey,
      modelName: this.embeddingModel
    });

    return this.embeddings;
  }

  _resolveClientOptions() {
    const rawUrl = String(process.env.CHROMA_URL || '').trim();
    if (rawUrl) {
      try {
        const parsed = new URL(rawUrl);
        return {
          host: parsed.hostname,
          port: parsed.port ? Number(parsed.port) : (parsed.protocol === 'https:' ? 443 : 8000),
          ssl: parsed.protocol === 'https:'
        };
      } catch (error) {
        console.warn('Invalid CHROMA_URL, falling back to host/port vars:', error.message);
      }
    }

    return {
      host: process.env.CHROMA_HOST || '127.0.0.1',
      port: Number(process.env.CHROMA_PORT || 8000),
      ssl: String(process.env.CHROMA_SSL || 'false').toLowerCase() === 'true'
    };
  }

  async _getClient() {
    if (this.client) {
      return this.client;
    }

    this.client = new ChromaClient(this._resolveClientOptions());
    return this.client;
  }

  async _getCollection(collectionName) {
    const client = await this._getClient();
    return client.getCollection({ name: collectionName });
  }

  async _embedQuery(text) {
    const embeddings = await this._getEmbeddings();
    return embeddings.embedQuery(String(text || '').slice(0, 4000));
  }

  _distanceToScore(distance) {
    if (typeof distance !== 'number' || Number.isNaN(distance)) {
      return 0;
    }

    return Number((1 - Math.min(Math.max(distance, 0), 1)).toFixed(4));
  }

  _parseQueryResult(result = {}, fallbackSource = '') {
    const documents = Array.isArray(result.documents) ? result.documents[0] || [] : [];
    const metadatas = Array.isArray(result.metadatas) ? result.metadatas[0] || [] : [];
    const distances = Array.isArray(result.distances) ? result.distances[0] || [] : [];
    const ids = Array.isArray(result.ids) ? result.ids[0] || [] : [];

    return documents
      .map((document, index) => {
        const metadata = metadatas[index] || {};
        const score = this._distanceToScore(distances[index]);
        return {
          id: String(ids[index] || metadata.productId || metadata.id || `${fallbackSource}_${index}`),
          title: metadata.title || metadata.productName || metadata.source || fallbackSource,
          source: metadata.source || fallbackSource,
          category: metadata.category || metadata.type || '',
          score,
          content: String(document || '').trim(),
          metadata
        };
      })
      .filter((item) => item.content);
  }

  _mapProductCandidate(product = {}, fallbackScore = 0, source = 'mongo') {
    if (!product) {
      return null;
    }

    const id = String(product.id || product._id || product.product || '').trim();
    const images = Array.isArray(product.images) ? product.images : [];
    const specifications = product.specifications && typeof product.specifications === 'object'
      ? Object.fromEntries(Object.entries(product.specifications).slice(0, 12))
      : {};

    return {
      id,
      name: product.name || 'Sản phẩm',
      brand: product.brand || '',
      category: product.category || '',
      price: Number(product.price ?? product.salePrice ?? 0) || 0,
      stock: Number(product.stock ?? 0) || 0,
      description: product.description || '',
      imageUrl: product.imageUrl || product.image || images[0] || null,
      score: Number(product.score ?? fallbackScore ?? 0) || 0,
      source,
      specifications
    };
  }

  async searchKnowledge(query, limit = 5) {
    try {
      const collection = await this._getCollection(this.knowledgeCollectionName);
      const queryEmbedding = await this._embedQuery(query);
      const result = await collection.query({
        queryEmbeddings: [queryEmbedding],
        nResults: Math.max(1, Math.min(Number(limit) || 5, 10)),
        include: ['documents', 'metadatas', 'distances', 'ids']
      });

      return this._parseQueryResult(result, 'techstore_knowledge');
    } catch (error) {
      console.warn('Chroma knowledge search failed:', error.message);
      return [];
    }
  }

  async searchProducts(query, limit = 5) {
    try {
      const collection = await this._getCollection(this.productCollectionName);
      const queryEmbedding = await this._embedQuery(query);
      const result = await collection.query({
        queryEmbeddings: [queryEmbedding],
        nResults: Math.max(1, Math.min(Number(limit) || 5, 10)),
        include: ['documents', 'metadatas', 'distances', 'ids']
      });

      const parsed = this._parseQueryResult(result, 'techstore_products');
      const productIds = parsed
        .map((item) => String(item.metadata?.productId || item.id || '').trim())
        .filter((value) => value && /^[a-f0-9]{24}$/i.test(value));

      if (productIds.length === 0) {
        return parsed.map((item) => this._mapProductCandidate({
          id: item.id,
          name: item.metadata?.productName || item.title,
          brand: item.metadata?.brand || '',
          category: item.metadata?.category || '',
          price: Number(item.metadata?.price || 0),
          stock: Number(item.metadata?.stock || 0),
          description: item.content,
          imageUrl: item.metadata?.imageUrl || null,
          score: item.score,
          specifications: item.metadata?.specifications || {}
        }, item.score, 'chroma'));
      }

      const products = await Product.find({ _id: { $in: productIds } })
        .select('name description brand category price salePrice image images stock specifications')
        .lean();

      const byId = new Map(products.map((product) => [String(product._id), product]));

      return parsed
        .map((item) => {
          const productId = String(item.metadata?.productId || item.id || '').trim();
          const found = byId.get(productId);
          if (found) {
            return this._mapProductCandidate({
              ...found,
              id: productId,
              score: item.score,
              imageUrl: item.metadata?.imageUrl || found.image || found.images?.[0] || null
            }, item.score, 'chroma');
          }

          return this._mapProductCandidate({
            id: productId,
            name: item.metadata?.productName || item.title,
            brand: item.metadata?.brand || '',
            category: item.metadata?.category || '',
            price: Number(item.metadata?.price || 0),
            stock: Number(item.metadata?.stock || 0),
            description: item.content,
            imageUrl: item.metadata?.imageUrl || null,
            score: item.score,
            specifications: item.metadata?.specifications || {}
          }, item.score, 'chroma');
        })
        .filter(Boolean);
    } catch (error) {
      console.warn('Chroma product search failed:', error.message);
      return [];
    }
  }
}

module.exports = new ChromaRetrievalService();