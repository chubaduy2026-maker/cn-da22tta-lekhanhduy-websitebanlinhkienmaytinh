/**
 * Enhanced Recommendation Routes v2.0
 * NodeJS RecommendationService (Collaborative Filtering, Content-Based, Hybrid)
 * 
 * API Endpoints:
 *   GET  /api/ai/v2/recommend/user/:userId      - Gợi ý theo user
 *   GET  /api/ai/v2/recommend/product/:productId - Gợi ý theo sản phẩm
 *   POST /api/ai/v2/recommend/cart               - Gợi ý theo giỏ hàng
 *   GET  /api/ai/v2/recommend/trending           - Sản phẩm trending
 *   GET  /api/ai/v2/recommend/best-sellers       - Sản phẩm bán chạy
 *   GET  /api/ai/v2/recommend/fbt/:productId     - Frequently Bought Together
 *   GET  /api/ai/v2/status                       - Model status
 *   GET  /api/ai/v2/ab-test/results              - A/B test results
 *   POST /api/ai/v2/track                        - Track interaction
 *   POST /api/ai/v2/track-click                  - Track rec click
 *   GET  /api/ai/v2/stats                        - AI usage stats
 */

const express = require('express');
const router = express.Router();
const { auth, optionalAuth, isAdmin } = require('../../middleware/auth');
const RecommendationService = require('../../services/ai/RecommendationService');
const RecommendationLog = require('../../models/RecommendationLog');
const UserInteraction = require('../../models/UserInteraction');
const Order = require('../../models/Order');
const Product = require('../../models/Product');

// ==================== RECOMMENDATION ENDPOINTS ====================

/**
 * GET /api/ai/v2/recommend/user/:userId
 * Gợi ý sản phẩm cho user dựa trên hành vi
 */
router.get('/recommend/user/:userId', optionalAuth, async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { userId } = req.params;
    const { limit = 10, ab_variant = null } = req.query;
    const parsedLimit = Math.min(parseInt(limit) || 10, 50);

    const recommendations = await RecommendationService.getPersonalizedRecommendations(
      userId, { limit: parsedLimit }
    );
    const modelSources = ['nodejs_personalized'];

    const latencyMs = Date.now() - startTime;

    _logRecommendation({
      user: req.user?._id || userId,
      requestType: 'user',
      recommendations,
      modelSources,
      abVariant: ab_variant,
      latencyMs
    });

    res.json({
      success: true,
      count: recommendations.length,
      recommendations,
      meta: {
        modelSources,
        latencyMs,
        engine: 'nodejs',
        abVariant: ab_variant
      }
    });
  } catch (error) {
    console.error('V2 User recommendation error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/ai/v2/recommend/product/:productId
 * Gợi ý sản phẩm tương tự (Content-Based + Item CF)
 */
router.get('/recommend/product/:productId', optionalAuth, async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { productId } = req.params;
    const { limit = 10, type = 'hybrid' } = req.query;
    const parsedLimit = Math.min(parseInt(limit) || 10, 50);
    const userId = req.user?._id?.toString();

    let recommendations = [];
    let modelSources = [];

    switch (type) {
      case 'rule-based':
        recommendations = await RecommendationService.getRuleBasedRecommendations(
          productId, { limit: parsedLimit }
        );
        modelSources = ['nodejs_rule_based'];
        break;
      case 'item-based':
        recommendations = await RecommendationService.getItemBasedCF(
          productId, { limit: parsedLimit }
        );
        modelSources = ['nodejs_item_cf'];
        break;
      case 'content-based':
        recommendations = await RecommendationService.getContentBasedRecommendations(
          productId, { limit: parsedLimit }
        );
        modelSources = ['nodejs_content_based'];
        break;
      case 'cross-sell':
        recommendations = await RecommendationService.getCrossSellRecommendations(
          productId, { limit: parsedLimit }
        );
        modelSources = ['nodejs_cross_sell'];
        break;
      case 'hybrid':
      default:
        recommendations = await RecommendationService.getHybridRecommendations(
          userId, productId, { limit: parsedLimit }
        );
        modelSources = ['nodejs_hybrid'];
    }

    const latencyMs = Date.now() - startTime;

    _logRecommendation({
      user: req.user?._id,
      requestType: 'product',
      inputProductId: productId,
      recommendations,
      modelSources,
      latencyMs
    });

    res.json({
      success: true,
      count: recommendations.length,
      recommendations,
      meta: {
        modelSources,
        latencyMs,
        engine: 'nodejs'
      }
    });
  } catch (error) {
    console.error('V2 Product recommendation error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/ai/v2/recommend/cart
 * Gợi ý sản phẩm mua kèm
 */
router.post('/recommend/cart', optionalAuth, async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { cartItems, productIds } = req.body;
    const { limit = 5 } = req.query;
    const parsedLimit = Math.min(parseInt(limit) || 5, 20);

    // Extract product IDs from cart items
    let cartProductIds = productIds || [];
    if (cartItems && cartItems.length > 0) {
      cartProductIds = cartItems.map(item => 
        (item.product?._id || item.product || item.productId)?.toString()
      ).filter(Boolean);
    }

    if (cartProductIds.length === 0) {
      return res.json({ success: true, count: 0, recommendations: [] });
    }

    const recommendations = await RecommendationService.getCartRecommendations(
      cartItems || cartProductIds.map(id => ({ product: id })),
      { limit: parsedLimit }
    );
    const modelSources = ['nodejs_cart'];

    const latencyMs = Date.now() - startTime;

    _logRecommendation({
      user: req.user?._id,
      requestType: 'cart',
      inputCartProductIds: cartProductIds,
      recommendations,
      modelSources,
      latencyMs
    });

    res.json({
      success: true,
      count: recommendations.length,
      recommendations,
      meta: {
        modelSources,
        latencyMs,
        engine: 'nodejs'
      }
    });
  } catch (error) {
    console.error('V2 Cart recommendation error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/ai/v2/recommend/trending
 * Sản phẩm trending (popular + recent interactions)
 */
router.get('/recommend/trending', async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { limit = 10, category = null } = req.query;
    const parsedLimit = Math.min(parseInt(limit) || 10, 50);

    const recommendations = await RecommendationService.getPopularRecommendations({
      limit: parsedLimit,
      category
    });
    const modelSources = ['nodejs_popular'];

    const latencyMs = Date.now() - startTime;

    res.json({
      success: true,
      count: recommendations.length,
      recommendations,
      meta: {
        modelSources,
        latencyMs,
        engine: 'nodejs'
      }
    });
  } catch (error) {
    console.error('V2 Trending error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/ai/v2/recommend/best-sellers
 * Sản phẩm bán chạy dựa trên lượt mua thực tế từ đơn hàng
 */
router.get('/recommend/best-sellers', async (req, res) => {
  const startTime = Date.now();

  try {
    const { limit = 12, days = 30, category = null } = req.query;
    const parsedLimit = Math.min(parseInt(limit) || 12, 50);
    const parsedDays = Math.min(parseInt(days) || 30, 365);

    const dateThreshold = new Date();
    dateThreshold.setDate(dateThreshold.getDate() - parsedDays);

    // Aggregate từ Order: đếm số lượng bán theo product
    const matchStage = {
      createdAt: { $gte: dateThreshold },
      status: { $nin: ['cancelled'] }
    };

    const pipeline = [
      { $match: matchStage },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.product',
          totalSold: { $sum: '$items.quantity' },
          totalRevenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
          orderCount: { $sum: 1 },
          uniqueBuyers: { $addToSet: '$user' }
        }
      },
      {
        $addFields: {
          uniqueBuyerCount: { $size: { $ifNull: ['$uniqueBuyers', []] } }
        }
      },
      { $sort: { totalSold: -1 } },
      { $limit: parsedLimit * 2 } // Lấy dư để lọc
    ];

    const bestSellers = await Order.aggregate(pipeline);

    if (bestSellers.length === 0) {
      return res.json({
        success: true,
        count: 0,
        recommendations: [],
        meta: { engine: 'order-aggregation', latencyMs: Date.now() - startTime }
      });
    }

    // Fetch product details
    const productIds = bestSellers.map(b => b._id).filter(Boolean);
    const productQuery = {
      _id: { $in: productIds },
      stock: { $gt: 0 }
    };
    if (category) productQuery.category = category;

    const products = await Product.find(productQuery)
      .select('name price originalPrice image images category brand rating reviewCount stock');

    const productMap = new Map(products.map(p => [p._id.toString(), p]));

    const recommendations = bestSellers
      .filter(b => b._id && productMap.has(b._id.toString()))
      .slice(0, parsedLimit)
      .map(b => {
        const product = productMap.get(b._id.toString());
        return {
          ...product.toObject(),
          totalSold: b.totalSold,
          orderCount: b.orderCount,
          uniqueBuyerCount: b.uniqueBuyerCount,
          totalRevenue: b.totalRevenue,
          recommendationType: 'best-seller'
        };
      });

    const latencyMs = Date.now() - startTime;

    res.json({
      success: true,
      count: recommendations.length,
      recommendations,
      meta: {
        engine: 'order-aggregation',
        period: `${parsedDays} ngày`,
        latencyMs
      }
    });
  } catch (error) {
    console.error('V2 Best-sellers error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==================== TRACKING ====================

/**
 * POST /api/ai/v2/track
 * Track user interaction (real-time event)
 * Saves to MongoDB AND forwards to Python AI service for online learning
 */
router.post('/track', optionalAuth, async (req, res) => {
  try {
    const { productId, interactionType, sessionId, metadata = {} } = req.body;

    if (!productId || !interactionType) {
      return res.status(400).json({
        success: false,
        message: 'productId and interactionType are required'
      });
    }

    const userId = req.user?._id;

    // Save to MongoDB
    if (userId) {
      const interaction = new UserInteraction({
        user: userId,
        product: productId,
        interactionType,
        sessionId,
        source: metadata.source || 'direct',
        metadata,
        deviceType: metadata.deviceType || 'desktop',
        viewDuration: metadata.viewDuration || 0
      });
      await interaction.save();
    }

    // Forward tracking complete
    res.json({ success: true, message: 'Interaction tracked' });
  } catch (error) {
    console.error('V2 Track error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==================== ADMIN ENDPOINTS ====================

/**
 * GET /api/ai/v2/status
 * Get AI model status
 */
router.get('/status', async (req, res) => {
  try {
    res.json({
      success: true,
      nodejsService: {
        available: true,
        models: ['rule-based', 'user-cf', 'item-cf', 'content-based', 'hybrid']
      }
    });
  } catch (error) {
    console.error('V2 Status error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/ai/v2/ab-test/results
 * Get A/B test results
 */
router.get('/ab-test/results', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }

    const { days = 30 } = req.query;
    
    const [abResults, modelPerf] = await Promise.all([
      RecommendationLog.getABTestResults(parseInt(days)),
      RecommendationLog.getModelPerformance(parseInt(days))
    ]);

    res.json({
      success: true,
      abTestResults: abResults,
      modelPerformance: modelPerf
    });
  } catch (error) {
    console.error('V2 A/B test error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/ai/v2/track-click
 * Track recommendation click (for CTR calculation)
 */
router.post('/track-click', optionalAuth, async (req, res) => {
  try {
    const { logId, productId, position } = req.body;
    
    if (logId) {
      await RecommendationLog.findByIdAndUpdate(logId, {
        $push: {
          clickedProducts: {
            product: productId,
            position,
            clickedAt: new Date()
          }
        }
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Track click error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==================== NEW v2.0 ENDPOINTS ====================

/**
 * GET /api/ai/v2/recommend/fbt/:productId
 * Frequently Bought Together
 */
router.get('/recommend/fbt/:productId', async (req, res) => {
  const startTime = Date.now();
  try {
    const { productId } = req.params;
    const { limit = 5 } = req.query;
    const parsedLimit = Math.min(parseInt(limit) || 5, 20);

    const recommendations = await RecommendationService.getCrossSellRecommendations(
      productId, { limit: parsedLimit }
    ) || [];

    const latencyMs = Date.now() - startTime;
    res.json({
      success: true,
      count: recommendations.length,
      recommendations,
      meta: {
        modelSources: ['nodejs_cross_sell'],
        latencyMs,
        engine: 'nodejs'
      }
    });
  } catch (error) {
    console.error('V2 FBT error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==================== AI USAGE STATS ====================

/**
 * GET /api/ai/v2/stats
 * Get comprehensive AI feature usage statistics
 * Returns counts for: user recs, product recs, cart recs, trending, FBT, semantic search, A/B testing
 */
router.get('/stats', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }

    const { days = 30 } = req.query;
    const dateThreshold = new Date();
    dateThreshold.setDate(dateThreshold.getDate() - parseInt(days));

    // Aggregate RecommendationLog by requestType
    const [recLogStats, interactionStats, abTestStats, recLogTotal, interactionTotal, searchCount, recentActivity] = await Promise.all([
      // 1. Recommendation log counts by type
      RecommendationLog.aggregate([
        { $match: { createdAt: { $gte: dateThreshold } } },
        {
          $group: {
            _id: '$requestType',
            count: { $sum: 1 },
            totalClicks: { $sum: { $size: { $ifNull: ['$clickedProducts', []] } } },
            totalConversions: { $sum: { $cond: ['$converted', 1, 0] } },
            avgLatency: { $avg: '$latencyMs' }
          }
        }
      ]),
      // 2. UserInteraction counts by type
      UserInteraction.aggregate([
        { $match: { createdAt: { $gte: dateThreshold } } },
        {
          $group: {
            _id: '$interactionType',
            count: { $sum: 1 },
            uniqueUsers: { $addToSet: '$user' },
            uniqueProducts: { $addToSet: '$product' }
          }
        },
        {
          $addFields: {
            uniqueUserCount: { $size: '$uniqueUsers' },
            uniqueProductCount: { $size: '$uniqueProducts' }
          }
        },
        { $project: { uniqueUsers: 0, uniqueProducts: 0 } }
      ]),
      // 3. A/B test variant counts
      RecommendationLog.aggregate([
        { $match: { createdAt: { $gte: dateThreshold }, abVariant: { $ne: null } } },
        {
          $group: {
            _id: '$abVariant',
            count: { $sum: 1 },
            clicks: { $sum: { $size: { $ifNull: ['$clickedProducts', []] } } },
            conversions: { $sum: { $cond: ['$converted', 1, 0] } }
          }
        },
        { $sort: { _id: 1 } }
      ]),
      // 4. Total recommendation logs
      RecommendationLog.countDocuments({ createdAt: { $gte: dateThreshold } }),
      // 5. Total interactions
      UserInteraction.countDocuments({ createdAt: { $gte: dateThreshold } }),
      // 6. Search count (search_click interactions as proxy)
      UserInteraction.countDocuments({
        createdAt: { $gte: dateThreshold },
        interactionType: 'search_click'
      }),
      // 7. Daily activity for chart (last 7 days)
      RecommendationLog.aggregate([
        { $match: { createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ])
    ]);

    // Build feature stats map
    const recMap = {};
    recLogStats.forEach(r => { recMap[r._id] = r; });

    const interactionMap = {};
    interactionStats.forEach(i => { interactionMap[i._id] = i; });

    const features = {
      personalizedRecommendations: {
        label: 'Gợi ý cá nhân hóa',
        description: 'Gợi ý sản phẩm cho từng user dựa trên lịch sử tương tác',
        count: recMap['user']?.count || 0,
        clicks: recMap['user']?.totalClicks || 0,
        conversions: recMap['user']?.totalConversions || 0,
        avgLatency: Math.round(recMap['user']?.avgLatency || 0),
        ctr: recMap['user']?.count > 0
          ? ((recMap['user']?.totalClicks || 0) / recMap['user'].count * 100).toFixed(1)
          : '0.0'
      },
      similarProducts: {
        label: 'Sản phẩm tương tự',
        description: 'Tìm sản phẩm giống với sản phẩm đang xem',
        count: recMap['product']?.count || 0,
        clicks: recMap['product']?.totalClicks || 0,
        conversions: recMap['product']?.totalConversions || 0,
        avgLatency: Math.round(recMap['product']?.avgLatency || 0),
        ctr: recMap['product']?.count > 0
          ? ((recMap['product']?.totalClicks || 0) / recMap['product'].count * 100).toFixed(1)
          : '0.0'
      },
      cartCrossSell: {
        label: 'Cross-sell giỏ hàng',
        description: 'Gợi ý thêm sản phẩm khi user có items trong cart',
        count: recMap['cart']?.count || 0,
        clicks: recMap['cart']?.totalClicks || 0,
        conversions: recMap['cart']?.totalConversions || 0,
        avgLatency: Math.round(recMap['cart']?.avgLatency || 0),
        ctr: recMap['cart']?.count > 0
          ? ((recMap['cart']?.totalClicks || 0) / recMap['cart'].count * 100).toFixed(1)
          : '0.0'
      },
      frequentlyBoughtTogether: {
        label: 'Frequently Bought Together',
        description: 'Sản phẩm thường mua cùng nhau (Association Rules)',
        count: recMap['trending']?.count || 0, // FBT uses trending type or check separately
        clicks: recMap['trending']?.totalClicks || 0,
        conversions: recMap['trending']?.totalConversions || 0,
        avgLatency: Math.round(recMap['trending']?.avgLatency || 0),
        ctr: '0.0'
      },
      trending: {
        label: 'Trending / Popular',
        description: 'Sản phẩm đang hot dựa trên tương tác gần đây',
        count: recMap['trending']?.count || 0,
        clicks: recMap['trending']?.totalClicks || 0,
        conversions: recMap['trending']?.totalConversions || 0,
        avgLatency: Math.round(recMap['trending']?.avgLatency || 0),
        ctr: recMap['trending']?.count > 0
          ? ((recMap['trending']?.totalClicks || 0) / recMap['trending'].count * 100).toFixed(1)
          : '0.0'
      },
      semanticSearch: {
        label: 'Tìm kiếm ngữ nghĩa',
        description: 'Tìm sản phẩm bằng câu truy vấn tự nhiên (FAISS + TF-IDF)',
        count: (recMap['search']?.count || 0) + searchCount,
        clicks: interactionMap['search_click']?.count || 0,
        uniqueUsers: interactionMap['search_click']?.uniqueUserCount || 0,
        uniqueProducts: interactionMap['search_click']?.uniqueProductCount || 0,
        avgLatency: Math.round(recMap['search']?.avgLatency || 0),
        ctr: '—'
      },
      abTesting: {
        label: 'A/B Testing',
        description: 'So sánh hiệu quả các biến thể trọng số model',
        totalTests: abTestStats.reduce((sum, v) => sum + v.count, 0),
        variants: abTestStats.map(v => ({
          variant: v._id,
          count: v.count,
          clicks: v.clicks,
          conversions: v.conversions,
          ctr: v.count > 0 ? ((v.clicks / v.count) * 100).toFixed(1) : '0.0'
        }))
      }
    };

    // Interaction summary
    const interactions = {
      view: interactionMap['view']?.count || 0,
      search_click: interactionMap['search_click']?.count || 0,
      cart_add: interactionMap['cart_add']?.count || 0,
      wishlist: interactionMap['wishlist']?.count || 0,
      review: interactionMap['review']?.count || 0,
      purchase: interactionMap['purchase']?.count || 0
    };

    res.json({
      success: true,
      period: `${days} ngày gần đây`,
      totalRecommendationRequests: recLogTotal,
      totalUserInteractions: interactionTotal,
      features,
      interactions,
      recentActivity,
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('V2 Stats error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==================== HELPER ====================

async function _logRecommendation(data) {
  try {
    const log = new RecommendationLog({
      user: data.user,
      requestType: data.requestType,
      inputProductId: data.inputProductId,
      inputCartProductIds: data.inputCartProductIds,
      recommendations: (data.recommendations || []).slice(0, 20).map((rec, idx) => ({
        product: rec._id || rec.productId,
        score: rec.score,
        position: idx + 1,
        sources: rec.sources || [rec.recommendationType]
      })),
      modelSources: data.modelSources,
      abVariant: data.abVariant,
      latencyMs: data.latencyMs
    });
    await log.save();
  } catch (error) {
    console.error('Failed to log recommendation:', error.message);
  }
}

module.exports = router;
