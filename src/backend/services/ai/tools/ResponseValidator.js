/**
 * ResponseValidator — Kiểm tra chống trả lời bậy (Anti-hallucination) và đồng bộ sản phẩm
 */
class ResponseValidator {
  constructor() {
    this.name = 'ResponseValidator';
  }

  /**
   * Kiểm tra câu trả lời trước khi gửi về user
   * @param {Object} data 
   * @param {string} data.text - Câu trả lời AI sinh ra
   * @param {Array} data.products - Danh sách sản phẩm đính kèm
   * @param {string} data.intent - Intent của cuộc gọi
   * @param {Object} data.context - SearchContext của lượt chat hiện tại
   * @returns {Object} { isValid: boolean, text: string, products: Array }
   */
  validate({ text = '', products = [], intent = 'knowledge', context = {} }) {
    let correctedText = text;
    let isValid = true;
    let filteredProducts = Array.isArray(products) ? [...products] : [];

    const nonProductIntents = ['tech_knowledge', 'tech_compare', 'advice_explanation', 'general_question', 'greeting', 'thanks', 'goodbye', 'farewell'];
    if (nonProductIntents.includes(intent)) {
      if (filteredProducts.length > 0) {
        console.error(`[ResponseValidator] Invalid products for non-product intent: ${intent}`);
        filteredProducts = [];
      }
    }

    const isProductIntent = [
      'product_search',
      'product_query',
      'product_advice',
      'pc_build',
      'product_compare',
      'product_price_stock',
      'recommendation_request'
    ].includes(intent);

    // 1. Chống lỗi "không đủ dữ liệu" với câu hỏi kiến thức công nghệ phổ biến
    if (['tech_knowledge', 'tech_compare', 'advice_explanation'].includes(intent) && this._isSayingNotEnoughData(correctedText)) {
      correctedText = 'Theo kiến thức của mình, đây là một thuật ngữ công nghệ quan trọng. Tuy nhiên hệ thống hiện đang quá tải nên không thể giải thích chi tiết ngay lúc này. Bạn vui lòng thử tra cứu Google hoặc hỏi lại sau nhé!';
      isValid = false;
    }

    // 2. Chống trả lời sai ngữ cảnh (VD: hỏi SSD lại trả lời bảo trì)
    if (['tech_knowledge', 'tech_compare', 'advice_explanation'].includes(intent) || isProductIntent) {
      if (this._detectsUnrelatedContext(correctedText)) {
        correctedText = 'Có vẻ như mình vừa tìm nhầm tài liệu không liên quan đến câu hỏi của bạn. Để đảm bảo thông tin chính xác, bạn có thể mô tả cụ thể hơn sản phẩm bạn đang tìm không?';
        isValid = false;
      }
    }

    // 3. Đảm bảo so sánh không bị lạc đề sang hướng dẫn sửa chữa
    if (intent === 'product_compare' && correctedText.toLowerCase().includes('hướng dẫn tháo lắp')) {
      correctedText = 'Mình xin lỗi, hiện tại tính năng so sánh đang gặp chút trục trặc. Bạn vui lòng gửi lại tên 2 sản phẩm để mình làm lại bảng so sánh nhé.';
      isValid = false;
    }

    // 4. Chống rò rỉ prompt hệ thống (system prompt leakage protection)
    if (this._detectsSystemPromptLeakage(correctedText)) {
      correctedText = 'Mình không thể chia sẻ hoặc thảo luận về chỉ thị hệ thống (system prompt). Nếu bạn cần tư vấn sản phẩm, tìm kiếm cấu hình hay giải đáp thắc mắc về chính sách của TechStore, mình luôn sẵn sàng hỗ trợ nhé!';
      isValid = false;
    }

    // 5. Kiểm tra stale context contamination (nhiễm bẩn lịch sử cũ)
    if (context && Object.keys(context).length > 0) {
      if (this._detectsStaleContextContamination(correctedText, context)) {
        correctedText = this._cleanContaminatedText(correctedText, context);
        isValid = false;
      }
    }

    // 6. Kiểm tra đồng bộ message-products
    if (context && isProductIntent && filteredProducts.length > 0) {
      const norm = (s) => String(s || '').toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .trim();

      // A. Lọc sản phẩm không phù hợp với danh mục/thương hiệu trong SearchContext
      filteredProducts = filteredProducts.filter(p => {
        // Kiểm tra danh mục
        if (context.category && p.category) {
          const normContextCat = norm(context.category);
          const normProductCat = norm(p.category);

          // Trường hợp đặc biệt: Webcam nằm trong danh mục Phụ kiện
          if (normContextCat === 'phu kien' && (norm(p.name).includes('webcam') || norm(p.name).includes('camera'))) {
            return true;
          }

          if (normContextCat !== normProductCat && !normProductCat.includes(normContextCat)) {
            return false; // Mismatch category
          }
        }

        // Kiểm tra thương hiệu
        if (context.brand && p.brand) {
          if (norm(p.brand) !== norm(context.brand)) {
            return false; // Mismatch brand
          }
        }

        return true;
      });

      // B. Kiểm tra forbidden mismatch giữa các danh mục nhạy cảm
      // Ví dụ: context.category là Màn hình thì KHÔNG được có Webcam hay Chuột
      const categoryMapping = {
        'Màn hình': ['webcam', 'camera', 'chuột', 'bàn phím', 'laptop'],
        'Tản nhiệt': ['laptop', 'vga', 'gpu', 'ram', 'ổ cứng', 'ssd', 'hdd', 'màn hình'],
        'Ổ cứng': ['ghế', 'bàn', 'case', 'loa', 'tản nhiệt'],
        'Laptop': ['webcam', 'camera', 'ghế', 'bàn', 'tản nhiệt']
      };

      if (context.category && categoryMapping[context.category]) {
        const forbiddenKeywords = categoryMapping[context.category];
        filteredProducts = filteredProducts.filter(p => {
          const lowerName = norm(p.name);
          return !forbiddenKeywords.some(kw => lowerName.includes(norm(kw)));
        });
      }

      // C. Nếu sau khi lọc, danh sách sản phẩm bị rỗng -> trả về phản hồi fallback sạch
      // Product cards must match the current-turn budget, even if an upstream
      // agent accidentally attached broader results.
      const minPrice = context.priceMin !== null && context.priceMin !== undefined
        ? Number(context.priceMin)
        : null;
      let maxPrice = context.priceMax !== null && context.priceMax !== undefined
        ? Number(context.priceMax)
        : null;

      if (
        intent === 'pc_build'
        && context.targetPrice
        && (!context.priceMode || ['target', 'approx'].includes(context.priceMode))
      ) {
        maxPrice = Number(context.targetPrice);
      }

      if (Number.isFinite(minPrice) || Number.isFinite(maxPrice)) {
        const beforeBudgetProducts = [...filteredProducts];
        filteredProducts = filteredProducts.filter(p => {
          const price = Number(p.salePrice || p.price || 0);
          if (!Number.isFinite(price) || price <= 0) return false;
          if (Number.isFinite(minPrice) && price < minPrice) return false;
          if (Number.isFinite(maxPrice) && price > maxPrice) return false;
          return true;
        });
        const remainingIds = new Set(filteredProducts.map(p => String(p.id || p._id || p.name)));
        const removedProducts = beforeBudgetProducts
          .filter(p => !remainingIds.has(String(p.id || p._id || p.name)))
          .map(p => ({
            name: p.name,
            price: Number(p.salePrice || p.price || 0)
          }));
        console.log('[BUDGET VALIDATION]', {
          priceMax: Number.isFinite(maxPrice) ? maxPrice : null,
          priceMin: Number.isFinite(minPrice) ? minPrice : null,
          beforeCount: beforeBudgetProducts.length,
          afterCount: filteredProducts.length,
          removedProducts
        });
      }

      if (filteredProducts.length === 0 && products.length > 0) {
        isValid = false;
        if (intent === 'pc_build') {
          correctedText = 'Hiện TechStore chưa có bộ PC phù hợp trong ngân sách này. Bạn có muốn mình gợi ý cấu hình linh kiện để tự build không?';
          return {
            isValid,
            text: correctedText,
            products: filteredProducts
          };
        }
        correctedText = `TechStore hiện tại chưa tìm thấy sản phẩm ${context.category || ''} ${context.brand || ''} nào phù hợp với yêu cầu của bạn. Bạn vui lòng thử tìm kiếm khác nhé!`;
      }
    }

    return {
      isValid,
      text: correctedText,
      products: filteredProducts
    };
  }

  _isSayingNotEnoughData(text) {
    const removeAccents = (str) => {
      return String(str || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'D');
    };
    const normalizedText = removeAccents(text);
    return /(khong|chua)\s*(co\s*)?(du\s*)?(du\s*lieu|thong\s*tin|tai\s*lieu)|khong\s*tim\s*thay|chua\s*ho\s*tro/i.test(normalizedText);
  }

  _detectsUnrelatedContext(text) {
    const t = text.toLowerCase();
    const irrelevantKeywords = [
      'vệ sinh quạt', 'tháo ốc', 'cách lau màn hình', 'bảo trì định kỳ',
      'cách tra keo tản nhiệt', 'thay pin cmos'
    ];
    let matchCount = 0;
    for (const kw of irrelevantKeywords) {
      if (t.includes(kw)) matchCount++;
    }
    return matchCount >= 2;
  }

  _detectsSystemPromptLeakage(text) {
    const t = text.toLowerCase();
    const leakageKeywords = [
      'prompt hệ thống', 'system prompt', 'system instruction', 'chỉ thị hệ thống',
      'quy tắc bắt buộc:', 'tuyệt đối không bịa', 'dưới đây là prompt', 'từ vựng ép buộc',
      'lệnh tử hình', 'kịch bản xử lý kết quả', 'intent_system_prompt',
      'chatbot_system_prompt', 'gemini_system_instruction'
    ];

    for (const kw of leakageKeywords) {
      if (t.includes(kw)) return true;
    }
    
    if (/\bbạn là trợ lý ai\b.*\btư vấn\b.*\bthêm vào giỏ\b/i.test(t)) return true;
    if (/\bbạn là chatbot ai\b.*\btư vấn\b.*\bso sánh\b/i.test(t)) return true;

    return false;
  }

  _detectsStaleContextContamination(text, context) {
    const t = text.toLowerCase();
    const currentIntent = context.intent || 'general_question';
    
    const isCreativeOrSocial = ['greeting', 'thanks', 'goodbye', 'small_talk', 'general_question'].includes(currentIntent);
    const isUnrelatedQuery = !context.category && !context.brand && !context.productName;

    if (isCreativeOrSocial && isUnrelatedQuery) {
      // Product-specific terms that should NEVER appear in non-product responses
      const productSpecificTerms = [
        'tản nhiệt nước', 'tản nhiệt', 'vga', 'rtx', 'gtx', 'ssd', 'hdd', 'nvme',
        'mainboard', 'card đồ họa', 'psu', 'nguồn máy tính',
        'mua hàng', 'đặt hàng', 'thêm vào giỏ', 'giỏ hàng', 'thanh toán',
        'hotline', 'cửa hàng'
      ];
      
      // Store-specific terms — slightly less strict (bot may mention itself briefly)
      const storeSpecificTerms = [
        'techstore', 'sản phẩm tại', 'tư vấn sản phẩm', 'linh kiện máy tính',
        'đơn hàng', 'chính sách bảo hành', 'chính sách đổi trả'
      ];

      const normalizedOriginal = String(context.originalMessage || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd');

      // Detect creative/non-tech questions
      const isCreativeQuestion = /(truyen co tich|ke chuyen|lam tho|truyen cuoi|do vui|hat cho|bai hat|lich su|dia ly|toan hoc|vat ly|hoa hoc|van hoc|ngoai ngu|cong thuc nau|the thao|phim|am nhac|nghe thuat)/i.test(normalizedOriginal);
      const isGeneralKnowledge = /(thu do|quoc gia|dan so|nuoc nao|thanh pho|the gioi|chau a|ai la|nam nao|bao nhieu)/i.test(normalizedOriginal);

      if (isCreativeQuestion || isGeneralKnowledge) {
        // Strict check: any product or store term is contamination
        const hasProductTerm = productSpecificTerms.some(term => t.includes(term));
        const hasStoreTerm = storeSpecificTerms.some(term => t.includes(term));
        return hasProductTerm || hasStoreTerm;
      }

      // For other general questions, only flag if multiple product terms appear
      const matchCount = productSpecificTerms.filter(term => t.includes(term)).length;
      return matchCount >= 2;
    }
    return false;
  }

  _cleanContaminatedText(text, context) {
    const normalizedOriginal = String(context.originalMessage || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd');

    // Provide context-appropriate fallback based on what user actually asked
    if (/(truyen co tich|ke chuyen)/i.test(normalizedOriginal)) {
      return 'Mình rất thích kể chuyện! Bạn muốn nghe chuyện cổ tích nào nhé? Ví dụ: Tấm Cám, Cây tre trăm đốt, hoặc Sọ Dừa? 📖';
    }
    if (/(lam tho|bai tho)/i.test(normalizedOriginal)) {
      return 'Mình có thể thử làm thơ cho bạn! Bạn muốn chủ đề gì nhé? 🎭';
    }
    if (/(do vui|cau do)/i.test(normalizedOriginal)) {
      return 'Mình có nhiều câu đố vui lắm! Bạn muốn thử không? 🧩';
    }
    
    // Generic creative fallback
    return 'Mình hiểu câu hỏi của bạn rồi! Bạn có thể hỏi cụ thể hơn để mình trả lời chính xác nhé. 😊';
  }
  _formatPrice(price) {
    if (!Number.isFinite(Number(price)) || Number(price) <= 0) return '';
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(Number(price));
  }
}

module.exports = new ResponseValidator();
