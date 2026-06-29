require('dotenv').config();
const mongoose = require('mongoose');

async function main() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/thietbidientu');
    console.log('Connected to MongoDB');
    
    const db = mongoose.connection.db;
    
    // List collections
    const collections = await db.listCollections().toArray();
    console.log('Collections:', collections.map(c => c.name));
    
    for (const coll of ['products', 'productembeddings', 'knowledgedocuments']) {
      try {
        console.log(`\nSearch Indexes for collection: ${coll}`);
        const indexes = await db.collection(coll).listSearchIndexes().toArray();
        console.log(JSON.stringify(indexes, null, 2));
      } catch (err) {
        console.log(`Error listing search indexes for ${coll}:`, err.message);
      }
    }
    
    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error);
  }
}

main();
