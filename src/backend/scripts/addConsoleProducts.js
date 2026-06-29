const mongoose = require('mongoose');
const Category = require('../models/Category');
const Product = require('../models/Product');
require('dotenv').config();

const addConsoleProducts = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/thietbidientu');
    console.log('✅ Connected to MongoDB\n');
    
    // Kiểm tra xem đã có category Console chưa
    let consoleCategory = await Category.findOne({ name: 'Console' });
    
    if (!consoleCategory) {
      console.log('📦 Creating Console category...');
      consoleCategory = await Category.create({
        name: 'Console',
        slug: 'console',
        description: 'Máy chơi game console như PlayStation, Xbox, Nintendo Switch',
        icon: '🎮',
        order: 17
      });
      console.log('✅ Created Console category');
    } else {
      console.log('✓ Console category already exists');
    }
    
    // Danh sách sản phẩm Console để thêm
    const consoleProducts = [
      {
        name: 'PlayStation 5 Standard Edition (PS5)',
        description: `<p><strong>PlayStation 5 Standard Edition</strong> - Thế hệ console gaming mới nhất từ Sony</p>
<ul>
<li>Chip xử lý AMD Zen 2 với 8 nhân CPU</li>
<li>GPU AMD RDNA 2 hỗ trợ Ray Tracing</li>
<li>16GB GDDR6 RAM</li>
<li>SSD 825GB siêu tốc</li>
<li>Hỗ trợ độ phân giải 4K lên đến 120fps</li>
<li>Tương thích ngược với game PS4</li>
<li>Ổ đĩa Blu-ray Ultra HD</li>
</ul>`,
        price: 13990000,
        category: 'Console',
        subcategory: ['PlayStation'],
        brand: 'Sony',
        image: '/img/img-danhmucsanpham/Console.png',
        images: ['/img/img-danhmucsanpham/Console.png'],
        stock: 8,
        featured: true
      },
      {
        name: 'PlayStation 5 Digital Edition (PS5)',
        description: `<p><strong>PlayStation 5 Digital Edition</strong> - Phiên bản kỹ thuật số không ổ đĩa</p>
<ul>
<li>Chip xử lý AMD Zen 2 với 8 nhân CPU</li>
<li>GPU AMD RDNA 2 hỗ trợ Ray Tracing</li>
<li>16GB GDDR6 RAM</li>
<li>SSD 825GB siêu tốc</li>
<li>Hỗ trợ độ phân giải 4K lên đến 120fps</li>
<li>Tương thích ngược với game PS4</li>
<li>Phiên bản Digital - không ổ đĩa</li>
</ul>`,
        price: 11990000,
        category: 'Console',
        subcategory: ['PlayStation'],
        brand: 'Sony',
        image: '/img/img-danhmucsanpham/Console.png',
        images: ['/img/img-danhmucsanpham/Console.png'],
        stock: 10,
        featured: true
      },
      {
        name: 'Xbox Series X 1TB',
        description: `<p><strong>Xbox Series X</strong> - Console gaming mạnh mẽ nhất của Microsoft</p>
<ul>
<li>Chip xử lý AMD Zen 2 với 8 nhân CPU 3.8GHz</li>
<li>GPU AMD RDNA 2 12 TFLOPS</li>
<li>16GB GDDR6 RAM</li>
<li>SSD 1TB NVMe</li>
<li>Hỗ trợ 4K gaming tới 120fps</li>
<li>8K HDR, Ray Tracing</li>
<li>Xbox Game Pass Ultimate</li>
<li>Tương thích ngược 4 thế hệ Xbox</li>
</ul>`,
        price: 12990000,
        category: 'Console',
        subcategory: ['Xbox'],
        brand: 'Microsoft',
        image: '/img/img-danhmucsanpham/Console.png',
        images: ['/img/img-danhmucsanpham/Console.png'],
        stock: 6,
        featured: true
      },
      {
        name: 'Xbox Series S 512GB',
        description: `<p><strong>Xbox Series S</strong> - Console gaming nhỏ gọn với hiệu năng mạnh mẽ</p>
<ul>
<li>Chip xử lý AMD Zen 2 với 8 nhân CPU 3.6GHz</li>
<li>GPU AMD RDNA 2 4 TFLOPS</li>
<li>10GB GDDR6 RAM</li>
<li>SSD 512GB NVMe</li>
<li>Hỗ trợ gaming 1440p tới 120fps</li>
<li>Upscaling lên 4K</li>
<li>Xbox Game Pass Ultimate</li>
<li>Thiết kế nhỏ gọn, không ổ đĩa</li>
</ul>`,
        price: 7990000,
        category: 'Console',
        subcategory: ['Xbox'],
        brand: 'Microsoft',
        image: '/img/img-danhmucsanpham/Console.png',
        images: ['/img/img-danhmucsanpham/Console.png'],
        stock: 12,
        featured: false
      },
      {
        name: 'Nintendo Switch OLED Model',
        description: `<p><strong>Nintendo Switch OLED</strong> - Phiên bản nâng cấp với màn hình OLED tuyệt đẹp</p>
<ul>
<li>Màn hình OLED 7 inch sống động</li>
<li>Bộ nhớ trong 64GB</li>
<li>Chơi được ở 3 chế độ: TV, Tabletop, Handheld</li>
<li>Dock mới với cổng LAN tích hợp</li>
<li>Loa stereo nâng cấp</li>
<li>Pin lên đến 9 giờ chơi game</li>
<li>Joy-Con controllers đa năng</li>
<li>Thư viện game độc quyền Nintendo</li>
</ul>`,
        price: 8990000,
        category: 'Console',
        subcategory: ['Nintendo'],
        brand: 'Nintendo',
        image: '/img/img-danhmucsanpham/Console.png',
        images: ['/img/img-danhmucsanpham/Console.png'],
        stock: 15,
        featured: true
      },
      {
        name: 'Nintendo Switch Standard',
        description: `<p><strong>Nintendo Switch Standard</strong> - Console lai độc đáo của Nintendo</p>
<ul>
<li>Màn hình LCD 6.2 inch</li>
<li>Bộ nhớ trong 32GB</li>
<li>Chơi được ở 3 chế độ: TV, Tabletop, Handheld</li>
<li>Joy-Con controllers tháo rời</li>
<li>Pin 4.5 - 9 giờ tùy game</li>
<li>Hỗ trợ thẻ nhớ microSD</li>
<li>Chơi game Nintendo độc quyền</li>
<li>Multiplayer cục bộ và online</li>
</ul>`,
        price: 6990000,
        category: 'Console',
        subcategory: ['Nintendo'],
        brand: 'Nintendo',
        image: '/img/img-danhmucsanpham/Console.png',
        images: ['/img/img-danhmucsanpham/Console.png'],
        stock: 20,
        featured: false
      },
      {
        name: 'Nintendo Switch Lite',
        description: `<p><strong>Nintendo Switch Lite</strong> - Phiên bản nhỏ gọn chỉ dành cho chơi cầm tay</p>
<ul>
<li>Màn hình LCD 5.5 inch cảm ứng</li>
<li>Bộ nhớ trong 32GB</li>
<li>Thiết kế nhỏ gọn, nhẹ hơn</li>
<li>Chỉ chơi ở chế độ Handheld</li>
<li>Pin 3 - 7 giờ chơi game</li>
<li>Hỗ trợ thẻ nhớ microSD</li>
<li>Giá phải chăng</li>
<li>Tương thích hầu hết game Switch</li>
</ul>`,
        price: 4990000,
        category: 'Console',
        subcategory: ['Nintendo'],
        brand: 'Nintendo',
        image: '/img/img-danhmucsanpham/Console.png',
        images: ['/img/img-danhmucsanpham/Console.png'],
        stock: 18,
        featured: false
      },
      {
        name: 'Sony DualSense Wireless Controller (Trắng)',
        description: `<p><strong>Tay cầm DualSense</strong> - Controller thế hệ mới cho PS5</p>
<ul>
<li>Công nghệ Haptic Feedback chân thực</li>
<li>Adaptive Triggers phản hồi thông minh</li>
<li>Microphone tích hợp</li>
<li>Touchpad cảm ứng</li>
<li>Loa mono tích hợp</li>
<li>Pin sạc USB-C</li>
<li>Kết nối không dây Bluetooth</li>
<li>Tương thích PC và mobile</li>
</ul>`,
        price: 1790000,
        category: 'Console',
        subcategory: ['PlayStation', 'Phụ kiện Console'],
        brand: 'Sony',
        image: '/img/img-danhmucsanpham/Console.png',
        images: ['/img/img-danhmucsanpham/Console.png'],
        stock: 25,
        featured: false
      },
      {
        name: 'Xbox Wireless Controller (Carbon Black)',
        description: `<p><strong>Tay cầm Xbox Wireless</strong> - Controller đa nền tảng của Microsoft</p>
<ul>
<li>Thiết kế ergonomic thoải mái</li>
<li>D-pad하이brid cải tiến</li>
<li>Nút Share chụp ảnh/quay video</li>
<li>Kết nối Bluetooth hoặc Xbox Wireless</li>
<li>Pin AA hoặc sạc tùy chọn</li>
<li>Tương thích Xbox và PC</li>
<li>Cổng USB-C</li>
<li>Mapping buttons tùy chỉnh</li>
</ul>`,
        price: 1490000,
        category: 'Console',
        subcategory: ['Xbox', 'Phụ kiện Console'],
        brand: 'Microsoft',
        image: '/img/img-danhmucsanpham/Console.png',
        images: ['/img/img-danhmucsanpham/Console.png'],
        stock: 30,
        featured: false
      },
      {
        name: 'Nintendo Switch Pro Controller',
        description: `<p><strong>Pro Controller</strong> - Tay cầm chuyên nghiệp cho Nintendo Switch</p>
<ul>
<li>Thiết kế truyền thống thoải mái</li>
<li>HD Rumble và NFC</li>
<li>Pin lên đến 40 giờ</li>
<li>Kết nối không dây Bluetooth</li>
<li>Sạc qua USB-C</li>
<li>Gyroscope và accelerometer</li>
<li>Phù hợp chơi game dài</li>
<li>Tương thích PC</li>
</ul>`,
        price: 1690000,
        category: 'Console',
        subcategory: ['Nintendo', 'Phụ kiện Console'],
        brand: 'Nintendo',
        image: '/img/img-danhmucsanpham/Console.png',
        images: ['/img/img-danhmucsanpham/Console.png'],
        stock: 22,
        featured: false
      }
    ];
    
    console.log(`\n📦 Adding ${consoleProducts.length} Console products...\n`);
    
    for (const productData of consoleProducts) {
      // Kiểm tra xem sản phẩm đã tồn tại chưa
      const existingProduct = await Product.findOne({ name: productData.name });
      
      if (existingProduct) {
        console.log(`⚠️  Product already exists: ${productData.name}`);
      } else {
        await Product.create(productData);
        console.log(`✅ Added: ${productData.name} - ${productData.price.toLocaleString('vi-VN')} đ`);
      }
    }
    
    console.log('\n✨ Done! Console category and products have been added to the database.');
    
    // Thống kê
    const totalConsoleProducts = await Product.countDocuments({ category: 'Console' });
    console.log(`\n📊 Total Console products in database: ${totalConsoleProducts}`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

addConsoleProducts();
