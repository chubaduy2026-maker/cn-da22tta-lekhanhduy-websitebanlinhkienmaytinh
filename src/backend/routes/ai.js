const express = require('express');

const router = express.Router();

const { SemanticSearchService } = require('../services/ai');

router.get('/search', async (req, res) => {
  try {
    const {
      q,
      limit = 20,
      type = 'hybrid',
      category = null,
      brand = null,
      minPrice = null,
      maxPrice = null
    } = req.query;

    if (!q) {
      return res.status(400).json({ success: false, message: 'Query parameter "q" is required' });
    }

    let results;
    const options = {
      limit: parseInt(limit, 10),
      category,
      brand,
      priceRange: (minPrice || maxPrice)
        ? {
            min: minPrice ? parseFloat(minPrice) : 0,
            max: maxPrice ? parseFloat(maxPrice) : Number.MAX_VALUE
          }
        : null
    };

    switch (type) {
      case 'keyword':
        results = await SemanticSearchService.keywordSearch(q, options);
        break;
      case 'tfidf':
        results = await SemanticSearchService.searchTFIDF(q, options);
        break;
      case 'embedding':
        results = await SemanticSearchService.searchWithEmbeddings(q, options);
        break;
      case 'hybrid':
      default:
        results = await SemanticSearchService.hybridSearch(q, options);
        break;
    }

    return res.json({
      success: true,
      query: q,
      type,
      count: results.length,
      results
    });
  } catch (error) {
    console.error('Search error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/search/autocomplete', async (req, res) => {
  try {
    const { q, limit = 10 } = req.query;

    if (!q || q.length < 2) {
      return res.json({ success: true, suggestions: { products: [], categories: [], brands: [] } });
    }

    const suggestions = await SemanticSearchService.getAutocompleteSuggestions(q, {
      limit: parseInt(limit, 10)
    });

    return res.json({
      success: true,
      suggestions
    });
  } catch (error) {
    console.error('Autocomplete error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/search/related', async (req, res) => {
  try {
    const { q, limit = 5 } = req.query;

    if (!q) {
      return res.json({ success: true, relatedSearches: [] });
    }

    const relatedSearches = await SemanticSearchService.getRelatedSearches(q, {
      limit: parseInt(limit, 10)
    });

    return res.json({
      success: true,
      relatedSearches
    });
  } catch (error) {
    console.error('Related search error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// ==================== GEMINI AI ADMIN INTERFACE ====================
const { auth } = require('../middleware/auth');
const GeminiChatService = require('../services/GeminiChatService');
const { callGemini } = require('../src/utils/geminiClient');

/**
 * GET /api/ai/gemini/status
 * Lấy trạng thái hoạt động của Gemini AI
 */
router.get('/gemini/status', auth, async (req, res) => {
  try {
    const hasApiKey = !!process.env.GEMINI_API_KEY;
    const initialized = GeminiChatService.isInitialized && hasApiKey;
    return res.json({
      success: true,
      gemini: {
        initialized,
        model: GeminiChatService.modelName || process.env.GEMINI_MODEL || 'gemini-1.5-flash',
        hasApiKey
      }
    });
  } catch (error) {
    console.error('Gemini status check error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/ai/gemini/chat
 * Gửi tin nhắn kiểm thử trực tiếp tới Gemini AI
 */
router.post('/gemini/chat', auth, async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) {
      return res.status(400).json({ success: false, message: 'Message is required' });
    }

    const responseText = await callGemini(message);
    return res.json({
      success: true,
      response: {
        text: responseText,
        model: GeminiChatService.modelName || process.env.GEMINI_MODEL || 'gemini-1.5-flash'
      }
    });
  } catch (error) {
    console.error('Gemini test chat error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
