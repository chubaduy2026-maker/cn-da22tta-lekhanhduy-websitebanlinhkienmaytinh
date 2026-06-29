const path = require('path');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '..', '.env') });
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

const ProductSearchAgent = require('../services/ai/agents/ProductSearchAgent');
const SearchContext = require('../src/utils/SearchContext');

const TEST_MESSAGES = [
  'tôi cần tìm laptop Dell',
  'cho tôi xem laptop ASUS',
  'tìm SSD 1TB',
  'shop có chuột Logitech không',
  'cho tôi xem màn hình Samsung',
  'tìm RAM 16GB',
  'có tai nghe Razer không',
  'cho tôi xem CPU Intel',
  'tìm VGA Gigabyte',
  'có nguồn 650W không'
];

async function run() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/thietbidientu';
  console.log('Connecting to MongoDB...');
  await mongoose.connect(mongoUri, {
    serverSelectionTimeoutMS: Number(process.env.MONGO_TEST_TIMEOUT_MS || 10000)
  });
  console.log('Connected to MongoDB');

  for (const message of TEST_MESSAGES) {
    const context = await SearchContext.build(message, 'product_search', `test_${Date.now()}`);
    const products = await ProductSearchAgent._searchProductsFromMongo(message, {
      budget: {
        minPrice: context.priceMin,
        maxPrice: context.priceMax
      },
      brand: context.brand,
      category: context.category,
      allowedKeywords: context.allowedKeywords,
      specs: context.specs
    });
    const debug = ProductSearchAgent.getLastSearchDebug() || {};

    console.log('\n================ PRODUCT SEARCH SERVICE TEST ================');
    console.log('input:', message);
    console.log('extractedBrand:', context.brand || null);
    console.log('extractedCategory:', context.category || null);
    console.log('finalMongoQuery:', debug.finalMongoQueryText || '{}');
    console.log('matchedLevel:', debug.matchedLevel || 'none');
    console.log('resultCount:', products.length);
    console.log('firstProducts:', (debug.firstProducts || []).map(p => ({
      id: p.id,
      name: p.name,
      brand: p.brand,
      category: p.category,
      price: p.price,
      stock: p.stock,
      isActive: p.isActive,
      status: p.status
    })));
  }

  await mongoose.disconnect();
}

run().catch(async (error) => {
  console.error('ProductSearchService direct test failed:', error);
  try {
    await mongoose.disconnect();
  } catch (_) {
    // ignore cleanup errors
  }
  process.exit(1);
});
