const mongoose = require('mongoose');
const Product = require('../models/Product');
const Category = require('../models/Category');
require('dotenv').config();

const systemSummary = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/thietbidientu');
    console.log('✅ Connected to MongoDB\n');
    
    // Lấy thông tin categories
    const categories = await Category.find().sort({ order: 1, name: 1 });
    console.log('=' .repeat(100));
    console.log('📊 HỆ THỐNG QUẢN LÝ SẢN PHẨM - TỔNG QUAN');
    console.log('='.repeat(100));
    
    console.log(`\n📁 TỔNG SỐ DANH MỤC: ${categories.length}`);
    console.log('-'.repeat(100));
    
    let totalProducts = 0;
    let totalStock = 0;
    let totalValue = 0;
    
    for (const category of categories) {
      const products = await Product.find({ category: category.name });
      const categoryStock = products.reduce((sum, p) => sum + (p.stock || 0), 0);
      const categoryValue = products.reduce((sum, p) => sum + (p.price * p.stock || 0), 0);
      
      totalProducts += products.length;
      totalStock += categoryStock;
      totalValue += categoryValue;
      
      console.log(`\n${category.icon || '📦'} ${category.name}`);
      console.log(`   Số sản phẩm: ${products.length}`);
      console.log(`   Tồn kho: ${categoryStock} sản phẩm`);
      console.log(`   Giá trị: ${categoryValue.toLocaleString('vi-VN')} đ`);
      
      if (products.length > 0) {
        const avgPrice = products.reduce((sum, p) => sum + p.price, 0) / products.length;
        console.log(`   Giá trung bình: ${avgPrice.toLocaleString('vi-VN')} đ`);
      }
    }
    
    console.log('\n' + '='.repeat(100));
    console.log('📈 THỐNG KÊ TỔNG HỢP');
    console.log('='.repeat(100));
    console.log(`Tổng số sản phẩm: ${totalProducts}`);
    console.log(`Tổng tồn kho: ${totalStock} sản phẩm`);
    console.log(`Tổng giá trị hàng tồn: ${totalValue.toLocaleString('vi-VN')} đ`);
    console.log(`Giá trị trung bình/sản phẩm: ${(totalValue / totalStock).toLocaleString('vi-VN')} đ`);
    
    // Top 5 sản phẩm đắt nhất
    console.log('\n💎 TOP 5 SẢN PHẨM ĐẮT NHẤT');
    console.log('-'.repeat(100));
    const topExpensive = await Product.find().sort({ price: -1 }).limit(5);
    topExpensive.forEach((p, i) => {
      console.log(`${i + 1}. ${p.name}`);
      console.log(`   Giá: ${p.price.toLocaleString('vi-VN')} đ | Danh mục: ${p.category}`);
    });
    
    // Top 5 sản phẩm rẻ nhất
    console.log('\n💰 TOP 5 SẢN PHẨM RẺ NHẤT');
    console.log('-'.repeat(100));
    const topCheap = await Product.find().sort({ price: 1 }).limit(5);
    topCheap.forEach((p, i) => {
      console.log(`${i + 1}. ${p.name}`);
      console.log(`   Giá: ${p.price.toLocaleString('vi-VN')} đ | Danh mục: ${p.category}`);
    });
    
    // Sản phẩm sắp hết hàng
    console.log('\n⚠️  SẢN PHẨM SẮP HẾT HÀNG (Tồn kho ≤ 2)');
    console.log('-'.repeat(100));
    const lowStock = await Product.find({ stock: { $lte: 2 } }).sort({ stock: 1 });
    if (lowStock.length === 0) {
      console.log('   ✅ Không có sản phẩm nào sắp hết hàng');
    } else {
      lowStock.forEach((p) => {
        console.log(`   🔴 ${p.name}`);
        console.log(`      Tồn kho: ${p.stock} | Danh mục: ${p.category}`);
      });
    }
    
    // Sản phẩm featured
    console.log('\n⭐ SẢN PHẨM NỔI BẬT (Featured)');
    console.log('-'.repeat(100));
    const featured = await Product.find({ featured: true });
    console.log(`   Có ${featured.length} sản phẩm được đánh dấu nổi bật`);
    
    console.log('\n' + '='.repeat(100));
    console.log('✨ Hệ thống đang hoạt động tốt!');
    console.log('='.repeat(100));
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

systemSummary();
