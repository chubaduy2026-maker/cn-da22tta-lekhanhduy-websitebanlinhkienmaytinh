const UserBehavior = require('../../models/UserBehavior');
const Cart = require('../../models/Cart');
const Order = require('../../models/Order');
const ChatbotConversation = require('../../models/ChatbotConversation');

class UserPreferenceService {
  /**
   * Tạo User Preference Profile từ lịch sử hoạt động
   * @param {String} userId
   * @param {String} sessionId
   * @returns {Object} Hồ sơ sở thích người dùng
   */
  async buildUserProfile(userId, sessionId) {
    const profile = {
      favoriteCategories: [],
      favoriteBrands: [],
      priceRange: { min: 0, max: 999999999, average: 0 },
      specs: {},
      useCases: [],
      recentViews: [],
      recentViewCategories: [],
      recentViewBrands: [],
      cartItems: []
    };

    // Query behaviors in the last 30 days
    const query = {};
    if (userId) {
      query.$or = [{ userId: userId }, { sessionId: sessionId }];
    } else if (sessionId) {
      query.sessionId = sessionId;
    } else {
      return profile; // Return empty profile if neither is provided
    }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    query.createdAt = { $gte: thirtyDaysAgo };

    try {
      const behaviors = await UserBehavior.find(query).populate('productId').lean();

      // 1. Process behaviors
      const categoriesCount = {};
      const brandsCount = {};
      const priceList = [];
      const keywords = [];
      const viewedProductIds = new Set();

      behaviors.forEach(b => {
        // Extract views
        if (b.eventType === 'view_product' && b.productId) {
          const prodId = b.productId._id.toString();
          viewedProductIds.add(prodId);
          if (!profile.recentViews.includes(prodId)) {
            profile.recentViews.push(prodId);
          }
        }

        // Extract search keywords
        if (b.eventType === 'search_keyword' && b.keyword) {
          keywords.push(b.keyword);
        }

        // Extract categories/brands
        if (b.category) {
          categoriesCount[b.category] = (categoriesCount[b.category] || 0) + 1;
        }
        if (b.brand) {
          brandsCount[b.brand] = (brandsCount[b.brand] || 0) + 1;
        }
        if (b.price > 0) {
          priceList.push(b.price);
        }
      });

      // Take top 3 categories
      profile.favoriteCategories = Object.entries(categoriesCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([cat]) => cat);

      // Take top 3 brands
      profile.favoriteBrands = Object.entries(brandsCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([brand]) => brand);

      // Calculate price range
      if (priceList.length > 0) {
        const sum = priceList.reduce((a, b) => a + b, 0);
        const avg = sum / priceList.length;
        profile.priceRange = {
          min: Math.max(0, Math.min(...priceList) * 0.8),
          max: Math.max(...priceList) * 1.2,
          average: Math.round(avg)
        };
      }

      // 2. Fetch Cart items
      const cartQuery = userId ? { userId } : { sessionId };
      const cart = await Cart.findOne(cartQuery).lean();
      if (cart && cart.items) {
        profile.cartItems = cart.items.map(item => item.product.toString());
      }

      // 3. Fetch Orders (if logged in)
      if (userId) {
        const orders = await Order.find({ user: userId, status: { $ne: 'cancelled' } }).lean();
        orders.forEach(order => {
          if (order.items) {
            order.items.forEach(item => {
              if (item.product) {
                const pId = item.product.toString();
                if (!profile.recentViews.includes(pId)) {
                  profile.recentViews.push(pId);
                }
              }
            });
          }
        });
      }

      // 4. Fetch Chatbot Conversations
      const conversationQuery = userId ? { user: userId } : { sessionId };
      const chatConversation = await ChatbotConversation.findOne(conversationQuery)
        .sort({ updatedAt: -1 })
        .lean();

      if (chatConversation && chatConversation.messages) {
        // Take last 10 messages from user to analyze intent/useCase/keywords
        const userMessages = chatConversation.messages
          .filter(m => m.role === 'user')
          .slice(-10)
          .map(m => m.content);
          
        userMessages.forEach(msg => {
          const normalized = msg.toLowerCase();
          
          // Detect use-cases
          if (normalized.includes('game') || normalized.includes('gaming') || normalized.includes('rtx')) {
            if (!profile.useCases.includes('gaming')) profile.useCases.push('gaming');
          }
          if (normalized.includes('code') || normalized.includes('lập trình') || normalized.includes('dev')) {
            if (!profile.useCases.includes('programming')) profile.useCases.push('programming');
          }
          if (normalized.includes('học') || normalized.includes('sinh viên') || normalized.includes('student')) {
            if (!profile.useCases.includes('student')) profile.useCases.push('student');
          }
          if (normalized.includes('văn phòng') || normalized.includes('office') || normalized.includes('word') || normalized.includes('excel')) {
            if (!profile.useCases.includes('office')) profile.useCases.push('office');
          }
          if (normalized.includes('đồ họa') || normalized.includes('thiết kế') || normalized.includes('photoshop') || normalized.includes('edit')) {
            if (!profile.useCases.includes('design')) profile.useCases.push('design');
          }

          // Detect specs
          const ramMatch = normalized.match(/(\d+)\s*gb\s*ram/i) || normalized.match(/ram\s*(\d+)\s*gb/i);
          if (ramMatch) profile.specs.RAM = `${ramMatch[1]}GB`;
          
          const ssdMatch = normalized.match(/(\d+)\s*gb\s*ssd/i) || normalized.match(/ssd\s*(\d+)\s*gb/i) || normalized.match(/(\d+)\s*tb\s*ssd/i);
          if (ssdMatch) profile.specs.SSD = ssdMatch[0].toUpperCase();
        });
      }

      // Add recent view details (categories, brands) to help matching
      if (behaviors.length > 0) {
        const recentViewProducts = behaviors
          .filter(b => b.eventType === 'view_product' && b.productId)
          .map(b => b.productId);
        
        profile.recentViewCategories = [...new Set(recentViewProducts.map(p => p.category))].filter(Boolean);
        profile.recentViewBrands = [...new Set(recentViewProducts.map(p => p.brand))].filter(Boolean);
      }
    } catch (err) {
      console.error('❌ Error building user preference profile:', err);
    }

    return profile;
  }
}

module.exports = new UserPreferenceService();
