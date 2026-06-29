/**
 * ComparisonAgent — So sánh sản phẩm chi tiết
 *
 * Chức năng:
 * - Tìm sản phẩm từ tên/model trong câu hỏi
 * - Tạo bảng so sánh markdown với các tiêu chí quan trọng
 * - Phân tích ưu điểm, nhược điểm từng sản phẩm
 * - Đưa ra khuyến nghị theo nhu cầu cụ thể
 *
 * @module services/ai/agents/ComparisonAgent
 */

const Product = require('../../../models/Product');

// Tiêu chí so sánh theo danh mục
const COMPARISON_CRITERIA = {
  laptop: ['CPU', 'RAM', 'Storage', 'GPU', 'Display', 'Battery', 'Weight', 'Price'],
  cpu: ['Cores', 'Threads', 'Base Clock', 'Boost Clock', 'TDP', 'Socket', 'Cache'],
  gpu: ['VRAM', 'Memory Type', 'TDP', 'Performance', 'DLSS', 'Ray Tracing'],
  ram: ['Capacity', 'Speed', 'Type', 'Latency', 'Voltage'],
  ssd: ['Capacity', 'Interface', 'Read Speed', 'Write Speed', 'Form Factor'],
  monitor: ['Resolution', 'Refresh Rate', 'Panel Type', 'Response Time', 'Color Gamut', 'Size'],
  default: ['Brand', 'Price', 'Rating', 'Stock']
};

class ComparisonAgent {
  constructor() {
    this.name = 'ComparisonAgent';
    this.description = 'So sánh nhiều sản phẩm với phân tích chi tiết';
  }

  /**
   * Thực thi so sánh sản phẩm
   * @param {Object} params
   * @returns {Promise<Object>}
   */
  async execute({ message = '', history = [], context = {} } = {}) {
    try {
      // 1) Trích xuất tên sản phẩm cần so sánh
      const productNames = this._extractProductNames(message);

      // 2) Tìm sản phẩm từ database
      const foundProducts = await this._findProducts(productNames, message);

      // 3) Không đủ sản phẩm để so sánh
      if (foundProducts.length < 2) {
        const notFound = productNames.filter(name =>
          !foundProducts.some(p => this._normalize(p.name).includes(this._normalize(name)))
        );

        return {
          type: 'compare',
          answer: this._buildNotEnoughProductsAnswer(foundProducts, notFound, productNames),
          products: foundProducts.map(p => this._formatProduct(p)),
          sources: [],
          quickReplies: [
            { title: '🔍 Gửi tên model cụ thể', payload: 'Model A vs Model B' },
            { title: '💰 So sánh theo ngân sách', payload: 'So sánh laptop gaming 20-25 triệu' }
          ]
        };
      }

      // 4) Xác định tiêu chí so sánh theo danh mục
      const category = this._detectCategory(foundProducts);
      const criteria = COMPARISON_CRITERIA[category] || COMPARISON_CRITERIA.default;

      // 5) Sinh câu trả lời so sánh
      const answer = await this._generateComparison(message, foundProducts, criteria, history);

      return {
        type: 'compare',
        answer,
        products: foundProducts.map(p => this._formatProduct(p)),
        sources: foundProducts.map(p => ({
          type: 'product',
          id: p._id?.toString(),
          title: p.name
        })),
        quickReplies: this._buildFollowUpReplies(foundProducts, message)
      };
    } catch (error) {
      console.error('[ComparisonAgent] execute error:', error.message);
      return {
        type: 'compare',
        answer: 'Mình gặp sự cố khi so sánh. Bạn thử gửi tên model cụ thể hơn nhé!',
        products: [],
        sources: []
      };
    }
  }

  /**
   * Trích xuất tên sản phẩm từ câu hỏi
   * "so sánh RTX 4060 và RTX 4070" → ["RTX 4060", "RTX 4070"]
   * @private
   */
  _extractProductNames(message = '') {
    let text = String(message || '');

    // Loại bỏ cụm mở đầu
    text = text.replace(
      /^(so sánh|so sanh|compare|giúp tôi so sánh|hãy so sánh|bạn so sánh|cho tôi so sánh)\s*/i,
      ''
    );

    // Tách bằng các từ nối so sánh
    const parts = text
      .split(/\bvs\.?\b|\bvà\b|\bvoi\b|\bwith\b|\bgiữa\b|\bgiua\b|,|;/i)
      .map(p => p.replace(/[?!.]/g, '').trim())
      .filter(p => p.length > 1);

    return parts.slice(0, 4); // Tối đa 4 sản phẩm
  }

  /**
   * Tìm sản phẩm từ database theo tên gợi ý
   * @private
   */
  async _findProducts(names = [], originalMessage = '') {
    const found = [];
    const seen = new Set();

    for (const name of names) {
      if (!name || name.length < 2) continue;

      // Tìm kiếm match-all-words
      const terms = name.trim().split(/\s+/).filter(t => t.length > 0);
      if (terms.length === 0) continue;

      const andConditions = terms.map(t => ({
        name: { $regex: t, $options: 'i' }
      }));

      const product = await Product.findOne({ $and: andConditions }).lean();

      if (product) {
        const key = product._id.toString();
        if (!seen.has(key)) {
          seen.add(key);
          found.push(product);
        }
      }
    }

    // Nếu chỉ tìm được 1 hoặc 0, thử tìm thêm từ toàn bộ message
    if (found.length < 2 && originalMessage) {
      const extraTerms = this._extractKeyTerms(originalMessage);
      const extraQuery = {
        $or: extraTerms.map(t => ({ name: { $regex: t, $options: 'i' } }))
      };

      const extras = await Product.find(extraQuery)
        .sort({ rating: -1 })
        .limit(4)
        .lean();

      for (const p of extras) {
        const key = p._id.toString();
        if (!seen.has(key)) {
          seen.add(key);
          found.push(p);
        }
        if (found.length >= 4) break;
      }
    }

    return found.slice(0, 4);
  }

  /**
   * Trích xuất từ khóa quan trọng từ message
   * @private
   */
  _extractKeyTerms(message = '') {
    const normalized = this._normalize(message);
    // Tìm model numbers, brand names
    const MODEL_PATTERN = /\b([a-z]+\s*\d+[a-z]*\d*|[a-z]+\s+[a-z]+\s*\d+)\b/gi;
    const matches = [];
    let match;
    while ((match = MODEL_PATTERN.exec(normalized)) !== null) {
      if (match[0].length > 3) matches.push(match[0]);
    }
    return matches.slice(0, 6);
  }

  /**
   * Phát hiện danh mục sản phẩm từ danh sách
   * @private
   */
  _detectCategory(products = []) {
    if (products.length === 0) return 'default';
    const category = String(products[0].category || '').toLowerCase();

    if (category.includes('laptop')) return 'laptop';
    if (category.includes('cpu') || category.includes('vi xu ly')) return 'cpu';
    if (category.includes('gpu') || category.includes('vga') || category.includes('card')) return 'gpu';
    if (category.includes('ram')) return 'ram';
    if (category.includes('ssd') || category.includes('hdd')) return 'ssd';
    if (category.includes('monitor') || category.includes('man hinh')) return 'monitor';
    return 'default';
  }

  /**
   * Sinh bảng so sánh bằng Gemini
   * @private
   */
  async _generateComparison(message, products = [], criteria = [], history = []) {
    try {
      const { callGemini } = require('../../../src/utils/geminiClient');

      const productData = products.map(p => {
        const specs = p.specifications instanceof Map
          ? Object.fromEntries(p.specifications)
          : (p.specifications || {});
        return {
          name: p.name,
          brand: p.brand,
          price: this._formatPrice(p.salePrice || p.price),
          rating: p.rating,
          stock: p.stock,
          specifications: specs
        };
      });

      const historyText = history.slice(-4)
        .map(h => `${h.role === 'user' ? 'Khách' : 'AI'}: ${h.content}`)
        .join('\n');

      const prompt = [
        'Bạn là chuyên gia phân tích sản phẩm công nghệ của TechStore.',
        '',
        `YÊU CẦU: "${message}"`,
        '',
        'LỊCH SỬ HỘI THOẠI:',
        historyText || 'Không có.',
        '',
        'DỮ LIỆU SẢN PHẨM:',
        JSON.stringify(productData, null, 2),
        '',
        `TIÊU CHÍ SO SÁNH: ${criteria.join(', ')}`,
        '',
        'HƯỚNG DẪN:',
        '1. Tạo bảng markdown so sánh với các cột: Tiêu chí | ' + products.map(p => p.name.slice(0, 25)).join(' | '),
        '2. Dùng dữ liệu specifications đã cung cấp, không tự suy diễn',
        '3. Nếu thiếu thông số → ghi "Chưa có dữ liệu"',
        '4. Sau bảng: viết nhận xét ngắn và khuyến nghị theo nhu cầu',
        '5. Format: ⭐ cho sản phẩm tốt hơn ở từng tiêu chí',
        '6. Kết luận dứt khoát: sản phẩm nào phù hợp với ai',
        '7. Tiếng Việt, chuyên nghiệp'
      ].join('\n');

      return String(await callGemini(prompt) || '').trim();
    } catch (error) {
      console.warn('[ComparisonAgent] Gemini failed:', error.message);
      return this._buildFallbackComparison(products);
    }
  }

  /**
   * Fallback: tạo bảng so sánh cơ bản không dùng AI
   * @private
   */
  _buildFallbackComparison(products = []) {
    const headers = ['Tiêu chí', ...products.map(p => p.name.slice(0, 20))];
    const separator = headers.map(() => '---').join(' | ');
    const rows = [
      ['Giá', ...products.map(p => this._formatPrice(p.salePrice || p.price))],
      ['Thương hiệu', ...products.map(p => p.brand || 'N/A')],
      ['Danh mục', ...products.map(p => p.category || 'N/A')],
      ['Đánh giá', ...products.map(p => `${p.rating || 0}/5 ⭐`)],
      ['Tồn kho', ...products.map(p => `${p.stock || 0} cái`)]
    ];

    const table = [
      `| ${headers.join(' | ')} |`,
      `| ${separator} |`,
      ...rows.map(row => `| ${row.join(' | ')} |`)
    ].join('\n');

    return `${table}\n\n*Ghi chú: Vui lòng xem chi tiết từng sản phẩm để biết thêm thông số kỹ thuật.*`;
  }

  _buildNotEnoughProductsAnswer(found = [], notFound = [], requested = []) {
    if (found.length === 0) {
      return `Mình chưa tìm thấy sản phẩm nào để so sánh.\n\nBạn hãy thử:\n- Gửi tên model cụ thể (VD: "RTX 4060 vs RTX 4070")\n- Hoặc gửi tên 2 laptop/linh kiện muốn so sánh`;
    }

    const foundNames = found.map(p => `**${p.name}**`).join(', ');
    const notFoundText = notFound.length > 0 ? notFound.map(n => `"${n}"`).join(', ') : '';

    return [
      `Mình chỉ tìm thấy ${foundNames} trong kho.`,
      notFoundText ? `Không tìm thấy: ${notFoundText}` : '',
      '',
      'Để so sánh chính xác, bạn hãy gửi tên model đầy đủ hoặc thêm thương hiệu (VD: "ASUS TUF Gaming A15 vs MSI Pulse 15").'
    ].filter(Boolean).join('\n');
  }

  _buildFollowUpReplies(products = [], message = '') {
    const replies = [];
    if (products.length > 0) {
      replies.push({
        title: `🛒 Xem chi tiết ${products[0]?.name?.slice(0, 20)}`,
        payload: `Chi tiết sản phẩm ${products[0]?.name}`
      });
    }
    replies.push({ title: '💡 Gợi ý theo ngân sách', payload: 'Tư vấn theo ngân sách' });
    return replies;
  }

  _formatProduct(p = {}) {
    return {
      id: p._id?.toString() || '',
      name: p.name || 'Sản phẩm',
      brand: p.brand || '',
      category: p.category || '',
      price: Number(p.salePrice || p.price || 0),
      stock: Number(p.stock || 0),
      rating: Number(p.rating || 0),
      imageUrl: p.imageUrl || p.image || (Array.isArray(p.images) ? p.images[0] : null) || null,
      productUrl: p._id ? `/product/${p._id}` : null,
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
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(Number(price));
  }
}

module.exports = new ComparisonAgent();
