class ProductRankingService {
  /**
   * Tính điểm Final Score cho từng sản phẩm và tạo lý do đề xuất
   * @param {Object} product - Đối tượng Product
   * @param {Object} userProfile - User Preference Profile từ UserPreferenceService
   * @param {Object} context - { productId, category, brand, price, specifications, chatbotIntent, searchKeyword, isCartPage, cartProductIds }
   * @returns {Object} { product, finalScore, aiMatchScore, recommendationReasons }
   */
  rankProduct(product, userProfile, context = {}) {
    // 1. User Preference Match (0.35)
    let preferenceScore = 0;
    const prefDetails = [];
    
    if (userProfile) {
      // Category match
      if (userProfile.favoriteCategories && userProfile.favoriteCategories.includes(product.category)) {
        preferenceScore += 0.3;
        prefDetails.push('category');
      }
      
      // Brand match
      if (userProfile.favoriteBrands && userProfile.favoriteBrands.includes(product.brand)) {
        preferenceScore += 0.25;
        prefDetails.push('brand');
      }
      
      // Price match
      if (userProfile.priceRange) {
        const { min, max, average } = userProfile.priceRange;
        const price = product.price;
        if (price >= min && price <= max) {
          preferenceScore += 0.25;
          prefDetails.push('price');
        } else if (average > 0) {
          const low = average * 0.7;
          const high = average * 1.3;
          if (price >= low && price <= high) {
            preferenceScore += 0.2;
            prefDetails.push('price_avg');
          }
        }
      }
      
      // Specifications match
      if (userProfile.specs && Object.keys(userProfile.specs).length > 0) {
        let specMatchCount = 0;
        let totalCheckedSpecs = 0;
        
        for (const [key, val] of Object.entries(userProfile.specs)) {
          if (product.specifications && product.specifications[key]) {
            totalCheckedSpecs++;
            const productSpecVal = String(product.specifications[key]).toLowerCase();
            const userPrefVal = String(val).toLowerCase();
            if (productSpecVal.includes(userPrefVal) || userPrefVal.includes(productSpecVal)) {
              specMatchCount++;
            }
          }
        }
        
        if (totalCheckedSpecs > 0 && specMatchCount > 0) {
          preferenceScore += 0.1 * (specMatchCount / totalCheckedSpecs);
          prefDetails.push('specs');
        }
      }
      
      // Use cases match
      if (userProfile.useCases && userProfile.useCases.length > 0 && product.useCase && product.useCase.length > 0) {
        const overlap = userProfile.useCases.filter(uc => product.useCase.includes(uc));
        if (overlap.length > 0) {
          preferenceScore += 0.1 * (overlap.length / userProfile.useCases.length);
          prefDetails.push('usecase');
        }
      }
    }
    
    preferenceScore = Math.min(preferenceScore, 1);

    // 2. Behavior Match (0.25)
    let behaviorScore = 0;
    const behaviorDetails = [];
    if (userProfile) {
      const pId = product._id?.toString() || product.id?.toString();
      
      // Is in cart
      if (userProfile.cartItems && userProfile.cartItems.includes(pId)) {
        behaviorScore += 0.8;
        behaviorDetails.push('cart');
      }
      
      // Is viewed recently
      if (userProfile.recentViews && userProfile.recentViews.includes(pId)) {
        behaviorScore += 0.5;
        behaviorDetails.push('viewed');
      }
      
      // Shares category/brand with recent views
      if (userProfile.recentViewCategories && userProfile.recentViewCategories.includes(product.category)) {
        behaviorScore += 0.2;
        behaviorDetails.push('recent_category');
      }
      
      if (userProfile.recentViewBrands && userProfile.recentViewBrands.includes(product.brand)) {
        behaviorScore += 0.15;
        behaviorDetails.push('recent_brand');
      }
    }
    
    // Cross-sell logic for cart recommendations
    if (context.isCartPage && context.cartItems && context.cartItems.length > 0) {
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

      // Check if product belongs to cross-sell category of any cart items
      let isCrossSellMatch = false;
      let targetCartCategory = '';
      
      for (const item of context.cartItems) {
        const cartProd = item.product;
        if (cartProd && cartProd.category) {
          const crossSellCats = crossSellMap[cartProd.category] || [];
          if (crossSellCats.includes(product.category)) {
            isCrossSellMatch = true;
            targetCartCategory = cartProd.category;
            break;
          }
        }
      }

      if (isCrossSellMatch) {
        behaviorScore += 0.5;
        behaviorDetails.push(`cross_sell_${targetCartCategory}`);
      }
    }

    behaviorScore = Math.min(behaviorScore, 1);

    // 3. Content Similarity (0.25)
    let contentScore = 0;
    const contentDetails = [];
    let isUpgradeProduct = false;
    
    // If context has currentProductId
    if (context.productId && context.productId.toString() !== product._id?.toString()) {
      // Same category
      if (context.category && product.category === context.category) {
        contentScore += 0.4;
        contentDetails.push('same_category');
      }
      
      // Same brand
      if (context.brand && product.brand === context.brand) {
        contentScore += 0.3;
        contentDetails.push('same_brand');
      }
      
      // Similar price (within ±25% of context price)
      if (context.price && product.price) {
        const diff = Math.abs(product.price - context.price) / context.price;
        if (diff <= 0.25) {
          contentScore += 0.2;
          contentDetails.push('similar_price');
        }
      }
      
      // Specs similarity
      if (context.specifications && product.specifications) {
        let match = 0;
        let count = 0;
        for (const [k, v] of Object.entries(context.specifications)) {
          if (product.specifications[k]) {
            count++;
            if (String(product.specifications[k]).toLowerCase() === String(v).toLowerCase()) {
              match++;
            }
          }
        }
        if (count > 0 && match > 0) {
          contentScore += 0.1 * (match / count);
          contentDetails.push('similar_specs');
        }
      }

      // Upsell logic: Higher price but better specs
      if (context.price && product.price > context.price && product.price <= context.price * 1.5) {
        // Compare RAM sizes
        const getRamGb = (specsObj) => {
          if (!specsObj) return 0;
          const ramStr = String(specsObj.RAM || '').toLowerCase();
          const match = ramStr.match(/(\d+)\s*gb/);
          return match ? parseInt(match[1], 10) : 0;
        };

        const pRam = getRamGb(product.specifications);
        const cRam = getRamGb(context.specifications);

        // Compare SSD sizes
        const getSsdGb = (specsObj) => {
          if (!specsObj) return 0;
          const ssdStr = String(specsObj.SSD || specsObj['Ổ cứng'] || '').toLowerCase();
          const matchGb = ssdStr.match(/(\d+)\s*gb/);
          if (matchGb) return parseInt(matchGb[1], 10);
          const matchTb = ssdStr.match(/(\d+)\s*tb/);
          if (matchTb) return parseInt(matchTb[1], 10) * 1024;
          return 0;
        };

        const pSsd = getSsdGb(product.specifications);
        const cSsd = getSsdGb(context.specifications);

        if ((pRam > cRam && cRam > 0) || (pSsd > cSsd && cSsd > 0)) {
          isUpgradeProduct = true;
          contentScore += 0.15;
          contentDetails.push('upsell_upgrade');
        }
      }
    } else {
      if (context.searchKeyword) {
        const kw = context.searchKeyword.toLowerCase();
        if (product.name.toLowerCase().includes(kw) || product.category.toLowerCase().includes(kw)) {
          contentScore += 0.8;
          contentDetails.push('keyword_match');
        }
      }
      if (context.chatbotIntent) {
        if (product.useCase && product.useCase.includes(context.chatbotIntent)) {
          contentScore += 0.6;
          contentDetails.push('chatbot_intent');
        }
      }
    }
    contentScore = Math.min(contentScore, 1);

    // 4. Popularity Score (0.15)
    let popularityScore = 0;
    if (product.rating) {
      popularityScore += (product.rating / 5) * 0.4;
    }
    if (product.reviewCount) {
      popularityScore += Math.min(product.reviewCount / 50, 1) * 0.3;
    }
    if (product.isFeatured) {
      popularityScore += 0.3;
    }
    popularityScore = Math.min(popularityScore, 1);

    // Final Weighted Score calculation
    const finalScore = (preferenceScore * 0.35) + (behaviorScore * 0.25) + (contentScore * 0.25) + (popularityScore * 0.15);
    
    // Convert to percentage [0-100]
    const aiMatchScore = Math.round(finalScore * 100);

    // Generate natural language reasons explaining recommendation
    const reasons = [];
    
    // 1. Check if it is a cross-sell accessory matched in cart page
    const foundCrossSell = behaviorDetails.find(d => d.startsWith('cross_sell_'));
    if (foundCrossSell) {
      const srcCat = foundCrossSell.replace('cross_sell_', '');
      reasons.push(`Sản phẩm mua kèm phù hợp cho ${srcCat} trong giỏ hàng.`);
    }

    // 2. Check if it is an upsell upgrade choice
    if (isUpgradeProduct) {
      reasons.push('Lựa chọn nâng cấp với cấu hình mạnh mẽ hơn.');
    }

    // 3. Match from user profile preferences
    if (prefDetails.includes('category') || prefDetails.includes('brand')) {
      reasons.push(`Phù hợp với thương hiệu/dòng máy bạn yêu thích (${product.brand || product.category}).`);
    }
    if (prefDetails.includes('usecase')) {
      const matchUseCase = product.useCase.find(uc => userProfile?.useCases?.includes(uc));
      if (matchUseCase) {
        const viUseCases = { gaming: 'chơi game', programming: 'lập trình', student: 'học tập', office: 'văn phòng', design: 'thiết kế đồ họa' };
        reasons.push(`Đáp ứng tốt nhu cầu ${viUseCases[matchUseCase] || matchUseCase} của bạn.`);
      }
    }

    // 4. Match based on behavior views
    if (behaviorDetails.includes('viewed')) {
      reasons.push('Bạn đã quan tâm sản phẩm này gần đây.');
    } else if (behaviorDetails.includes('recent_category')) {
      reasons.push(`Dựa trên các sản phẩm thuộc danh mục ${product.category} bạn đã xem.`);
    }

    // 5. Match based on similar attributes
    if (contentDetails.includes('same_brand') && context.productId) {
      reasons.push(`Cùng thương hiệu ${product.brand} với sản phẩm đang xem.`);
    }
    if (contentDetails.includes('similar_price') && context.productId) {
      reasons.push('Có mức giá tương đương với sản phẩm hiện tại.');
    }
    if (product.rating >= 4.5 && product.reviewCount > 5) {
      reasons.push(`Sản phẩm bán chạy được đánh giá cao (${product.rating}⭐).`);
    }

    // Default fallback reason
    if (reasons.length === 0) {
      reasons.push('Sản phẩm nổi bật đề xuất cho bạn.');
    }

    return {
      product,
      finalScore,
      aiMatchScore,
      recommendationReasons: reasons.slice(0, 2)
    };
  }
}

module.exports = new ProductRankingService();
