/**
 * syncPCCompatibilitySpecs.js
 * Normalize CPU socket / mainboard socket / RAM bus fields into Product.specifications.
 *
 * Usage:
 *   node scripts/syncPCCompatibilitySpecs.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Product = require('../models/Product');

const SOCKET_PATTERNS = [
  /LGA\s?1700/i,
  /LGA\s?1200/i,
  /LGA\s?1151/i,
  /AM5/i,
  /AM4/i,
  /sTRX4/i,
  /TR4/i
];

const BUS_PATTERNS = [
  /\b(2133|2400|2666|2933|3000|3200|3466|3600|3733|4000|4266|4400|4600|4800|5200|5600|6000|6400|6800|7200)\b/g
];

function toMapObject(specifications) {
  if (!specifications) {
    return {};
  }
  if (specifications instanceof Map) {
    return Object.fromEntries(specifications.entries());
  }
  return { ...specifications };
}

function pickSocket(text) {
  if (!text) {
    return '';
  }
  for (const pattern of SOCKET_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      return match[0].replace(/\s+/g, '').toUpperCase();
    }
  }
  return '';
}

function pickBusList(text) {
  if (!text) {
    return [];
  }

  const values = new Set();
  for (const pattern of BUS_PATTERNS) {
    const matches = text.match(pattern) || [];
    matches.forEach((m) => values.add(Number(m)));
  }

  return [...values].filter(Number.isFinite).sort((a, b) => a - b);
}

function isCPU(product) {
  return /cpu|processor|ryzen|intel core/i.test(`${product.category} ${product.name}`);
}

function isMainboard(product) {
  return /mainboard|motherboard|bo mach chu|bo mạch chủ/i.test(`${product.category} ${product.name}`);
}

function isRAM(product) {
  return /ram|memory|ddr4|ddr5/i.test(`${product.category} ${product.name}`);
}

async function main() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/thietbidientu';
  await mongoose.connect(mongoUri);

  const products = await Product.find({}).lean();
  let updated = 0;
  let scanned = 0;

  for (const product of products) {
    scanned += 1;

    const specs = toMapObject(product.specifications);
    const searchText = [
      product.name || '',
      product.description || '',
      specs.socket || '',
      specs['Socket'] || '',
      specs['CPU Socket'] || '',
      specs['Memory Speed'] || '',
      specs['Bus'] || '',
      specs['RAM Bus'] || '',
      specs['Supports'] || ''
    ].join(' ');

    let changed = false;

    if (isCPU(product)) {
      const socket = pickSocket(searchText);
      if (socket && specs.socket !== socket) {
        specs.socket = socket;
        changed = true;
      }
    }

    if (isMainboard(product)) {
      const socket = pickSocket(searchText);
      const buses = pickBusList(searchText);

      if (socket && specs.socket !== socket) {
        specs.socket = socket;
        changed = true;
      }

      if (buses.length > 0) {
        const normalized = JSON.stringify(buses);
        if (specs.supportedRamBus !== normalized) {
          specs.supportedRamBus = normalized;
          changed = true;
        }
      }
    }

    if (isRAM(product)) {
      const buses = pickBusList(searchText);
      if (buses.length > 0) {
        const maxBus = Math.max(...buses);
        if (specs.bus !== String(maxBus)) {
          specs.bus = String(maxBus);
          changed = true;
        }
      }
    }

    if (changed) {
      await Product.updateOne(
        { _id: product._id },
        { $set: { specifications: specs } }
      );
      updated += 1;
    }
  }

  console.log(`Scanned: ${scanned} products`);
  console.log(`Updated: ${updated} products`);

  await mongoose.disconnect();
}

main().catch((error) => {
  console.error('syncPCCompatibilitySpecs failed:', error.message);
  process.exit(1);
});
