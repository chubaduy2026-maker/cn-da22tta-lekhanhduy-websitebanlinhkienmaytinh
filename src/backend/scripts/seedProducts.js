/**
 * seedProducts.js
 * Script để seed sample products cho hệ thống.
 * 
 * Chức năng:
 *   - Tạo các sản phẩm mẫu (laptop, PC, linh kiện, phụ kiện)
 *   - Chỉ chạy nếu database chưa có products
 * 
 * Chạy: node scripts/seedProducts.js [--force]
 */

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/thietbidientu';
const FORCE = process.argv.includes('--force') || process.argv.includes('-f');

// Sample products data
const sampleProducts = [
  // Laptops
  {
    name: 'Laptop Gaming ASUS ROG Strix G15',
    description: 'Laptop gaming mạnh mẽ với RTX 4060, màn hình 165Hz, tản nhiệt hiệu quả',
    price: 32990000,
    originalPrice: 35990000,
    category: 'Laptop',
    brand: 'ASUS',
    stock: 15,
    rating: 4.8,
    reviewCount: 124,
    specifications: {
      CPU: 'AMD Ryzen 7 7735HS',
      RAM: '16GB DDR5',
      Storage: '512GB NVMe SSD',
      GPU: 'NVIDIA RTX 4060 8GB',
      Display: '15.6" FHD 165Hz',
      Battery: '90Wh'
    },
    images: ['/uploads/products/rog-strix-g15.jpg'],
    isActive: true,
    isFeatured: true
  },
  {
    name: 'MacBook Pro 14 inch M3 Pro',
    description: 'MacBook Pro với chip M3 Pro, màn hình Liquid Retina XDR, hiệu năng vượt trội',
    price: 49990000,
    originalPrice: 52990000,
    category: 'Laptop',
    brand: 'Apple',
    stock: 8,
    rating: 4.9,
    reviewCount: 89,
    specifications: {
      CPU: 'Apple M3 Pro 11-core',
      RAM: '18GB Unified',
      Storage: '512GB SSD',
      GPU: 'M3 Pro 14-core GPU',
      Display: '14.2" Liquid Retina XDR',
      Battery: '17 hours'
    },
    images: ['/uploads/products/macbook-pro-14.jpg'],
    isActive: true,
    isFeatured: true
  },
  {
    name: 'Laptop Dell XPS 15',
    description: 'Laptop cao cấp với màn hình OLED 3.5K, Intel Core i7, thiết kế mỏng nhẹ',
    price: 42990000,
    originalPrice: 45990000,
    category: 'Laptop',
    brand: 'Dell',
    stock: 12,
    rating: 4.7,
    reviewCount: 67,
    specifications: {
      CPU: 'Intel Core i7-13700H',
      RAM: '16GB DDR5',
      Storage: '512GB NVMe SSD',
      GPU: 'NVIDIA RTX 4050 6GB',
      Display: '15.6" OLED 3.5K',
      Battery: '86Wh'
    },
    images: ['/uploads/products/dell-xps-15.jpg'],
    isActive: true,
    isFeatured: false
  },
  
  // PC Components
  {
    name: 'Card đồ họa NVIDIA RTX 4070 Super',
    description: 'VGA gaming cao cấp, ray tracing, DLSS 3.0, hiệu năng 1440p tuyệt vời',
    price: 15990000,
    originalPrice: 17490000,
    category: 'VGA',
    brand: 'NVIDIA',
    stock: 20,
    rating: 4.8,
    reviewCount: 156,
    specifications: {
      CUDA_Cores: '7168',
      Memory: '12GB GDDR6X',
      Boost_Clock: '2475 MHz',
      TDP: '220W',
      Interface: 'PCIe 4.0 x16'
    },
    images: ['/uploads/products/rtx-4070-super.jpg'],
    isActive: true,
    isFeatured: true
  },
  {
    name: 'CPU Intel Core i9-14900K',
    description: 'Vi xử lý cao cấp nhất, 24 nhân, tối ưu cho gaming và workstation',
    price: 14990000,
    originalPrice: 16490000,
    category: 'CPU',
    brand: 'Intel',
    stock: 10,
    rating: 4.7,
    reviewCount: 78,
    specifications: {
      Cores: '24 (8P + 16E)',
      Threads: '32',
      Base_Clock: '3.2 GHz',
      Boost_Clock: '6.0 GHz',
      Cache: '36MB L3',
      TDP: '125W'
    },
    images: ['/uploads/products/i9-14900k.jpg'],
    isActive: true,
    isFeatured: true
  },
  {
    name: 'RAM Kingston Fury Beast 32GB DDR5-6000',
    description: 'Kit RAM DDR5 tốc độ cao, tản nhiệt nhôm, XMP 3.0',
    price: 2990000,
    originalPrice: 3290000,
    category: 'RAM',
    brand: 'Kingston',
    stock: 50,
    rating: 4.6,
    reviewCount: 234,
    specifications: {
      Capacity: '32GB (2x16GB)',
      Speed: 'DDR5-6000',
      Latency: 'CL30',
      Voltage: '1.35V',
      Heatsink: 'Yes'
    },
    images: ['/uploads/products/kingston-fury-32gb.jpg'],
    isActive: true,
    isFeatured: false
  },
  {
    name: 'SSD Samsung 990 Pro 2TB',
    description: 'Ổ cứng NVMe Gen4 tốc độ cao nhất, đọc 7450MB/s, ghi 6900MB/s',
    price: 4990000,
    originalPrice: 5490000,
    category: 'SSD',
    brand: 'Samsung',
    stock: 30,
    rating: 4.9,
    reviewCount: 312,
    specifications: {
      Capacity: '2TB',
      Interface: 'PCIe 4.0 NVMe',
      Read_Speed: '7450 MB/s',
      Write_Speed: '6900 MB/s',
      TBW: '1200TB',
      Controller: 'Samsung Pascal'
    },
    images: ['/uploads/products/samsung-990-pro.jpg'],
    isActive: true,
    isFeatured: true
  },
  
  // Accessories
  {
    name: 'Tai nghe Gaming HyperX Cloud III',
    description: 'Tai nghe gaming 7.1 surround, driver 53mm, micro khử ồn',
    price: 2490000,
    originalPrice: 2790000,
    category: 'Tai nghe',
    brand: 'HyperX',
    stock: 45,
    rating: 4.7,
    reviewCount: 189,
    specifications: {
      Driver: '53mm',
      Frequency: '10Hz - 21kHz',
      Impedance: '62Ω',
      Connection: 'USB / 3.5mm',
      Surround: '7.1 Virtual'
    },
    images: ['/uploads/products/hyperx-cloud-iii.jpg'],
    isActive: true,
    isFeatured: false
  },
  {
    name: 'Bàn phím cơ Logitech G Pro X',
    description: 'Bàn phím cơ TKL, hot-swappable, RGB LIGHTSYNC',
    price: 2990000,
    originalPrice: 3290000,
    category: 'Bàn phím',
    brand: 'Logitech',
    stock: 25,
    rating: 4.8,
    reviewCount: 145,
    specifications: {
      Switch: 'GX Blue Clicky (hot-swap)',
      Layout: 'TKL (87 keys)',
      Backlight: 'RGB LIGHTSYNC',
      Connection: 'USB-C detachable',
      Software: 'G HUB'
    },
    images: ['/uploads/products/logitech-gpro-x.jpg'],
    isActive: true,
    isFeatured: true
  },
  {
    name: 'Chuột gaming Razer DeathAdder V3 Pro',
    description: 'Chuột không dây nhẹ nhất Razer, sensor Focus Pro 30K, 90 giờ pin',
    price: 3590000,
    originalPrice: 3990000,
    category: 'Chuột',
    brand: 'Razer',
    stock: 35,
    rating: 4.8,
    reviewCount: 267,
    specifications: {
      Sensor: 'Focus Pro 30K',
      DPI: '30000',
      Weight: '63g',
      Battery: '90 hours',
      Connection: '2.4GHz / Bluetooth',
      Switches: 'Optical Gen-3'
    },
    images: ['/uploads/products/razer-deathadder-v3.jpg'],
    isActive: true,
    isFeatured: true
  }
];

async function seedProducts() {
  console.log('=' .repeat(60));
  console.log('🚀 TechStore - Seed Products');
  console.log('=' .repeat(60));
  
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB:', MONGODB_URI.split('@')[1] || MONGODB_URI);
    
    const Product = require('../models/Product');
    const Category = require('../models/Category');
    
    // Check existing products
    const existingCount = await Product.countDocuments();
    console.log(`📊 Existing products: ${existingCount}`);
    
    if (existingCount > 0 && !FORCE) {
      console.log('');
      console.log('⚠️ Products already exist! Use --force to add sample products anyway.');
      console.log('');
      process.exit(0);
    }
    
    // Create categories if needed
    const categories = ['Laptop', 'VGA', 'CPU', 'RAM', 'SSD', 'Tai nghe', 'Bàn phím', 'Chuột'];
    console.log('');
    console.log('📁 Ensuring categories exist...');
    
    for (const catName of categories) {
      const exists = await Category.findOne({ name: catName });
      if (!exists) {
        await Category.create({ name: catName, description: `Danh mục ${catName}` });
        console.log(`   ✅ Created category: ${catName}`);
      }
    }
    
    // Insert products
    console.log('');
    console.log('📦 Inserting sample products...');
    
    let inserted = 0;
    for (const productData of sampleProducts) {
      // Check if product already exists
      const exists = await Product.findOne({ name: productData.name });
      if (exists) {
        console.log(`   ⏭️ Skipped (exists): ${productData.name.substring(0, 40)}...`);
        continue;
      }
      
      await Product.create(productData);
      console.log(`   ✅ Created: ${productData.name.substring(0, 40)}...`);
      inserted++;
    }
    
    const totalCount = await Product.countDocuments();
    
    console.log('');
    console.log('=' .repeat(60));
    console.log(`✅ Done! Inserted: ${inserted} products`);
    console.log(`📊 Total products in database: ${totalCount}`);
    console.log('=' .repeat(60));
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

seedProducts();
