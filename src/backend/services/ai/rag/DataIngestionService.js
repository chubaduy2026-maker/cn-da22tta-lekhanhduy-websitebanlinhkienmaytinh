/**
 * Data Ingestion Service
 * Imports documents from multiple sources, chunks, embeds, and stores in MongoDB
 * 
 * Supports: PDF, Markdown, Text, JSON, Web pages
 * 
 * @module services/ai/rag/DataIngestionService
 */
const fs = require('fs');
const path = require('path');
const KnowledgeDocument = require('../../../models/KnowledgeDocument');
const EmbeddingService = require('./EmbeddingService');
const TextChunker = require('./TextChunker');

class DataIngestionService {
  constructor() {
    this.stats = { processed: 0, chunks: 0, errors: 0 };
  }

  /**
   * Ingest a single file (auto-detect type by extension)
   * @param {string} filePath - Path to the file
   * @param {Object} options
   * @returns {Promise<Object>} Ingestion result
   */
  async ingestFile(filePath, options = {}) {
    const ext = path.extname(filePath).toLowerCase();
    const raw = fs.readFileSync(filePath, 'utf-8');
    const source = options.source || path.basename(filePath);
    const category = options.category || 'general';

    let text;
    switch (ext) {
      case '.md':
        text = TextChunker.stripMarkdown(raw);
        return this._processText(text, { ...options, source, category, sourceType: 'markdown' });
      case '.txt':
        text = TextChunker.cleanText(raw);
        return this._processText(text, { ...options, source, category, sourceType: 'text' });
      case '.json':
        return this._ingestJSON(raw, { ...options, source, category });
      default:
        // Try as plain text
        text = TextChunker.cleanText(raw);
        return this._processText(text, { ...options, source, category, sourceType: 'text' });
    }
  }

  /**
   * Ingest plain text content directly
   * @param {string} text - Raw text content
   * @param {Object} options
   * @returns {Promise<Object>}
   */
  async ingestText(text, options = {}) {
    const source = options.source || 'direct_input';
    const category = options.category || 'general';
    const cleaned = TextChunker.cleanText(text);
    return this._processText(cleaned, { ...options, source, category, sourceType: 'text' });
  }

  /**
   * Ingest a markdown string
   * @param {string} markdown
   * @param {Object} options
   * @returns {Promise<Object>}
   */
  async ingestMarkdown(markdown, options = {}) {
    const source = options.source || 'markdown_input';
    const category = options.category || 'general';
    const text = TextChunker.stripMarkdown(markdown);
    return this._processText(text, { ...options, source, category, sourceType: 'markdown' });
  }

  /**
   * Ingest a web page by URL (requires fetching)
   * @param {string} url - Web page URL
   * @param {Object} options
   * @returns {Promise<Object>}
   */
  async ingestWebPage(url, options = {}) {
    try {
      const axios = require('axios');
      const response = await axios.get(url, {
        timeout: 15000,
        headers: { 'User-Agent': 'TechStore-AI-Bot/1.0' },
        maxContentLength: 5 * 1024 * 1024 // 5MB limit
      });

      // Basic HTML to text extraction
      let text = response.data;
      // Remove script and style tags
      text = text.replace(/<script[\s\S]*?<\/script>/gi, '');
      text = text.replace(/<style[\s\S]*?<\/style>/gi, '');
      // Remove HTML tags
      text = text.replace(/<[^>]+>/g, ' ');
      // Decode HTML entities
      text = text.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
      text = TextChunker.cleanText(text);

      const source = options.source || url;
      const category = options.category || 'general';
      return this._processText(text, { ...options, source, category, sourceType: 'webpage' });
    } catch (error) {
      console.error(`Failed to fetch ${url}:`, error.message);
      return { success: false, error: error.message, source: url };
    }
  }

  /**
   * Ingest JSON document (expects {text, category?, title?, tags?} or array)
   * @param {string} jsonString
   * @param {Object} options
   * @returns {Promise<Object>}
   */
  async _ingestJSON(jsonString, options = {}) {
    const data = JSON.parse(jsonString);
    const items = Array.isArray(data) ? data : [data];
    const results = [];

    for (const item of items) {
      const text = item.text || item.content || item.body || JSON.stringify(item);
      const category = item.category || options.category || 'general';
      const source = item.source || options.source || 'json_import';
      const result = await this._processText(TextChunker.cleanText(text), {
        ...options,
        source,
        category,
        sourceType: 'json',
        title: item.title,
        tags: item.tags
      });
      results.push(result);
    }

    return {
      success: true,
      totalItems: items.length,
      results
    };
  }

  /**
   * Ingest all files from a directory
   * @param {string} dirPath - Directory path
   * @param {Object} options
   * @returns {Promise<Object>}
   */
  async ingestDirectory(dirPath, options = {}) {
    const supportedExts = ['.md', '.txt', '.json'];
    const files = fs.readdirSync(dirPath)
      .filter(f => supportedExts.includes(path.extname(f).toLowerCase()));

    console.log(`📁 Found ${files.length} files in ${dirPath}`);

    const results = [];
    for (const file of files) {
      const filePath = path.join(dirPath, file);
      console.log(`  📄 Processing: ${file}`);
      try {
        const result = await this.ingestFile(filePath, options);
        results.push({ file, ...result });
      } catch (error) {
        console.error(`  ❌ Error processing ${file}:`, error.message);
        results.push({ file, success: false, error: error.message });
        this.stats.errors++;
      }
    }

    return {
      success: true,
      directory: dirPath,
      filesProcessed: files.length,
      results,
      stats: this.stats
    };
  }

  /**
   * Remove all documents from a specific source
   * @param {string} source
   * @returns {Promise<Object>}
   */
  async removeBySource(source) {
    const result = await KnowledgeDocument.deleteMany({ source });
    return { deleted: result.deletedCount, source };
  }

  /**
   * Get ingestion statistics
   * @returns {Promise<Object>}
   */
  async getStats() {
    const total = await KnowledgeDocument.countDocuments();
    const byCategory = await KnowledgeDocument.aggregate([
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    const bySource = await KnowledgeDocument.aggregate([
      { $group: { _id: '$source', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    return { total, byCategory, bySource, processingStats: this.stats };
  }

  // --- Private Methods ---

  /**
   * Process text: chunk → embed → store
   */
  async _processText(text, options = {}) {
    const {
      source, category, sourceType = 'text',
      chunkSize = 1000, overlap = 150,
      title = null, tags = []
    } = options;

    if (!text || text.trim().length < 20) {
      return { success: false, error: 'Text too short to process', source };
    }

    // 1. Chunk the text
    const chunks = TextChunker.chunk(text, { chunkSize, overlap });
    console.log(`  ✂️ Split into ${chunks.length} chunks`);

    // 2. Embed all chunks
    let embeddings;
    try {
      embeddings = await EmbeddingService.embedBatch(chunks);
    } catch (error) {
      console.error(`  ❌ Embedding failed for ${source}:`, error.message);
      return { success: false, error: `Embedding failed: ${error.message}`, source };
    }

    // 3. Store in MongoDB
    const docs = chunks.map((chunk, i) => ({
      text: chunk,
      embedding: embeddings[i],
      source,
      category,
      sourceType,
      chunkIndex: i,
      totalChunks: chunks.length,
      embeddingModel: EmbeddingService.modelName,
      dimension: embeddings[i].length,
      metadata: {
        title: title || source,
        language: 'vi',
        wordCount: chunk.split(/\s+/).length,
        tags: tags || []
      },
      status: 'completed'
    }));

    // Remove old documents from same source before re-ingesting
    await KnowledgeDocument.deleteMany({ source });
    await KnowledgeDocument.insertMany(docs);

    this.stats.processed++;
    this.stats.chunks += chunks.length;

    console.log(`  ✅ Stored ${chunks.length} chunks for "${source}"`);

    return {
      success: true,
      source,
      category,
      chunksCreated: chunks.length,
      embeddingDimension: embeddings[0]?.length || 0
    };
  }
}

module.exports = new DataIngestionService();
