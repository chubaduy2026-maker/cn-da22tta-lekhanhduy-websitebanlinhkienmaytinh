/**
 * Knowledge Base Admin Routes
 * CRUD operations for the RAG knowledge base
 * 
 * @module routes/knowledge
 */

const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const KnowledgeDocument = require('../models/KnowledgeDocument');
const { DataIngestionService, VectorSearchService, EmbeddingService } = require('../services/ai/rag');

// ==================== PUBLIC ENDPOINTS ====================

/**
 * POST /api/knowledge/search
 * Semantic search against the knowledge base
 */
router.post('/search', async (req, res) => {
  try {
    const { query, category, limit = 5 } = req.body;
    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    const results = await VectorSearchService.hybridSearch(query, {
      limit: Math.min(limit, 20),
      category
    });

    res.json({
      success: true,
      query,
      results: results.map(r => ({
        text: r.text,
        source: r.source,
        category: r.category,
        score: (r.finalScore || r.similarity || 0).toFixed(4)
      })),
      count: results.length
    });
  } catch (error) {
    console.error('Knowledge search error:', error);
    res.status(500).json({ error: 'Search failed', message: error.message });
  }
});

// ==================== ADMIN ENDPOINTS ====================

/**
 * GET /api/knowledge/stats
 * Get knowledge base statistics
 */
router.get('/stats', auth.isAdmin, async (req, res) => {
  try {
    const stats = await VectorSearchService.getStats();
    res.json({ success: true, ...stats });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/knowledge/documents
 * List all knowledge documents (paginated)
 */
router.get('/documents', auth.isAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const category = req.query.category;

    const filter = {};
    if (category) filter.category = category;

    const [docs, total] = await Promise.all([
      KnowledgeDocument.find(filter)
        .select('text source category sourceType chunkIndex totalChunks metadata status createdAt')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      KnowledgeDocument.countDocuments(filter)
    ]);

    res.json({
      success: true,
      documents: docs,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/knowledge/ingest/text
 * Ingest text content into knowledge base
 */
router.post('/ingest/text', auth.isAdmin, async (req, res) => {
  try {
    const { text, source, category, tags } = req.body;
    if (!text || !source || !category) {
      return res.status(400).json({ error: 'text, source, and category are required' });
    }

    const result = await DataIngestionService.ingestText(text, {
      source,
      category,
      tags: tags || []
    });

    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/knowledge/ingest/markdown
 * Ingest markdown content into knowledge base
 */
router.post('/ingest/markdown', auth.isAdmin, async (req, res) => {
  try {
    const { markdown, source, category, tags } = req.body;
    if (!markdown || !source || !category) {
      return res.status(400).json({ error: 'markdown, source, and category are required' });
    }

    const result = await DataIngestionService.ingestMarkdown(markdown, {
      source,
      category,
      tags: tags || []
    });

    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/knowledge/ingest/url
 * Ingest a web page into knowledge base
 */
router.post('/ingest/url', auth.isAdmin, async (req, res) => {
  try {
    const { url, category, source } = req.body;
    if (!url || !category) {
      return res.status(400).json({ error: 'url and category are required' });
    }

    const result = await DataIngestionService.ingestWebPage(url, {
      category,
      source: source || url
    });

    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/knowledge/source/:source
 * Remove all documents from a specific source
 */
router.delete('/source/:source', auth.isAdmin, async (req, res) => {
  try {
    const source = decodeURIComponent(req.params.source);
    const result = await DataIngestionService.removeBySource(source);
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/knowledge/document/:id
 * Remove a single document by ID
 */
router.delete('/document/:id', auth.isAdmin, async (req, res) => {
  try {
    const doc = await KnowledgeDocument.findByIdAndDelete(req.params.id);
    if (!doc) {
      return res.status(404).json({ error: 'Document not found' });
    }
    res.json({ success: true, deleted: req.params.id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/knowledge/health
 * Check knowledge base health
 */
router.get('/health', async (req, res) => {
  try {
    const docCount = await KnowledgeDocument.countDocuments({ status: 'completed' });
    res.json({
      status: 'ok',
      embeddingServiceAvailable: EmbeddingService.isAvailable(),
      knowledgeDocuments: docCount,
      embeddingModel: EmbeddingService.modelName
    });
  } catch (error) {
    res.json({
      status: 'error',
      error: error.message
    });
  }
});

module.exports = router;
