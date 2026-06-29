/**
 * RecommendationAgent — Gợi ý sản phẩm theo nhu cầu
 *
 * Chức năng:
 * - Phân tích nhu cầu người dùng (use-case, ngân sách, ưu tiên)
 * - Gợi ý sản phẩm phù hợp với lý do chi tiết
 * - Hỗ trợ các nhóm nhu cầu: gaming, đồ họa, lập trình, văn phòng, học tập
 * - Cá nhân hóa theo lịch sử hội thoại
 *
 * @module services/ai/agents/RecommendationAgent
 */

const Product = require('../../../models/Product');
const RecommendationService = require('../RecommendationService');

// Tiêu chí quan trọng theo từng use-case
const USE_CASE_CRITERIA = {
  gaming: {
    label: 'Gaming',
    priority: ['gpu', 'cpu', 'ram', 'display_hz'],
    description: 'Ưu tiên GPU mạnh, CPU nhanh, RAM ≥ 16GB, màn hình ≥ 144Hz',
    minRam: 16,
    minDisplayHz: 144,
    keywords: ['gaming', 'game', 'rtx', 'gtx', 'rog', 'tuf gaming', 'raider', 'legion gaming']
  },
  design: {
    label: 'Thiết kế đồ họa',
    priority: ['display_color', 'ram', 'gpu', 'cpu'],
    description: 'Ưu tiên màn hình màu chuẩn (IPS/OLED, ≥95% sRGB), RAM ≥ 16GB',
    minRam: 16,
    displayRequirement: 'IPS or OLED',
    keywords: ['studio', 'pro', 'creator', 'oled', 'color accurate']
  },
  programming: {
    label: 'Lập trình',
    priority: ['ram', 'ssd', 'battery', 'keyboard'],
    description: 'Ưu tiên RAM ≥ 16GB, SSD nhanh ≥ 512GB, pin tốt ≥ 8h, bàn phím thoải mái',
    minRam: 16,
    minSsdGb: 512,
    keywords: ['thinkpad', 'xps', 'matebook', 'vivobook', 'zenbook pro']
  },
  office: {
    label: 'Văn phòng',
    priority: ['battery', 'weight', 'display', 'price'],
    description: 'Ưu tiên pin trâu ≥ 10h, nhẹ ≤ 1.5kg, giá hợp lý',
    maxWeightKg: 1.8,
    keywords: ['ultrabook', 'ultraslim', 'business', 'pro', 'gram', 'swift']
  },
  student: {
    label: 'Học tập',
    priority: ['price', 'battery', 'performance', 'weight'],
    description: 'Cân bằng giá-hiệu năng, pin tốt, nhẹ, dễ mang theo',
    keywords: ['vivobook', 'aspire', 'ideapad', 'inspiron', 'swift']
  }
};

class RecommendationAgent {
  constructor() {
    this.name = 'RecommendationAgent';
    this.description = 'Gợi ý sản phẩm phù hợp theo nhu cầu người dùng';
  }

  /**
   * Thực thi gợi ý sản phẩm
   * @param {Object} params
   * @returns {Promise<Object>}
   */
  async execute({ message = '', history = [], context = {} } = {}) {
    try {
      // 1) Phân tích nhu cầu
      const userNeeds = this._analyzeUserNeeds(message, history);

      // 2) Lấy gợi ý thông minh từ Recommendation Engine mới
      const userId = context.userId;
      const sessionId = context.sessionId;
      const ranked = await RecommendationService.getSmartRecommendations(userId, sessionId, {
        chatbotIntent: userNeeds.useCase,
        searchKeyword: message,
        limit: 5
      });

      // 4) Xử lý không tìm thấy
      if (ranked.length === 0) {
        return {
          type: 'recommendation',
          answer: this._buildClarifyQuestion(userNeeds),
          products: [],
          sources: [],
          quickReplies: this._buildClarifyReplies(userNeeds)
        };
      }

      // 5) Sinh câu trả lời
      const answer = await this._generateRecommendation(message, ranked, userNeeds, history);

      return {
        type: 'recommendation',
        answer,
        products: ranked.slice(0, 5).map(p => this._formatProduct(p)),
        sources: ranked.slice(0, 5).map(p => ({
          type: 'product',
          id: p._id?.toString() || p.id,
          title: p.name,
          score: p.aiMatchScore || p.score || 0
        })),
        quickReplies: this._buildFollowUpReplies(ranked, userNeeds)
      };
    } catch (error) {
      console.error('[RecommendationAgent] execute error:', error.message);
      return {
        type: 'recommendation',
        answer: 'Mình gặp sự cố khi tìm kiếm. Bạn có thể mô tả cụ thể hơn về nhu cầu không?',
        products: [],
        sources: []
      };
    }
  }

  /**
   * Phân tích nhu cầu người dùng từ message + history
   * @private
   */
  _analyzeUserNeeds(message = '', history = []) {
    const normalized = this._normalize(message);
    // Kết hợp với lịch sử để lấy context
    const historyText = history
      .slice(-6)
      .map(h => this._normalize(h.content || ''))
      .join(' ');
    const combinedText = `${normalized} ${historyText}`;

    const needs = {
      useCase: null,
      budget: { min: null, max: null },
      productType: 'laptop', // default
      brand: null,
      specificRequirements: [],
      isVague: false
    };

    // Detect use-case
    for (const [key, criteria] of Object.entries(USE_CASE_CRITERIA)) {
      if (new RegExp(criteria.keywords.join('|'), 'i').test(combinedText) ||
          combinedText.includes(key)) {
        needs.useCase = key;
        break;
      }
    }

    // Detect product type
    if (/(chuot|mouse)/.test(normalized)) needs.productType = 'mouse';
    else if (/(ban phim|keyboard)/.test(normalized)) needs.productType = 'keyboard';
    else if (/(tai nghe|headset)/.test(normalized)) needs.productType = 'headset';
    else if (/(man hinh|monitor)/.test(normalized)) needs.productType = 'monitor';
    else if (/(pc|may ban|desktop)/.test(normalized)) needs.productType = 'pc';
    else needs.productType = 'laptop';

    // Extract budget
    const budgetMatch = normalized.match(/(\d+)\s*(trieu|tr)/i);
    if (budgetMatch) {
      const amount = Number(budgetMatch[1]) * 1_000_000;
      // Nếu "dưới X" → maxPrice, nếu chỉ "X triệu" → maxPrice với tolerance
      if (/duoi|under|toi da/.test(normalized)) {
        needs.budget.max = amount;
      } else {
        needs.budget.max = amount * 1.1; // 10% tolerance
        needs.budget.min = amount * 0.8;
      }
    }

    // Check nếu yêu cầu quá mơ hồ
    needs.isVague = !needs.useCase && !needs.budget.max && !needs.brand;

    return needs;
  }

  /**
   * Tìm sản phẩm phù hợp với nhu cầu
   * @private
   */
  async _findRecommendedProducts(needs = {}) {
    const query = { stock: { $gt: 0 } };

    // Lọc theo loại sản phẩm
    if (needs.productType && needs.productType !== 'pc') {
      query.category = { $regex: needs.productType, $options: 'i' };
    }

    // Lọc theo ngân sách
    if (needs.budget.max) {
      query.price = { ...query.price, $lte: needs.budget.max };
    }
    if (needs.budget.min) {
      query.price = { ...query.price, $gte: needs.budget.min };
    }

    // Thêm từ khóa use-case vào query
    if (needs.useCase && USE_CASE_CRITERIA[needs.useCase]) {
      const keywords = USE_CASE_CRITERIA[needs.useCase].keywords;
      // Thêm OR condition cho keywords
      query.$or = keywords.map(kw => ({
        $or: [
          { name: { $regex: kw, $options: 'i' } },
          { description: { $regex: kw, $options: 'i' } }
        ]
      }));
    }

    const products = await Product.find(query)
      .sort({ rating: -1, reviewCount: -1 })
      .limit(12)
      .lean();

    return products;
  }

  /**
   * Xếp hạng sản phẩm theo độ phù hợp với use-case
   * @private
   */
  _rankProducts(products = [], needs = {}) {
    if (!needs.useCase) return products;

    return products
      .map(p => {
        let score = (p.rating || 0) / 5;
        const specs = p.specifications instanceof Map
          ? Object.fromEntries(p.specifications)
          : (p.specifications || {});
        const specsStr = JSON.stringify(specs).toLowerCase();

        // Thêm điểm theo use-case
        switch (needs.useCase) {
          case 'gaming':
            if (/rtx [34]\d{3}/i.test(specsStr)) score += 0.3;
            if (/16gb|32gb/i.test(specsStr)) score += 0.15;
            if (/144hz|165hz|240hz/i.test(specsStr)) score += 0.15;
            break;
          case 'design':
            if (/oled|ips/i.test(specsStr)) score += 0.25;
            if (/16gb|32gb/i.test(specsStr)) score += 0.15;
            if (/srgb|dci-p3/i.test(specsStr)) score += 0.2;
            break;
          case 'programming':
            if (/16gb|32gb/i.test(specsStr)) score += 0.25;
            if (/512gb|1tb|2tb/i.test(specsStr)) score += 0.15;
            if (/backlit|led keyboard/i.test(specsStr)) score += 0.1;
            break;
          case 'office':
          case 'student':
            if (p.price < 15_000_000) score += 0.2;
            if (/lightweight|thin|slim/i.test(specsStr)) score += 0.15;
            break;
        }

        return { ...p, _relevanceScore: Math.min(score, 1) };
      })
      .sort((a, b) => b._relevanceScore - a._relevanceScore);
  }

  /**
   * Sinh câu trả lời gợi ý bằng Gemini
   * @private
   */
  async _generateRecommendation(message, products = [], needs = {}, history = []) {
    try {
      const { callGemini } = require('../../../src/utils/geminiClient');
      const criteria = needs.useCase ? USE_CASE_CRITERIA[needs.useCase] : null;

      const productList = products
        .slice(0, 5)
        .map((p, i) => {
          const specs = p.specifications instanceof Map
            ? Object.fromEntries(p.specifications)
            : (p.specifications || {});
          const specsStr = Object.entries(specs).slice(0, 6).map(([k, v]) => `${k}: ${v}`).join(' | ');
          const price = this._formatPrice(p.salePrice || p.price);
          const reasonStr = Array.isArray(p.recommendationReasons) ? p.recommendationReasons.join(' ') : (p.recommendationReasons || '');
          return `${i + 1}. ${p.name} — ${price} — Match: ${p.aiMatchScore || 0}% — Lý do đề xuất: ${reasonStr}\n   Specs: ${specsStr}`;
        })
        .join('\n\n');

      const prompt = [
        'Bạn là chuyên viên tư vấn công nghệ thân thiện của TechStore.',
        '',
        `YÊU CẦU NGƯỜI DÙNG: "${message}"`,
        needs.useCase ? `MỤC ĐÍCH SỬ DỤNG: ${criteria?.label || needs.useCase}` : '',
        needs.useCase ? `TIÊU CHÍ QUAN TRỌNG: ${criteria?.description || ''}` : '',
        needs.budget.max ? `NGÂN SÁCH TỐI ĐA: ${this._formatPrice(needs.budget.max)}` : '',
        '',
        'SẢN PHẨM GỢI Ý (đã xếp hạng theo độ phù hợp):',
        productList,
        '',
        'HƯỚNG DẪN:',
        '1. Giới thiệu top 3 sản phẩm phù hợp nhất, giải thích TẠI SAO phù hợp với nhu cầu cụ thể',
        '2. Highlight thông số quan trọng nhất cho use-case đó',
        '3. Đề xuất sản phẩm cụ thể và lý do',
        '4. Hỏi thêm nếu cần clarify (ngân sách, ưu tiên)',
        '5. KHÔNG bịa thông số — chỉ dùng data ở trên',
        '6. Tiếng Việt, thân thiện, ≤ 300 từ'
      ].filter(Boolean).join('\n');

      return String(await callGemini(prompt) || '').trim();
    } catch (error) {
      console.warn('[RecommendationAgent] Gemini failed:', error.message);
      return this._buildFallbackRecommendation(products, needs);
    }
  }

  _buildFallbackRecommendation(products = [], needs = {}) {
    const top = products.slice(0, 3);
    const lines = [
      needs.useCase
        ? `Dựa trên nhu cầu **${USE_CASE_CRITERIA[needs.useCase]?.label || needs.useCase}**, mình gợi ý:\n`
        : 'Dưới đây là một số sản phẩm phù hợp:\n',
      ...top.map((p, i) => `**${i + 1}. ${p.name}** — ${this._formatPrice(p.salePrice || p.price)}`),
      '\nBạn muốn xem thêm thông tin sản phẩm nào không?'
    ];
    return lines.join('\n');
  }

  _buildClarifyQuestion(needs = {}) {
    return [
      'Mình chưa tìm thấy sản phẩm phù hợp. Để tư vấn chính xác hơn, bạn cho biết thêm:',
      '- Ngân sách dự kiến khoảng bao nhiêu?',
      '- Mục đích sử dụng chính (gaming/học tập/văn phòng/đồ họa/lập trình)?',
      '- Thương hiệu nào bạn ưa thích?'
    ].join('\n');
  }

  _buildClarifyReplies(needs = {}) {
    return [
      { title: '💰 Ngân sách dưới 15 triệu', payload: 'Gợi ý laptop dưới 15 triệu' },
      { title: '🎮 Dùng cho gaming', payload: 'Gợi ý laptop gaming' },
      { title: '📚 Dùng cho học tập', payload: 'Gợi ý laptop cho sinh viên' },
      { title: '💼 Dùng cho văn phòng', payload: 'Gợi ý laptop văn phòng' }
    ];
  }

  _buildFollowUpReplies(products = [], needs = {}) {
    const replies = [];
    if (products.length >= 2) {
      replies.push({
        title: `⚖️ So sánh top 2`,
        payload: `So sánh ${products[0]?.name} và ${products[1]?.name}`
      });
    }
    if (needs.useCase === 'gaming') {
      replies.push({ title: '🖥️ Build PC gaming', payload: 'Build PC gaming cùng ngân sách' });
    }
    replies.push({ title: '📊 Tìm theo ngân sách khác', payload: 'Tìm sản phẩm ngân sách khác' });
    return replies;
  }

  _formatProduct(p = {}) {
    return {
      id: p._id?.toString() || p.id || '',
      name: p.name || 'Sản phẩm',
      brand: p.brand || '',
      category: p.category || '',
      price: Number(p.salePrice || p.price || 0),
      stock: Number(p.stock || 0),
      rating: Number(p.rating || 0),
      imageUrl: p.imageUrl || p.image || (Array.isArray(p.images) ? p.images[0] : null) || null,
      productUrl: p._id ? `/product/${p._id}` : (p.id ? `/product/${p.id}` : null),
      aiMatchScore: p.aiMatchScore || null,
      recommendationReasons: p.recommendationReasons || []
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
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(Number(price));
  }
}

module.exports = new RecommendationAgent();
