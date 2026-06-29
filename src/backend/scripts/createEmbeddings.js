/**
 * createEmbeddings.js
 * Script để trigger tạo embeddings và build FAISS index thông qua AI Service.
 * 
 * Chức năng:
 *   - Gọi AI Service để rebuild vector index
 *   - Fallback: gọi Python script trực tiếp nếu cần
 * 
 * Chạy: node scripts/createEmbeddings.js
 */

const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

async function checkAIServiceHealth() {
  try {
    const response = await axios.get(`${AI_SERVICE_URL}/health`, { timeout: 5000 });
    return response.data.status === 'healthy';
  } catch (error) {
    return false;
  }
}

async function triggerEmbeddingBuild() {
  console.log('=' .repeat(60));
  console.log('🚀 TechStore - Create Product Embeddings');
  console.log('=' .repeat(60));
  console.log(`📡 AI Service URL: ${AI_SERVICE_URL}`);
  console.log('');

  // Check AI service health
  console.log('🔍 Checking AI Service health...');
  const isHealthy = await checkAIServiceHealth();
  
  if (!isHealthy) {
    console.error('❌ AI Service is not available!');
    console.log('');
    console.log('💡 Please ensure the AI service is running:');
    console.log('   Start the local AI service on http://localhost:8000');
    console.log('   Example: cd ai-service && uvicorn main:app --host 0.0.0.0 --port 8000');
    process.exit(1);
  }
  
  console.log('✅ AI Service is healthy');
  console.log('');

  // Trigger training which includes embedding rebuild
  console.log('🔧 Triggering embedding/index rebuild via /train endpoint...');
  
  try {
    const response = await axios.post(
      `${AI_SERVICE_URL}/train`,
      { force: true },
      { 
        timeout: 300000, // 5 minutes timeout for training
        headers: { 'Content-Type': 'application/json' }
      }
    );
    
    if (response.data.success) {
      console.log('✅ Training/Embedding build started successfully!');
      console.log(`   Status: ${response.data.status}`);
      console.log(`   Message: ${response.data.message}`);
    } else {
      console.warn('⚠️ Training returned non-success response:', response.data);
    }
  } catch (error) {
    console.error('❌ Failed to trigger embedding build:', error.message);
    if (error.response) {
      console.error('   Response:', error.response.data);
    }
    process.exit(1);
  }
  
  console.log('');
  
  // Wait and check status
  console.log('⏳ Waiting for training to complete (polling every 10s)...');
  
  let attempts = 0;
  const maxAttempts = 30; // 5 minutes max
  
  while (attempts < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, 10000)); // 10 seconds
    attempts++;
    
    try {
      const statusResponse = await axios.get(`${AI_SERVICE_URL}/status`);
      const models = statusResponse.data.models;
      
      if (!models.is_training) {
        console.log('');
        console.log('=' .repeat(60));
        console.log('📊 Training Complete - Model Status:');
        console.log('=' .repeat(60));
        
        console.log(`   SVD:           fitted=${models.svd?.fitted}, confidence=${(models.svd?.confidence * 100).toFixed(1)}%`);
        console.log(`   ALS:           fitted=${models.als?.fitted}, confidence=${(models.als?.confidence * 100).toFixed(1)}%`);
        console.log(`   NCF:           fitted=${models.ncf?.fitted}, confidence=${(models.ncf?.confidence * 100).toFixed(1)}%`);
        console.log(`   Content-Based: fitted=${models.content_based?.fitted}, n_products=${models.content_based?.n_products}`);
        console.log(`   Association:   fitted=${models.association?.fitted}, n_rules=${models.association?.n_rules}`);
        console.log('');
        console.log(`   Last trained: ${models.last_trained}`);
        console.log('');
        console.log('✅ Embeddings and FAISS index built successfully!');
        
        process.exit(0);
      }
      
      process.stdout.write(`\r   Training in progress... (${attempts * 10}s elapsed)`);
    } catch (error) {
      console.warn(`   Warning: Status check failed: ${error.message}`);
    }
  }
  
  console.log('');
  console.warn('⚠️ Training is still in progress after 5 minutes. Check logs for status.');
  console.log('   Check the local AI service logs for status.');
  process.exit(0);
}

// Run
triggerEmbeddingBuild().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
