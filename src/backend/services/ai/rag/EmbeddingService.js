/**
 * Embedding Service (local/self-hosted)
 * Uses @xenova/transformers on CPU with persistent model cache.
 *
 * Model: Xenova/all-MiniLM-L6-v2 (384 dimensions)
 *
 * @module services/ai/rag/EmbeddingService
 */

const path = require('path');

class EmbeddingService {
  constructor() {
    this.modelName = 'Xenova/all-MiniLM-L6-v2';
    this.dimension = 384;
    this.extractor = null;
    this.readyPromise = null;
    this.cacheDir = process.env.TRANSFORMERS_CACHE || path.join(process.cwd(), '.cache', 'transformers');

    // Warm up model in background. Calls are still safe without awaiting this constructor.
    this._initialize();
  }

  async _initialize() {
    if (this.readyPromise) {
      return this.readyPromise;
    }

    this.readyPromise = (async () => {
      try {
        const transformers = await import('@xenova/transformers');
        const { pipeline, env } = transformers;

        env.allowRemoteModels = true;
        env.cacheDir = this.cacheDir;

        this.extractor = await pipeline('feature-extraction', this.modelName);
        console.log(`EmbeddingService ready: ${this.modelName} (cache: ${this.cacheDir})`);
      } catch (error) {
        this.extractor = null;
        console.error('EmbeddingService initialization failed:', error.message);
        throw error;
      }
    })();

    return this.readyPromise;
  }

  async _ensureReady() {
    if (!this.extractor) {
      await this._initialize();
    }

    if (!this.extractor) {
      throw new Error('Embedding model is not available');
    }
  }

  /**
   * Generate embedding vector for text.
   * Mean pooling + normalization for stable cosine comparison.
   */
  async embedText(text) {
    try {
      if (!text || !text.trim()) {
        throw new Error('Text cannot be empty');
      }

      await this._ensureReady();

      const output = await this.extractor(text.slice(0, 4000), {
        pooling: 'mean',
        normalize: true
      });

      const vector = Array.from(output.data || []);
      if (vector.length === 0) {
        throw new Error('Embedding output is empty');
      }

      this.dimension = vector.length;
      return vector;
    } catch (error) {
      throw new Error(`embedText failed: ${error.message}`);
    }
  }

  async embedBatch(texts) {
    if (!Array.isArray(texts) || texts.length === 0) {
      return [];
    }

    const vectors = [];
    for (const text of texts) {
      try {
        vectors.push(await this.embedText(text));
      } catch (error) {
        console.error('embedBatch item failed:', error.message);
        vectors.push([]);
      }
    }
    return vectors;
  }

  isAvailable() {
    return this.extractor !== null;
  }

  getInfo() {
    return {
      modelName: this.modelName,
      dimension: this.dimension,
      cacheDir: this.cacheDir,
      ready: this.isAvailable()
    };
  }
}

module.exports = new EmbeddingService();
