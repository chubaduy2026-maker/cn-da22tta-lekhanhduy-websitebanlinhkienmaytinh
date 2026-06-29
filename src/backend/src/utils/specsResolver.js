class SpecsResolver {
  /**
   * Resolves technical specifications from raw user query.
   * @param {string} text - Raw query message
   * @returns {Object} Extracted specs object
   */
  resolveSpecs(text = '') {
    if (!text || typeof text !== 'string') return {};

    const normalized = text.toLowerCase();
    const specs = {};

    // 1. Storage size (e.g. 1tb, 512gb, 2tb, 256gb)
    const storageMatch = normalized.match(/\b(1tb|2tb|512gb|256gb|128gb|64gb)\b/);
    if (storageMatch) {
      specs.storage = storageMatch[1].toUpperCase();
    }

    // 2. RAM size (e.g. 16gb ram, 8gb ram, 32gb ram)
    const ramMatch = normalized.match(/\b(8gb|16gb|32gb|64gb)\s*ram\b/) || 
                     normalized.match(/\bram\s*(8gb|16gb|32gb|64gb|8g|16g|32g|64g)\b/);
    if (ramMatch) {
      const sizeStr = ramMatch[1] || ramMatch[2];
      const sizeNum = parseInt(sizeStr);
      if (sizeNum <= 64) {
        specs.ram = `${sizeNum}GB`;
      }
    } else {
      // Check simple bare 8gb/16gb/32gb only if not matching storage size
      const simpleRamMatch = normalized.match(/\b(8gb|16gb|32gb|64gb)\b/);
      if (simpleRamMatch) {
        const sizeStr = simpleRamMatch[1];
        if (!specs.storage || specs.storage.toLowerCase() !== sizeStr.toLowerCase()) {
          specs.ram = sizeStr.toUpperCase();
        }
      }
    }

    // 3. GPU/VGA series (e.g. RTX 4060, RTX 4070, GTX 1650, RX 7600)
    const gpuMatch = normalized.match(/\b(rtx|gtx|rx)\s*(\d{4}|\d{3})\b/i);
    if (gpuMatch) {
      specs.gpu = `${gpuMatch[1].toUpperCase()} ${gpuMatch[2]}`;
    }

    // 4. CPU Series (e.g. i5, i7, i9, ryzen 5, ryzen 7, ryzen 9)
    const cpuMatch = normalized.match(/\b(i3|i5|i7|i9)\b/) || normalized.match(/\bryzen\s*(3|5|7|9)\b/);
    if (cpuMatch) {
      if (cpuMatch[0].startsWith('i')) {
        specs.cpu = cpuMatch[0].toUpperCase();
      } else {
        specs.cpu = `Ryzen ${cpuMatch[1]}`;
      }
    }

    // 5. Screen Refresh Rate (e.g. 144hz, 240hz, 360hz, 60hz)
    const hzMatch = normalized.match(/\b(\d+)\s*hz\b/);
    if (hzMatch) {
      specs.refreshRate = `${hzMatch[1]}Hz`;
    }

    // 6. Screen Size (e.g. 27 inch, 24 inch, 32 inch, 15.6 inch)
    const sizeMatch = normalized.match(/\b(\d+(\.\d+)?)\s*(inch|in|x)\b/);
    if (sizeMatch) {
      specs.screenSize = `${sizeMatch[1]} inch`;
    }

    // 7. RAM DDR Generation (e.g. ddr4, ddr5)
    const ddrMatch = normalized.match(/\b(ddr4|ddr5)\b/);
    if (ddrMatch) {
      specs.ddr = ddrMatch[1].toUpperCase();
    }

    // 8. SSD NVMe type (e.g. nvme, sata)
    const nvmeMatch = normalized.match(/\b(nvme|sata)\b/);
    if (nvmeMatch) {
      specs.ssdType = nvmeMatch[1].toUpperCase();
    }

    // 9. PSU Wattage (e.g. 650w, 750w, 850w)
    const wattMatch = normalized.match(/\b(\d+)\s*w\b/);
    if (wattMatch) {
      specs.wattage = `${wattMatch[1]}W`;
    }

    return specs;
  }
}

module.exports = new SpecsResolver();
