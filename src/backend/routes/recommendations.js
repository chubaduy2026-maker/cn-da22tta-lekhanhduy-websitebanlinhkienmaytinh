const express = require('express');
const router = express.Router();
const { optionalAuth, auth } = require('../middleware/auth');
const { RecommendationService } = require('../services/ai');
const Product = require('../models/Product');
const Cart = require('../models/Cart');

// GET /api/recommendations/home - Gợi ý cho trang chủ
router.get('/home', optionalAuth, async (req, res) => {
  try {
    const userId = req.user?._id?.toString();
    const sessionId = req.headers['x-session-id'] || req.query.sessionId;
    const limit = parseInt(req.query.limit, 10) || 12;

    const recommendations = await RecommendationService.getSmartRecommendations(userId, sessionId, {
      limit
    });

    return res.json({
      success: true,
      count: recommendations.length,
      recommendations
    });
  } catch (error) {
    console.error('Home recommendation route error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/recommendations/product/:productId - Gợi ý trang chi tiết sản phẩm
router.get('/product/:productId', optionalAuth, async (req, res) => {
  try {
    const { productId } = req.params;
    const userId = req.user?._id?.toString();
    const sessionId = req.headers['x-session-id'] || req.query.sessionId;
    const limit = parseInt(req.query.limit, 10) || 8;

    // Load context product details to provide matching guidelines
    const product = await Product.findById(productId).lean();
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    const recommendations = await RecommendationService.getSmartRecommendations(userId, sessionId, {
      productId,
      category: product.category,
      brand: product.brand,
      price: product.price,
      specifications: product.specifications,
      limit
    });

    return res.json({
      success: true,
      count: recommendations.length,
      recommendations
    });
  } catch (error) {
    console.error('Product recommendation route error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/recommendations/cart - Gợi ý trang giỏ hàng
router.get('/cart', optionalAuth, async (req, res) => {
  try {
    const userId = req.user?._id?.toString();
    const sessionId = req.headers['x-session-id'] || req.query.sessionId;
    const limit = parseInt(req.query.limit, 10) || 6;

    // Fetch active cart items
    const cartQuery = userId ? { userId } : { sessionId };
    const cart = await Cart.findOne(cartQuery).populate('items.product').lean();
    
    let cartProductIds = [];
    let cartItems = [];
    if (cart && cart.items) {
      cartItems = cart.items;
      cartProductIds = cart.items.map(i => i.product?._id?.toString()).filter(Boolean);
    }

    const recommendations = await RecommendationService.getSmartRecommendations(userId, sessionId, {
      cartItems,
      cartProductIds,
      limit,
      isCartPage: true
    });

    // Remove products already in the cart from recommendations list
    const filteredRecs = recommendations.filter(p => !cartProductIds.includes(p._id?.toString()));

    return res.json({
      success: true,
      count: filteredRecs.length,
      recommendations: filteredRecs
    });
  } catch (error) {
    console.error('Cart recommendation route error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/recommendations/cart - Compatibility for legacy client POST requests
router.post('/cart', optionalAuth, async (req, res) => {
  try {
    const userId = req.user?._id?.toString();
    const sessionId = req.headers['x-session-id'] || req.body.sessionId;
    const { cartItems } = req.body;
    const limit = parseInt(req.query.limit, 10) || 5;

    let cartProductIds = [];
    if (Array.isArray(cartItems)) {
      cartProductIds = cartItems.map(i => (i.product?._id || i.product || i.productId)?.toString()).filter(Boolean);
    }

    const recommendations = await RecommendationService.getSmartRecommendations(userId, sessionId, {
      cartItems: Array.isArray(cartItems) ? cartItems.map(i => ({ product: i.product || i.productId || i })) : [],
      cartProductIds,
      limit,
      isCartPage: true
    });

    const filteredRecs = recommendations.filter(p => !cartProductIds.includes(p._id?.toString()));

    return res.json({
      success: true,
      count: filteredRecs.length,
      recommendations: filteredRecs
    });
  } catch (error) {
    console.error('Legacy Cart recommendation route error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/recommendations/search - Tìm kiếm cá nhân hóa
router.get('/search', optionalAuth, async (req, res) => {
  try {
    const userId = req.user?._id?.toString();
    const sessionId = req.headers['x-session-id'] || req.query.sessionId;
    const limit = parseInt(req.query.limit, 10) || 12;
    const query = req.query.q || '';

    const recommendations = await RecommendationService.getSmartRecommendations(userId, sessionId, {
      searchKeyword: query,
      limit
    });

    return res.json({
      success: true,
      count: recommendations.length,
      recommendations
    });
  } catch (error) {
    console.error('Search recommendation route error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/recommendations/chat - Gợi ý sản phẩm cho Chatbot
router.post('/chat', optionalAuth, async (req, res) => {
  try {
    const userId = req.user?._id?.toString();
    const { sessionId, chatbotIntent, query } = req.body;
    const limit = parseInt(req.body.limit, 10) || 5;

    const recommendations = await RecommendationService.getSmartRecommendations(userId, sessionId, {
      chatbotIntent,
      searchKeyword: query,
      limit
    });

    return res.json({
      success: true,
      count: recommendations.length,
      recommendations
    });
  } catch (error) {
    console.error('Chat chatbot recommendation route error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// ==================== LEGACY API COMPATIBILITY ENDPOINTS ====================

// GET /api/recommendations/user - Legacy personalized recs
router.get('/user', optionalAuth, async (req, res) => {
  try {
    const userId = req.user?._id?.toString();
    const sessionId = req.headers['x-session-id'] || req.query.sessionId;
    const limit = parseInt(req.query.limit, 10) || 10;

    const recommendations = await RecommendationService.getSmartRecommendations(userId, sessionId, { limit });

    return res.json({
      success: true,
      count: recommendations.length,
      recommendations
    });
  } catch (error) {
    console.error('Legacy user recommendations error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/recommendations/popular - Legacy popular recs
router.get('/popular', async (req, res) => {
  try {
    const { limit = 10, category = null } = req.query;
    const recommendations = await RecommendationService.getPopularRecommendations({
      limit: parseInt(limit, 10),
      category
    });

    return res.json({
      success: true,
      count: recommendations.length,
      recommendations
    });
  } catch (error) {
    console.error('Legacy popular error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
