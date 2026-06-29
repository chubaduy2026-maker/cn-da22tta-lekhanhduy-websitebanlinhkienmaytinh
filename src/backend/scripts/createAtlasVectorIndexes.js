/**
 * createAtlasVectorIndexes.js
 * Create Atlas Search Vector indexes for KnowledgeDocument and ProductEmbedding.
 *
 * Usage:
 *   node scripts/createAtlasVectorIndexes.js
 */

require('dotenv').config();
const mongoose = require('mongoose');

const knowledgeCollection = process.env.MONGODB_KNOWLEDGE_COLLECTION || 'knowledgedocuments';
const productEmbeddingCollection = process.env.MONGODB_PRODUCT_EMBEDDING_COLLECTION || 'productembeddings';
const knowledgeIndexName = process.env.MONGODB_KNOWLEDGE_VECTOR_INDEX || 'knowledge_embedding_index';
const productIndexName = process.env.MONGODB_PRODUCT_VECTOR_INDEX || 'product_embedding_index';
const dimensions = Number(process.env.EMBEDDING_DIMENSION || 384);

async function ensureSearchIndex(db, collectionName, indexName, indexDefinition) {
  const collection = db.collection(collectionName);

  try {
    const indexes = await collection.listSearchIndexes().toArray();
    const existed = indexes.find((idx) => idx.name === indexName);

    if (existed) {
      console.log(`[SKIP] Search index already exists: ${collectionName}/${indexName}`);
      return;
    }

    const createdName = await collection.createSearchIndex({
      name: indexName,
      definition: indexDefinition
    });

    console.log(`[OK] Created search index ${createdName} on ${collectionName}`);
  } catch (error) {
    console.error(`[ERR] Failed on ${collectionName}/${indexName}:`, error.message);
    throw error;
  }
}

async function main() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/thietbidientu';

  try {
    await mongoose.connect(mongoUri);
    const db = mongoose.connection.db;

    console.log('Connected to MongoDB Atlas');
    console.log(`Using embedding dimension: ${dimensions}`);

    const knowledgeVectorDefinition = {
      mappings: {
        dynamic: false,
        fields: {
          embedding: {
            type: 'knnVector',
            dimensions,
            similarity: 'cosine'
          },
          status: {
            type: 'token'
          },
          category: {
            type: 'token'
          }
        }
      }
    };

    const productVectorDefinition = {
      mappings: {
        dynamic: false,
        fields: {
          embedding: {
            type: 'knnVector',
            dimensions,
            similarity: 'cosine'
          },
          status: {
            type: 'token'
          },
          metadata: {
            type: 'document',
            fields: {
              category: { type: 'token' },
              brand: { type: 'token' }
            }
          }
        }
      }
    };

    await ensureSearchIndex(db, knowledgeCollection, knowledgeIndexName, knowledgeVectorDefinition);
    await ensureSearchIndex(db, productEmbeddingCollection, productIndexName, productVectorDefinition);

    console.log('Atlas vector index setup completed');
    process.exit(0);
  } catch (error) {
    console.error('Atlas index setup failed:', error.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

main();
