const UserBehavior = require('../../models/UserBehavior');
const UserInteraction = require('../../models/UserInteraction');

class BehaviorTrackerService {
  constructor() {
    this.behaviorTypes = {
      // New standardized behavior types
      VIEWED_PRODUCT: 'view_product',
      SEARCHED_QUERY: 'search_keyword',
      CLICKED_PRODUCT: 'click_product',
      ADDED_TO_CART: 'add_to_cart',
      PURCHASED: 'purchase_product',
      CHATBOT_MESSAGE: 'chatbot_message',
      RECOMMENDATION_CLICK: 'recommendation_click',
      RECOMMENDATION_IMPRESSION: 'recommendation_impression'
    };
  }

  /**
   * Track user behavior
   * @param {Object} eventData - The behavior event fields
   * @returns {Object} Result of the operation
   */
  async trackBehavior(eventData) {
    try {
      let {
        userId,
        sessionId,
        eventType,
        productId,
        keyword = '',
        category = '',
        brand = '',
        price = 0,
        metadata = {}
      } = eventData;

      if (!sessionId) {
        throw new Error('sessionId is required for tracking behavior');
      }
      if (!eventType) {
        throw new Error('eventType is required for tracking behavior');
      }

      // Automatically resolve details (category, brand, price) from Product model if missing
      if (productId && (!category || !brand || !price)) {
        const Product = require('../../models/Product');
        const product = await Product.findById(productId).lean();
        if (product) {
          category = category || product.category;
          brand = brand || product.brand;
          price = price || product.price;
        }
      }

      const behavior = new UserBehavior({
        userId: userId || null,
        sessionId,
        eventType,
        productId: productId || null,
        keyword: keyword || '',
        category: category || '',
        brand: brand || '',
        price: price || 0,
        metadata,
        createdAt: new Date()
      });

      await behavior.save();

      // Legacy fallback: Save to UserInteraction model if it is a legacy event type we want to support in CF
      if (userId && ['view_product', 'click_product', 'add_to_cart', 'purchase_product'].includes(eventType)) {
        const typeMapping = {
          'view_product': 'view',
          'click_product': 'search_click',
          'add_to_cart': 'cart_add',
          'purchase_product': 'purchase'
        };

        const legacyInteraction = new UserInteraction({
          user: userId,
          product: productId,
          interactionType: typeMapping[eventType],
          sessionId,
          source: metadata.source || 'direct',
          metadata
        });
        await legacyInteraction.save().catch(e => console.log('Legacy log error (ignored):', e.message));
      }

      console.log(`📊 [BehaviorTracker] Tracked event ${eventType} for session ${sessionId}`);
      return { success: true, behavior };
    } catch (error) {
      console.error('❌ [BehaviorTracker] Error tracking behavior:', error);
      return { success: false, error: error.message };
    }
  }

  // ==================== LEGACY COMPATIBILITY METHODS ====================

  async trackProductView(userId, sessionId, productId, source = {}) {
    return this.trackBehavior({
      userId,
      sessionId,
      eventType: this.behaviorTypes.VIEWED_PRODUCT,
      productId,
      metadata: { source }
    });
  }

  async trackSearch(userId, sessionId, query, results = {}) {
    return this.trackBehavior({
      userId,
      sessionId,
      eventType: this.behaviorTypes.SEARCHED_QUERY,
      keyword: query,
      metadata: { results }
    });
  }

  async trackRecommendation(userId, sessionId, productIds, strategy) {
    // Log multiple product impressions
    if (Array.isArray(productIds)) {
      for (const pId of productIds) {
        await this.trackBehavior({
          userId,
          sessionId,
          eventType: this.behaviorTypes.RECOMMENDATION_IMPRESSION,
          productId: pId,
          metadata: { strategy }
        });
      }
    }
    return { success: true };
  }

  async trackComparison(userId, sessionId, productIds) {
    return this.trackBehavior({
      userId,
      sessionId,
      eventType: 'click_product',
      metadata: { productIds, action: 'compare' }
    });
  }

  async trackPCBuild(userId, sessionId, budget, purpose) {
    return this.trackBehavior({
      userId,
      sessionId,
      eventType: this.behaviorTypes.CHATBOT_MESSAGE,
      keyword: `PC Build: budget ${budget}, purpose ${purpose}`,
      metadata: { budget, purpose }
    });
  }

  // Other legacy methods stubbed
  async getUserPreferences(userId, options = {}) {
    // Handled by new UserPreferenceService, but return basic legacy shape
    const UserPreferenceService = require('./UserPreferenceService');
    const profile = await UserPreferenceService.buildUserProfile(userId, null);
    return {
      success: true,
      preferences: {
        favoriteCategories: profile.favoriteCategories,
        favoriteBrands: profile.favoriteBrands,
        priceRange: profile.priceRange
      }
    };
  }

  async getSessionBehaviors(sessionId) {
    const behaviors = await UserBehavior.find({ sessionId }).populate('productId').lean();
    return {
      success: true,
      summary: {
        totalInteractions: behaviors.length,
        viewedProducts: behaviors.filter(b => b.eventType === 'view_product').map(b => b.productId),
        searchQueries: behaviors.filter(b => b.eventType === 'search_keyword').map(b => b.keyword)
      }
    };
  }

  async getPurchaseInsights(userId) {
    const Order = require('../../models/Order');
    const orders = await Order.find({ user: userId, status: { $ne: 'cancelled' } }).lean();
    return {
      success: true,
      insights: {
        totalOrders: orders.length,
        totalSpent: orders.reduce((sum, o) => sum + o.totalAmount, 0)
      }
    };
  }
}

module.exports = new BehaviorTrackerService();
