const Category = require('../../models/Category');

class CategoryResolver {
  constructor() {
    // Mapping of key aliases to canonical database category name
    this.mapping = {
      'laptop': { dbName: 'Laptop', keywords: ['laptop', 'may tinh xach tay', 'macbook', 'notebook'] },
      'pc': { dbName: 'PC', keywords: ['pc', 'may tinh ban', 'desktop', 'case may tinh', 'thung may'] },
      'man hinh': { dbName: 'Màn hình', keywords: ['man hinh', 'monitor', 'display', 'manhinh'] },
      'chuot': { dbName: 'Chuột', keywords: ['chuot', 'mouse'] },
      'ban phim': { dbName: 'Bàn phím', keywords: ['ban phim', 'keyboard'] },
      'tai nghe': { dbName: 'Tai nghe', keywords: ['tai nghe', 'headphone', 'headset', 'tainghe'] },
      'webcam': { dbName: 'Phụ kiện', keywords: ['webcam', 'camera'], allowedKeywords: ['webcam', 'camera', 'ghi hinh'] },
      'ssd': { dbName: 'Ổ cứng', keywords: ['ssd', 'o cung ssd'], allowedKeywords: ['ssd', 'solid state'] },
      'hdd': { dbName: 'Ổ cứng', keywords: ['hdd', 'o cung hdd'], allowedKeywords: ['hdd', 'hard drive', 'hard disk'] },
      'ram': { dbName: 'RAM', keywords: ['ram', 'bo nho', 'ddr4', 'ddr5', 'memory'] },
      'vga': { dbName: 'VGA', keywords: ['vga', 'gpu', 'card do hoa', 'rtx', 'gtx', 'radeon', 'card man hinh'] },
      'cpu': { dbName: 'CPU', keywords: ['cpu', 'bo xu ly', 'processor', 'chip', 'i3', 'i5', 'i7', 'i9', 'ryzen'] },
      'mainboard': { dbName: 'Mainboard', keywords: ['mainboard', 'main', 'bo mach chu', 'motherboard', 'mb'] },
      'nguon': { dbName: 'Nguồn', keywords: ['psu', 'nguon', 'nguon may tinh', 'power supply', 'bo nguon'] },
      'case': { dbName: 'Case', keywords: ['vo may', 'case', 'thung may'] },
      'tan nhiet nuoc': { dbName: 'Tản nhiệt', keywords: ['tan nhiet nuoc', 'aio', 'liquid cooler', 'water cooling'], allowedKeywords: ['nuoc', 'liquid', 'aio', 'water'] },
      'tan nhiet khi': { dbName: 'Tản nhiệt', keywords: ['tan nhiet khi', 'air cooler'], allowedKeywords: ['khi', 'air'] },
      'tan nhiet': { dbName: 'Tản nhiệt', keywords: ['tan nhiet', 'cooler', 'radiator', 'cooling'] },
      'ghe': { dbName: 'Ghế', keywords: ['ghe', 'gaming chair', 'ghe choi game', 'ghe gaming'] },
      'ban': { dbName: 'Phụ kiện', keywords: ['ban gaming', 'ban lam viec'] },
      'loa': { dbName: 'Loa', keywords: ['loa', 'speaker'] },
      'console': { dbName: 'Console', keywords: ['console', 'nintendo switch', 'playstation', 'ps5', 'xbox'] },
      'phu kien': { dbName: 'Phụ kiện', keywords: ['phu kien', 'accessory', 'cap', 'hub', 'lot chuot'] },
      'thiet bi van phong': { dbName: 'Thiết bị văn phòng', keywords: ['thiet bi van phong', 'office device', 'may in', 'printer'] }
    };
    
    this.dbCategories = [];
    this.lastFetched = 0;
    this.cacheDuration = 5 * 60 * 1000; // 5 minutes cache
  }

  async getCategories() {
    const now = Date.now();
    if (this.dbCategories.length > 0 && (now - this.lastFetched < this.cacheDuration)) {
      return this.dbCategories;
    }
    try {
      const cats = await Category.find({ isActive: true }).select('name').lean();
      this.dbCategories = cats.map(c => c.name);
      this.lastFetched = now;
    } catch (err) {
      console.warn('[CategoryResolver] Failed to fetch categories from DB, falling back to static:', err.message);
      if (this.dbCategories.length === 0) {
        this.dbCategories = [
          'Mainboard', 'Tai nghe', 'Phụ kiện', 'Màn hình', 'VGA', 'Nguồn', 'Bàn phím',
          'Loa', 'PC', 'CPU', 'RAM', 'Ổ cứng', 'Case', 'Tản nhiệt', 'Chuột', 'Laptop',
          'Ghế', 'Thiết bị văn phòng', 'Console'
        ];
      }
    }
    return this.dbCategories;
  }

  /**
   * Resolves database category name from user message query.
   * @param {string} text - Raw query message
   * @returns {Promise<string|null>} Resolved category name or null
   */
  async resolveCategory(text = '') {
    const details = await this.resolveCategoryDetails(text);
    return details ? details.category : null;
  }

  /**
   * Resolves detailed category information from user message query.
   * @param {string} text - Raw query message
   * @returns {Promise<Object|null>} { category: string, canonicalKey: string, allowedKeywords: string[] }
   */
  async resolveCategoryDetails(text = '') {
    if (!text || typeof text !== 'string') return null;
    const normalizedText = this._normalize(text);
    const dbCats = await this.getCategories();

    // 1. Check mapping aliases dictionary first
    for (const [canonicalKey, conf] of Object.entries(this.mapping)) {
      for (const kw of conf.keywords) {
        const regex = new RegExp(`\\b${kw}\\b`, 'i');
        if (regex.test(normalizedText) || normalizedText.includes(kw)) {
          // Find matching Category name from DB
          const matchedDbCat = dbCats.find(c => this._normalize(c) === this._normalize(conf.dbName));
          if (matchedDbCat) {
            return {
              category: matchedDbCat,
              canonicalKey,
              allowedKeywords: conf.allowedKeywords || []
            };
          }
          
          return {
            category: conf.dbName,
            canonicalKey,
            allowedKeywords: conf.allowedKeywords || []
          };
        }
      }
    }

    // 2. Direct match Category name in DB
    for (const cat of dbCats) {
      const normalizedCat = this._normalize(cat);
      const regex = new RegExp(`\\b${normalizedCat}\\b`, 'i');
      if (regex.test(normalizedText) || normalizedText.includes(normalizedCat)) {
        return {
          category: cat,
          canonicalKey: normalizedCat,
          allowedKeywords: []
        };
      }
    }

    return null;
  }

  _normalize(str = '') {
    return str
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/[^\w\s\.-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
}

module.exports = new CategoryResolver();
