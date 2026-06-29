/**
 * Generate Product Embeddings Script
 * Creates vector embeddings for all products using Gemini Embedding API
 * Stores in ProductEmbedding collection for semantic product search
 * 
 * Usage: node scripts/generateProductEmbeddings.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Product = require('../models/Product');
const ProductEmbedding = require('../models/ProductEmbedding');
const EmbeddingService = require('../services/ai/rag/EmbeddingService');

async function main() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/thietbidientu';
  await mongoose.connect(mongoUri);
  console.log('✅ Connected to MongoDB\n');

  if (!EmbeddingService.isAvailable()) {
    console.error('❌ EmbeddingService not available. Check GEMINI_API_KEY in .env');
    process.exit(1);
  }

  const products = await Product.find({}).lean();
  console.log(`📦 Found ${products.length} products\n`);

  let created = 0, updated = 0, errors = 0;

  for (const product of products) {
    try {
      // Build source text from product data
      const specs = product.specifications
        ? Object.entries(product.specifications).map(([k, v]) => `${k}: ${v}`).join('. ')
        : '';

      const sourceText = [
        product.name,
        product.brand,
        product.category,
        product.description?.substring(0, 500),
        specs
      ].filter(Boolean).join('. ');

      if (!sourceText || sourceText.length < 10) {
        console.log(`  ⏭ Skipping ${product.name} (insufficient text)`);
        continue;
      }

      // Generate embedding
      const embedding = await EmbeddingService.embedText(sourceText);

      // Upsert into ProductEmbedding
      const existing = await ProductEmbedding.findOne({ product: product._id });
      if (existing) {
        existing.sourceText = sourceText;
        existing.embedding = embedding;
        existing.dimension = embedding.length;
        existing.embeddingModel = 'gemini-embedding-001';
        existing.metadata = {
          productName: product.name,
          category: product.category,
          brand: product.brand,
          priceRange: getPriceRange(product.price)
        };
        existing.status = 'completed';
        await existing.save();
        updated++;
      } else {
        await ProductEmbedding.create({
          product: product._id,
          sourceText,
          embedding,
          dimension: embedding.length,
          embeddingModel: 'gemini-embedding-001',
          metadata: {
            productName: product.name,
            category: product.category,
            brand: product.brand,
            priceRange: getPriceRange(product.price)
          },
          status: 'completed'
        });
        created++;
      }

      console.log(`  ✅ ${product.name} (${embedding.length}D)`);

      // Rate limit
      await new Promise(resolve => setTimeout(resolve, 150));

    } catch (error) {
      console.error(`  ❌ ${product.name}: ${error.message}`);
      errors++;
    }
  }

  console.log(`\n🎉 Product embedding generation complete!`);
  console.log(`   Created: ${created}, Updated: ${updated}, Errors: ${errors}`);

  await mongoose.disconnect();
}

function getPriceRange(price) {
  if (!price) return 'unknown';
  if (price < 5000000) return 'budget';
  if (price < 15000000) return 'mid-range';
  if (price < 30000000) return 'high-end';
  return 'premium';
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
