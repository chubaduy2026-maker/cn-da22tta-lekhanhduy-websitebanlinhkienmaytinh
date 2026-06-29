/**
 * Seed products from MongoDB into ChromaDB collection `techstore_products`.
 * Usage: node src/scripts/seedChromaProducts.js
 */

require('dotenv').config();

const mongoose = require('mongoose');
const { ChromaClient } = require('chromadb');
const Product = require('../../models/Product');

const CHROMA_HOST = process.env.CHROMA_SERVER_HOST || process.env.CHROMA_HOST || '127.0.0.1';
const CHROMA_PORT = Number(process.env.CHROMA_SERVER_PORT || process.env.CHROMA_PORT || 8000);
const CHROMA_COLLECTION = process.env.CHROMA_PRODUCT_COLLECTION || 'techstore_products';
const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/thietbidientu';
const BATCH_SIZE = Math.max(1, Number(process.env.CHROMA_PRODUCT_SYNC_BATCH_SIZE || 32));

function buildDocumentText(product = {}) {
  const specs = product.specifications && typeof product.specifications === 'object'
    ? Object.entries(product.specifications).slice(0, 20).map(([k, v]) => `${k}: ${v}`).join('. ')
    : '';

  return [product.name, product.brand, product.category, product.description, specs]
    .filter(Boolean)
    .join('. ');
}

async function createChromaClient() {
  try {
    return new ChromaClient({
      host: CHROMA_HOST,
      port: CHROMA_PORT,
      ssl: false
    });
  } catch (err) {
    throw new Error('Failed to initialize Chroma client: ' + err.message);
  }
}

async function main() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(MONGO_URI, { autoIndex: false });
  console.log('✅ Connected to MongoDB');

  const products = await Product.find({}).lean();
  console.log(`Found ${products.length} products in MongoDB`);

  let chromaClient;
  try {
    chromaClient = await createChromaClient();
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }

  // Ensure Chroma server is reachable by attempting to get or create collection
  let collection;
  try {
    collection = await chromaClient.getCollection({ name: CHROMA_COLLECTION });
  } catch (err) {
    // If cannot reach server, give clear message
    const msg = String(err?.message || err || '').toLowerCase();
    if (msg.includes('connect') || msg.includes('ecconnrefused') || msg.includes('failed to fetch') || msg.includes('not found') ) {
      console.error('ChromaDB chưa chạy. Hãy bật ChromaDB server trước rồi chạy lại npm run seed:chroma');
      await mongoose.disconnect();
      process.exit(1);
    }
    // Try to create collection
    try {
      collection = await chromaClient.createCollection({ name: CHROMA_COLLECTION });
    } catch (createErr) {
      console.error('Không thể tạo collection trong ChromaDB:', createErr.message || createErr);
      await mongoose.disconnect();
      process.exit(1);
    }
  }

  if (!collection) {
    try {
      collection = await chromaClient.createCollection({ name: CHROMA_COLLECTION });
    } catch (err) {
      console.error('ChromaDB chưa chạy. Hãy bật ChromaDB server trước rồi chạy lại npm run seed:chroma');
      await mongoose.disconnect();
      process.exit(1);
    }
  }

  let processed = 0;
  let skipped = 0;

  for (let i = 0; i < products.length; i += BATCH_SIZE) {
    const batch = products.slice(i, i + BATCH_SIZE);
    const ids = [];
    const documents = [];
    const metadatas = [];

    for (const p of batch) {
      const doc = buildDocumentText(p);
      if (!doc || doc.length < 5) {
        skipped += 1;
        continue;
      }
      ids.push(String(p._id));
      documents.push(doc);
      metadatas.push({
        productId: String(p._id),
        name: p.name || '',
        brand: p.brand || '',
        category: p.category || '',
        price: Number(p.salePrice || p.price || 0) || 0,
        stock: Number(p.stock || 0) || 0
      });
    }

    if (ids.length === 0) continue;

    try {
      // Upsert documents - embeddings may be computed server-side if configured
      await collection.upsert({ ids, documents, metadatas });
      processed += ids.length;
      console.log(`Upserted ${processed}/${products.length} documents`);
    } catch (err) {
      console.error('Lỗi khi upsert vào ChromaDB:', err.message || err);
      await mongoose.disconnect();
      process.exit(1);
    }
  }

  console.log(`Seed completed. Total products: ${products.length}, processed: ${processed}, skipped: ${skipped}`);

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error('Seeding failed:', err.message || err);
  try { await mongoose.disconnect(); } catch (e) {}
  process.exit(1);
});
