/**
 * PCBuilderAgent — Xây dựng cấu hình PC theo ngân sách
 *
 * Chức năng:
 * - Phân bổ ngân sách tối ưu cho từng linh kiện theo use-case
 * - Tìm linh kiện phù hợp từ database
 * - Kiểm tra tương thích cơ bản (socket CPU-Mainboard, công suất PSU)
 * - Tạo danh sách linh kiện hoàn chỉnh với giá thực tế
 * - Đề xuất nâng cấp theo thứ tự ưu tiên
 *
 * @module services/ai/agents/PCBuilderAgent
 */

const Product = require('../../../models/Product');
const priceResolver = require('../../../src/utils/priceResolver');

// Tỷ lệ phân bổ ngân sách tối ưu theo use-case
const BUDGET_ALLOCATION = {
  gaming: {
    cpu: 0.18,
    gpu: 0.35,
    ram: 0.08,
    ssd: 0.07,
    mainboard: 0.12,
    psu: 0.08,
    case: 0.07,
    cooler: 0.05
  },
  workstation: {
    cpu: 0.28,
    gpu: 0.18,
    ram: 0.18,
    ssd: 0.12,
    mainboard: 0.10,
    psu: 0.07,
    case: 0.05,
    cooler: 0.02
  },
  office: {
    cpu: 0.25,
    gpu: 0.05,
    ram: 0.12,
    ssd: 0.10,
    mainboard: 0.18,
    psu: 0.12,
    case: 0.10,
    cooler: 0.08
  },
  streaming: {
    cpu: 0.25,
    gpu: 0.28,
    ram: 0.12,
    ssd: 0.08,
    mainboard: 0.10,
    psu: 0.08,
    case: 0.06,
    cooler: 0.03
  }
};

// Tên danh mục trong database
const COMPONENT_CATEGORIES = {
  cpu: ['cpu', 'vi xu ly', 'processor'],
  gpu: ['gpu', 'vga', 'card do hoa', 'card man hinh'],
  ram: ['ram', 'bo nho ram'],
  ssd: ['ssd', 'o cung the ran', 'nvme'],
  mainboard: ['mainboard', 'bo mach chu', 'motherboard'],
  psu: ['psu', 'nguon', 'power supply', 'bo nguon'],
  case: ['case', 'vo may', 'thung may', 'tower'],
  cooler: ['tan nhiet', 'cooler', 'cpu cooler', 'aio']
};

// Công suất tiêu thụ ước tính theo GPU (W)
const GPU_POWER_DRAW = {
  'rtx 4090': 450,
  'rtx 4080': 320,
  'rtx 4070 ti': 285,
  'rtx 4070': 200,
  'rtx 4060 ti': 165,
  'rtx 4060': 115,
  'rtx 3090': 350,
  'rtx 3080': 320,
  'rtx 3070': 220,
  'rtx 3060': 170,
  'rx 7900': 330,
  'rx 7800': 263,
  'rx 6800': 250,
  'rx 6700': 230,
  default: 150
};

class PCBuilderAgent {
  constructor() {
    this.name = 'PCBuilderAgent';
    this.description = 'Xây dựng cấu hình PC tối ưu theo ngân sách và nhu cầu';
  }

  /**
   * Thực thi build PC
   * @param {Object} params
   * @returns {Promise<Object>}
   */
  async execute({ message = '', history = [], context = {} } = {}) {
    try {
      // 1) Phân tích yêu cầu build
      const buildParams = this._parseBuildParams(message, history);

      // Chưa đủ thông tin
      if (!buildParams.budget) {
        return {
          type: 'pc_build',
          answer: this._buildAskBudgetMessage(),
          products: [],
          sources: [],
          quickReplies: [
            { title: '💰 Build PC 20 triệu', payload: 'Build PC gaming 20 triệu' },
            { title: '💰 Build PC 30 triệu', payload: 'Build PC gaming 30 triệu' },
            { title: '💰 Build PC 40 triệu', payload: 'Build PC gaming 40 triệu' },
            { title: '💰 Build PC 50 triệu', payload: 'Build PC workstation 50 triệu' }
          ]
        };
      }

      // 2) Phân bổ ngân sách
      const prebuiltPCs = await this._findPrebuiltPCs(buildParams);
      if (prebuiltPCs.length > 0) {
        const answer = this._buildPrebuiltPCAnswer(prebuiltPCs, buildParams);
        return {
          type: 'product_results',
          intent: 'pc_build',
          answer,
          products: prebuiltPCs.map(p => this._formatProduct(p)),
          sources: prebuiltPCs.map(p => ({
            type: 'product',
            id: p._id?.toString(),
            title: p.name,
            role: 'prebuilt_pc'
          })),
          metadata: {
            budget: buildParams.budget,
            priceMin: buildParams.priceMin,
            priceMax: buildParams.priceMax,
            priceMode: buildParams.priceMode,
            useCase: buildParams.useCase,
            source: 'prebuilt_pc_products'
          },
          quickReplies: [
            { title: 'PC ngan sach khac', payload: 'Build PC gaming 40 trieu' },
            { title: 'Xem VGA nang cap', payload: 'Cho toi xem VGA gaming' }
          ]
        };
      }

      if (buildParams.strictPrebuilt) {
        return {
          type: 'product_results',
          intent: 'pc_build',
          answer: this._buildNoPrebuiltPCAnswer(buildParams),
          products: [],
          sources: [],
          metadata: {
            budget: buildParams.budget,
            priceMin: buildParams.priceMin,
            priceMax: buildParams.priceMax,
            priceMode: buildParams.priceMode,
            useCase: buildParams.useCase,
            source: 'prebuilt_pc_products'
          },
          quickReplies: [
            { title: 'Tang ngan sach', payload: `Build PC gaming ${Math.ceil((buildParams.budget || 0) / 1000000) + 10} trieu` },
            { title: 'Build linh kien roi', payload: `Goi y cau hinh linh kien PC ${Math.ceil((buildParams.budget || 0) / 1000000)} trieu` }
          ]
        };
      }

      const allocation = this._allocateBudget(buildParams);

      // 3) Tìm linh kiện cho từng thành phần
      const components = await this._findComponents(allocation, buildParams);

      // 4) Kiểm tra tương thích
      const compatibility = this._checkCompatibility(components);

      // 5) Tính tổng giá
      const totalPrice = this._calculateTotal(components);

      // 6) Sinh câu trả lời
      const answer = await this._generateBuildAnswer(
        message, components, compatibility, totalPrice, buildParams, history
      );

      return {
        type: 'pc_build',
        answer,
        products: Object.values(components)
          .filter(Boolean)
          .map(c => this._formatProduct(c.product)),
        sources: Object.values(components)
          .filter(Boolean)
          .map(c => ({
            type: 'product',
            id: c.product?._id?.toString(),
            title: c.product?.name,
            role: c.role
          })),
        metadata: {
          budget: buildParams.budget,
          totalPrice,
          useCase: buildParams.useCase,
          compatibility
        },
        quickReplies: [
          { title: '⬆️ Nâng cấp GPU', payload: `Nâng cấp GPU cho build PC ${buildParams.budget / 1e6} triệu` },
          { title: '💾 Thêm ổ cứng 2TB', payload: 'Thêm HDD 2TB vào cấu hình' },
          { title: '🖥️ Mua màn hình phù hợp', payload: `Gợi ý màn hình cho RTX dưới 10 triệu` }
        ]
      };
    } catch (error) {
      console.error('[PCBuilderAgent] execute error:', error.message);
      return {
        type: 'pc_build',
        answer: 'Mình gặp sự cố khi xây dựng cấu hình. Bạn hãy thử lại với thông tin cụ thể hơn!',
        products: [],
        sources: []
      };
    }
  }

  /**
   * Phân tích tham số build từ câu hỏi
   * @private
   */
  _parseBuildParams(message = '', history = []) {
    const normalized = this._normalize(message);
    const histText = history.slice(-4).map(h => this._normalize(h.content || '')).join(' ');
    const combined = `${normalized} ${histText}`;
    const currentPriceDetails = priceResolver.resolvePrice(normalized);
    const previousPriceDetails = priceResolver.resolvePrice(histText);
    const hasCurrentBudget = this._hasParsedBudget(currentPriceDetails);
    const hasPreviousBudget = this._hasParsedBudget(previousPriceDetails);
    const canReusePreviousBudget = !hasCurrentBudget && hasPreviousBudget && this._isBudgetFollowUp(normalized);
    const priceDetails = hasCurrentBudget
      ? currentPriceDetails
      : canReusePreviousBudget
        ? previousPriceDetails
        : currentPriceDetails;

    const params = {
      budget: null,
      priceMin: priceDetails.priceMin,
      priceMax: priceDetails.priceMax,
      targetPrice: priceDetails.targetPrice,
      priceMode: priceDetails.priceMode,
      strictPrebuilt: /\b(bo pc|may pc|pc gaming|pc van phong|build pc|cau hinh pc)\b/.test(combined),
      useCase: 'gaming',
      cpuBrand: null,
      gpuBrand: null
    };

    // Trích xuất ngân sách
    const resolvedBudget = priceDetails.targetPrice || priceDetails.priceMax || priceDetails.priceMin || null;
    if (resolvedBudget) {
      params.budget = resolvedBudget;
    } else {
      const budgetMatch = normalized.match(/(\d+)\s*(trieu|tr|million)/i);
      if (budgetMatch) {
        params.budget = Number(budgetMatch[1]) * 1_000_000;
        params.priceMax = params.budget;
        params.priceMode = params.priceMode || 'target';
      }
    }

    if (params.budget && (!params.priceMode || params.priceMode === 'target' || params.priceMode === 'approx')) {
      params.priceMin = null;
      params.priceMax = params.budget;
    }

    console.log('[BUDGET DEBUG]', {
      originalMessage: message,
      previousBudget: this._budgetSnapshot(previousPriceDetails),
      currentParsedBudget: this._budgetSnapshot(currentPriceDetails),
      finalBudgetUsed: this._budgetSnapshot(params),
      reason: hasCurrentBudget
        ? 'current_message_budget'
        : canReusePreviousBudget
          ? 'follow_up_reused_previous_budget'
          : 'no_budget_in_current_message'
    });

    // Phát hiện use-case
    if (/(workstation|render|3d|video edit|premiere|blender)/.test(combined)) {
      params.useCase = 'workstation';
    } else if (/(office|van phong|ban lam viec)/.test(combined)) {
      params.useCase = 'office';
    } else if (/(stream|streaming|obs|twitch)/.test(combined)) {
      params.useCase = 'streaming';
    } else {
      params.useCase = 'gaming';
    }

    // CPU brand preference
    if (/\bintel\b/.test(combined)) params.cpuBrand = 'Intel';
    else if (/\bamd\b|\bryzen\b/.test(combined)) params.cpuBrand = 'AMD';

    // GPU brand preference
    if (/\bnvidia\b|\brtx\b|\bgtx\b/.test(combined)) params.gpuBrand = 'NVIDIA';
    else if (/\bamd\b|\bradeon\b|\brx\b/.test(combined)) params.gpuBrand = 'AMD';

    return params;
  }

  _hasParsedBudget(priceDetails = {}) {
    return Boolean(priceDetails?.targetPrice || priceDetails?.priceMin || priceDetails?.priceMax);
  }

  _isBudgetFollowUp(normalizedMessage = '') {
    return /\b(re hon|loai khac|mau nao|con mau|con cai|cai nao khac|nang cap|ha gia|them lua chon|khac khong)\b/.test(normalizedMessage)
      && !/\b(build pc|cau hinh pc|bo pc|may pc|pc gaming|pc van phong)\b/.test(normalizedMessage);
  }

  _budgetSnapshot(priceDetails = {}) {
    return {
      priceMin: priceDetails.priceMin ?? null,
      priceMax: priceDetails.priceMax ?? null,
      targetPrice: priceDetails.targetPrice ?? null,
      priceMode: priceDetails.priceMode ?? null
    };
  }

  /**
   * Prefer real prebuilt PC products from the shop catalog before composing parts.
   * This keeps chatbot cards aligned with the product listing source of truth.
   * @private
   */
  async _findPrebuiltPCs(params = {}) {
    const query = {
      category: /^PC$/i
    };

    if (Product.schema.path('isActive')) {
      query.isActive = { $ne: false };
    }

    if (params.priceMin !== null || params.priceMax !== null) {
      query.price = {};
      if (params.priceMin !== null) query.price.$gte = params.priceMin;
      if (params.priceMax !== null) query.price.$lte = params.priceMax;
    }

    const sort = params.priceMin !== null && params.priceMax === null
      ? { price: 1, rating: -1, createdAt: -1 }
      : { price: -1, rating: -1, createdAt: -1 };

    const products = await Product.find(query)
      .sort(sort)
      .limit(5)
      .lean();

    const filtered = products.filter((product) => {
      const price = Number(product.salePrice || product.price || 0);
      if (!Number.isFinite(price) || price <= 0) return false;
      if (params.priceMin !== null && price < params.priceMin) return false;
      if (params.priceMax !== null && price > params.priceMax) return false;
      return true;
    });

    console.log('[PC BUILD SEARCH DEBUG]', {
      searchContext: {
        priceMin: params.priceMin,
        priceMax: params.priceMax,
        targetPrice: params.targetPrice,
        priceMode: params.priceMode,
        useCase: params.useCase
      },
      finalMongoQuery: this._stringifyQueryForDebug(query),
      resultCount: filtered.length,
      firstProducts: filtered.slice(0, 5).map(p => ({
        name: p.name,
        price: Number(p.salePrice || p.price || 0)
      }))
    });

    return filtered;
  }

  _buildPrebuiltPCAnswer(products = [], params = {}) {
    const budgetText = this._describeBudget(params);
    const lines = [
      budgetText
        ? `Mình tìm được các bộ PC có sẵn phù hợp ${budgetText}:`
        : 'Mình tìm được các bộ PC có sẵn phù hợp tại TechStore:',
      '',
      ...products.slice(0, 5).map((p) => `- ${p.name}: ${this._formatPrice(p.salePrice || p.price)}`)
    ];

    return `${lines.join('\n')}\n\nCác mẫu trên lấy trực tiếp từ catalog hiện tại, nên giá và card sản phẩm bên dưới sẽ khớp với website.`;
  }

  _buildNoPrebuiltPCAnswer(params = {}) {
    const budgetText = this._describeBudget(params);
    return `Hiện TechStore chưa có bộ PC dựng sẵn phù hợp ${budgetText || 'với tiêu chí này'}. Bạn có thể tăng ngân sách hoặc chuyển sang build linh kiện rời để mình ghép cấu hình theo sản phẩm đang có.`;
  }

  _describeBudget(params = {}) {
    if (params.priceMin !== null && params.priceMax !== null) {
      return `trong khoảng ${this._formatPrice(params.priceMin)} - ${this._formatPrice(params.priceMax)}`;
    }
    if (params.priceMin !== null) {
      return `từ ${this._formatPrice(params.priceMin)} trở lên`;
    }
    if (params.priceMax !== null) {
      return `không vượt quá ${this._formatPrice(params.priceMax)}`;
    }
    return '';
  }

  /**
   * Phân bổ ngân sách cho từng linh kiện
   * @private
   */
  _allocateBudget(params = {}) {
    const { budget, useCase } = params;
    const ratios = BUDGET_ALLOCATION[useCase] || BUDGET_ALLOCATION.gaming;

    const allocation = {};
    for (const [component, ratio] of Object.entries(ratios)) {
      allocation[component] = Math.floor(budget * ratio);
    }

    return allocation;
  }

  /**
   * Tìm linh kiện tốt nhất trong ngân sách
   * @private
   */
  async _findComponents(allocation = {}, params = {}) {
    const components = {};

    for (const [component, budget] of Object.entries(allocation)) {
      const categories = COMPONENT_CATEGORIES[component];
      if (!categories) continue;

      const query = {
        $or: categories.map(cat => ({ category: { $regex: cat, $options: 'i' } })),
        price: { $lte: budget * 1.15 }, // 15% tolerance
        stock: { $gt: 0 }
      };

      // Thêm brand preference
      if (component === 'cpu' && params.cpuBrand) {
        query.brand = { $regex: params.cpuBrand, $options: 'i' };
      }
      if (component === 'gpu' && params.gpuBrand) {
        query.brand = { $regex: params.gpuBrand, $options: 'i' };
      }

      const product = await Product.findOne(query)
        .sort({ price: -1, rating: -1 }) // Lấy sản phẩm đắt nhất trong budget (tốt nhất)
        .lean();

      if (product) {
        components[component] = {
          role: component,
          product,
          budget,
          actualPrice: Number(product.salePrice || product.price || 0)
        };
      }
    }

    return components;
  }

  /**
   * Kiểm tra tương thích cơ bản
   * @private
   */
  _checkCompatibility(components = {}) {
    const issues = [];
    const warnings = [];

    // Kiểm tra PSU đủ công suất
    const gpu = components.gpu?.product;
    const cpu = components.cpu?.product;
    const psu = components.psu?.product;

    if (gpu && psu) {
      const gpuName = this._normalize(gpu.name);
      let gpuPower = GPU_POWER_DRAW.default;

      for (const [model, power] of Object.entries(GPU_POWER_DRAW)) {
        if (gpuName.includes(model)) {
          gpuPower = power;
          break;
        }
      }

      const cpuPower = 95; // Ước tính CPU
      const systemPower = 100; // Bo mạch chủ + RAM + SSD + Fans
      const totalRequired = gpuPower + cpuPower + systemPower;

      // Trích xuất công suất PSU từ tên
      const psuMatch = psu.name.match(/(\d+)\s*w/i);
      const psuWattage = psuMatch ? Number(psuMatch[1]) : 550;

      if (psuWattage < totalRequired) {
        issues.push(`⚠️ PSU ${psuWattage}W có thể không đủ cho ${gpu.name} (cần ~${totalRequired}W)`);
      } else if (psuWattage < totalRequired * 1.2) {
        warnings.push(`💡 Khuyến nghị PSU ${Math.ceil(totalRequired * 1.2 / 50) * 50}W để an toàn hơn`);
      }
    }

    return { issues, warnings, isCompatible: issues.length === 0 };
  }

  /**
   * Tính tổng giá
   * @private
   */
  _calculateTotal(components = {}) {
    return Object.values(components)
      .filter(Boolean)
      .reduce((sum, c) => sum + (c.actualPrice || 0), 0);
  }

  /**
   * Sinh câu trả lời build PC bằng Gemini
   * @private
   */
  async _generateBuildAnswer(message, components, compatibility, totalPrice, params, history = []) {
    try {
      const { callGemini } = require('../../../src/utils/geminiClient');

      const componentList = Object.entries(components)
        .filter(([, v]) => v)
        .map(([role, c]) => {
          const price = this._formatPrice(c.actualPrice);
          return `${role.toUpperCase()}: ${c.product.name} — ${price} (ngân sách: ${this._formatPrice(c.budget)})`;
        })
        .join('\n');

      const total = this._formatPrice(totalPrice);
      const budget = this._formatPrice(params.budget);
      const useCase = params.useCase;

      const prompt = [
        'Bạn là chuyên gia build PC tại TechStore.',
        '',
        `YÊU CẦU: "${message}"`,
        `NGÂN SÁCH: ${budget}`,
        `MỤC ĐÍCH: ${useCase}`,
        '',
        'LINH KIỆN ĐÃ CHỌN:',
        componentList || '(Không tìm thấy linh kiện phù hợp)',
        '',
        `TỔNG GIÁ THỰC TẾ: ${total}`,
        '',
        compatibility.issues.length > 0 ? `VẤN ĐỀ TƯƠNG THÍCH:\n${compatibility.issues.join('\n')}` : '',
        compatibility.warnings.length > 0 ? `KHUYẾN NGHỊ:\n${compatibility.warnings.join('\n')}` : '',
        '',
        'HƯỚNG DẪN TRẢ LỜI:',
        '1. Tạo bảng linh kiện markdown: | Linh kiện | Model | Giá |',
        '2. Thêm dòng Tổng cộng ở cuối bảng',
        '3. Giải thích lý do chọn từng linh kiện chính (CPU, GPU)',
        '4. Nêu vấn đề tương thích nếu có',
        '5. Gợi ý: linh kiện nào có thể upgrade sau',
        '6. KHÔNG tự bịa model hoặc giá — chỉ dùng dữ liệu trên',
        '7. Tiếng Việt, chuyên nghiệp'
      ].filter(Boolean).join('\n');

      return String(await callGemini(prompt) || '').trim();
    } catch (error) {
      console.warn('[PCBuilderAgent] Gemini failed:', error.message);
      return this._buildFallbackAnswer(components, compatibility, totalPrice, params);
    }
  }

  /**
   * Fallback khi Gemini không phản hồi
   * @private
   */
  _buildFallbackAnswer(components = {}, compatibility = {}, totalPrice = 0, params = {}) {
    const rows = Object.entries(components)
      .filter(([, v]) => v)
      .map(([role, c]) =>
        `| ${role.toUpperCase()} | ${c.product.name} | ${this._formatPrice(c.actualPrice)} |`
      );

    const table = [
      `## Cấu hình PC ${params.useCase} — ${this._formatPrice(params.budget)}`,
      '',
      '| Linh kiện | Model | Giá |',
      '|---|---|---|',
      ...rows,
      `| **Tổng cộng** | | **${this._formatPrice(totalPrice)}** |`
    ].join('\n');

    const issues = compatibility.issues?.length > 0
      ? `\n\n⚠️ **Lưu ý:** ${compatibility.issues.join('; ')}`
      : '';

    return `${table}${issues}`;
  }

  _buildAskBudgetMessage() {
    return [
      'Để xây dựng cấu hình PC phù hợp, mình cần biết thêm:',
      '',
      '💰 **Ngân sách tổng là bao nhiêu?** (VD: 25 triệu, 40 triệu)',
      '🎯 **Mục đích sử dụng chính:** Gaming, làm đồ họa/render, văn phòng, streaming?',
      '🔧 **Có yêu cầu gì đặc biệt?** CPU Intel hay AMD? GPU NVIDIA hay AMD?',
      '',
      'Mình sẽ tạo cấu hình tối ưu nhất trong tầm giá cho bạn!'
    ].join('\n');
  }

  _formatProduct(p = {}) {
    if (!p) return null;
    return {
      id: p._id?.toString() || '',
      name: p.name || 'Sản phẩm',
      brand: p.brand || '',
      category: p.category || '',
      price: Number(p.salePrice || p.price || 0),
      stock: Number(p.stock || 0),
      imageUrl: p.imageUrl || p.image || (Array.isArray(p.images) ? p.images[0] : null) || null,
      productUrl: p._id ? `/product/${p._id}` : null
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

  _stringifyQueryForDebug(query = {}) {
    return JSON.stringify(query, (key, value) => {
      if (value instanceof RegExp) return value.toString();
      return value;
    });
  }
}

module.exports = new PCBuilderAgent();
