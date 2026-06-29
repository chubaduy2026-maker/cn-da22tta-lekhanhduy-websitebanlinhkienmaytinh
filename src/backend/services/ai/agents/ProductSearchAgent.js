/**
 * ProductSearchAgent — Tìm kiếm sản phẩm thông minh
 *
 * Chức năng:
 * - Tìm kiếm sản phẩm theo từ khóa, ngân sách, thương hiệu, danh mục
 * - Kết hợp keyword search (MongoDB text index) + semantic search (vector)
 * - Trích xuất ngân sách, thương hiệu từ câu hỏi tự nhiên bằng resolvers động
 * - Sinh câu trả lời tư vấn bằng Gemini
 *
 * @module services/ai/agents/ProductSearchAgent
 */

const Product = require('../../../models/Product');
const Category = require('../../../models/Category');
const SearchContext = require('../../../src/utils/SearchContext');

class ProductSearchAgent {
  constructor() {
    this.name = 'ProductSearchAgent';
    this.description = 'Tìm kiếm sản phẩm theo nhu cầu người dùng';
    this.defaultLimit = 6;
    this.maxLimit = 10;
  }

  /**
   * Thực thi tìm kiếm sản phẩm
   * @param {Object} params
   * @param {string} params.message - Câu hỏi của người dùng
   * @param {Array} params.history - Lịch sử hội thoại
   * @param {Object} params.context - Context bổ sung
   * @param {string} params.intent - Intent của cuộc gọi
   * @returns {Promise<Object>} Dynamic response object matching requirements
   */
  async execute({ message = '', history = [], context = {}, intent = 'product_search' } = {}) {
    try {
      // 1) Phân tích yêu cầu người dùng bằng SearchContext
      const searchContextObj = context.searchContext || await SearchContext.build(message, intent, context.requestId);
      const { brand, category, priceMin, priceMax, allowedKeywords, specs } = searchContextObj;
      const budget = { minPrice: priceMin, maxPrice: priceMax };

      // 2) Tìm kiếm sản phẩm từ MongoDB
      const products = await this._searchProductsFromMongo(message, { budget, brand, category, allowedKeywords, specs });

      // 3) Xử lý kết quả không tìm thấy (dynamic fallback)
      if (!products || products.length === 0) {
        const fallback = await this._buildDynamicFallback({ brand, category, budget, allowedKeywords });
        const fallbackProducts = Array.isArray(fallback.fallbackProducts)
          ? fallback.fallbackProducts.map(p => this._formatProduct(p))
          : [];
        return {
          type: 'product_results',
          intent,
          answer: fallback.answer,
          message: fallback.answer,
          filters: {
            category: category || '',
            brand: brand || '',
            priceMin: budget.minPrice,
            priceMax: budget.maxPrice
          },
          context: searchContextObj,
          products: fallbackProducts,
          sources: fallbackProducts.map(p => ({
            type: 'product',
            id: p._id || p.id,
            title: p.name,
            score: 0
          })),
          quickReplies: fallback.quickReplies
        };
      }

      // 4) Sinh câu trả lời tư vấn
      let answer = '';
      let quickReplies = [];

      if (brand && !category) {
        // Chỉ có brand
        const brandOnly = await this._buildBrandOnlyResponse(brand, products);
        answer = brandOnly.answer;
        quickReplies = brandOnly.quickReplies;
      } else if (category && !brand && budget.minPrice === null && budget.maxPrice === null) {
        // Chỉ có category
        const categoryOnly = await this._buildCategoryOnlyResponse(category, products);
        answer = categoryOnly.answer;
        quickReplies = categoryOnly.quickReplies;
      } else {
        // Đầy đủ thông tin -> gọi Gemini tư vấn hoặc dùng fallback answer
        answer = await this._generateAnswer(message, products, history, { budget, brand, category });
        quickReplies = this._buildQuickReplies(products, { budget, brand, category });
      }

      return {
        type: 'product_results',
        intent,
        answer,
        message: answer,
        filters: {
          category: category || '',
          brand: brand || '',
          priceMin: budget.minPrice,
          priceMax: budget.maxPrice
        },
        context: searchContextObj,
        products: products.map(p => this._formatProduct(p)),
        sources: products.map(p => ({
          type: 'product',
          id: p._id?.toString(),
          title: p.name,
          score: p._score || 0
        })),
        quickReplies
      };
    } catch (error) {
      console.error('[ProductSearchAgent] execute error:', error.stack);
      return {
        type: 'product_results',
        intent: 'product_search',
        answer: 'Mình đang gặp sự cố khi tìm kiếm. Bạn thử lại sau nhé!',
        message: 'Mình đang gặp sự cố khi tìm kiếm. Bạn thử lại sau nhé!',
        filters: { category: '', brand: '', priceMin: null, priceMax: null },
        context: {},
        products: [],
        sources: [],
        quickReplies: []
      };
    }
  }

  /**
   * Tìm kiếm sản phẩm từ database theo category, brand, price, allowedKeywords, specs
   * @private
   */
  async _searchProductsFromMongo(rawMessage = '', params = {}) {
    const { budget = {}, brand = '', category = '', allowedKeywords = [], specs = {} } = params;
    const originalMessage = String(rawMessage || '').trim();
    const searchBudget = {
      minPrice: budget.minPrice ?? null,
      maxPrice: budget.maxPrice ?? null
    };
    const keywords = this._extractSearchKeywords(originalMessage, { brand, category, allowedKeywords, specs });
    const resolvedCategory = await this._resolveCategoryForQuery(category);
    const categoryId = resolvedCategory?.categoryId || '';
    const baseQuery = this._buildBaseProductQuery(searchBudget);
    const queryAttempts = this._buildSearchQueryAttempts({
      baseQuery,
      brand,
      category,
      resolvedCategory,
      keywords,
      allowedKeywords,
      specs
    });

    let products = [];
    let finalQuery = baseQuery;
    let matchedLevel = 'none';

    for (const attempt of queryAttempts) {
      finalQuery = attempt.query;
      products = await Product.find(attempt.query)
        .sort({ rating: -1, createdAt: -1 })
        .limit(this.maxLimit)
        .lean();

      if (products.length > 0) {
        matchedLevel = attempt.level;
        break;
      }
    }

    this._logProductSearchDebug({
      originalMessage,
      intent: 'product_search',
      brand,
      category,
      resolvedCategory,
      categoryId,
      priceMin: searchBudget.minPrice,
      priceMax: searchBudget.maxPrice,
      keywords,
      query: finalQuery,
      products,
      matchedLevel
    });

    return products;
  }

  _buildBaseProductQuery(budget = {}) {
    const query = {};

    if (Product.schema.path('isActive')) {
      query.isActive = { $ne: false };
    }

    if (Product.schema.path('status')) {
      query.status = 'active';
    }

    if (budget.minPrice !== null || budget.maxPrice !== null) {
      query.price = {};
      if (budget.minPrice !== null) query.price.$gte = budget.minPrice;
      if (budget.maxPrice !== null) query.price.$lte = budget.maxPrice;
    }

    return query;
  }

  async _resolveCategoryForQuery(category = '') {
    const rawCategory = String(category || '').trim();
    if (!rawCategory) {
      return { value: '', categoryId: '', source: 'none', isObjectId: false };
    }

    const productCategoryPath = Product.schema.path('category');
    const instance = productCategoryPath?.instance || '';

    if (instance === 'ObjectId') {
      const escapedCat = this._escapeRegex(rawCategory);
      const slug = this._slugify(rawCategory);
      const categoryDoc = await Category.findOne({
        $or: [
          { name: new RegExp(escapedCat, 'i') },
          { slug: new RegExp(this._escapeRegex(slug), 'i') }
        ]
      }).lean();

      return {
        value: categoryDoc?._id || null,
        categoryId: categoryDoc?._id?.toString?.() || '',
        name: categoryDoc?.name || rawCategory,
        source: categoryDoc ? 'Category' : 'none',
        isObjectId: true
      };
    }

    const categoryDoc = await Category.findOne({
      $or: [
        { name: new RegExp(`^${this._escapeRegex(rawCategory)}$`, 'i') },
        { slug: this._slugify(rawCategory) }
      ]
    }).lean().catch(() => null);

    const resolvedName = categoryDoc?.name || rawCategory;
    return {
      value: resolvedName,
      categoryId: resolvedName,
      name: resolvedName,
      source: categoryDoc ? 'Category.name' : 'Product.category',
      isObjectId: false
    };
  }

  _buildSearchQueryAttempts({ baseQuery, brand, category, resolvedCategory, keywords, allowedKeywords, specs }) {
    const attempts = [];
    const brandOrNameCondition = this._buildBrandOrNameCondition(brand);
    const categoryCondition = this._buildCategoryCondition(category, resolvedCategory);
    const categoryKeywordCondition = this._buildKeywordAndCondition(this._categoryKeywords(category), ['name', 'category']);
    const meaningfulKeywords = this._dedupe([
      ...keywords,
      ...Object.values(specs || {}).map(v => String(v || '').trim()).filter(Boolean)
    ]);
    const contextlessKeywords = this._withoutContextKeywords(meaningfulKeywords, { brand, category });
    const addAttempt = (level, conditions) => {
      const cleanConditions = conditions.filter(Boolean);
      if (cleanConditions.length === 0) return;
      attempts.push({
        level,
        query: this._andQuery(baseQuery, cleanConditions)
      });
    };

    if (categoryCondition && brandOrNameCondition) {
      addAttempt('level_1_category_brand', [categoryCondition, brandOrNameCondition]);
    }

    if (categoryCondition && brandOrNameCondition && (baseQuery.price || Object.keys(specs || {}).length > 0)) {
      addAttempt('level_1b_category_brand_budget', [categoryCondition, brandOrNameCondition]);
    }

    if (brandOrNameCondition) {
      const brandKeywordTerms = this._dedupe([
        ...this._categoryKeywords(category),
        ...contextlessKeywords
      ]);
      addAttempt('level_2_brand_keywords', [
        brandOrNameCondition,
        this._buildKeywordAndCondition(brandKeywordTerms, ['name', 'category'])
      ]);
    }

    if (categoryCondition) {
      const categoryTerms = this._dedupe([
        ...this._brandKeywords(brand),
        ...contextlessKeywords
      ]);
      addAttempt('level_3_category_keywords', [
        categoryCondition,
        this._buildKeywordAndCondition(categoryTerms, ['name', 'brand', 'description', 'embeddingText'])
      ]);
    }

    if (categoryCondition && !brand && (baseQuery.price || contextlessKeywords.length === 0)) {
      addAttempt('level_3b_category_budget_only', [categoryCondition]);
    }

    if (brandOrNameCondition && categoryKeywordCondition) {
      addAttempt('level_3b_brand_category_keyword', [brandOrNameCondition, categoryKeywordCondition]);
    }

    addAttempt('level_4_keyword_search', [
      this._buildKeywordAndCondition(this._categoryKeywords(category), ['name', 'category']),
      this._buildKeywordAndCondition(this._brandKeywords(brand), ['name', 'brand', 'subcategory']),
      this._buildKeywordAndCondition(contextlessKeywords, ['name', 'brand', 'category', 'description', 'embeddingText'])
    ]);

    if (categoryCondition && !brand) {
      addAttempt('level_5_category_only', [categoryCondition]);
    }

    if (brandOrNameCondition) {
      addAttempt('level_6_brand_only', [brandOrNameCondition]);
    }

    if (attempts.length === 0) {
      attempts.push({
        level: 'level_0_base',
        query: { ...baseQuery }
      });
    }

    return attempts;
  }

  _buildBrandOrNameCondition(brand = '') {
    const rawBrand = String(brand || '').trim();
    if (!rawBrand) return null;
    const brandRegex = new RegExp(`^${this._escapeRegex(rawBrand)}$`, 'i');
    const nameRegex = new RegExp(this._escapeRegex(rawBrand), 'i');

    if (Product.schema.path('brand')) {
      const conditions = [
        { brand: brandRegex },
        { name: nameRegex }
      ];
      if (Product.schema.path('subcategory')) {
        conditions.push({ subcategory: brandRegex });
      }
      return { $or: conditions };
    }

    return { name: nameRegex };
  }

  _buildCategoryCondition(category = '', resolvedCategory = {}) {
    const rawCategory = String(category || resolvedCategory?.name || '').trim();
    if (!rawCategory) return null;

    if (resolvedCategory?.isObjectId) {
      if (!resolvedCategory.value) return null;
      return { category: resolvedCategory.value };
    }

    const escaped = this._escapeRegex(String(resolvedCategory?.value || rawCategory));
    return { category: new RegExp(`^${escaped}$`, 'i') };
  }

  _buildKeywordAndCondition(terms = [], fields = []) {
    const cleanTerms = this._dedupe(terms)
      .map(term => String(term || '').trim())
      .filter(term => term.length > 1);

    if (cleanTerms.length === 0 || fields.length === 0) return null;

    return {
      $and: cleanTerms.map(term => {
        const regex = new RegExp(this._escapeRegex(term), 'i');
        return {
          $or: fields
            .filter(field => Product.schema.path(field) || field === 'embeddingText')
            .map(field => ({ [field]: regex }))
        };
      })
    };
  }

  _andQuery(baseQuery = {}, conditions = []) {
    const baseConditions = Object.entries(baseQuery).map(([key, value]) => ({ [key]: value }));
    const allConditions = [...baseConditions, ...conditions].filter(Boolean);
    if (allConditions.length === 0) return {};
    if (allConditions.length === 1) return allConditions[0];
    return { $and: allConditions };
  }

  _extractSearchKeywords(message = '', { brand = '', category = '', allowedKeywords = [], specs = {} } = {}) {
    const normalized = this._normalize(message);
    const stopWords = new Set([
      'toi', 'minh', 'can', 'muon', 'tim', 'kiem', 'cho', 'xem', 'shop',
      'co', 'khong', 'ban', 'mua', 'san', 'pham', 'hang', 'cua', 'ad',
      'gia', 'bao', 'nhieu', 'duoi', 'tren', 'tu', 'den', 'voi', 'giup',
      'cac', 'bo', 'di', 'trieu', 'tr', 'm', 'million', 'ngan', 'sach',
      'tam', 'khoang', 'hon', 'it', 'nhat', 'toi', 'da', 'loc', 'danh',
      'sach', 'show', 'gui'
    ]);
    const normalizedBrandParts = this._normalize(brand).split(/\s+/).filter(Boolean);
    const normalizedCategoryParts = this._normalize(category).split(/\s+/).filter(Boolean);
    const blocked = new Set([...normalizedBrandParts, ...normalizedCategoryParts]);

    const words = normalized
      .split(/\s+/)
      .map(word => word.trim())
      .filter(word => word.length > 1 && !/^\d+(?:[.,]\d+)?$/.test(word) && !stopWords.has(word) && !blocked.has(word));

    const specValues = Object.values(specs || {}).map(v => String(v || '').trim()).filter(Boolean);
    return this._dedupe([
      ...this._categoryKeywords(category),
      ...this._brandKeywords(brand),
      ...words,
      ...specValues
    ]);
  }

  _categoryKeywords(category = '') {
    const rawCategory = String(category || '').trim();
    return rawCategory ? [rawCategory] : [];
  }

  _brandKeywords(brand = '') {
    const rawBrand = String(brand || '').trim();
    return rawBrand ? [rawBrand] : [];
  }

  _dedupe(values = []) {
    const seen = new Set();
    const result = [];
    for (const value of values) {
      const clean = String(value || '').trim();
      if (!clean) continue;
      const key = this._normalize(clean);
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(clean);
    }
    return result;
  }

  _withoutContextKeywords(values = [], { brand = '', category = '' } = {}) {
    const blocked = new Set([
      ...this._normalize(brand).split(/\s+/).filter(Boolean),
      ...this._normalize(category).split(/\s+/).filter(Boolean),
      this._normalize(brand),
      this._normalize(category)
    ].filter(Boolean));

    return this._dedupe(values).filter(value => {
      const normalized = this._normalize(value);
      if (!normalized) return false;
      if (blocked.has(normalized)) return false;
      const parts = normalized.split(/\s+/).filter(Boolean);
      return !parts.every(part => blocked.has(part));
    });
  }

  _escapeRegex(value = '') {
    return String(value || '').replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
  }

  _slugify(value = '') {
    return this._normalize(value)
      .replace(/\s+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  _stringifyQueryForDebug(query = {}) {
    return JSON.stringify(query, (key, value) => {
      if (value instanceof RegExp) {
        return value.toString();
      }
      if (value && typeof value === 'object' && value._bsontype === 'ObjectId') {
        return value.toString();
      }
      return value;
    }, 2);
  }

  _logProductSearchDebug({
    originalMessage,
    intent,
    brand,
    category,
    resolvedCategory,
    categoryId,
    priceMin,
    priceMax,
    keywords,
    query,
    products,
    matchedLevel
  }) {
    const firstProducts = products.slice(0, 5).map(p => ({
      id: p._id,
      name: p.name,
      brand: p.brand,
      category: p.category,
      price: p.price,
      isActive: p.isActive,
      status: p.status,
      stock: p.stock
    }));

    this.lastSearchDebug = {
      originalMessage,
      intent,
      brand,
      category,
      resolvedCategory,
      categoryId,
      priceMin,
      priceMax,
      keywords,
      finalMongoQuery: query,
      finalMongoQueryText: this._stringifyQueryForDebug(query),
      matchedLevel,
      resultCount: products.length,
      firstProducts
    };

    console.log('========== CHATBOT PRODUCT SEARCH DEBUG ==========');
    console.log('Original message:', originalMessage);
    console.log('Extracted intent:', intent);
    console.log('Extracted brand:', brand);
    console.log('Extracted category:', category);
    console.log('Resolved category:', resolvedCategory);
    console.log('Resolved categoryId:', categoryId);
    console.log('Price min:', priceMin);
    console.log('Price max:', priceMax);
    console.log('Keywords:', keywords);
    console.log('Matched fallback level:', matchedLevel);
    console.log('Final Mongo Query:', this._stringifyQueryForDebug(query));
    console.log('Result count:', products.length);
    console.log('First products:', firstProducts);
    console.log('===============================================');
  }

  getLastSearchDebug() {
    return this.lastSearchDebug || null;
  }

  async _searchProducts(rawMessage = '', params = {}) {
    const { budget, brand, category, allowedKeywords, specs } = params;

    const query = {
      isActive: true,
      stock: { $gt: 0 }
    };

    // 1. Thương hiệu
    if (brand) {
      const escapedBrand = brand.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      query.brand = new RegExp(`^${escapedBrand}$`, 'i');
    }

    // 2. Danh mục
    if (category) {
      const escapedCat = category.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      const dbCat = await Category.findOne({
        $or: [
          { name: new RegExp(`^${escapedCat}$`, 'i') },
          { slug: category.toLowerCase().replace(/đ/g, 'd').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-') }
        ]
      }).lean();

      if (dbCat) {
        query.category = dbCat.name;
      } else {
        query.category = new RegExp(`^${escapedCat}$`, 'i');
      }
    }

    // 3. Lọc giá
    if (budget.minPrice !== null || budget.maxPrice !== null) {
      query.price = {};
      if (budget.minPrice !== null) query.price.$gte = budget.minPrice;
      if (budget.maxPrice !== null) query.price.$lte = budget.maxPrice;
    }

    // 4. Từ khóa bắt buộc (tản nhiệt nước vs khí, ssd vs hdd)
    if (allowedKeywords && allowedKeywords.length > 0) {
      const regexPatterns = allowedKeywords.map(k => k.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'));
      query.$or = query.$or || [];
      query.$or.push(
        { name: new RegExp(regexPatterns.join('|'), 'i') },
        { embeddingText: new RegExp(regexPatterns.join('|'), 'i') }
      );
    }

    // 5. Specs filtering
    if (specs && Object.keys(specs).length > 0) {
      const specVals = Object.values(specs);
      query.$or = query.$or || [];
      for (const val of specVals) {
        const escapedVal = val.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        query.$or.push(
          { name: new RegExp(`\\b${escapedVal}\\b`, 'i') },
          { embeddingText: new RegExp(`\\b${escapedVal}\\b`, 'i') }
        );
      }
    }

    let products = [];

    // Thử keyword search
    if (rawMessage.trim()) {
      const textQuery = { ...query };
      const searchWords = rawMessage
        .split(/\s+/)
        .filter(w => w.length > 2)
        .slice(0, 5)
        .join(' ');

      if (searchWords) {
        try {
          products = await Product.find({
            ...textQuery,
            $text: { $search: searchWords }
          })
          .sort({ score: { $meta: 'textScore' }, rating: -1 })
          .limit(this.defaultLimit)
          .lean();
        } catch (err) {
          // ignore text index failure
        }
      }
    }

    // Nếu không có kết quả text, dùng query chính
    if (products.length === 0) {
      products = await Product.find(query)
        .sort({ rating: -1, createdAt: -1 })
        .limit(this.defaultLimit)
        .lean();
    }

    // Semantic search fallback (chỉ khi query chính rỗng)
    if (products.length === 0 && rawMessage.trim()) {
      try {
        const SemanticSearchService = require('../SemanticSearchService');
        if (SemanticSearchService && typeof SemanticSearchService.search === 'function') {
          const vectorResults = await SemanticSearchService.search(rawMessage, this.defaultLimit);
          if (Array.isArray(vectorResults) && vectorResults.length > 0) {
            products = vectorResults
              .map(r => r.product || r)
              .filter(p => {
                if (!p.isActive || p.stock <= 0) return false;
                if (brand && String(p.brand).toLowerCase() !== brand.toLowerCase()) return false;
                if (category && String(p.category).toLowerCase() !== category.toLowerCase()) return false;
                if (budget.minPrice !== null && p.price < budget.minPrice) return false;
                if (budget.maxPrice !== null && p.price > budget.maxPrice) return false;
                return true;
              });
          }
        }
      } catch (err) {
        console.warn('[ProductSearchAgent] Semantic search fallback failed:', err.message);
      }
    }

    return products;
  }

  /**
   * Tạo phản hồi cho trường hợp Brand Only
   * @private
   */
  async _buildBrandOnlyResponse(brand, products) {
    const categories = await Product.distinct('category', {
      brand: new RegExp(`^${brand.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, 'i')
    });

    const cleanCats = categories.filter(Boolean);
    let answer = `Mình tìm thấy một số sản phẩm nổi bật của thương hiệu **${brand}** tại TechStore.\n\n`;
    if (cleanCats.length > 0) {
      answer += `Bạn muốn xem sản phẩm **${brand}** thuộc danh mục nào?\n` + cleanCats.map(c => `- ${c} ${brand}`).join('\n');
    }

    const quickReplies = cleanCats.map(c => ({
      title: `${c} ${brand}`,
      payload: `Tìm ${c} ${brand}`
    }));

    return { answer, quickReplies };
  }

  /**
   * Tạo phản hồi cho trường hợp Category Only
   * @private
   */
  async _buildCategoryOnlyResponse(category, products) {
    const brands = await Product.distinct('brand', {
      category: new RegExp(`^${category.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, 'i')
    });

    const cleanBrands = brands.filter(Boolean).slice(0, 4);
    let answer = `Dưới đây là các sản phẩm **${category}** nổi bật tại TechStore.`;
    if (cleanBrands.length > 0) {
      answer += `\n\nBạn có thể lọc chi tiết hơn theo thương hiệu: ${cleanBrands.join(', ')}.`;
    }

    const quickReplies = cleanBrands.map(b => ({
      title: `${category} ${b}`,
      payload: `Tìm ${category} ${b}`
    }));

    quickReplies.push({ title: `${category} dưới 15tr`, payload: `Tìm ${category} dưới 15 triệu` });
    quickReplies.push({ title: `${category} dưới 25tr`, payload: `Tìm ${category} dưới 25 triệu` });

    return { answer, quickReplies };
  }

  /**
   * Tạo phản hồi động khi không tìm thấy sản phẩm chính xác
   * @private
   */
  async _buildDynamicFallback(params = {}) {
    const { brand, category, budget, allowedKeywords } = params;
    let answer = '';
    let fallbackProducts = [];
    let quickReplies = [];

    if (category) {
      const query = {
        category: new RegExp(`^${this._escapeRegex(category)}$`, 'i')
      };

      if (Product.schema.path('isActive')) {
        query.isActive = { $ne: false };
      }

      if (budget && (budget.minPrice !== null || budget.maxPrice !== null)) {
        query.price = {};
        if (budget.minPrice !== null) query.price.$gte = budget.minPrice;
        if (budget.maxPrice !== null) query.price.$lte = budget.maxPrice;
      }

      if (allowedKeywords && allowedKeywords.length > 0) {
        const regexPatterns = allowedKeywords.map(k => k.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'));
        query.$or = [
          { name: new RegExp(regexPatterns.join('|'), 'i') },
          { embeddingText: new RegExp(regexPatterns.join('|'), 'i') }
        ];
      }

      fallbackProducts = await Product.find(query)
        .sort({ rating: -1, createdAt: -1 })
        .limit(3)
        .lean();

      if (brand) {
        answer = `Hiện TechStore chưa có sản phẩm **${category}** của thương hiệu **${brand}** phù hợp.`;
        if (fallbackProducts.length > 0) {
          const distinctBrands = Array.from(new Set(fallbackProducts.map(p => p.brand).filter(Boolean)));
          answer += ` Mình có các sản phẩm **${category}** từ thương hiệu khác như: ${distinctBrands.join(', ')} cùng phân khúc nếu bạn quan tâm.`;
          quickReplies = distinctBrands.map(b => ({
            title: `${category} ${b}`,
            payload: `Tìm ${category} ${b}`
          }));
        }
      } else {
        answer = `Hiện TechStore chưa có sản phẩm **${category}** phù hợp với tiêu chí của bạn.`;
        if (fallbackProducts.length > 0) {
          answer += ` Bạn có thể tham khảo một số mẫu **${category}** nổi bật dưới đây nhé.`;
        }
      }
    } else if (brand) {
      answer = `Hiện TechStore chưa có sản phẩm nào của thương hiệu **${brand}** phù hợp.`;
      
      const brandFallbackQuery = {
        brand: new RegExp(`^${brand.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, 'i')
      };
      if (Product.schema.path('isActive')) {
        brandFallbackQuery.isActive = { $ne: false };
      }
      if (budget && (budget.minPrice !== null || budget.maxPrice !== null)) {
        brandFallbackQuery.price = {};
        if (budget.minPrice !== null) brandFallbackQuery.price.$gte = budget.minPrice;
        if (budget.maxPrice !== null) brandFallbackQuery.price.$lte = budget.maxPrice;
      }

      fallbackProducts = await Product.find(brandFallbackQuery).limit(3).lean();

      if (fallbackProducts.length > 0) {
        const distinctCats = Array.from(new Set(fallbackProducts.map(p => p.category).filter(Boolean)));
        answer += ` Bạn có thể tham khảo sản phẩm thuộc danh mục khác của **${brand}** như: ${distinctCats.join(', ')} dưới đây nhé.`;
      }
    } else {
      answer = 'Hiện TechStore chưa có sản phẩm phù hợp với tiêu chí này.';
      fallbackProducts = [];
    }

    if (budget && budget.maxPrice !== null) {
      answer += ` (dưới ${this._formatPrice(budget.maxPrice)})`;
    }

    // Set fallbackProducts to empty if it mismatch the main topic category to be extra safe
    if (category) {
      fallbackProducts = fallbackProducts.filter(p => this._normalize(p.category) === this._normalize(category));
    }
    if (brand) {
      fallbackProducts = fallbackProducts.filter(p => this._normalize(p.brand) === this._normalize(brand));
    }
    if (budget && (budget.minPrice !== null || budget.maxPrice !== null)) {
      fallbackProducts = fallbackProducts.filter(p => {
        const price = Number(p.salePrice || p.price || 0);
        if (!Number.isFinite(price) || price <= 0) return false;
        if (budget.minPrice !== null && price < budget.minPrice) return false;
        if (budget.maxPrice !== null && price > budget.maxPrice) return false;
        return true;
      });
    }

    return { answer, fallbackProducts, quickReplies };
  }

  /**
   * Sinh câu trả lời tư vấn bằng Gemini
   * @private
   */
  async _generateAnswer(message, products = [], history = [], params = {}) {
    try {
      const { callGemini } = require('../../../src/utils/geminiClient');
      const { budget, brand, category } = params;

      const productList = products
        .slice(0, 5)
        .map((p, i) => {
          const price = this._formatPrice(p.salePrice || p.price);
          const specs = p.specifications instanceof Map
            ? Object.fromEntries(p.specifications)
            : (p.specifications || {});
          const specsStr = Object.entries(specs)
            .slice(0, 5)
            .map(([k, v]) => `${k}: ${v}`)
            .join(', ');
          return `${i + 1}. ${p.name} | ${p.brand} | Giá: ${price} | ${specsStr} | Tồn kho: ${p.stock}`;
        })
        .join('\n');

      const historyText = history
        .slice(-4)
        .map(h => `${h.role === 'user' ? 'Khách' : 'AI'}: ${h.content}`)
        .join('\n');

      const prompt = [
        'Bạn là chuyên viên tư vấn sản phẩm thân thiện của TechStore.',
        'Quy tắc tối cao:',
        '- Chỉ tư vấn và liệt kê các sản phẩm nằm trong danh sách "SẢN PHẨM TÌM ĐƯỢC" bên dưới.',
        '- TUYỆT ĐỐI KHÔNG tự bịa tên sản phẩm, giá bán, tồn kho hay thông số ngoài dữ liệu.',
        '- Nếu danh sách "SẢN PHẨM TÌM ĐƯỢC" trống hoặc không có, bạn phải trả lời là hiện TechStore chưa có sản phẩm phù hợp và gợi ý các tiêu chí khác.',
        '',
        `CÂU HỎI KHÁCH HÀNG: ${message}`,
        category ? `DANH MỤC: ${category}` : '',
        budget.maxPrice ? `NGÂN SÁCH TỐI ĐA: ${this._formatPrice(budget.maxPrice)}` : '',
        brand ? `THƯƠNG HIỆU: ${brand}` : '',
        '',
        'LỊCH SỬ GẦN ĐÂY:',
        historyText || 'Không có.',
        '',
        'SẢN PHẨM TÌM ĐƯỢC:',
        productList,
        '',
        'HƯỚNG DẪN TRẢ LỜI:',
        '- Nêu rõ đặc điểm nổi bật của các sản phẩm trên phù hợp nhu cầu khách hàng',
        '- Format giá dạng XX.XXX.XXXđ',
        '- Trả lời bằng tiếng Việt, ngắn gọn, tự nhiên, đúng trọng tâm'
      ].filter(Boolean).join('\n');

      const answer = await callGemini(prompt);
      return String(answer || '').trim();
    } catch (error) {
      console.warn('[ProductSearchAgent] Gemini generation failed, using local fallback:', error.message);
      return this._buildFallbackAnswer(products, params);
    }
  }

  /**
   * Câu trả lời fallback khi Gemini không phản hồi
   * @private
   */
  _buildFallbackAnswer(products = [], params = {}) {
    if (products.length === 0) {
      return this._buildNotFoundAnswer('', params);
    }

    const lines = [
      'Mình tìm được một số sản phẩm phù hợp tại TechStore:\n',
      ...products.slice(0, 5).map((p, i) => {
        const price = this._formatPrice(p.salePrice || p.price);
        return `**${i + 1}. ${p.name}**\n- Giá: ${price}\n- Thương hiệu: ${p.brand || 'N/A'}`;
      }),
      '\nBạn muốn xem chi tiết sản phẩm nào không?'
    ];

    return lines.join('\n');
  }

  /**
   * Câu trả lời khi không tìm thấy
   * @private
   */
  _buildNotFoundAnswer(message = '', params = {}) {
    const { budget, brand, category } = params;
    let reply = `Hiện tại TechStore chưa có sản phẩm phù hợp`;
    if (category) reply += ` trong danh mục **${category}**`;
    if (brand) reply += ` của hãng **${brand}**`;
    if (budget && budget.maxPrice) reply += ` dưới **${this._formatPrice(budget.maxPrice)}**`;
    reply += '.\n\n';
    reply += 'Bạn có thể tham khảo:\n';
    reply += '- Chọn hãng khác\n';
    reply += '- Nâng ngân sách rộng hơn một chút\n';
    reply += '- Gợi ý cấu hình tương ứng khác nhé!';
    return reply;
  }

  /**
   * Tạo quick replies gợi ý
   * @private
   */
  _buildQuickReplies(products = [], params = {}) {
    const replies = [];
    if (products.length >= 2) {
      replies.push({
        title: `So sánh ${products[0]?.name?.slice(0, 20)}... và ${products[1]?.name?.slice(0, 20)}...`,
        payload: `So sánh ${products[0]?.name} và ${products[1]?.name}`
      });
    }
    replies.push({ title: 'Lọc thương hiệu khác', payload: 'Tìm sản phẩm thương hiệu khác' });
    return replies;
  }

  /**
   * Format sản phẩm cho frontend
   * @private
   */
  _formatProduct(p = {}) {
    const id = p._id?.toString() || p.id || '';
    return {
      id,
      _id: id,
      name: p.name || 'Sản phẩm',
      brand: p.brand || '',
      category: p.category || '',
      price: Number(p.salePrice || p.price || 0),
      salePrice: p.salePrice === null || p.salePrice === undefined ? null : Number(p.salePrice) || null,
      stock: Number(p.stock || 0),
      rating: Number(p.rating || 0),
      image: p.image || p.imageUrl || (Array.isArray(p.images) ? p.images[0] : null) || null,
      imageUrl: p.imageUrl || p.image || (Array.isArray(p.images) ? p.images[0] : null) || null,
      slug: p.slug || '',
      productUrl: id ? `/product/${id}` : null,
      specifications: p.specifications instanceof Map
        ? Object.fromEntries(p.specifications)
        : (p.specifications || {})
    };
  }

  _normalize(text = '') {
    return String(text || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  _formatPrice(price) {
    if (!price || isNaN(Number(price))) return 'Liên hệ';
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(Number(price));
  }
}

module.exports = new ProductSearchAgent();
