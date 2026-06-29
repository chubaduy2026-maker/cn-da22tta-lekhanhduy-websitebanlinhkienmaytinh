/**
 * Recommendation Service
 * Hệ thống gợi ý sản phẩm đa mức: Rule-based → Collaborative Filtering → Hybrid
 * Upgraded to include Smart Personalized Recommendation Engine using UserPreferenceService and ProductRankingService.
 * 
 * @module services/ai/RecommendationService
 * @description AI Service cho Product Recommendations
 */

const mongoose = require('mongoose');
const Product = require('../../models/Product');
const UserInteraction = require('../../models/UserInteraction');
const ProductEmbedding = require('../../models/ProductEmbedding');
const Order = require('../../models/Order');
const UserPreferenceService = require('./UserPreferenceService');
const ProductRankingService = require('./ProductRankingService');

class RecommendationService {
  constructor() {
    // Cache cho similarity matrices
    this.userSimilarityCache = new Map();
    this.itemSimilarityCache = new Map();
    this.cacheTTL = 60 * 60 * 1000; // 1 hour
    
    // Weights cho hybrid model
    this.hybridWeights = {
      collaborative: 0.4,
      contentBased: 0.35,
      popularity: 0.15,
      ruleBased: 0.1
    };
  }

  // ==================== SMART PERSONALIZED RECOMMENDATION ENGINE ====================

  /**
   * Động cơ gợi ý thông minh, cá nhân hóa theo hành vi người dùng
   * @param {String} userId - User ID (nếu đã đăng nhập)
   * @param {String} sessionId - Session ID (dùng cho khách vãng lai)
   * @param {Object} context - Ngữ cảnh hiện tại (productId, category, brand, price, specifications, chatbotIntent, searchKeyword)
   * @returns {Promise<Array>} Danh sách sản phẩm gợi ý đã chấm điểm và sắp xếp
   */
  async getSmartRecommendations(userId, sessionId, context = {}) {
    try {
      // 0. Điền đầy đủ thông tin sản phẩm trong giỏ hàng nếu thiếu (cho trang giỏ hàng)
      if (context.isCartPage && context.cartItems && context.cartItems.length > 0) {
        const productIds = context.cartItems.map(item => {
          const prod = item.product || item;
          return prod._id || prod.productId || prod;
        }).filter(Boolean);

        try {
          const dbProducts = await Product.find({ _id: { $in: productIds } }).lean();
          context.cartItems = context.cartItems.map(item => {
            const itemId = (item.product?._id || item.productId || item._id || item).toString();
            const dbProd = dbProducts.find(p => p._id.toString() === itemId);
            return {
              ...item,
              product: dbProd || item.product
            };
          });
        } catch (err) {
          console.error('❌ [RecommendationService] Error populating cart items:', err);
        }
      }

      // 1. Lấy thông tin người dùng & Tạo User Preference Profile
      const userProfile = await UserPreferenceService.buildUserProfile(userId, sessionId);

      // 2. Lấy danh sách sản phẩm ứng viên
      const candidates = await this.getCandidateProducts(userProfile, context);

      // 3. Chấm điểm và sắp xếp sản phẩm qua ProductRankingService
      const rankedList = candidates.map(product => {
        return ProductRankingService.rankProduct(product, userProfile, context);
      });

      // Sắp xếp giảm dần theo Final Score
      rankedList.sort((a, b) => b.finalScore - a.finalScore);

      // 4. Trả về top sản phẩm phù hợp nhất
      const limit = parseInt(context.limit, 10) || 10;
      return rankedList.slice(0, limit).map(item => {
        const prodObj = item.product instanceof mongoose.Document || (item.product.toObject && typeof item.product.toObject === 'function')
          ? item.product.toObject()
          : item.product;
          
        return {
          ...prodObj,
          aiMatchScore: item.aiMatchScore,
          recommendationReasons: item.recommendationReasons,
          score: item.finalScore // Giữ trường score cho tương thích ngược
        };
      });
    } catch (error) {
      console.error('❌ [RecommendationService] Error generating smart recommendations:', error);
      // Fallback: Trả về danh sách bán chạy/nổi bật khi gặp lỗi
      return this.getPopularRecommendations({ limit: context.limit || 10 });
    }
  }

  /**
   * Lấy danh sách ứng viên sản phẩm dựa trên profile người dùng và context
   */
  async getCandidateProducts(userProfile, context = {}) {
    const query = { isActive: true, stock: { $gt: 0 } };
    const orConditions = [];

    // For cart page, restrict candidates strictly to cross-sell categories
    if (context.isCartPage && context.cartItems && context.cartItems.length > 0) {
      const productIds = context.cartItems.map(item => {
        const prod = item.product || item;
        return prod._id || prod.productId || prod;
      }).filter(Boolean);

      try {
        const dbProducts = await Product.find({ _id: { $in: productIds } }).select('category').lean();
        const crossSellMap = {
          'Laptop': ['Chuột', 'Bàn phím', 'Tai nghe', 'Màn hình', 'Phụ kiện', 'Balo', 'Đế tản nhiệt', 'RAM', 'SSD'],
          'PC': ['Màn hình', 'Bàn phím', 'Chuột', 'Ghế gaming', 'Tai nghe', 'Bàn gaming', 'Lót chuột'],
          'Ghế gaming': ['Bàn gaming', 'PC', 'Phụ kiện', 'Lót chuột'],
          'CPU': ['Mainboard', 'Tản nhiệt', 'RAM'],
          'VGA': ['Nguồn', 'Case', 'Màn hình'],
          'Mainboard': ['RAM', 'CPU', 'Ổ cứng', 'Nguồn'],
          'RAM': ['Mainboard', 'CPU', 'Ổ cứng'],
          'Màn hình': ['VGA', 'Chuột', 'Bàn phím', 'Tai nghe'],
          'Ổ cứng': ['Mainboard', 'RAM', 'SSD'],
          'Case': ['Nguồn', 'Tản nhiệt', 'Phụ kiện'],
          'Tản nhiệt': ['Case', 'CPU'],
          'Nguồn': ['VGA', 'Case', 'Mainboard'],
          'Bàn phím': ['Chuột', 'Lót chuột', 'Tai nghe'],
          'Chuột': ['Bàn phím', 'Lót chuột', 'Tai nghe'],
          'Tai nghe': ['Laptop', 'PC', 'Chuột', 'Bàn phím'],
          'Loa': ['PC', 'Laptop'],
          'Console': ['Tay cầm', 'Màn hình', 'Tai nghe']
        };

        const targetCategories = new Set();
        dbProducts.forEach(prod => {
          const category = prod.category;
          if (category && crossSellMap[category]) {
            crossSellMap[category].forEach(cat => targetCategories.add(cat));
          }
        });

        if (targetCategories.size > 0) {
          query.category = { $in: Array.from(targetCategories) };
        }
      } catch (err) {
        console.error('❌ [RecommendationService] Error fetching cart items for candidates:', err);
      }
    } else {
      // 1. Sản phẩm cùng danh mục với sản phẩm đang xem
      if (context.category) {
        orConditions.push({ category: context.category });
      }

      // 2. Sản phẩm cùng thương hiệu người dùng thường quan tâm
      if (userProfile && userProfile.favoriteBrands && userProfile.favoriteBrands.length > 0) {
        orConditions.push({ brand: { $in: userProfile.favoriteBrands } });
      }

      // 3. Sản phẩm cùng danh mục người dùng quan tâm
      if (userProfile && userProfile.favoriteCategories && userProfile.favoriteCategories.length > 0) {
        orConditions.push({ category: { $in: userProfile.favoriteCategories } });
      }

      // 4. Sản phẩm cùng khoảng giá
      if (userProfile && userProfile.priceRange && userProfile.priceRange.average > 0) {
        const avg = userProfile.priceRange.average;
        orConditions.push({ price: { $gte: avg * 0.7, $lte: avg * 1.3 } });
      }

      // 5. Sản phẩm nổi bật / đánh giá cao (để đảm bảo có đủ ứng viên)
      orConditions.push({ isFeatured: true });
      orConditions.push({ rating: { $gte: 4.5 } });

      // 6. Sản phẩm liên quan đến từ khóa tìm kiếm
      if (context.searchKeyword) {
        orConditions.push({ name: { $regex: context.searchKeyword, $options: 'i' } });
        orConditions.push({ brand: { $regex: context.searchKeyword, $options: 'i' } });
        orConditions.push({ category: { $regex: context.searchKeyword, $options: 'i' } });
      }

      // 7. Sản phẩm liên quan đến nội dung chatbot đã tư vấn (theo intent usecase)
      if (context.chatbotIntent) {
        orConditions.push({ useCase: context.chatbotIntent });
      }

      if (orConditions.length > 0) {
        query.$or = orConditions;
      }
    }

    // Loại trừ sản phẩm hiện tại
    if (context.productId) {
      query._id = { $ne: new mongoose.Types.ObjectId(context.productId) };
    }

    // Giới hạn số lượng ứng viên để không làm chậm hiệu năng tải trang
    let candidates = await Product.find(query).limit(80).lean();

    // Fallback: nếu không đủ sản phẩm phù hợp, bổ sung sản phẩm phổ biến cùng danh mục
    if (candidates.length < 10) {
      const fallbackQuery = { isActive: true, stock: { $gt: 0 } };
      if (context.category) {
        fallbackQuery.category = context.category;
      }
      if (context.productId) {
        fallbackQuery._id = { $ne: new mongoose.Types.ObjectId(context.productId) };
      }
      
      const fallbackProducts = await Product.find(fallbackQuery)
        .sort({ rating: -1, reviewCount: -1 })
        .limit(30)
        .lean();

      const existingIds = new Set(candidates.map(c => c._id.toString()));
      fallbackProducts.forEach(p => {
        if (!existingIds.has(p._id.toString())) {
          candidates.push(p);
        }
      });
    }

    return candidates;
  }

  // ==================== UTILITY METHODS ====================
  
  /**
   * Tính Cosine Similarity giữa 2 vectors
   */
  cosineSimilarity(vecA, vecB) {
    if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }
    
    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Tính Pearson Correlation
   */
  pearsonCorrelation(vecA, vecB) {
    if (!vecA || !vecB || vecA.length !== vecB.length || vecA.length === 0) return 0;
    
    const n = vecA.length;
    const meanA = vecA.reduce((a, b) => a + b, 0) / n;
    const meanB = vecB.reduce((a, b) => a + b, 0) / n;
    
    let numerator = 0;
    let denomA = 0;
    let denomB = 0;
    
    for (let i = 0; i < n; i++) {
      const diffA = vecA[i] - meanA;
      const diffB = vecB[i] - meanB;
      numerator += diffA * diffB;
      denomA += diffA * diffA;
      denomB += diffB * diffB;
    }
    
    if (denomA === 0 || denomB === 0) return 0;
    return numerator / (Math.sqrt(denomA) * Math.sqrt(denomB));
  }

  /**
   * Normalize scores to 0-1 range
   */
  normalizeScores(items) {
    if (items.length === 0) return items;
    
    const maxScore = Math.max(...items.map(i => i.score));
    const minScore = Math.min(...items.map(i => i.score));
    const range = maxScore - minScore;
    
    if (range === 0) return items.map(i => ({ ...i, normalizedScore: 1 }));
    
    return items.map(i => ({
      ...i,
      normalizedScore: (i.score - minScore) / range
    }));
  }

  // ==================== LEVEL 1: RULE-BASED RECOMMENDATIONS ====================
  
  async getRuleBasedRecommendations(productId, options = {}) {
    const { limit = 10, excludeIds = [] } = options;
    
    const product = await Product.findById(productId);
    if (!product) return [];

    const excludeObjectIds = [...excludeIds, productId].map(id => 
      new mongoose.Types.ObjectId(id)
    );

    const priceMin = product.price * 0.8;
    const priceMax = product.price * 1.2;

    const recommendations = await Product.aggregate([
      {
        $match: {
          _id: { $nin: excludeObjectIds },
          stock: { $gt: 0 },
          isActive: true
        }
      },
      {
        $addFields: {
          sameCategoryScore: { $cond: [{ $eq: ['$category', product.category] }, 30, 0] },
          sameBrandScore: { $cond: [{ $eq: ['$brand', product.brand] }, 20, 0] },
          priceRangeScore: {
            $cond: [
              { $and: [
                { $gte: ['$price', priceMin] },
                { $lte: ['$price', priceMax] }
              ]},
              15,
              0
            ]
          },
          ratingScore: { $multiply: ['$rating', 5] },
          stockScore: { $cond: [{ $gt: ['$stock', 10] }, 5, 0] }
        }
      },
      {
        $addFields: {
          totalScore: {
            $add: [
              '$sameCategoryScore',
              '$sameBrandScore', 
              '$priceRangeScore',
              '$ratingScore',
              '$stockScore'
            ]
          }
        }
      },
      { $sort: { totalScore: -1 } },
      { $limit: limit },
      {
        $project: {
          _id: 1,
          name: 1,
          price: 1,
          image: 1,
          category: 1,
          brand: 1,
          rating: 1,
          stock: 1,
          score: '$totalScore',
          recommendationType: { $literal: 'rule-based' }
        }
      }
    ]);

    return recommendations;
  }

  async getCrossSellRecommendations(productId, options = {}) {
    const { limit = 5 } = options;
    
    const product = await Product.findById(productId);
    if (!product) return [];

    const crossSellMap = {
      'Laptop': ['Chuột', 'Bàn phím', 'Tai nghe', 'Màn hình'],
      'PC': ['Màn hình', 'Bàn phím', 'Chuột', 'Ghế gaming'],
      'CPU': ['Mainboard', 'Tản nhiệt'],
      'VGA': ['Nguồn', 'Case'],
      'Mainboard': ['RAM', 'CPU', 'Ổ cứng'],
      'RAM': ['Mainboard', 'CPU'],
      'Màn hình': ['VGA', 'Cáp HDMI'],
      'Ổ cứng': ['Case', 'Cáp SATA'],
      'Case': ['Nguồn', 'Tản nhiệt'],
      'Tản nhiệt': ['Case', 'CPU'],
      'Nguồn': ['VGA', 'Case'],
      'Bàn phím': ['Chuột', 'Lót chuột'],
      'Chuột': ['Bàn phím', 'Lót chuột'],
      'Ghế gaming': ['Bàn gaming', 'PC'],
      'Tai nghe': ['Laptop', 'PC'],
      'Loa': ['PC', 'Laptop'],
      'Console': ['Tay cầm', 'Màn hình']
    };

    const targetCategories = crossSellMap[product.category] || [];
    if (targetCategories.length === 0) return [];

    const recommendations = await Product.find({
      category: { $in: targetCategories },
      stock: { $gt: 0 },
      isActive: true
    })
    .sort({ rating: -1, reviewCount: -1 })
    .limit(limit)
    .select('name price image category brand rating stock');

    return recommendations.map(p => ({
      ...p.toObject(),
      score: 1,
      recommendationType: 'cross-sell'
    }));
  }

  // ==================== LEVEL 2: COLLABORATIVE FILTERING ====================

  async getUserBasedCF(userId, options = {}) {
    const { limit = 10, minSimilarity = 0.1, topK = 20 } = options;
    
    const interactionMatrix = await UserInteraction.getInteractionMatrix({
      minInteractions: 2,
      timeRange: 90
    });

    if (interactionMatrix.length < 2) {
      return [];
    }

    const currentUserData = interactionMatrix.find(
      u => u._id.toString() === userId.toString()
    );
    
    if (!currentUserData || currentUserData.interactions.length === 0) {
      return [];
    }

    const allProducts = new Set();
    interactionMatrix.forEach(u => {
      u.interactions.forEach(i => allProducts.add(i.product.toString()));
    });
    const productList = Array.from(allProducts);

    const createUserVector = (userData) => {
      const vector = new Array(productList.length).fill(0);
      userData.interactions.forEach(i => {
        const idx = productList.indexOf(i.product.toString());
        if (idx !== -1) vector[idx] = i.score;
      });
      return vector;
    };

    const currentUserVector = createUserVector(currentUserData);
    
    const userSimilarities = [];
    for (const otherUser of interactionMatrix) {
      if (otherUser._id.toString() === userId.toString()) continue;
      
      const otherVector = createUserVector(otherUser);
      const similarity = this.cosineSimilarity(currentUserVector, otherVector);
      
      if (similarity >= minSimilarity) {
        userSimilarities.push({
          userId: otherUser._id,
          similarity,
          interactions: otherUser.interactions
        });
      }
    }

    userSimilarities.sort((a, b) => b.similarity - a.similarity);
    const topUsers = userSimilarities.slice(0, topK);

    const currentUserProducts = new Set(
      currentUserData.interactions.map(i => i.product.toString())
    );

    const productScores = new Map();
    
    for (const user of topUsers) {
      for (const interaction of user.interactions) {
        const productId = interaction.product.toString();
        if (currentUserProducts.has(productId)) continue;
        
        const weightedScore = interaction.score * user.similarity;
        const current = productScores.get(productId) || { score: 0, count: 0 };
        productScores.set(productId, {
          score: current.score + weightedScore,
          count: current.count + 1
        });
      }
    }

    const recommendations = Array.from(productScores.entries())
      .map(([productId, data]) => ({
        productId,
        score: data.score / data.count,
        supportCount: data.count
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    const productIds = recommendations.map(r => r.productId);
    const products = await Product.find({ _id: { $in: productIds }, isActive: true })
      .select('name price image category brand rating stock');

    return recommendations.map(r => {
      const product = products.find(p => p._id.toString() === r.productId);
      return {
        ...product?.toObject(),
        score: r.score,
        supportCount: r.supportCount,
        recommendationType: 'user-based-cf'
      };
    }).filter(r => r.name);
  }

  async getItemBasedCF(productId, options = {}) {
    const { limit = 10, minSimilarity = 0.1 } = options;
    
    const cacheKey = `item-${productId}`;
    const cached = this.itemSimilarityCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.data.slice(0, limit);
    }

    const interactions = await UserInteraction.find({
      interactionType: { $in: ['view', 'cart_add', 'purchase', 'review'] }
    }).select('user product weight');

    const itemUserMap = new Map();
    const allUsers = new Set();
    
    interactions.forEach(i => {
      const productKey = i.product.toString();
      const userKey = i.user.toString();
      allUsers.add(userKey);
      
      if (!itemUserMap.has(productKey)) {
        itemUserMap.set(productKey, new Map());
      }
      const userMap = itemUserMap.get(productKey);
      userMap.set(userKey, (userMap.get(userKey) || 0) + i.weight);
    });

    const userList = Array.from(allUsers);
    const targetProductId = productId.toString();
    
    if (!itemUserMap.has(targetProductId)) {
      return [];
    }

    const createItemVector = (productId) => {
      const userMap = itemUserMap.get(productId);
      if (!userMap) return null;
      return userList.map(userId => userMap.get(userId) || 0);
    };

    const targetVector = createItemVector(targetProductId);
    if (!targetVector) return [];

    const similarities = [];
    for (const [otherProductId] of itemUserMap) {
      if (otherProductId === targetProductId) continue;
      
      const otherVector = createItemVector(otherProductId);
      if (!otherVector) continue;
      
      const similarity = this.cosineSimilarity(targetVector, otherVector);
      
      if (similarity >= minSimilarity) {
        similarities.push({
          productId: otherProductId,
          similarity
        });
      }
    }

    similarities.sort((a, b) => b.similarity - a.similarity);
    const topSimilar = similarities.slice(0, limit);

    const productIds = topSimilar.map(s => s.productId);
    const products = await Product.find({ 
      _id: { $in: productIds },
      stock: { $gt: 0 },
      isActive: true
    }).select('name price image category brand rating stock');

    const results = topSimilar.map(s => {
      const product = products.find(p => p._id.toString() === s.productId);
      if (!product) return null;
      return {
        ...product.toObject(),
        score: s.similarity,
        recommendationType: 'item-based-cf'
      };
    }).filter(r => r !== null);

    this.itemSimilarityCache.set(cacheKey, {
      data: results,
      timestamp: Date.now()
    });

    return results;
  }

  // ==================== LEVEL 3: CONTENT-BASED FILTERING ====================

  async getContentBasedRecommendations(productId, options = {}) {
    const { limit = 10, minSimilarity = 0.5 } = options;
    
    const productEmbedding = await ProductEmbedding.findOne({
      product: productId,
      status: 'completed'
    });

    if (!productEmbedding) {
      return this.getRuleBasedRecommendations(productId, options);
    }

    const similarProducts = await ProductEmbedding.findSimilarProducts(
      productEmbedding.embedding,
      {
        limit,
        minSimilarity,
        excludeProductIds: [productId]
      }
    );

    const productIds = similarProducts.map(s => s.product);
    const products = await Product.find({
      _id: { $in: productIds },
      stock: { $gt: 0 },
      isActive: true
    }).select('name price image category brand rating stock');

    return similarProducts.map(s => {
      const product = products.find(p => p._id.toString() === s.product.toString());
      if (!product) return null;
      return {
        ...product.toObject(),
        score: s.similarity,
        recommendationType: 'content-based'
      };
    }).filter(r => r !== null);
  }

  // ==================== LEVEL 4: HYBRID RECOMMENDATIONS ====================

  async getHybridRecommendations(userId, productId = null, options = {}) {
    const { 
      limit = 10, 
      weights = this.hybridWeights,
      diversityFactor = 0.3
    } = options;

    const allRecommendations = new Map();
    const addToMap = (items, sourceWeight, sourceName) => {
      items.forEach((item, index) => {
        const id = item._id?.toString() || item.productId?.toString();
        if (!id) return;
        
        const positionWeight = 1 / Math.log2(index + 2);
        const score = (item.normalizedScore || item.score || 1) * sourceWeight * positionWeight;
        
        const existing = allRecommendations.get(id);
        if (existing) {
          existing.score += score;
          existing.sources.push(sourceName);
        } else {
          allRecommendations.set(id, {
            productId: id,
            score,
            sources: [sourceName],
            product: item
          });
        }
      });
    };

    if (userId) {
      try {
        const userBasedRecs = await this.getUserBasedCF(userId, { limit: 20 });
        const normalizedUserBased = this.normalizeScores(userBasedRecs);
        addToMap(normalizedUserBased, weights.collaborative * 0.5, 'user-based-cf');
      } catch (err) {
        console.log('User-based CF error:', err.message);
      }
    }

    if (productId) {
      try {
        const itemBasedRecs = await this.getItemBasedCF(productId, { limit: 20 });
        const normalizedItemBased = this.normalizeScores(itemBasedRecs);
        addToMap(normalizedItemBased, weights.collaborative * 0.5, 'item-based-cf');
      } catch (err) {
        console.log('Item-based CF error:', err.message);
      }
    }

    if (productId) {
      try {
        const contentBasedRecs = await this.getContentBasedRecommendations(productId, { limit: 20 });
        const normalizedContentBased = this.normalizeScores(contentBasedRecs);
        addToMap(normalizedContentBased, weights.contentBased, 'content-based');
      } catch (err) {
        console.log('content-based error:', err.message);
      }
    }

    try {
      const popularProducts = await UserInteraction.getPopularProducts(20, 30);
      const popularWithProducts = await Product.find({
        _id: { $in: popularProducts.map(p => p._id) },
        stock: { $gt: 0 },
        isActive: true
      }).select('name price image category brand rating stock');

      const popularRecs = popularProducts.map(p => {
        const product = popularWithProducts.find(
          prod => prod._id.toString() === p._id.toString()
        );
        return product ? { ...product.toObject(), score: p.score } : null;
      }).filter(p => p !== null);

      const normalizedPopular = this.normalizeScores(popularRecs);
      addToMap(normalizedPopular, weights.popularity, 'popularity');
    } catch (err) {
      console.log('Popularity error:', err.message);
    }

    if (productId) {
      try {
        const ruleBasedRecs = await this.getRuleBasedRecommendations(productId, { limit: 15 });
        const normalizedRuleBased = this.normalizeScores(ruleBasedRecs);
        addToMap(normalizedRuleBased, weights.ruleBased, 'rule-based');
      } catch (err) {
        console.log('Rule-based error:', err.message);
      }
    }

    let results = Array.from(allRecommendations.values())
      .sort((a, b) => b.score - a.score);

    if (diversityFactor > 0) {
      results = this.applyDiversity(results, diversityFactor, limit * 2);
    }

    const topResults = results.slice(0, limit);
    const productIds = topResults.map(r => r.productId);
    
    const products = await Product.find({
      _id: { $in: productIds }
    }).select('name price originalPrice image images category brand rating reviewCount stock');

    return topResults.map(r => {
      const product = products.find(p => p._id.toString() === r.productId);
      if (!product) return null;
      return {
        ...product.toObject(),
        score: r.score,
        sources: r.sources,
        recommendationType: 'hybrid'
      };
    }).filter(r => r !== null);
  }

  applyDiversity(items, diversityFactor, targetCount) {
    const categoryCount = new Map();
    const diverseResults = [];
    const maxPerCategory = Math.ceil(targetCount / 3);

    for (const item of items) {
      const category = item.product?.category || 'unknown';
      const count = categoryCount.get(category) || 0;
      
      if (count < maxPerCategory) {
        const penalty = 1 - (count * diversityFactor / maxPerCategory);
        diverseResults.push({
          ...item,
          score: item.score * penalty
        });
        categoryCount.set(category, count + 1);
      }
    }

    return diverseResults.sort((a, b) => b.score - a.score);
  }

  // ==================== PERSONALIZED RECOMMENDATIONS ====================

  async getPersonalizedRecommendations(userId, options = {}) {
    const { limit = 10 } = options;

    const recentInteractions = await UserInteraction.find({
      user: userId
    })
    .sort({ createdAt: -1 })
    .limit(50)
    .populate('product', 'category brand');

    if (recentInteractions.length === 0) {
      return this.getPopularRecommendations({ limit });
    }

    const categoryPrefs = new Map();
    const brandPrefs = new Map();
    
    recentInteractions.forEach(interaction => {
      if (!interaction.product) return;
      
      const category = interaction.product.category;
      const brand = interaction.product.brand;
      
      categoryPrefs.set(category, (categoryPrefs.get(category) || 0) + interaction.weight);
      if (brand) {
        brandPrefs.set(brand, (brandPrefs.get(brand) || 0) + interaction.weight);
      }
    });

    const topCategories = Array.from(categoryPrefs.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([cat]) => cat);

    const topBrands = Array.from(brandPrefs.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([brand]) => brand);

    const interactedProductIds = recentInteractions.map(i => i.product?._id).filter(Boolean);
    
    const recommendations = await Product.find({
      _id: { $nin: interactedProductIds },
      stock: { $gt: 0 },
      isActive: true,
      $or: [
        { category: { $in: topCategories } },
        { brand: { $in: topBrands } }
      ]
    })
    .sort({ rating: -1, reviewCount: -1 })
    .limit(limit)
    .select('name price image category brand rating stock');

    return recommendations.map(p => ({
      ...p.toObject(),
      recommendationType: 'personalized',
      matchedPreferences: {
        category: topCategories.includes(p.category),
        brand: topBrands.includes(p.brand)
      }
    }));
  }

  async getPopularRecommendations(options = {}) {
    const { limit = 10, category = null, timeRange = 30 } = options;

    const popularProducts = await UserInteraction.getPopularProducts(limit, timeRange);
    
    const query = {
      _id: { $in: popularProducts.map(p => p._id) },
      stock: { $gt: 0 },
      isActive: true
    };
    if (category) query.category = category;

    const products = await Product.find(query)
      .select('name price image category brand rating stock');

    return popularProducts
      .map(p => {
        const product = products.find(prod => prod._id.toString() === p._id.toString());
        if (!product) return null;
        return {
          ...product.toObject(),
          score: p.score,
          uniqueUsers: p.uniqueUserCount,
          viewCount: p.viewCount,
          purchaseCount: p.purchaseCount,
          recommendationType: 'popular'
        };
      })
      .filter(p => p !== null);
  }

  // ==================== CART RECOMMENDATIONS ====================

  async getCartRecommendations(cartItems, options = {}) {
    const { limit = 5 } = options;
    
    if (!cartItems || cartItems.length === 0) return [];

    const recommendations = new Map();
    
    for (const item of cartItems) {
      const productId = item.product?._id || item.product;
      if (!productId) continue;

      const crossSell = await this.getCrossSellRecommendations(productId, { limit: 3 });
      crossSell.forEach(p => {
        const id = p._id.toString();
        const existing = recommendations.get(id);
        if (existing) {
          existing.score += 1;
        } else {
          recommendations.set(id, { ...p, score: 1 });
        }
      });

      const similar = await this.getItemBasedCF(productId, { limit: 3 });
      similar.forEach(p => {
        if (!p._id) return;
        const id = p._id.toString();
        const existing = recommendations.get(id);
        if (existing) {
          existing.score += p.score || 0.5;
        } else {
          recommendations.set(id, { ...p, score: p.score || 0.5 });
        }
      });
    }

    const cartProductIds = cartItems.map(i => 
      (i.product?._id || i.product)?.toString()
    ).filter(Boolean);
    
    cartProductIds.forEach(id => recommendations.delete(id));

    return Array.from(recommendations.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(p => ({
        ...p,
        recommendationType: 'cart-based'
      }));
  }
}

module.exports = new RecommendationService();
