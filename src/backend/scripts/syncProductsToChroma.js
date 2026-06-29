/**
 * Sync MongoDB products into local/remote ChromaDB.
 *
 * Purpose:
 * - Build a Chroma collection for product RAG retrieval.
 * - Keep MongoDB as the source of truth for products.
 *
 * Usage:
 *   node scripts/syncProductsToChroma.js
 */

require('dotenv').config();

const mongoose = require('mongoose');
const { ChromaClient } = require('chromadb');
const { GoogleGenerativeAIEmbeddings } = require('@langchain/google-genai');

const Product = require('../models/Product');

const CHROMA_COLLECTION = process.env.CHROMA_PRODUCT_COLLECTION || 'techstore_products';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const EMBEDDING_MODEL = process.env.CHROMA_EMBEDDING_MODEL || process.env.GEMINI_EMBEDDING_MODEL || 'embedding-001';
const BATCH_SIZE = Math.max(1, Number(process.env.CHROMA_PRODUCT_SYNC_BATCH_SIZE || 32));

function normalizePriceRange(price = 0) {
  const numeric = Number(price) || 0;
  if (numeric < 5000000) return 'budget';
  if (numeric < 15000000) return 'mid-range';
  if (numeric < 30000000) return 'high-end';
  return 'premium';
}

function buildSourceText(product = {}) {
  const specs = product.specifications && typeof product.specifications === 'object'
    ? Object.entries(product.specifications)
      .slice(0, 20)
      .map(([key, value]) => `${key}: ${value}`)
      .join('. ')
    : '';

  return [
    product.name,
    product.brand,
    product.category,
    product.description,
    specs,
    `Giá: ${product.salePrice || product.price || 0}`,
    `Tồn kho: ${product.stock || 0}`
  ].filter(Boolean).join('. ');
}

async function getEmbeddings() {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is required to generate product embeddings');
  }

  return new GoogleGenerativeAIEmbeddings({
    apiKey: GEMINI_API_KEY,
    modelName: EMBEDDING_MODEL
  });
}

async function main() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/thietbidientu';
  const chromaUrl = String(process.env.CHROMA_URL || '').trim();

  await mongoose.connect(mongoUri);
  console.log('✅ Connected to MongoDB');

  const embeddings = await getEmbeddings();
  const products = await Product.find({}).lean();
  console.log(`📦 Found ${products.length} products`);

  const chromaClient = chromaUrl
    ? (() => {
        const parsed = new URL(chromaUrl);
        return new ChromaClient({
          host: parsed.hostname,
          port: parsed.port ? Number(parsed.port) : (parsed.protocol === 'https:' ? 443 : 8000),
          ssl: parsed.protocol === 'https:'
        });
      })()
    : new ChromaClient({
        host: process.env.CHROMA_HOST || '127.0.0.1',
        port: Number(process.env.CHROMA_PORT || 8000),
        ssl: String(process.env.CHROMA_SSL || 'false').toLowerCase() === 'true'
      });

  let collection;
  try {
    collection = await chromaClient.getCollection({ name: CHROMA_COLLECTION });
  } catch (error) {
    collection = await chromaClient.createCollection({
      name: CHROMA_COLLECTION,
      embeddingFunction: null,
      metadata: { 'hnsw:space': 'cosine' }
    });
  }

  let processed = 0;
  let skipped = 0;

  for (let index = 0; index < products.length; index += BATCH_SIZE) {
    const batch = products.slice(index, index + BATCH_SIZE);
    const records = [];

    for (const product of batch) {
      const sourceText = buildSourceText(product);
      if (!sourceText || sourceText.length < 10) {
        skipped += 1;
        continue;
      }

      records.push({
        id: String(product._id),
        document: sourceText,
        metadata: {
          productId: String(product._id),
          productName: product.name || '',
          brand: product.brand || '',
          category: product.category || '',
          price: Number(product.salePrice || product.price || 0) || 0,
          stock: Number(product.stock || 0) || 0,
          priceRange: normalizePriceRange(product.salePrice || product.price || 0),
          source: 'mongo_product'
        }
      });
    }

    if (records.length === 0) {
      continue;
    }

    const vectors = await embeddings.embedDocuments(records.map((item) => item.document));

    await collection.upsert({
      ids: records.map((item) => item.id),
      documents: records.map((item) => item.document),
      embeddings: vectors,
      metadatas: records.map((item) => item.metadata)
    });

    processed += records.length;
    console.log(`✅ Synced ${processed}/${products.length} products`);
  }

  console.log('🎉 Product sync completed');
  console.log(JSON.stringify({
    collection: CHROMA_COLLECTION,
    totalProducts: products.length,
    processed,
    skipped,
    embeddingModel: EMBEDDING_MODEL
  }, null, 2));

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error('❌ Product sync failed:', error.message);
  try {
    await mongoose.disconnect();
  } catch (disconnectError) {
    // ignore disconnect errors
  }
  process.exit(1);
});