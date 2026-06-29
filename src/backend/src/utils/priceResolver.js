class PriceResolver {
  /**
   * Resolves price boundaries from raw user message text.
   * @param {string} text - Raw query message
   * @returns {Object} { priceMin: number|null, priceMax: number|null, targetPrice: number|null, priceMode: string|null }
   */
  resolvePrice(text = '') {
    if (!text || typeof text !== 'string') {
      return { priceMin: null, priceMax: null, targetPrice: null, priceMode: null };
    }

    const normalized = text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .replace(/đ/g, 'd')
      .replace(/[^\w\s\.-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const result = { priceMin: null, priceMax: null, targetPrice: null, priceMode: null };

    // Helper to parse price words to numbers (e.g. "5 trieu" -> 5000000)
    const parseToVND = (amountStr, unitStr = '') => {
      const num = Number(amountStr.replace(/[,\.]/g, ''));
      if (!Number.isFinite(num)) return null;
      const u = String(unitStr).toLowerCase();
      if (['trieu', 'tr', 'm'].includes(u)) return num * 1000000;
      if (['k', 'nghin'].includes(u)) return num * 1000;
      // If no unit but number is small (e.g. "5"), assume million
      if (num < 1000 && !u) return num * 1000000;
      return num;
    };

    // 1. "dưới X triệu" / "dưới X tr" / "tối đa X triệu" / "dưới X"
    const underMatch = normalized.match(
      /(?:duoi|under|toi da|max|khong qua|<|re hon)\s*(\d+[.,]?\d*)\s*(trieu|tr|m\b|million)?/i
    );
    if (underMatch) {
      result.priceMax = parseToVND(underMatch[1], underMatch[2]);
      result.priceMode = 'under';
      return result;
    }

    // 2. "từ X đến Y triệu" / "từ X - Y triệu" / "X đến Y triệu"
    const rangeMatch = normalized.match(
      /(?:tu|from)?\s*(\d+[.,]?\d*)\s*(trieu|tr)?\s*(?:den|toi|to|-)\s*(\d+[.,]?\d*)\s*(trieu|tr)?/i
    );
    if (rangeMatch && !normalized.includes('duoi') && !normalized.includes('tren')) {
      const unit = rangeMatch[2] || rangeMatch[4];
      result.priceMin = parseToVND(rangeMatch[1], unit);
      result.priceMax = parseToVND(rangeMatch[3], rangeMatch[4]);
      result.priceMode = 'range';
      return result;
    }

    // 3. "trên X triệu" / "từ X triệu trở lên" / "hơn X triệu" / "trên X"
    const overMatch = normalized.match(
      /(?:tren|over|tu|min|it nhat|>|hon)\s*(\d+[.,]?\d*)\s*(trieu|tr)?/i
    );
    if (overMatch) {
      result.priceMin = parseToVND(overMatch[1], overMatch[2]);
      result.priceMode = 'over';
      return result;
    }

    // 4. "khoảng X triệu" / "tầm X triệu"
    const approxMatch = normalized.match(
      /(?:khoang|tam|tam khoang|around|about)\s*(\d+[.,]?\d*)\s*(trieu|tr)?/i
    );
    if (approxMatch) {
      const target = parseToVND(approxMatch[1], approxMatch[2]);
      if (target) {
        result.targetPrice = target;
        // Let's suggest a range +/- 20%
        result.priceMin = target * 0.8;
        result.priceMax = target * 1.2;
        result.priceMode = 'approx';
      }
      return result;
    }

    // 5. Bare number check (e.g. "laptop 15 trieu" or "chuot 500k")
    const bareMatch = normalized.match(
      /\b(\d+[.,]?\d*)\s*(trieu|tr|k|nghin)\b/i
    );
    if (bareMatch) {
      const target = parseToVND(bareMatch[1], bareMatch[2]);
      if (target) {
        result.targetPrice = target;
        // If it specifies millions or k, set bounds
        if (bareMatch[2] === 'k') {
          result.priceMin = target * 0.7;
          result.priceMax = target * 1.3;
        } else {
          result.priceMin = target * 0.8;
          result.priceMax = target * 1.2;
        }
        result.priceMode = 'target';
      }
    }

    return result;
  }
}

module.exports = new PriceResolver();
