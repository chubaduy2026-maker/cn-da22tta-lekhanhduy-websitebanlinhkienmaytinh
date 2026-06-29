require('dotenv').config();
const mongoose = require('mongoose');
const Product = require('../models/Product');
const UserBehavior = require('../models/UserBehavior');
const RecommendationService = require('../services/ai/RecommendationService');

async function runTest() {
  const testSessionId = 'test_session_smart_rec_' + Date.now();
  console.log(`🚀 Starting smart recommendation validation test (Session ID: ${testSessionId})...`);

  try {
    // 1. Kết nối database
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB.');

    // 2. Lấy các sản phẩm thực tế từ DB để tạo dữ liệu giả lập hành vi
    const laptop = await Product.findOne({ category: { $regex: /laptop/i }, isActive: true, stock: { $gt: 0 } });
    const accessory = await Product.findOne({ category: { $in: ['Chuột', 'Bàn phím', 'Tai nghe', 'Màn hình'] }, isActive: true, stock: { $gt: 0 } });
    const components = await Product.find({ category: { $in: ['Mainboard', 'CPU', 'VGA', 'RAM'] }, isActive: true, stock: { $gt: 0 } }).limit(2);

    if (!laptop || !accessory || components.length < 1) {
      console.error('❌ Yêu cầu database có sẵn một số sản phẩm thuộc các danh mục khác nhau (Laptop, Chuột/Bàn phím, Linh kiện PC) để chạy thử nghiệm.');
      process.exit(1);
    }

    console.log(`\n📦 Đã chọn các sản phẩm dùng cho kiểm thử:`);
    console.log(`  - Laptop: ${laptop.name} [Category: ${laptop.category}, Brand: ${laptop.brand}, Price: ${laptop.price}]`);
    console.log(`  - Phụ kiện: ${accessory.name} [Category: ${accessory.category}, Brand: ${accessory.brand}, Price: ${accessory.price}]`);
    components.forEach((c, idx) => {
      console.log(`  - Linh kiện ${idx + 1}: ${c.name} [Category: ${c.category}, Brand: ${c.brand}, Price: ${c.price}]`);
    });

    // 3. Tạo dữ liệu giả lập hành vi người dùng
    console.log('\n📝 Giả lập hành vi người dùng:');
    const behaviors = [
      // Tìm kiếm từ khóa liên quan đến thương hiệu Laptop
      {
        sessionId: testSessionId,
        eventType: 'search_keyword',
        keyword: `${laptop.brand} laptop`
      },
      // Xem chi tiết Laptop
      {
        sessionId: testSessionId,
        eventType: 'view_product',
        productId: laptop._id,
        category: laptop.category,
        brand: laptop.brand,
        price: laptop.price
      },
      // Thêm Laptop vào giỏ hàng
      {
        sessionId: testSessionId,
        eventType: 'add_to_cart',
        productId: laptop._id,
        category: laptop.category,
        brand: laptop.brand,
        price: laptop.price
      }
    ];

    await UserBehavior.insertMany(behaviors);
    console.log(`  ✅ Đã lưu ${behaviors.length} hành vi giả lập vào MongoDB.`);

    // 4. TEST CASE 1: Trang chủ (Home Page) - Gợi ý cá nhân hóa theo lịch sử hành vi
    console.log('\n--- TEST CASE 1: Gợi ý Cá nhân hóa Trang chủ (Home Recommendations) ---');
    const homeRecs = await RecommendationService.getSmartRecommendations(null, testSessionId, { limit: 4 });
    console.log(`Số lượng kết quả gợi ý nhận được: ${homeRecs.length}`);
    homeRecs.forEach((prod, index) => {
      console.log(`${index + 1}. [Match Score: ${prod.aiMatchScore}%] ${prod.name}`);
      console.log(`   Phân loại: ${prod.category} | Thương hiệu: ${prod.brand} | Giá: ${prod.price}`);
      console.log(`   Lý do đề xuất: ${prod.recommendationReasons.join(', ')}`);
    });

    // 5. TEST CASE 2: Trang chi tiết sản phẩm (Product Detail Page) - Upsell Boost
    // Giả lập xem sản phẩm Laptop hiện tại, kỳ vọng sản phẩm cùng danh mục Laptop đắt tiền hơn (hoặc tương đương) nhưng cấu hình mạnh hơn có điểm cao
    console.log('\n--- TEST CASE 2: Gợi ý Nâng cấp (Upsell Recommendations) trên Trang Chi tiết sản phẩm ---');
    const productRecs = await RecommendationService.getSmartRecommendations(null, testSessionId, {
      productId: laptop._id,
      category: laptop.category,
      brand: laptop.brand,
      price: laptop.price,
      limit: 4
    });
    console.log(`Số lượng kết quả gợi ý nhận được: ${productRecs.length}`);
    productRecs.forEach((prod, index) => {
      console.log(`${index + 1}. [Match Score: ${prod.aiMatchScore}%] ${prod.name}`);
      console.log(`   Phân loại: ${prod.category} | Thương hiệu: ${prod.brand} | Giá: ${prod.price}`);
      console.log(`   Lý do đề xuất: ${prod.recommendationReasons.join(', ')}`);
    });

    // 6. TEST CASE 3: Trang giỏ hàng (Cart Page) - Cross-sell Boost
    // Giả lập trong giỏ hàng đang có chiếc Laptop, kỳ vọng hệ thống gợi ý các phụ kiện tương thích (như Chuột, Bàn phím...) có booster đặc biệt
    console.log('\n--- TEST CASE 3: Gợi ý Bán kèm (Cross-sell/Accessories) trên Trang Giỏ hàng ---');
    // Truyền context cartItems chứa Laptop
    const cartRecs = await RecommendationService.getSmartRecommendations(null, testSessionId, {
      cartItems: [{ productId: laptop._id, quantity: 1 }],
      isCartPage: true,
      limit: 4
    });
    console.log(`Số lượng kết quả gợi ý nhận được: ${cartRecs.length}`);
    cartRecs.forEach((prod, index) => {
      console.log(`${index + 1}. [Match Score: ${prod.aiMatchScore}%] ${prod.name}`);
      console.log(`   Phân loại: ${prod.category} | Thương hiệu: ${prod.brand} | Giá: ${prod.price}`);
      console.log(`   Lý do đề xuất: ${prod.recommendationReasons.join(', ')}`);
    });

    // 7. Dọn dẹp dữ liệu kiểm thử
    console.log('\n🧹 Đang dọn dẹp dữ liệu kiểm thử...');
    const deleteResult = await UserBehavior.deleteMany({ sessionId: testSessionId });
    console.log(`  ✅ Đã xóa ${deleteResult.deletedCount} hành vi kiểm thử.`);

    console.log('\n✨ Chạy kiểm thử thành công!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Lỗi kiểm thử:', error);
    process.exit(1);
  }
}

runTest();
