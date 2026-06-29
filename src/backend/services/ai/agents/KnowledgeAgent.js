/**
 * KnowledgeAgent — Trả lời kiến thức công nghệ
 *
 * Chức năng:
 * - Xử lý câu hỏi kiến thức công nghệ (CPU, RAM, SSD, GPU, mạng, v.v.)
 * - Kết hợp ChromaDB knowledge base và Gemini để trả lời
 * - Xử lý lời chào hỏi, cảm ơn, tạm biệt
 * - Từ chối câu hỏi ngoài phạm vi công nghệ
 * - Đề xuất sản phẩm liên quan sau khi giải thích kiến thức
 *
 * @module services/ai/agents/KnowledgeAgent
 */

const KnowledgeDocument = require('../../../models/KnowledgeDocument');

// Phản hồi mặc định cho các intent cơ bản (không cần AI)
const INSTANT_RESPONSES = {
  greeting: [
    'Chào bạn! 👋 Mình là TechBot — trợ lý AI của TechStore.',
    'Mình có thể giúp bạn:\n- 🔍 Tìm kiếm sản phẩm công nghệ\n- ⚖️ So sánh laptop, linh kiện\n- 🖥️ Xây dựng cấu hình PC\n- 📚 Giải thích kiến thức công nghệ',
    '\nBạn cần hỗ trợ gì hôm nay?'
  ],
  thanks: [
    'Không có gì! 😊 Mình rất vui khi được giúp bạn.',
    '\nNếu cần tư vấn thêm về sản phẩm, so sánh cấu hình hay hỏi kiến thức công nghệ, cứ nhắn mình nhé!'
  ],
  goodbye: [
    'Tạm biệt bạn! 👋',
    '\nKhi nào cần tư vấn sản phẩm công nghệ thì quay lại TechStore nhé.',
    'Chúc bạn một ngày tốt lành! ☀️'
  ],
  out_of_scope: [
    'Mình là trợ lý công nghệ của TechStore, chuyên hỗ trợ về:\n- Sản phẩm công nghệ\n- Kiến thức kỹ thuật\n- Tư vấn mua sắm',
    '\nMình chưa được đào tạo để trả lời chủ đề này. Bạn có muốn hỏi về công nghệ không? 💡'
  ]
};

// Danh sách chủ đề kiến thức có thể trả lời
const KNOWLEDGE_TOPICS = [
  'cpu', 'vi xu ly', 'processor', 'intel', 'amd', 'ryzen',
  'ram', 'ddr4', 'ddr5', 'memory', 'bo nho',
  'ssd', 'hdd', 'nvme', 'pcie', 'sata', 'o cung',
  'gpu', 'vga', 'rtx', 'gtx', 'radeon', 'card do hoa',
  'mainboard', 'motherboard', 'bo mach chu', 'socket',
  'psu', 'nguon may tinh', 'watt',
  'man hinh', 'monitor', 'hz', 'ips', 'oled', 'va panel',
  'wifi', 'bluetooth', 'lan', 'ethernet',
  'usb', 'hdmi', 'displayport', 'thunderbolt',
  'windows', 'linux', 'macos',
  'overclock', 'oc', 'tan nhiet', 'cooling',
  'pin', 'battery', 'sac', 'wh',
  'la gi', 'khac nhau', 'co nen', 'tot hon', 'nhanh hon'
];

class KnowledgeAgent {
  constructor() {
    this.name = 'KnowledgeAgent';
    this.description = 'Trả lời kiến thức công nghệ và xử lý hội thoại';
  }

  /**
   * Thực thi trả lời kiến thức
   * @param {Object} params
   * @returns {Promise<Object>}
   */
  async execute({ message = '', intent = 'knowledge', history = [], context = {} } = {}) {
    try {
      // Xử lý các intent cơ bản ngay lập tức
      if (['greeting', 'thanks', 'goodbye', 'smalltalk'].includes(intent)) {
        return this._handleInstantIntent(intent, message);
      }

      if (intent === 'out_of_scope') {
        return {
          type: 'out_of_scope',
          answer: INSTANT_RESPONSES.out_of_scope.join(''),
          products: [],
          sources: [],
          quickReplies: [
            { title: '🔍 Tìm laptop gaming', payload: 'Tìm laptop gaming dưới 20 triệu' },
            { title: '📚 Hỏi về SSD', payload: 'SSD NVMe là gì?' },
            { title: '🖥️ Build PC gaming', payload: 'Build PC gaming 30 triệu' }
          ]
        };
      }

      // Kiểm tra có phải câu hỏi kiến thức không
      const isTechQuestion = this._isTechKnowledgeQuestion(message);

      // 1) Tìm kiếm tài liệu từ knowledge base
      const knowledgeDocs = await this._searchKnowledge(message);

      // 2) Sinh câu trả lời
      const answer = await this._generateAnswer(message, knowledgeDocs, history, isTechQuestion);

      // 3) Tìm sản phẩm liên quan (nếu có)
      const relatedProducts = isTechQuestion
        ? await this._findRelatedProducts(message, knowledgeDocs)
        : [];

      return {
        type: 'knowledge',
        answer,
        products: relatedProducts,
        sources: knowledgeDocs.map(doc => ({
          type: 'knowledge',
          id: doc._id?.toString(),
          title: doc.title || doc.source,
          source: doc.source,
          category: doc.category,
          score: doc.similarity || 0
        })),
        quickReplies: this._buildFollowUpReplies(message, relatedProducts)
      };
    } catch (error) {
      console.error('[KnowledgeAgent] execute error:', error.message);
      return {
        type: 'knowledge',
        answer: 'Mình gặp sự cố khi tra cứu kiến thức. Bạn hãy thử hỏi lại sau nhé!',
        products: [],
        sources: []
      };
    }
  }

  /**
   * Xử lý intent cơ bản không cần AI
   * @private
   */
  _handleInstantIntent(intent, message = '') {
    const responses = {
      greeting: INSTANT_RESPONSES.greeting.join(''),
      thanks: INSTANT_RESPONSES.thanks.join(''),
      goodbye: INSTANT_RESPONSES.goodbye.join(''),
      smalltalk: [
        'Mình là TechBot — trợ lý AI của TechStore! 🤖',
        '\nMình chuyên hỗ trợ:',
        '\n- 🔍 Tìm kiếm & tư vấn sản phẩm công nghệ',
        '\n- ⚖️ So sánh laptop, PC, linh kiện',
        '\n- 🖥️ Build cấu hình PC theo ngân sách',
        '\n- 📚 Giải thích kiến thức kỹ thuật (CPU, RAM, SSD, GPU...)',
        '\n\nBạn cần mình giúp gì?'
      ].join('')
    };

    const quickRepliesByIntent = {
      greeting: [
        { title: '🔍 Tìm laptop gaming', payload: 'Laptop gaming dưới 25 triệu' },
        { title: '📚 Hỏi về SSD NVMe', payload: 'SSD NVMe là gì?' },
        { title: '🖥️ Build PC 30 triệu', payload: 'Build PC gaming 30 triệu' }
      ],
      thanks: [
        { title: '🔍 Tìm sản phẩm khác', payload: 'Gợi ý sản phẩm cho mình' }
      ],
      goodbye: [],
      smalltalk: [
        { title: '💡 Bắt đầu tư vấn', payload: 'Gợi ý laptop cho mình' }
      ]
    };

    return {
      type: intent,
      answer: responses[intent] || responses.smalltalk,
      products: [],
      sources: [],
      quickReplies: quickRepliesByIntent[intent] || []
    };
  }

  /**
   * Kiểm tra có phải câu hỏi kiến thức công nghệ không
   * @private
   */
  _isTechKnowledgeQuestion(message = '') {
    const normalized = this._normalize(message);
    return KNOWLEDGE_TOPICS.some(topic => normalized.includes(topic));
  }

  /**
   * Tìm kiếm tài liệu từ MongoDB knowledge base
   * @private
   */
  async _searchKnowledge(message = '') {
    try {
      // Full-text search trên knowledge documents
      const docs = await KnowledgeDocument.find({
        $text: { $search: message },
        status: 'completed'
      })
        .select('title text source category metadata')
        .sort({ score: { $meta: 'textScore' } })
        .limit(5)
        .lean();

      if (docs.length > 0) return docs;

      // Fallback: regex search nếu text index chưa sẵn sàng
      const keywords = message.split(/\s+/).filter(k => k.length > 2).slice(0, 4);
      if (keywords.length === 0) return [];

      const regexQuery = {
        $or: keywords.map(kw => ({
          $or: [
            { title: { $regex: kw, $options: 'i' } },
            { text: { $regex: kw, $options: 'i' } }
          ]
        })),
        status: 'completed'
      };

      return await KnowledgeDocument.find(regexQuery)
        .select('title text source category metadata')
        .limit(3)
        .lean();
    } catch (error) {
      console.warn('[KnowledgeAgent] Knowledge search failed:', error.message);
      return [];
    }
  }

  /**
   * Sinh câu trả lời bằng Gemini
   * @private
   */
  async _generateAnswer(message, knowledgeDocs = [], history = [], isTechQuestion = true) {
    try {
      const { callGemini } = require('../../../src/utils/geminiClient');

      const contextText = knowledgeDocs.length > 0
        ? knowledgeDocs.map((doc, i) =>
            `[${i + 1}] ${doc.title || doc.source}: ${String(doc.text || '').slice(0, 500)}`
          ).join('\n\n')
        : 'Không có tài liệu tham khảo trong kho kiến thức.';

      const historyText = history.slice(-4)
        .map(h => `${h.role === 'user' ? 'Khách' : 'AI'}: ${h.content}`)
        .join('\n');

      const prompt = [
        'Bạn là chuyên gia công nghệ thân thiện của TechStore.',
        '',
        `CÂU HỎI: "${message}"`,
        '',
        'LỊCH SỬ HỘI THOẠI:',
        historyText || 'Không có.',
        '',
        'NGỮ CẢNH KIẾN THỨC:',
        contextText,
        '',
        'HƯỚNG DẪN TRẢ LỜI:',
        '1. Bắt đầu bằng định nghĩa ngắn gọn, rõ ràng',
        '2. Giải thích chi tiết với ví dụ dễ hiểu (số liệu cụ thể nếu có)',
        '3. Ưu tiên dùng thông tin từ NGỮ CẢNH KIẾN THỨC',
        '4. Nếu không đủ thông tin trong context → dùng kiến thức chung nhưng nói rõ',
        '5. Dùng bảng markdown khi so sánh',
        '6. Không quá 250 từ, tiếng Việt, thân thiện',
        '7. Cuối cùng: gợi ý "Bạn có muốn xem sản phẩm liên quan không?"'
      ].join('\n');

      return String(await callGemini(prompt) || '').trim();
    } catch (error) {
      console.warn('[KnowledgeAgent] Gemini failed:', error.message);
      if (knowledgeDocs.length > 0) {
        return `Dựa trên tài liệu của TechStore:\n\n${String(knowledgeDocs[0].text || '').slice(0, 500)}`;
      }
      return 'Mình chưa tìm thấy đủ thông tin để trả lời chính xác. Bạn có thể hỏi chi tiết hơn không?';
    }
  }

  /**
   * Tìm sản phẩm liên quan đến kiến thức vừa giải thích
   * @private
   */
  async _findRelatedProducts(message = '', knowledgeDocs = []) {
    try {
      const Product = require('../../../models/Product');
      const normalized = this._normalize(message);

      // Xác định loại sản phẩm từ câu hỏi
      const PRODUCT_KEYWORDS = {
        'ssd': 'ssd',
        'ram': 'ram',
        'cpu': 'cpu',
        'gpu': 'vga',
        'man hinh': 'monitor',
        'laptop': 'laptop',
        'tai nghe': 'headset',
        'chuot': 'mouse'
      };

      let category = null;
      for (const [keyword, cat] of Object.entries(PRODUCT_KEYWORDS)) {
        if (normalized.includes(keyword)) {
          category = cat;
          break;
        }
      }

      if (!category) return [];

      const products = await Product.find({
        category: { $regex: category, $options: 'i' },
        stock: { $gt: 0 }
      })
        .sort({ rating: -1 })
        .limit(3)
        .lean();

      return products.map(p => ({
        id: p._id?.toString() || '',
        name: p.name,
        brand: p.brand || '',
        category: p.category || '',
        price: Number(p.salePrice || p.price || 0),
        stock: Number(p.stock || 0),
        imageUrl: p.imageUrl || p.image || null,
        productUrl: p._id ? `/product/${p._id}` : null
      }));
    } catch (error) {
      console.warn('[KnowledgeAgent] Related products search failed:', error.message);
      return [];
    }
  }

  /**
   * Tạo quick replies gợi ý
   * @private
   */
  _buildFollowUpReplies(message = '', products = []) {
    const normalized = this._normalize(message);
    const replies = [];

    if (products.length > 0) {
      replies.push({
        title: `🛒 Xem ${products[0]?.name?.slice(0, 20)}...`,
        payload: `Chi tiết ${products[0]?.name}`
      });
    }

    // Gợi ý câu hỏi liên quan
    if (normalized.includes('ssd')) {
      replies.push({ title: '💾 SSD NVMe vs SATA?', payload: 'SSD NVMe khác SSD SATA thế nào?' });
      replies.push({ title: '🔍 Xem SSD tại TechStore', payload: 'SSD NVMe 1TB dưới 3 triệu' });
    } else if (normalized.includes('ram')) {
      replies.push({ title: '💾 DDR5 vs DDR4?', payload: 'DDR5 khác DDR4 thế nào?' });
      replies.push({ title: '🔍 Xem RAM tại TechStore', payload: 'RAM DDR5 32GB' });
    } else if (normalized.includes('gpu') || normalized.includes('vga')) {
      replies.push({ title: '⚖️ RTX 4060 vs 4070?', payload: 'So sánh RTX 4060 và RTX 4070' });
    } else if (normalized.includes('cpu')) {
      replies.push({ title: '⚖️ Intel vs AMD?', payload: 'Intel i7 khác AMD Ryzen 7 thế nào?' });
    }

    if (replies.length < 2) {
      replies.push({ title: '🔍 Tìm sản phẩm liên quan', payload: `Tìm sản phẩm ${message.slice(0, 20)}` });
    }

    return replies.slice(0, 3);
  }

  _normalize(text = '') {
    return String(text || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }
}

module.exports = new KnowledgeAgent();
