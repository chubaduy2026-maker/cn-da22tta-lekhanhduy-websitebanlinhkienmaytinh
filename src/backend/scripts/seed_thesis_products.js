/**
 * seed_thesis_products.js — Script seed dữ liệu mẫu từ thesis/sample_data.json
 *
 * Chức năng:
 *   - Import 30 sản phẩm mẫu vào MongoDB
 *   - Tạo categories tương ứng
 *   - Bỏ qua sản phẩm đã tồn tại (upsert by name)
 *   - Hỗ trợ flag --force để seed lại toàn bộ
 *   - Hỗ trợ flag --clean để xóa hết rồi seed lại
 *
 * Cách dùng:
 *   cd d:\TechStore_AI\backend
 *   node scripts/seed_thesis_products.js           ← Seed mới (skip existing)
 *   node scripts/seed_thesis_products.js --force   ← Seed kể cả đã có
 *   node scripts/seed_thesis_products.js --clean   ← Xóa hết, seed lại từ đầu
 *
 * @module scripts/seed_thesis_products
 */

'use strict';

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const mongoose = require('mongoose');
const fs = require('fs');

// ===========================================================
// CONSTANTS
// ===========================================================
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/thietbidientu';
const SAMPLE_DATA_PATH = path.join(__dirname, '../../thesis/sample_data.json');
const FORCE = process.argv.includes('--force') || process.argv.includes('-f');
const CLEAN = process.argv.includes('--clean') || process.argv.includes('-c');

// ===========================================================
// CATEGORY COLOR MAP
// ===========================================================
const CATEGORY_META = {
  laptop: { color: '#4f46e5', icon: '💻', description: 'Laptop & Máy tính xách tay' },
  cpu: { color: '#0891b2', icon: '🔧', description: 'Vi xử lý CPU' },
  gpu: { color: '#16a34a', icon: '🖥️', description: 'Card đồ họa GPU/VGA' },
  ram: { color: '#d97706', icon: '💾', description: 'Bộ nhớ RAM' },
  ssd: { color: '#dc2626', icon: '⚡', description: 'Ổ cứng thể rắn SSD' },
  mainboard: { color: '#7c3aed', icon: '🔌', description: 'Bo mạch chủ Mainboard' },
  psu: { color: '#059669', icon: '🔋', description: 'Nguồn máy tính PSU' },
  monitor: { color: '#0284c7', icon: '🖥️', description: 'Màn hình máy tính' },
  mouse: { color: '#9333ea', icon: '🖱️', description: 'Chuột máy tính' },
  keyboard: { color: '#ea580c', icon: '⌨️', description: 'Bàn phím' },
  headset: { color: '#0d9488', icon: '🎧', description: 'Tai nghe' },
  case: { color: '#475569', icon: '📦', description: 'Vỏ máy tính Case' }
};

// ===========================================================
// HELPERS
// ===========================================================

function log(icon, msg) {
  console.log(`  ${icon} ${msg}`);
}

function hr(char = '─', width = 60) {
  console.log(char.repeat(width));
}

function formatVND(amount) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
}

// ===========================================================
// MAIN
// ===========================================================

async function main() {
  hr('═');
  console.log('🚀  TechStore AI — Seed Thesis Products');
  console.log(`    Mode: ${CLEAN ? '🗑️  CLEAN (xóa + seed lại)' : FORCE ? '⚡ FORCE (seed kể cả đã có)' : '🆕 NORMAL (skip existing)'}`);
  hr('═');

  // 1) Đọc dữ liệu mẫu
  if (!fs.existsSync(SAMPLE_DATA_PATH)) {
    console.error(`❌ Không tìm thấy file: ${SAMPLE_DATA_PATH}`);
    process.exit(1);
  }

  const rawData = JSON.parse(fs.readFileSync(SAMPLE_DATA_PATH, 'utf-8'));
  const { products: sampleProducts, metadata } = rawData;

  console.log(`\n📦 Đọc dữ liệu: ${sampleProducts.length} sản phẩm từ ${SAMPLE_DATA_PATH}`);
  console.log(`   Version: ${metadata.version} | ${metadata.description}`);

  // 2) Kết nối MongoDB
  console.log(`\n🔗 Kết nối MongoDB...`);
  await mongoose.connect(MONGODB_URI);
  const dbName = mongoose.connection.db.databaseName;
  log('✅', `Đã kết nối: ${dbName}`);

  // 3) Load models
  const Product = require('../models/Product');
  let Category;
  try {
    Category = require('../models/Category');
  } catch {
    Category = null;
    log('⚠️', 'Model Category không tồn tại, bỏ qua tạo category');
  }

  // 4) Clean nếu cần
  if (CLEAN) {
    const count = await Product.countDocuments();
    console.log(`\n🗑️  Xóa ${count} sản phẩm hiện có...`);
    await Product.deleteMany({});
    log('✅', `Đã xóa ${count} sản phẩm`);
  }

  // 5) Tạo categories
  if (Category) {
    console.log('\n📁 Đảm bảo categories tồn tại...');
    const categoryKeys = [...new Set(sampleProducts.map(p => p.category))];

    for (const catKey of categoryKeys) {
      const meta = CATEGORY_META[catKey] || { description: catKey, icon: '📦' };
      const catName = catKey.charAt(0).toUpperCase() + catKey.slice(1);

      try {
        await Category.findOneAndUpdate(
          { name: new RegExp(`^${catKey}$`, 'i') },
          {
            $setOnInsert: {
              name: catName,
              slug: catKey,
              description: meta.description,
              isActive: true
            }
          },
          { upsert: true, new: true }
        );
        log('✅', `Category: ${catName} (${meta.icon})`);
      } catch (err) {
        log('⚠️', `Category ${catName}: ${err.message}`);
      }
    }
  }

  // 6) Seed sản phẩm
  console.log('\n📦 Seed sản phẩm...');
  hr();

  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const productData of sampleProducts) {
    const { useCase, highlights, ...dbFields } = productData; // tách metadata không thuộc schema

    try {
      const existing = await Product.findOne({ name: productData.name });

      if (existing && !FORCE && !CLEAN) {
        log('⏭️', `Bỏ qua (đã tồn tại): ${productData.name.slice(0, 50)}`);
        skipped++;
        continue;
      }

      // Chuẩn bị data cho Product schema
      const productDoc = {
        name: dbFields.name,
        description: dbFields.description || '',
        category: dbFields.category || 'laptop',
        brand: dbFields.brand || 'Unknown',
        price: Number(dbFields.price) || 0,
        salePrice: dbFields.salePrice ? Number(dbFields.salePrice) : undefined,
        costPrice: dbFields.costPrice ? Number(dbFields.costPrice) : undefined,
        stock: Number(dbFields.stock) || 0,
        rating: Number(dbFields.rating) || 0,
        reviewCount: Number(dbFields.reviewCount) || 0,
        specifications: dbFields.specifications || {},
        images: dbFields.images || [],
        isActive: true,
        isFeatured: (dbFields.rating || 0) >= 4.8
      };

      if (existing && FORCE) {
        await Product.findByIdAndUpdate(existing._id, productDoc);
        log('🔄', `Cập nhật: ${productData.name.slice(0, 50)} | ${formatVND(productDoc.salePrice || productDoc.price)}`);
        updated++;
      } else {
        await Product.create(productDoc);
        log('✅', `Thêm mới: ${productData.name.slice(0, 50)} | ${formatVND(productDoc.salePrice || productDoc.price)}`);
        inserted++;
      }
    } catch (err) {
      log('❌', `Lỗi: ${productData.name.slice(0, 40)} — ${err.message}`);
      failed++;
    }
  }

  // 7) Thống kê
  hr('═');
  console.log('\n📊 KẾT QUẢ:');

  const total = await Product.countDocuments();
  const byCategory = await Product.aggregate([
    { $group: { _id: '$category', count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]);

  console.log(`\n  ✅ Thêm mới:  ${inserted} sản phẩm`);
  console.log(`  🔄 Cập nhật:  ${updated} sản phẩm`);
  console.log(`  ⏭️  Bỏ qua:   ${skipped} sản phẩm`);
  console.log(`  ❌ Lỗi:      ${failed} sản phẩm`);
  console.log(`\n  📦 Tổng sản phẩm trong DB: ${total}`);

  console.log('\n  Phân loại:');
  for (const cat of byCategory) {
    const icon = CATEGORY_META[cat._id?.toLowerCase()]?.icon || '📦';
    console.log(`    ${icon} ${cat._id}: ${cat.count} sản phẩm`);
  }

  hr('═');
  console.log('\n💡 Bước tiếp theo:');
  console.log('   1. Tạo vector embeddings:    node scripts/createEmbeddings.js');
  console.log('   2. Sync lên ChromaDB:        node scripts/syncProductsToChroma.js');
  console.log('   3. Tạo Atlas Vector Index:   node scripts/createAtlasVectorIndexes.js');
  console.log('   4. Chạy evaluation:          node evaluation/run_evaluation.js\n');

  await mongoose.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error('\n❌ Lỗi nghiêm trọng:', err.message);
  console.error(err.stack);
  process.exit(1);
});
