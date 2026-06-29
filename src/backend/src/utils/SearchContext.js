const brandResolver = require('./brandResolver');
const categoryResolver = require('./categoryResolver');
const priceResolver = require('./priceResolver');
const specsResolver = require('./specsResolver');
const needResolver = require('./needResolver');
const productNameResolver = require('./productNameResolver');

class SearchContext {
  /**
   * Builds the SearchContext for a given message.
   * @param {string} message - Raw user query message
   * @param {string} intent - Detected intent
   * @param {string} requestId - Unique request ID
   * @returns {Promise<Object>} The SearchContext object
   */
  async build(message = '', intent = '', requestId = '', sessionId = '') {
    const brand = await brandResolver.resolveBrand(message);
    const catDetails = await categoryResolver.resolveCategoryDetails(message);
    const priceDetails = priceResolver.resolvePrice(message);
    const category = catDetails ? catDetails.category : null;
    if (
      (intent === 'pc_build' || (intent === 'product_advice' && category === 'PC') || (intent === 'product_search' && category === 'PC'))
      && priceDetails.targetPrice
      && (!priceDetails.priceMode || ['target', 'approx'].includes(priceDetails.priceMode))
    ) {
      priceDetails.priceMin = null;
      priceDetails.priceMax = priceDetails.targetPrice;
    }
    const specs = specsResolver.resolveSpecs(message);
    const need = needResolver.resolveNeed(message);
    const productName = productNameResolver.resolveProductName(message);

    const canonicalKey = catDetails ? catDetails.canonicalKey : null;
    const allowedKeywords = catDetails ? catDetails.allowedKeywords : [];

    const productIntents = ['product_search', 'product_query', 'product_advice', 'pc_build', 'product_compare', 'product_price_stock', 'recommendation_request'];
    const knowledgeIntents = ['tech_knowledge', 'tech_compare', 'advice_explanation', 'policy_question', 'pc_compat'];
    const isProductIntent = productIntents.includes(intent);
    const isKnowledgeIntent = knowledgeIntents.includes(intent);

    // Dynamic search keywords
    const keywords = [];
    if (productName) keywords.push(productName);
    
    // Add allowedKeywords from category if present
    if (allowedKeywords && allowedKeywords.length > 0) {
      keywords.push(...allowedKeywords);
    }

    // Extract other words excluding generic ones
    const normalized = message
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/[^\w\s]/g, ' ')
      .trim();
    
    const words = normalized.split(/\s+/);
    const STOP_WORDS = new Set([
      'cho', 'den', 'duoi', 'tren', 'tu', 'ban', 'mua', 'can', 'muon', 'nhu',
      'the', 'mot', 'cai', 'nhung', 'cac', 'va', 'hoac', 'nhung', 'voi',
      'toi', 'minh', 'giup', 'tim', 'gia', 'bao', 'nhieu', 'nao', 'co', 'shop', 'ad', 'admin',
      'bo', 'di', 'trieu', 'tr', 'm', 'million', 'ngan', 'sach', 'tam', 'khoang',
      'hon', 'it', 'nhat', 'toi', 'da', 'loc', 'danh', 'sach', 'xem', 'show'
    ]);

    for (const word of words) {
      if (/^\d+(?:[.,]\d+)?$/.test(word)) continue;
      if (word.length > 2 && !STOP_WORDS.has(word) && !keywords.map(k => k.toLowerCase()).includes(word)) {
        // Only push if it doesn't match brand or category names
        const lowerBrand = brand ? brand.toLowerCase() : '';
        const lowerCat = category ? category.toLowerCase() : '';
        if (word !== lowerBrand && word !== lowerCat && !lowerBrand.includes(word) && !lowerCat.includes(word)) {
          keywords.push(word);
        }
      }
    }

    return {
      requestId: requestId || `req_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      sessionId: sessionId || '',
      originalMessage: message,
      normalizedMessage: normalized,
      intent,
      category: category || '',
      categoryId: category || '', // Since category field in DB is a string, categoryName is used as categoryId
      brand: brand || '',
      productName: productName || '',
      keywords: Array.from(new Set(keywords)), // unique keywords
      priceMin: priceDetails.priceMin,
      priceMax: priceDetails.priceMax,
      targetPrice: priceDetails.targetPrice,
      priceMode: priceDetails.priceMode,
      specs: specs || {},
      need: need || '',
      topic: category || brand || need || productName || (isKnowledgeIntent ? 'knowledge' : ''),
      isProductIntent,
      isKnowledgeIntent,
      shouldSearchProducts: isProductIntent,
      shouldCallGemini: isKnowledgeIntent || ['general_question', 'small_talk'].includes(intent),
      shouldUseRAG: isKnowledgeIntent || ['policy_question', 'pc_compat'].includes(intent),
      allowedCategories: category ? [category] : [],
      allowedBrands: brand ? [brand] : [],
      allowedKeywords: allowedKeywords || [],
      forbiddenCategories: [],
      confidence: 1.0
    };
  }
}

module.exports = new SearchContext();
