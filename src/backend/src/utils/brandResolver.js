const Product = require('../../models/Product');

class BrandResolver {
  constructor() {
    this.staticBrands = [
      'ASUS', 'MSI', 'Lenovo', 'Dell', 'HP', 'Acer', 'Apple', 'Logitech', 'Samsung',
      'Kingston', 'Corsair', 'Razer', 'Gigabyte', 'Intel', 'AMD', 'NVIDIA', 'LG',
      'DareU', 'Akko', 'Aula', 'Colorful', 'INNO3D', 'Microsoft', 'Newmen', 'Nintendo',
      'Sony', 'Xiaomi', 'G.Skill', 'SteelSeries', 'Western Digital', 'WD', 'Seagate',
      'Deepcool', 'Aigo', 'ID-Cooling', 'Jonsbo', 'Cooler Master', 'NZXT', 'Crucial'
    ];
    this.dbBrands = [];
    this.lastFetched = 0;
    this.cacheDuration = 5 * 60 * 1000; // 5 minutes cache
  }

  async getBrands() {
    const now = Date.now();
    if (this.dbBrands.length > 0 && (now - this.lastFetched < this.cacheDuration)) {
      return this.dbBrands;
    }
    try {
      // Query distinct brands from database
      const distinctBrands = await Product.distinct('brand');
      // Filter out empty/null values, trim and unique
      const filtered = distinctBrands
        .filter(b => typeof b === 'string' && b.trim().length > 0)
        .map(b => b.trim());

      const allBrandsSet = new Set([...filtered, ...this.staticBrands]);
      this.dbBrands = Array.from(allBrandsSet);
      this.lastFetched = now;
    } catch (err) {
      console.warn('[BrandResolver] Failed to fetch brands from DB, falling back to static:', err.message);
      if (this.dbBrands.length === 0) {
        this.dbBrands = [...this.staticBrands];
      }
    }
    return this.dbBrands;
  }

  /**
   * Resolves a brand name from user raw message text.
   * Supports diacritics normalization, aliases mapping, and regex search boundaries.
   * @param {string} text - Raw query message
   * @returns {Promise<string|null>} Resolved brand name or null
   */
  async resolveBrand(text = '') {
    if (!text || typeof text !== 'string') return null;
    const brands = await this.getBrands();
    const normalizedText = this._normalize(text);

    // Common alias/abbreviation maps
    const aliases = {
      'wd': 'Western Digital',
      'asu': 'ASUS',
      'logi': 'Logitech'
    };

    for (const [alias, canonical] of Object.entries(aliases)) {
      const regex = new RegExp(`\\b${alias}\\b`, 'i');
      if (regex.test(normalizedText)) {
        return canonical;
      }
    }

    // Sort brands by length descending to match longer words first (e.g. "Western Digital" before "WD")
    const sortedBrands = [...brands].sort((a, b) => b.length - a.length);
    for (const brand of sortedBrands) {
      const normalizedBrand = this._normalize(brand);
      if (normalizedBrand.length === 0) continue;

      const regex = new RegExp(`\\b${normalizedBrand}\\b`, 'i');
      if (regex.test(normalizedText) || normalizedText.includes(normalizedBrand)) {
        return brand;
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

module.exports = new BrandResolver();
