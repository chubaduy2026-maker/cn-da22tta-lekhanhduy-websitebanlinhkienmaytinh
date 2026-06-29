/**
 * Lean Semantic Search Service
 * MongoDB Atlas only: pre-filter + BM25 keyword + vector kNN.
 * No TF-IDF/Cosine logic in Node.js.
 */

const Product = require('../../models/Product');
const EmbeddingService = require('./rag/EmbeddingService');

class SemanticSearchService {
  constructor() {
    this.searchIndex = process.env.MONGODB_PRODUCT_SEARCH_INDEX || 'products_search_index';
    this.vectorPath = process.env.MONGODB_PRODUCT_VECTOR_PATH || 'embedding';
  }

  /**
   * MODULE 2
   * @param {Object} params
   * @param {string} params.keyword
   * @param {number[]|null} params.vector
   * @param {Object} params.filters
   * @param {number} params.limit
   */
  async searchProducts({ keyword = '', vector = null, filters = {}, limit = 10 } = {}) {
    try {
      const sanitizedLimit = Math.max(1, Math.min(Number(limit) || 10, 40));
      const normalizedFilters = this._normalizeFilters(filters);
      const hasStrictFilters = this._hasStrictFilters(normalizedFilters);
      const inferredCategory = normalizedFilters.category || this._extractCategoryHint(keyword);

      // Flexible keyword query first to avoid over-strict matching and exact-string misses.
      const extractedKeyword = this._extractKeywordForRegex(keyword, normalizedFilters);
      if (extractedKeyword) {
        const regexMatched = await this._queryByFlexibleKeyword(extractedKeyword, normalizedFilters, sanitizedLimit);
        if (regexMatched.length > 0) {
          return {
            exactMatch: true,
            products: regexMatched,
            appliedFilters: normalizedFilters,
            mode: 'regex_flexible'
          };
        }
      }

      // If user asks category-level exploration without strict constraints,
      // return featured products instead of marking as non-match.
      if (!hasStrictFilters && inferredCategory) {
        const featuredProducts = await this._fetchFeaturedByCategory(inferredCategory, Math.min(5, sanitizedLimit));
        return {
          exactMatch: true,
          products: featuredProducts,
          appliedFilters: normalizedFilters,
          mode: 'featured_category'
        };
      }

      const atlasFilter = this._buildAtlasFilter(normalizedFilters);

      let queryVector = Array.isArray(vector) && vector.length > 0 ? vector : null;
      if (!queryVector && keyword && keyword.trim()) {
        queryVector = await EmbeddingService.embedText(keyword);
      }

      const searchStage = this._buildHybridSearchStage({
        keyword,
        vector: queryVector,
        filter: atlasFilter,
        limit: sanitizedLimit
      });

      const pipeline = [
        searchStage,
        {
          $project: {
            _id: 1,
            name: 1,
            description: 1,
            category: 1,
            brand: 1,
            color: 1,
            price: 1,
            salePrice: 1,
            image: 1,
            images: 1,
            rating: 1,
            stock: 1,
            specifications: 1,
            score: { $meta: 'searchScore' }
          }
        },
        { $limit: sanitizedLimit }
      ];

      const products = await Product.aggregate(pipeline);

      if (products.length === 0 && (normalizedFilters.price_min !== null || normalizedFilters.price_max !== null)) {
        const targetPrice = normalizedFilters.price_max ?? normalizedFilters.price_min;
        const nearest = await this._fetchNearestPriceProducts({
          category: normalizedFilters.category,
          targetPrice,
          limit: 3
        });

        if (nearest.length > 0) {
          return {
            exactMatch: true,
            products: nearest,
            appliedFilters: normalizedFilters,
            mode: 'nearest_price'
          };
        }
      }

      return {
        exactMatch: products.length > 0,
        products,
        appliedFilters: normalizedFilters
      };
    } catch (error) {
      console.error('SemanticSearchService.searchProducts failed:', error.message);
      return {
        exactMatch: false,
        products: [],
        error: error.message,
        appliedFilters: this._normalizeFilters(filters)
      };
    }
  }

  /**
   * Smart Search Pipeline with 3 stages:
   * 1) strict, 2) relaxed, 3) semantic_only
   * @param {Object} extractedData
   * @returns {Promise<{results:Array, match_level:'strict'|'relaxed'|'semantic_only'}>}
   */
  async smartHybridSearch(extractedData = {}, options = {}) {
    const limit = Math.max(1, Math.min(Number(options.limit) || 8, 20));
    const explicitFilters = this._normalizeExplicitFilters(extractedData.explicit_filters || {});
    const semanticNeeds = String(extractedData.semantic_needs || '').trim();
    const rawQuery = String(extractedData.raw_query || '').trim();

    try {
      const stage1 = await this._runHybridStage({
        explicitFilters,
        semanticNeeds,
        rawQuery,
        limit,
        relaxed: false
      });

      if (stage1.length > 0) {
        return {
          results: stage1,
          match_level: 'strict'
        };
      }

      const relaxedFilters = this._relaxFilters(explicitFilters);
      const stage2 = await this._runHybridStage({
        explicitFilters: relaxedFilters,
        semanticNeeds,
        rawQuery,
        limit,
        relaxed: true
      });

      if (stage2.length > 0) {
        return {
          results: stage2,
          match_level: 'relaxed'
        };
      }

      const stage3 = await this._runSemanticOnlyStage({
        semanticNeeds,
        rawQuery,
        category: explicitFilters.category,
        limit: Math.min(limit, 3)
      });

      return {
        results: stage3,
        match_level: 'semantic_only'
      };
    } catch (error) {
      // Never bubble search failures to chat route. Fall back to simple Mongo query.
      console.error('SemanticSearchService.smartHybridSearch degraded:', error.message);
      const fallbackResults = await this._fallbackBasicSearch({
        explicitFilters,
        rawQuery,
        semanticNeeds,
        limit
      });

      return {
        results: fallbackResults,
        match_level: 'semantic_only'
      };
    }
  }

  async _fallbackBasicSearch({ explicitFilters = {}, rawQuery = '', semanticNeeds = '', limit = 8 } = {}) {
    try {
      const queryText = String(rawQuery || semanticNeeds || '').trim();
      const mongoFilter = {};

      const extractedKeyword = this._extractKeywordForRegex(queryText, explicitFilters);
      if (extractedKeyword) {
        return this._queryByFlexibleKeyword(extractedKeyword, {
          category: explicitFilters.category || null,
          brand: explicitFilters.brand || null,
          price_min: explicitFilters.minPrice ?? null,
          price_max: explicitFilters.maxPrice ?? null
        }, limit);
      }

      if (explicitFilters.category) {
        mongoFilter.category = { $regex: explicitFilters.category, $options: 'i' };
      }

      if (explicitFilters.brand) {
        mongoFilter.brand = { $regex: explicitFilters.brand, $options: 'i' };
      }

      if (explicitFilters.minPrice !== null || explicitFilters.maxPrice !== null) {
        mongoFilter.price = {};
        if (explicitFilters.minPrice !== null) {
          mongoFilter.price.$gte = explicitFilters.minPrice;
        }
        if (explicitFilters.maxPrice !== null) {
          mongoFilter.price.$lte = explicitFilters.maxPrice;
        }
      }

      if (queryText) {
        mongoFilter.$or = [
          { name: { $regex: queryText, $options: 'i' } },
          { description: { $regex: queryText, $options: 'i' } },
          { category: { $regex: queryText, $options: 'i' } },
          { brand: { $regex: queryText, $options: 'i' } }
        ];
      }

      const products = await Product.find(mongoFilter)
        .select('_id name description category brand color price salePrice image images rating stock specifications')
        .sort({ rating: -1, sold: -1, createdAt: -1 })
        .limit(limit)
        .lean();

      return Array.isArray(products) ? products : [];
    } catch (error) {
      console.error('SemanticSearchService._fallbackBasicSearch failed:', error.message);
      return [];
    }
  }

  _normalizeExplicitFilters(filters = {}) {
    const toStringOrEmpty = (v) => (typeof v === 'string' ? v.trim() : '');
    const toNumberOrNull = (v) => {
      if (v === null || v === undefined || v === '') {
        return null;
      }
      const n = Number(v);
      return Number.isFinite(n) && n > 0 ? n : null;
    };

    let minPrice = toNumberOrNull(filters.minPrice ?? filters.price_min ?? null);
    let maxPrice = toNumberOrNull(filters.maxPrice ?? filters.price_max ?? null);

    if (minPrice !== null && maxPrice !== null && minPrice > maxPrice) {
      const t = minPrice;
      minPrice = maxPrice;
      maxPrice = t;
    }

    return {
      category: toStringOrEmpty(filters.category),
      brand: toStringOrEmpty(filters.brand),
      color: toStringOrEmpty(filters.color),
      minPrice,
      maxPrice
    };
  }

  _relaxFilters(filters = {}) {
    const relaxed = {
      ...filters
    };

    if (relaxed.maxPrice !== null) {
      relaxed.maxPrice = Math.round(relaxed.maxPrice * 1.15);
    }

    // Relax hardest constraints first.
    relaxed.brand = '';
    relaxed.color = '';

    return relaxed;
  }

  async _runHybridStage({ explicitFilters = {}, semanticNeeds = '', rawQuery = '', limit = 8, relaxed = false } = {}) {
    const semanticText = [semanticNeeds, rawQuery].filter(Boolean).join(' ').trim();
    let vector = null;

    if (semanticText) {
      try {
        vector = await EmbeddingService.embedText(semanticText);
      } catch (error) {
        vector = null;
      }
    }

    const atlasFilter = this._buildAtlasFilterFromExplicit(explicitFilters);

    const shouldClauses = [];
    if (semanticText) {
      shouldClauses.push({
        text: {
          path: ['name', 'description', 'category', 'brand', 'specifications'],
          query: semanticText,
          score: { boost: { value: relaxed ? 2 : 3 } }
        }
      });
    }

    if (Array.isArray(vector) && vector.length > 0) {
      shouldClauses.push({
        near: {
          path: this.vectorPath,
          origin: vector,
          pivot: 1,
          score: { boost: { value: relaxed ? 3 : 2 } }
        }
      });
    }

    if (shouldClauses.length === 0) {
      shouldClauses.push({
        text: {
          path: ['name', 'description'],
          query: rawQuery || semanticNeeds || '*'
        }
      });
    }

    const pipeline = [
      {
        $search: {
          index: this.searchIndex,
          compound: {
            filter: atlasFilter,
            should: shouldClauses,
            minimumShouldMatch: 1
          }
        }
      },
      {
        $project: {
          _id: 1,
          name: 1,
          description: 1,
          category: 1,
          brand: 1,
          color: 1,
          price: 1,
          salePrice: 1,
          image: 1,
          images: 1,
          rating: 1,
          stock: 1,
          specifications: 1,
          score: { $meta: 'searchScore' }
        }
      },
      { $limit: limit }
    ];

    return Product.aggregate(pipeline);
  }

  async _runSemanticOnlyStage({ semanticNeeds = '', rawQuery = '', category = '', limit = 3 } = {}) {
    const semanticText = [semanticNeeds, rawQuery, category].filter(Boolean).join(' ').trim();
    let vector = null;

    if (semanticText) {
      try {
        vector = await EmbeddingService.embedText(semanticText);
      } catch (error) {
        vector = null;
      }
    }

    const filter = [
      {
        range: {
          path: 'stock',
          gt: 0
        }
      }
    ];

    const should = [];
    if (category) {
      should.push({
        text: {
          path: ['category', 'name', 'description'],
          query: category,
          score: { boost: { value: 2 } }
        }
      });
    }

    if (semanticText) {
      should.push({
        text: {
          path: ['name', 'description', 'specifications', 'category'],
          query: semanticText,
          score: { boost: { value: 3 } }
        }
      });
    }

    if (Array.isArray(vector) && vector.length > 0) {
      should.push({
        near: {
          path: this.vectorPath,
          origin: vector,
          pivot: 1,
          score: { boost: { value: 3 } }
        }
      });
    }

    if (should.length === 0) {
      should.push({
        text: {
          path: ['name', 'description'],
          query: '*'
        }
      });
    }

    return Product.aggregate([
      {
        $search: {
          index: this.searchIndex,
          compound: {
            filter,
            should,
            minimumShouldMatch: 1
          }
        }
      },
      {
        $project: {
          _id: 1,
          name: 1,
          description: 1,
          category: 1,
          brand: 1,
          color: 1,
          price: 1,
          salePrice: 1,
          image: 1,
          images: 1,
          rating: 1,
          stock: 1,
          specifications: 1,
          score: { $meta: 'searchScore' }
        }
      },
      { $limit: limit }
    ]);
  }

  _buildAtlasFilterFromExplicit(filters = {}) {
    const clauses = [
      {
        range: {
          path: 'stock',
          gt: 0
        }
      }
    ];

    if (filters.category) {
      clauses.push({
        text: {
          path: 'category',
          query: filters.category
        }
      });
    }

    if (filters.brand) {
      clauses.push({
        text: {
          path: 'brand',
          query: filters.brand
        }
      });
    }

    if (filters.color) {
      clauses.push({
        text: {
          path: ['color', 'specifications.color', 'name', 'description'],
          query: filters.color
        }
      });
    }

    if (filters.minPrice !== null || filters.maxPrice !== null) {
      const range = { path: 'price' };
      if (filters.minPrice !== null) {
        range.gte = filters.minPrice;
      }
      if (filters.maxPrice !== null) {
        range.lte = filters.maxPrice;
      }
      clauses.push({ range });
    }

    return clauses;
  }

  _hasStrictFilters(filters = {}) {
    return Boolean(
      filters.color
      || filters.brand
      || filters.price_min !== null
      || filters.price_max !== null
    );
  }

  _extractCategoryHint(keyword = '') {
    const text = String(keyword || '').toLowerCase();
    if (!text.trim()) {
      return null;
    }

    const map = [
      { key: 'laptop', pattern: /(laptop|notebook)/i },
      { key: 'tai nghe', pattern: /(tai\s*nghe|headphone|earphone)/i },
      { key: 'chuot', pattern: /(chuột|chuot|mouse)/i },
      { key: 'ban phim', pattern: /(bàn\s*phím|ban\s*phim|keyboard)/i },
      { key: 'man hinh', pattern: /(màn\s*hình|man\s*hinh|monitor)/i },
      { key: 'ram', pattern: /\bram\b/i },
      { key: 'ssd', pattern: /\bssd\b/i },
      { key: 'hdd', pattern: /\bhdd\b/i },
      { key: 'cpu', pattern: /\bcpu\b|intel\s*core|ryzen/i },
      { key: 'vga', pattern: /\bvga\b|gpu|rtx|gtx|radeon/i },
      { key: 'pc', pattern: /\bpc\b|desktop|máy\s*tính\s*(?:để\s*)?bàn|may\s*tinh\s*(?:de\s*)?ban/i },
      { key: 'ghe', pattern: /(?:\s|^)(ghế|ghe|chair)(?:\s|$)/i }
    ];

    const found = map.find((item) => item.pattern.test(text));
    return found ? found.key : null;
  }

  async _fetchFeaturedByCategory(category, limit = 5) {
    const safeLimit = Math.max(3, Math.min(Number(limit) || 5, 5));

    const products = await Product.aggregate([
      {
        $match: {
          stock: { $gt: 0 },
          category: { $regex: String(category), $options: 'i' }
        }
      },
      {
        $addFields: {
          _popularityScore: {
            $add: [
              { $ifNull: ['$sold', 0] },
              { $ifNull: ['$purchaseCount', 0] },
              { $multiply: [{ $ifNull: ['$rating', 0] }, 100] },
              { $ifNull: ['$reviewCount', 0] }
            ]
          }
        }
      },
      { $sort: { _popularityScore: -1, rating: -1, createdAt: -1 } },
      {
        $project: {
          _id: 1,
          name: 1,
          description: 1,
          category: 1,
          brand: 1,
          color: 1,
          price: 1,
          salePrice: 1,
          image: 1,
          images: 1,
          rating: 1,
          stock: 1,
          specifications: 1
        }
      },
      { $limit: safeLimit }
    ]);

    return products;
  }

  async _fetchNearestPriceProducts({ category = null, targetPrice = null, limit = 3 } = {}) {
    if (!Number.isFinite(Number(targetPrice))) {
      return [];
    }

    const safeTarget = Number(targetPrice);
    const safeLimit = Math.max(1, Math.min(Number(limit) || 3, 5));
    const match = {
      stock: { $gt: 0 }
    };

    if (category) {
      match.category = { $regex: String(category), $options: 'i' };
    }

    const products = await Product.aggregate([
      { $match: match },
      {
        $addFields: {
          _effectivePrice: {
            $ifNull: ['$salePrice', '$price']
          }
        }
      },
      {
        $addFields: {
          _priceDistance: {
            $abs: {
              $subtract: ['$_effectivePrice', safeTarget]
            }
          }
        }
      },
      { $sort: { _priceDistance: 1, rating: -1, createdAt: -1 } },
      {
        $project: {
          _id: 1,
          name: 1,
          description: 1,
          category: 1,
          brand: 1,
          color: 1,
          price: 1,
          salePrice: 1,
          image: 1,
          images: 1,
          rating: 1,
          stock: 1,
          specifications: 1
        }
      },
      { $limit: safeLimit }
    ]);

    return products;
  }

  /**
   * Compatibility wrapper for existing callers.
   */
  async searchWithMetadataFilters(query, options = {}) {
    const { limit = 10, category = null, filters = {} } = options;
    const merged = {
      ...filters,
      category: category || filters.category || null
    };

    return this.searchProducts({
      keyword: query,
      vector: null,
      filters: merged,
      limit
    });
  }

  _normalizeFilters(filters = {}) {
    const toNullableString = (value) => {
      if (typeof value !== 'string') return null;
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : null;
    };

    const toNullableNumber = (value) => {
      if (value === null || value === undefined || value === '') return null;
      const n = Number(value);
      return Number.isFinite(n) && n > 0 ? n : null;
    };

    let min = toNullableNumber(filters.price_min ?? filters.minPrice ?? null);
    let max = toNullableNumber(filters.price_max ?? filters.maxPrice ?? null);

    if (min !== null && max !== null && min > max) {
      const tmp = min;
      min = max;
      max = tmp;
    }

    return {
      category: toNullableString(filters.category),
      color: toNullableString(filters.color),
      brand: toNullableString(filters.brand),
      price_min: min,
      price_max: max
    };
  }

  _extractKeywordForRegex(rawKeyword = '', filters = {}) {
    const preferred = String(filters?.category || '').trim();
    if (preferred) {
      return preferred;
    }

    const query = String(rawKeyword || '').trim();
    if (!query) {
      return '';
    }

    const stopWords = new Set([
      'tu', 'van', 'tư', 'vấn', 'tim', 'tìm', 'kiem', 'kiếm', 'mua', 'cho', 'toi', 'tôi',
      'can', 'cần', 'muon', 'muốn', 'shop', 'giup', 'giúp', 'voi', 'với', 've', 'về'
    ]);

    const tokens = query
      .split(/\s+/)
      .map((t) => t.trim())
      .filter((t) => t.length > 1 && !stopWords.has(t.toLowerCase()));

    if (tokens.length === 0) {
      return query;
    }

    // Keep the full meaningful phrase (not only the last token) to avoid
    // matching by brand-only words such as "MSI".
    return tokens.join(' ');
  }

  async _queryByFlexibleKeyword(extractedKeyword, filters = {}, limit = 10) {
    const keywordText = String(extractedKeyword || '').trim();
    if (!keywordText) {
      return [];
    }

    const safeLimit = Math.max(1, Number(limit) || 10);
    const minPrice = filters.price_min ?? filters.minPrice ?? null;
    const maxPrice = filters.price_max ?? filters.maxPrice ?? null;
    const baseQuery = {};

    if (filters.brand) {
      baseQuery.brand = { $regex: String(filters.brand), $options: 'i' };
    }

    if (minPrice !== null || maxPrice !== null) {
      baseQuery.price = {};
      if (minPrice !== null) {
        baseQuery.price.$gte = Number(minPrice);
      }
      if (maxPrice !== null) {
        baseQuery.price.$lte = Number(maxPrice);
      }
    }

    const canonicalCategory = this._extractCategoryHint(filters.category || keywordText);
    const categoryRegex = canonicalCategory ? this._buildCoreCategoryRegex(canonicalCategory) : null;

    const searchTokens = keywordText
      .split(/\s+/)
      .map((token) => token.trim())
      .filter((token) => token.length > 1);

    const categoryTokens = this._categoryAliasTokens(canonicalCategory);
    const meaningfulTokens = searchTokens.filter((token) => !categoryTokens.has(token.toLowerCase()));

    // Phrase-first: for multi-word intent (e.g., "laptop msi"), require phrase in name/category/brand.
    const phraseRegex = new RegExp(this._escapeRegex(keywordText), 'i');
    const phraseQuery = {
      ...baseQuery,
      $or: [
        { name: phraseRegex },
        { category: phraseRegex },
        { brand: phraseRegex }
      ]
    };

    if (categoryRegex) {
      phraseQuery.category = categoryRegex;
    }

    const phraseResults = await Product.find(phraseQuery)
      .select('_id name description category brand color price salePrice image images rating stock specifications sold createdAt')
      .sort({ rating: -1, sold: -1, createdAt: -1 })
      .limit(safeLimit)
      .lean();

    if (phraseResults.length > 0) {
      return phraseResults;
    }

    // AND token matching: every token must appear in at least one searchable field.
    const andClauses = meaningfulTokens.map((token) => {
      const tokenRegex = new RegExp(this._escapeRegex(token), 'i');
      return {
        $or: [
          { name: tokenRegex },
          { description: tokenRegex },
          { brand: tokenRegex },
          { category: tokenRegex }
        ]
      };
    });

    const strictAndQuery = {
      ...baseQuery,
      ...(andClauses.length > 0 ? { $and: andClauses } : {})
    };

    if (categoryRegex) {
      strictAndQuery.category = categoryRegex;
    }

    const strictAndResults = await Product.find(strictAndQuery)
      .select('_id name description category brand color price salePrice image images rating stock specifications sold createdAt')
      .sort({ rating: -1, sold: -1, createdAt: -1 })
      .limit(safeLimit)
      .lean();

    if (strictAndResults.length > 0) {
      return strictAndResults;
    }

    // Step 1: for core categories (e.g., laptop/pc), prefer category-first matching to avoid accessory noise.
    if (categoryRegex) {
      const categoryOnlyQuery = {
        ...baseQuery,
        category: categoryRegex
      };

      const strictCategoryResults = await Product.find(categoryOnlyQuery)
        .select('_id name description category brand color price salePrice image images rating stock specifications sold createdAt')
        .sort({ rating: -1, sold: -1, createdAt: -1 })
        .limit(safeLimit)
        .lean();

      if (strictCategoryResults.length > 0) {
        return strictCategoryResults;
      }
    }

    // Final fallback: keep broad behavior but still avoid cross-category drift when category is inferred.
    const keywordRegex = new RegExp(this._escapeRegex(keywordText), 'i');
    const query = {
      ...baseQuery
    };
    query.$or = [{ category: keywordRegex }, { name: keywordRegex }];

    if (categoryRegex) {
      query.category = categoryRegex;
    }

    const broadResults = await Product.find(query)
      .select('_id name description category brand color price salePrice image images rating stock specifications sold createdAt')
      .sort({ rating: -1, sold: -1, createdAt: -1 })
      .limit(safeLimit * 2)
      .lean();

    if (!canonicalCategory) {
      return broadResults.slice(0, safeLimit);
    }

    const filtered = broadResults.filter((item) => {
      const categoryText = String(item?.category || '').toLowerCase();
      const nameText = String(item?.name || '').toLowerCase();

      if (canonicalCategory === 'laptop') {
        const isLikelyAccessory = /(de tan nhiet|gia do|stand|coolpad|phu kien|tui|balo|sac|chuot|ban phim)/i.test(nameText);
        const isLaptopCategory = /(laptop|notebook)/i.test(categoryText);
        return isLaptopCategory && !isLikelyAccessory;
      }

      return true;
    });

    return (filtered.length > 0 ? filtered : broadResults).slice(0, safeLimit);
  }

  _escapeRegex(input = '') {
    return String(input).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  _categoryAliasTokens(canonicalCategory = null) {
    const aliases = {
      laptop: ['laptop', 'notebook'],
      chuot: ['chuot', 'chuột', 'mouse'],
      'ban phim': ['ban', 'phim', 'bàn', 'phím', 'keyboard'],
      'man hinh': ['man', 'hinh', 'màn', 'hình', 'monitor'],
      ram: ['ram'],
      ssd: ['ssd'],
      hdd: ['hdd'],
      cpu: ['cpu', 'intel', 'core', 'ryzen'],
      vga: ['vga', 'gpu', 'rtx', 'gtx', 'radeon'],
      pc: ['pc', 'desktop'],
      'tai nghe': ['tai', 'nghe', 'headphone', 'earphone'],
      ghe: ['ghe', 'ghế', 'chair']
    };

    return new Set((aliases[canonicalCategory] || []).map((item) => item.toLowerCase()));
  }

  _buildCoreCategoryRegex(canonicalCategory = '') {
    switch (canonicalCategory) {
      case 'laptop':
        return /^(laptop|notebook)/i;
      case 'pc':
        return /^(pc|desktop|may\s*tinh\s*ban|máy\s*tính\s*bàn)/i;
      case 'man hinh':
        return /^(man\s*hinh|màn\s*hình|monitor)/i;
      case 'chuot':
        return /^(chuot|chuột|mouse)/i;
      case 'ban phim':
        return /^(ban\s*phim|bàn\s*phím|keyboard)/i;
      case 'tai nghe':
        return /^(tai\s*nghe|headphone|earphone)/i;
      case 'ghe':
        return /^(ghe|ghế|chair)/i;
      default:
        return new RegExp('^' + canonicalCategory, 'i');
    }
  }

  _buildAtlasFilter(filters) {
    const clauses = [
      {
        range: {
          path: 'stock',
          gt: 0
        }
      }
    ];

    if (filters.category) {
      clauses.push({
        text: {
          path: 'category',
          query: filters.category
        }
      });
    }

    if (filters.color) {
      clauses.push({
        text: {
          path: ['color', 'specifications.color', 'name', 'description'],
          query: filters.color
        }
      });
    }

    if (filters.brand) {
      clauses.push({
        text: {
          path: 'brand',
          query: filters.brand
        }
      });
    }

    if (filters.price_min !== null || filters.price_max !== null) {
      const range = {
        path: 'price'
      };

      if (filters.price_min !== null) {
        range.gte = filters.price_min;
      }
      if (filters.price_max !== null) {
        range.lte = filters.price_max;
      }

      clauses.push({ range });
    }

    return clauses;
  }

  _buildHybridSearchStage({ keyword, vector, filter, limit }) {
    const hasKeyword = typeof keyword === 'string' && keyword.trim().length > 0;
    const hasVector = Array.isArray(vector) && vector.length > 0;

    const shouldClauses = [];

    if (hasKeyword) {
      shouldClauses.push({
        text: {
          path: ['name', 'description', 'category', 'brand', 'specifications'],
          query: keyword,
          score: { boost: { value: 3 } }
        }
      });
    }

    if (hasVector) {
      shouldClauses.push({
        near: {
          path: this.vectorPath,
          origin: vector,
          pivot: 1,
          score: { boost: { value: 2 } }
        }
      });
    }

    if (shouldClauses.length === 0) {
      shouldClauses.push({
        text: {
          path: ['name', 'description'],
          query: '*'
        }
      });
    }

    return {
      $search: {
        index: this.searchIndex,
        compound: {
          filter,
          should: shouldClauses,
          minimumShouldMatch: 1
        }
      }
    };
  }
}

module.exports = new SemanticSearchService();
