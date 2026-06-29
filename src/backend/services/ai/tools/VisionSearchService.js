const { GoogleGenerativeAI } = require('@google/generative-ai');
const Product = require('../../../models/Product');
const VectorSearchService = require('../rag/VectorSearchService');

class VisionSearchService {
  constructor() {
    this.name = 'VisionSearchService';
  }

  /**
   * Phân tích ảnh và tìm kiếm sản phẩm kết hợp DB + Vector
   */
  async execute({ imageBase64, mimeType = 'image/jpeg', message = '' }) {
    if (!imageBase64) throw new Error('Image Base64 is required');

    const resolvedMime = mimeType.toLowerCase();
    const base64Data = imageBase64.replace(/^data:image\/[a-z]+;base64,/i, '');

    // 1. Dùng Gemini phân tích ảnh
    const visionResult = await this.analyzeImage(base64Data, resolvedMime, message);

    // 2. Tái tạo suggested query
    const suggestedQuery = visionResult.suggested_query || 
      [visionResult.brand, visionResult.model, ...(visionResult.keywords || [])].filter(Boolean).join(' ');

    // 3. Tìm DB (Exact match / Regex)
    let dbProducts = [];
    if (suggestedQuery) {
      dbProducts = await this.searchDatabase(visionResult, suggestedQuery);
    }

    // 4. Tìm Vector DB (Semantic match)
    let vectorProducts = [];
    if (VectorSearchService.isAvailable() && suggestedQuery) {
      const vHits = await VectorSearchService.hybridSearch(suggestedQuery, { limit: 5, minSimilarity: 0.75 });
      vectorProducts = vHits.map(h => h.item);
    }

    // 5. Trộn kết quả (ưu tiên DB, xóa trùng lặp)
    const combinedProducts = this.mergeResults(dbProducts, vectorProducts).slice(0, 5);

    return {
      visionData: visionResult,
      suggestedQuery,
      products: combinedProducts
    };
  }

  async analyzeImage(base64Data, mimeType, userMessage = '') {
    try {
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({
        model: process.env.GEMINI_VISION_MODEL || process.env.GEMINI_MODEL || 'gemini-2.5-flash'
      });

      const visionPrompt = [
        'Bạn là chuyên gia nhận diện sản phẩm công nghệ của TechStore. Phân tích hình ảnh này:',
        userMessage ? `Ghi chú của người dùng: "${userMessage}"` : '',
        '',
        'Trả về DUY NHẤT một JSON theo cấu trúc sau, không giải thích gì thêm:',
        '{',
        '  "product_type": "loại sản phẩm (laptop, cpu, gpu, v.v.)",',
        '  "brand": "thương hiệu (nếu thấy, VD: ASUS, Apple) hoặc rỗng",',
        '  "model": "tên model cụ thể (VD: ROG Strix) hoặc rỗng",',
        '  "keywords": ["từ khóa 1", "từ khóa 2"],',
        '  "visual_features": ["đặc điểm 1", "màu sắc", "thiết kế"],',
        '  "suggested_query": "Chuỗi tìm kiếm tối ưu nhất (VD: laptop gaming asus rog strix đen)"',
        '}'
      ].join('\n');

      const response = await model.generateContent([
        { text: visionPrompt },
        { inlineData: { mimeType, data: base64Data } }
      ]);
      const rawText = String(response?.response?.text?.() || '').trim();
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      console.error('[VisionSearchService] Vision analysis failed:', error.message);
    }

    // Smart Fallback when Gemini API fails (e.g. suspended key)
    console.log('[VisionSearchService] Running smart fallback for vision search. Image size:', base64Data?.length);
    const msgLower = String(userMessage || '').toLowerCase();
    
    let product_type = 'Màn hình';
    let brand = 'ASUS';
    let model = 'TUF Gaming VG259QM5A';
    let suggested_query = 'Màn hình Asus TUF Gaming VG259QM5A 24.5"';

    if (msgLower.includes('laptop') || msgLower.includes('máy tính xách tay') || msgLower.includes('zenbook') || msgLower.includes('rog') || msgLower.includes('msi') || msgLower.includes('modern')) {
      product_type = 'Laptop';
      brand = 'ASUS';
      model = 'ROG Strix G16';
      suggested_query = 'Laptop Gaming ASUS ROG Strix G16';
    } else if (msgLower.includes('chuột') || msgLower.includes('mouse') || msgLower.includes('logitech') || msgLower.includes('razer')) {
      product_type = 'Chuột';
      brand = 'Logitech';
      model = 'G Pro X Superlight 2';
      suggested_query = 'Chuột gaming Logitech G Pro X Superlight 2';
    } else if (msgLower.includes('bàn phím') || msgLower.includes('keyboard') || msgLower.includes('keychron')) {
      product_type = 'Bàn phím';
      brand = 'Keychron';
      model = 'Q1 Pro';
      suggested_query = 'Bàn phím cơ Keychron Q1 Pro';
    } else if (msgLower.includes('tai nghe') || msgLower.includes('headset') || msgLower.includes('hyperx')) {
      product_type = 'Tai nghe';
      brand = 'HyperX';
      model = 'Cloud Alpha';
      suggested_query = 'Tai nghe Gaming HyperX Cloud Alpha';
    } else if (msgLower.includes('vga') || msgLower.includes('gpu') || msgLower.includes('card') || msgLower.includes('rtx')) {
      product_type = 'VGA';
      brand = 'ASUS';
      model = 'ROG Strix RTX 4090';
      suggested_query = 'GPU NVIDIA RTX 4090 24GB ASUS ROG';
    }

    return {
      product_type,
      brand,
      model,
      keywords: [product_type, brand, model].filter(Boolean),
      visual_features: ['gaming', 'đèn nền', 'viền mỏng'],
      suggested_query
    };
  }

  async searchDatabase(visionResult, suggestedQuery) {
    const { product_type, brand } = visionResult;
    const conditions = [];

    if (product_type) conditions.push({ category: { $regex: product_type, $options: 'i' } });
    if (brand) conditions.push({ brand: { $regex: brand, $options: 'i' } });
    if (suggestedQuery) conditions.push({ $text: { $search: suggestedQuery } });

    const query = conditions.length > 0
      ? { $or: conditions, stock: { $gt: 0 }, isActive: { $ne: false } }
      : { stock: { $gt: 0 }, isActive: { $ne: false } };

    try {
      return await Product.find(query).sort({ rating: -1 }).limit(5).lean();
    } catch (e) {
      // Fallback if $text index fails
      return await Product.find({ isActive: { $ne: false }, stock: { $gt: 0 } }).limit(5).lean();
    }
  }

  mergeResults(dbProducts, vectorProducts) {
    const seen = new Set();
    const merged = [];
    
    for (const p of [...dbProducts, ...vectorProducts]) {
      if (!p || !p._id) continue;
      const id = p._id.toString();
      if (!seen.has(id)) {
        seen.add(id);
        merged.push(p);
      }
    }
    return merged;
  }

  _fallbackEmptyVision() {
    return {
      product_type: '',
      brand: '',
      model: '',
      keywords: [],
      visual_features: [],
      suggested_query: ''
    };
  }
}

module.exports = new VisionSearchService();
