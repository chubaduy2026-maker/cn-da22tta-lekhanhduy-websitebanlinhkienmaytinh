class ProductNameResolver {
  /**
   * Resolves potential product model names or keywords from user text.
   * @param {string} text - Raw query message
   * @returns {string|null} Resolved product name/model or null
   */
  resolveProductName(text = '') {
    if (!text || typeof text !== 'string') return null;

    const normalized = text.toLowerCase();
    
    // Series and famous model names
    const models = [
      'g15', 'a15', 'helios', 'legion', 'blackwidow', 'brio', 'mystique', 'll120', 'za-120b',
      'expertbook', 'zenbook', 'tuf', 'rog', 'predator', 'nitro', 'ideapad', 'thinkpad',
      'vostro', 'inspiron', 'pavilion', 'envy', 'spectre', 'latitude', 'xps', 'macbook', 'nautilus',
      'frozn', 'le240', 'briom', 'brio105'
    ];

    for (const model of models) {
      const regex = new RegExp(`\\b${model}\\b`, 'i');
      if (regex.test(normalized)) {
        return model.charAt(0).toUpperCase() + model.slice(1);
      }
    }

    // Try to extract generic alphanumeric string of length 3-10 that could be a model number
    const matches = normalized.match(/\b([a-z]+\d+|\d+[a-z]+|[a-z]+\d+[a-z]+)\b/gi);
    if (matches) {
      const excludedUnits = ['gb', 'tb', 'hz', 'w', 'v', 'ghz', 'mhz', 'usd', 'vnd', 'tr', 'kg', 'mm', 'cm'];
      for (const m of matches) {
        const lower = m.toLowerCase();
        if (!excludedUnits.some(unit => lower.endsWith(unit) || lower === unit)) {
          return m.toUpperCase();
        }
      }
    }

    return null;
  }
}

module.exports = new ProductNameResolver();
