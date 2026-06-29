require('dotenv').config();
const mongoose = require('mongoose');
const RAGPipeline = require('../services/ai/rag/RAGPipeline');
const EmbeddingService = require('../services/ai/rag/EmbeddingService');
const VectorSearchService = require('../services/ai/rag/VectorSearchService');
const KnowledgeDocument = require('../models/KnowledgeDocument');

async function test() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/thietbidientu');
    console.log('Connected to MongoDB');

    const query = 'Chính sách bảo hành laptop ở cửa hàng như thế nào?';
    console.log(`\nQuery: "${query}"`);

    // 1) Embed query
    const queryVector = await EmbeddingService.embedText(query);
    console.log('Query vector dimensions:', queryVector.length);

    // 2) Run raw aggregate search
    console.log('\n--- MongoDB Vector Search ---');
    const filter = { status: 'completed' };
    const rawDocs = await KnowledgeDocument.aggregate([
      {
        $vectorSearch: {
          index: process.env.MONGODB_KNOWLEDGE_VECTOR_INDEX || 'knowledge_embedding_index',
          path: 'embedding',
          queryVector,
          numCandidates: 40,
          limit: 5,
          filter
        }
      },
      {
        $project: {
          source: 1,
          category: 1,
          text: 1,
          similarity: { $meta: 'vectorSearchScore' }
        }
      }
    ]);

    console.log('Raw search matches:', rawDocs.length);
    rawDocs.forEach(d => {
      console.log(`- Source: ${d.source}, Similarity: ${d.similarity}`);
    });

    // 3) Run hybrid search fallback
    console.log('\n--- Hybrid Search Fallback ---');
    const hybridDocs = await VectorSearchService.hybridSearch(query, {
      limit: 5,
      minSimilarity: 0.65,
      categories: null
    });
    console.log('Hybrid matches:', hybridDocs.length);
    hybridDocs.forEach(d => {
      console.log(`- Source: ${d.source || d.metadata?.source}, Score/Similarity: ${d.similarity || d.score || d.finalScore}`);
    });

    await mongoose.disconnect();
  } catch (error) {
    console.error('Test crashed:', error);
  }
}

test();
