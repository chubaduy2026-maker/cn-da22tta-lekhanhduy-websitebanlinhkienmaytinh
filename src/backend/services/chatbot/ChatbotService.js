const { ChatGoogleGenerativeAI } = require('@langchain/google-genai');
const { ChatPromptTemplate } = require('@langchain/core/prompts');
const { StringOutputParser } = require('@langchain/core/output_parsers');

const Product = require('../../models/Product');
const SemanticSearchService = require('../ai/SemanticSearchService');
const ChromaRetrievalService = require('./ChromaRetrievalService');
const { CHATBOT_SYSTEM_PROMPT, buildChatbotPrompt } = require('./prompts');
const { detectIntent, PRODUCT_RELATED_INTENTS } = require('../../src/utils/chatbotIntent');

class ChatbotService {
  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY || '';
    this.modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
    this.temperature = Number(process.env.CHATBOT_TEMPERATURE || 0.2);
    this.maxOutputTokens = Number(process.env.CHATBOT_MAX_OUTPUT_TOKENS || 900);
    this.llm = null;
    this.answerChain = null;
    this._initializeModel();
  }

  _initializeModel() {
    if (!this.apiKey) {
      return;
    }

    this.llm = new ChatGoogleGenerativeAI({
      apiKey: this.apiKey,
      model: this.modelName,
      temperature: this.temperature,
      maxOutputTokens: this.maxOutputTokens,
      systemInstruction: CHATBOT_SYSTEM_PROMPT
    });

    const prompt = ChatPromptTemplate.fromMessages([
      ['system', CHATBOT_SYSTEM_PROMPT],
      ['human', '{input}']
    ]);

    this.answerChain = prompt.pipe(this.llm).pipe(new StringOutputParser());
  }

  async handleMessage({ message, sessionId = '', history = [], userId = null } = {}) {
    const question = String(message || '').trim();
    if (!question) {
      throw new Error('message is required');
    }

    // Use rule-based intent detector to route early and avoid unnecessary RAG/DB/LLM calls
    let intent = 'tech_knowledge';
    try {
      intent = detectIntent(question);
    } catch (err) {
      console.warn('Intent detection failed:', err && err.message);
    }

    console.log('USER MESSAGE:', question);
    console.log('DETECTED INTENT:', intent);

    if (intent === 'greeting') {
      return {
        answer: 'Chào bạn, mình là trợ lý AI của TechStore. Mình có thể tư vấn sản phẩm, so sánh laptop/PC/linh kiện và giải đáp kiến thức công nghệ cho bạn.',
        type: 'greeting',
        products: [],
        sources: []
      };
    }

    if (intent === 'thanks') {
      return {
        answer: 'Không có gì nha. Bạn cần tư vấn thêm sản phẩm, so sánh cấu hình hay hỏi kiến thức công nghệ thì cứ nhắn mình.',
        type: 'thanks',
        products: [],
        sources: []
      };
    }

    if (intent === 'goodbye') {
      return {
        answer: 'Tạm biệt bạn. Khi nào cần tư vấn sản phẩm công nghệ thì quay lại TechStore nhé.',
        type: 'goodbye',
        products: [],
        sources: []
      };
    }

    if (intent === 'smalltalk') {
      return {
        answer: 'Mình là trợ lý AI của TechStore. Mình có thể giúp bạn tư vấn sản phẩm theo nhu cầu, tìm laptop/PC/linh kiện phù hợp, so sánh sản phẩm và giải thích kiến thức công nghệ như RAM, SSD, CPU, GPU.',
        type: 'smalltalk',
        products: [],
        sources: []
      };
    }

    // For ALL product-related intents, proceed to search handlers
    const isCompare = intent === 'compare' || intent === 'product_compare';
    if (PRODUCT_RELATED_INTENTS.has(intent)) {
      const classification = this._classify(question);
      const productCandidates = await this._searchProducts(question, classification);
      const knowledge = await ChromaRetrievalService.searchKnowledge(question, isCompare ? 4 : 3);

      if (!productCandidates.length) {
        return {
          type: intent,
          answer: this._buildNoResultAnswer(question, intent),
          products: [],
          sources: this._buildSources({ knowledge }),
          quickReplies: this._quickRepliesForNoResults(question, intent)
        };
      }

      const products = isCompare
        ? this._resolveComparisonProducts(question, productCandidates)
        : productCandidates;

      const answer = await this._generateAnswer({
        type: isCompare ? 'comparison' : 'product_search',
        question,
        products,
        knowledge,
        history
      });

      return {
        type: isCompare ? 'comparison' : 'product_search',
        answer,
        products,
        sources: this._buildSources({ products, knowledge })
      };
    }

    // tech_knowledge -> call RAG/Chroma + Gemini
    if (intent === 'tech_knowledge') {
      const knowledge = await ChromaRetrievalService.searchKnowledge(question, 5);

      // Log Gemini diagnostics when we are about to invoke LLM for knowledge answers
      console.log('GEMINI_MODEL:', this.modelName);
      console.log('HAS_GEMINI_KEY:', !!this.apiKey);

      const answer = await this._generateAnswer({
        type: 'knowledge',
        question,
        products: [],
        knowledge,
        history
      });

      const fallbackText = this._fallbackAnswer({ type: 'knowledge', products: [], knowledge });
      const isFallback = String(answer || '').trim() === String(fallbackText || '').trim();

      return {
        type: 'knowledge',
        answer,
        products: [],
        sources: this._buildSources({ knowledge }),
        quickReplies: isFallback ? this._quickRepliesForFallback('knowledge', question, knowledge) : [],
        sessionId,
        userId
      };
    }

    // Fallback
    return {
      type: 'out_of_scope',
      answer: 'Mình là trợ lý AI của TechStore, mình chỉ hỗ trợ tư vấn sản phẩm công nghệ, so sánh sản phẩm và giải đáp kiến thức công nghệ.',
      products: [],
      sources: []
    };
  }

  _quickRepliesForNoResults(question, intent) {
    const base = [];
    if (intent === 'compare') {
      base.push(
        { title: 'So sánh theo giá', payload: 'So sánh theo giá' },
        { title: 'So sánh theo hiệu năng', payload: 'So sánh theo hiệu năng' },
        { title: 'Gửi tên 2 sản phẩm (A vs B)', payload: 'Gửi tên 2 sản phẩm: A vs B' }
      );
      return base;
    }

    // product_search or recommendation
    base.push(
      { title: 'Gợi ý theo ngân sách (ví dụ: 10 triệu)', payload: 'Ngân sách: 10 triệu' },
      { title: 'Gợi ý theo thương hiệu (ví dụ: Asus)', payload: 'Thương hiệu: Asus' },
      { title: 'Ví dụ sản phẩm (ví dụ: Laptop Asus Vivobook 14)', payload: 'Ví dụ: Laptop Asus Vivobook 14' }
    );

    return base;
  }

  _quickRepliesForFallback(type, question, knowledge) {
    // Generic quick replies to help user clarify when LLM/RAG fallback occurs
    const replies = [
      { title: 'Gửi tên model cụ thể (ví dụ: Asus X, MSI Y)', payload: 'Ví dụ: Asus Vivobook 14 vs MSI GF63' },
      { title: 'Cho biết ngân sách (ví dụ: 10 triệu)', payload: 'Ngân sách: 10 triệu' },
      { title: 'So sánh theo: giá', payload: 'So sánh theo giá' }
    ];

    return replies;
  }

  _classify(question) {
    const normalized = this._normalize(question);

    if (this._isUnsafe(normalized)) {
      return { type: 'out_of_scope', confidence: 1 };
    }

    if (this._hasComparisonIntent(normalized)) {
      return { type: 'comparison', confidence: 0.95, filters: this._buildSearchFilters(question) };
    }

    if (this._hasProductIntent(normalized)) {
      const recommendation = this._hasRecommendationIntent(normalized);
      return {
        type: recommendation ? 'recommendation' : 'product_search',
        confidence: 0.88,
        filters: this._buildSearchFilters(question)
      };
    }

    return { type: 'knowledge', confidence: 0.8 };
  }

  _normalize(text) {
    return String(text || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  _isUnsafe(normalized) {
    const patterns = [
      /ma tuy|thuoc no|vu khi|hack|crack|ddos|phishing|trojan|virus|ransomware/i,
      /tu tu|tu sat|giet|khung bo|khieu dam|khiêu dam/i
    ];

    return patterns.some((pattern) => pattern.test(normalized));
  }

  _hasComparisonIntent(normalized) {
    return /(so sanh|compare|vs\.?|versus|khac nhau giua|nen chon giua|diem khac|doi chieu)/i.test(normalized);
  }

  _hasRecommendationIntent(normalized) {
    return /(goi y|tu van|nen mua|chon|phu hop|de xuat|build|cau hinh|ngan sach|budget|di hoc|van phong|gaming|lap trinh|do hoa)/i.test(normalized);
  }

  _hasProductIntent(normalized) {
    const productPattern = /(laptop|pc|may tinh|chuot|ban phim|man hinh|tai nghe|loa|ram|ssd|hdd|cpu|gpu|card do hoa|mainboard|nguon|case|router|wifi|camera|may in|tablet|smartphone)/i;
    const buyingPattern = /(mua|gia|bao nhieu|re|duoi|tren|toi da|toi thieu|phu hop|so sanh|goi y|tu van|tim|search|con hang|co ban|xem|cho xem|show)/i;
    // Only need ONE of the two patterns — a user saying "laptop dell" still wants products
    return productPattern.test(normalized) || buyingPattern.test(normalized);
  }

  _buildSearchFilters(question) {
    const filters = {};

    const budget = this._extractBudgetRange(question);
    if (budget.minPrice !== null) {
      filters.minPrice = budget.minPrice;
    }
    if (budget.maxPrice !== null) {
      filters.maxPrice = budget.maxPrice;
    }

    return filters;
  }

  _extractBudgetRange(question) {
    const normalized = this._normalize(question);
    const result = { minPrice: null, maxPrice: null };

    const betweenMatch = normalized.match(/(?:tu|from)\s*(\d+[\d.,]*)\s*(trieu|tr|m|k|nghin|nghin dong|d)?\s*(?:den|toi|to|-)\s*(\d+[\d.,]*)\s*(trieu|tr|m|k|nghin|nghin dong|d)?/i);
    if (betweenMatch) {
      result.minPrice = this._parseMoneyToVnd(`${betweenMatch[1]} ${betweenMatch[2] || ''}`);
      result.maxPrice = this._parseMoneyToVnd(`${betweenMatch[3]} ${betweenMatch[4] || ''}`);
      return result;
    }

    const underMatch = normalized.match(/(?:duoi|<|<=|toi da|max)\s*(\d+[\d.,]*)\s*(trieu|tr|m|k|nghin|nghin dong|d)?/i);
    if (underMatch) {
      result.maxPrice = this._parseMoneyToVnd(`${underMatch[1]} ${underMatch[2] || ''}`);
      return result;
    }

    const overMatch = normalized.match(/(?:tren|>=|>|tu|toi thieu|min)\s*(\d+[\d.,]*)\s*(trieu|tr|m|k|nghin|nghin dong|d)?/i);
    if (overMatch) {
      result.minPrice = this._parseMoneyToVnd(`${overMatch[1]} ${overMatch[2] || ''}`);
    }

    return result;
  }

  _parseMoneyToVnd(text) {
    const normalized = this._normalize(text);
    const match = normalized.match(/(\d+[\d.,]*)\s*(trieu|tr|m|k|nghin|nghin dong|d)?/i);
    if (!match) {
      return null;
    }

    const number = Number(String(match[1]).replace(/,/g, '').replace(/\./g, ''));
    if (!Number.isFinite(number)) {
      return null;
    }

    const unit = String(match[2] || '').toLowerCase();
    if (unit === 'k' || unit.includes('nghin')) {
      return number * 1000;
    }

    if (unit === 'tr' || unit === 'trieu' || unit === 'm') {
      return number * 1000000;
    }

    return number;
  }

  async _searchProducts(question, classification) {
    const filters = classification.filters || {};
    let mongoProducts = [];

    try {
      const searchResults = await SemanticSearchService.smartHybridSearch({
        raw_query: question,
        semantic_needs: question,
        explicit_filters: filters
      }, {
        limit: 8
      });
      mongoProducts = Array.isArray(searchResults.results) ? searchResults.results : [];
    } catch (err) {
      console.warn('smartHybridSearch failed, using direct fallback:', err.message);
    }

    // Direct MongoDB regex fallback — matches the same query logic the website uses
    if (mongoProducts.length === 0) {
      try {
        mongoProducts = await this._directMongoSearch(question, filters, 8);
      } catch (err) {
        console.warn('Direct MongoDB fallback failed:', err.message);
      }
    }

    let chromaProducts = [];
    try {
      chromaProducts = await ChromaRetrievalService.searchProducts(question, 5);
    } catch (err) {
      console.warn('ChromaRetrievalService.searchProducts failed:', err.message);
    }

    return this._mergeProducts(mongoProducts, chromaProducts);
  }

  /**
   * Direct MongoDB search fallback — uses the same regex-on-name/brand/category/description
   * approach that the website product listing route uses.
   */
  async _directMongoSearch(question, filters = {}, limit = 8) {
    const searchTerms = String(question || '').trim().split(/\s+/).filter(t => t.length > 1);
    // Remove common Vietnamese stop words that don't help search
    const stopWords = new Set([
      'tu', 'van', 'tim', 'kiem', 'mua', 'cho', 'toi', 'can', 'muon',
      'shop', 'giup', 'voi', 've', 'co', 'khong', 'nao', 'la', 'gi',
      'ban', 'hay', 'cua', 'trong', 'vao', 'ra', 'den', 'duoc', 'bao',
      'nhieu', 'gia', 'con', 'hang', 'xem', 'san', 'pham', 'the'
    ]);
    const meaningfulTerms = searchTerms.filter(t => !stopWords.has(t.toLowerCase()));
    const termsToUse = meaningfulTerms.length > 0 ? meaningfulTerms : searchTerms;

    if (termsToUse.length === 0) return [];

    // Build $or conditions: each term must match at least one field
    const orConditions = termsToUse.map(term => {
      const regex = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      return {
        $or: [
          { name: regex },
          { brand: regex },
          { category: regex },
          { description: regex }
        ]
      };
    });

    const query = { $and: orConditions };

    // Apply price filters if present
    if (filters.minPrice || filters.maxPrice) {
      const priceFilter = {};
      if (filters.minPrice) priceFilter.$gte = filters.minPrice;
      if (filters.maxPrice) priceFilter.$lte = filters.maxPrice;
      query.price = priceFilter;
    }

    const products = await Product.find(query)
      .select('_id name description category brand price salePrice image imageUrl images stock specifications rating')
      .sort({ rating: -1, createdAt: -1 })
      .limit(limit)
      .lean();

    return Array.isArray(products) ? products : [];
  }

  _mergeProducts(primary = [], secondary = []) {
    const seen = new Set();
    const merged = [];

    for (const item of [...(Array.isArray(primary) ? primary : []), ...(Array.isArray(secondary) ? secondary : [])]) {
      if (!item) {
        continue;
      }

      const normalized = this._normalize(item.name || item.title || item.productName || item.id || '');
      const key = `${String(item.id || item._id || '').toLowerCase()}::${normalized}`;
      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      merged.push(this._normalizeProduct(item));
    }

    return merged.slice(0, 8);
  }

  _normalizeProduct(product = {}) {
    const id = String(product.id || product._id || product.product || '').trim();
    const images = Array.isArray(product.images) ? product.images : [];
    const specifications = product.specifications && typeof product.specifications === 'object'
      ? Object.fromEntries(Object.entries(product.specifications).slice(0, 12))
      : (product.metadata?.specifications || {});

    return {
      id,
      name: product.name || product.title || product.productName || 'Sản phẩm',
      brand: product.brand || product.metadata?.brand || '',
      category: product.category || product.metadata?.category || '',
      price: Number(product.price ?? product.salePrice ?? product.metadata?.price ?? 0) || 0,
      stock: Number(product.stock ?? product.metadata?.stock ?? 0) || 0,
      description: product.description || product.content || '',
      imageUrl: product.imageUrl || product.image || images[0] || product.metadata?.imageUrl || null,
      score: Number(product.score ?? product.similarity ?? 0) || 0,
      source: product.source || 'mongo',
      specifications
    };
  }

  _resolveComparisonProducts(question, products = []) {
    const fragments = this._extractComparisonFragments(question);
    if (fragments.length < 2) {
      return products.slice(0, 4);
    }

    const resolved = [];
    for (const fragment of fragments) {
      const match = this._findBestMatch(fragment, products);
      if (match && !resolved.some((item) => item.id === match.id)) {
        resolved.push(match);
      }
    }

    if (resolved.length >= 2) {
      return resolved;
    }

    return products.slice(0, 4);
  }

  _extractComparisonFragments(question) {
    return String(question || '')
      .replace(/^(so sanh|compare|cho toi|giup toi)/i, '')
      .split(/\b(?:vs|va|và|giua|giữa|với|vs\.|so với)\b/i)
      .map((part) => part.replace(/[?!.]/g, '').trim())
      .filter((part) => part.length > 2)
      .slice(0, 4);
  }

  _findBestMatch(fragment, products) {
    const normalizedFragment = this._normalize(fragment);
    let best = null;
    let bestScore = 0;

    for (const product of products) {
      const haystack = this._normalize([
        product.name,
        product.brand,
        product.category,
        product.description,
        JSON.stringify(product.specifications || {})
      ].join(' '));

      let score = 0;
      if (haystack.includes(normalizedFragment)) {
        score = 1;
      } else {
        const fragmentParts = normalizedFragment.split(/\s+/).filter(Boolean);
        if (fragmentParts.length > 0) {
          const matchedWords = fragmentParts.filter((word) => haystack.includes(word)).length;
          score = matchedWords / fragmentParts.length;
        }
      }

      if (score > bestScore) {
        bestScore = score;
        best = product;
      }
    }

    return bestScore > 0 ? best : null;
  }

  async _generateAnswer({ type, question, products = [], knowledge = [], history = [] }) {
    const promptInput = buildChatbotPrompt({
      type,
      question,
      products,
      knowledge,
      history
    });

    if (!this.answerChain) {
      return this._fallbackAnswer({ type, products, knowledge });
    }

    try {
      const answer = await this.answerChain.invoke({ input: promptInput });
      return String(answer || '').trim() || this._fallbackAnswer({ type, products, knowledge });
    } catch (error) {
      console.warn('Chatbot Gemini generation failed:', error.message);
      return this._fallbackAnswer({ type, products, knowledge });
    }
  }

  _fallbackAnswer({ type, products = [], knowledge = [] }) {
    if (type === 'comparison') {
      return products.length
        ? 'Mình đã tìm được một số sản phẩm liên quan. Bạn muốn so sánh theo tiêu chí nào: giá, hiệu năng, hay tính năng?'
        : 'Mình chưa tìm thấy đủ dữ liệu để so sánh. Vui lòng gửi tên 2 sản phẩm cụ thể (ví dụ: "A vs B") hoặc cho biết tiêu chí so sánh (giá/hiệu năng/thiết kế).';
    }

    if (type === 'recommendation' || type === 'product_search') {
      return products.length
        ? 'Mình đã tìm được các sản phẩm phù hợp. Bạn muốn lọc thêm theo giá, thương hiệu, hay so sánh chi tiết nào không?'
        : 'Mình chưa tìm thấy sản phẩm phù hợp. Bạn cho biết ngân sách, thương hiệu, hoặc ví dụ sản phẩm muốn tham khảo nhé.';
    }

    if (knowledge.length > 0) {
      return 'Mình đã tìm được ngữ cảnh liên quan trong kho kiến thức. Bạn xem phần trả lời ngắn gọn bên dưới nhé.';
    }

    return 'Mình chưa có đủ dữ liệu để trả lời chính xác. Bạn có thể nêu rõ hơn (ví dụ: tên model, ngân sách, hoặc tiêu chí bạn muốn so sánh)?';
  }

  _buildNoResultAnswer(question, type) {
    if (type === 'comparison') {
      return 'Mình chưa tìm thấy đủ sản phẩm để so sánh. Vui lòng gửi tên 2 sản phẩm cụ thể (ví dụ: "Laptop Asus X vs MSI Y") hoặc cho biết tiêu chí so sánh (giá/hiệu năng).';
    }

    return `Mình chưa tìm thấy sản phẩm phù hợp với yêu cầu "${question}". Bạn thử đổi ngân sách, thương hiệu hoặc mô tả nhu cầu cụ thể hơn nhé.`;
  }

  _buildSources({ products = [], knowledge = [] } = {}) {
    const productSources = (Array.isArray(products) ? products : []).map((product) => ({
      type: 'product',
      id: product.id,
      title: product.name,
      source: product.source || 'mongo',
      score: product.score || 0
    }));

    const knowledgeSources = (Array.isArray(knowledge) ? knowledge : []).map((item) => ({
      type: 'knowledge',
      id: item.id,
      title: item.title || item.source,
      source: item.source,
      category: item.category || '',
      score: item.score || 0
    }));

    return [...productSources, ...knowledgeSources];
  }
}

module.exports = new ChatbotService();