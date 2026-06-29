/**
 * Data Ingestion CLI Script
 * Import documents into the knowledge base for RAG
 * 
 * Usage:
 *   node scripts/ingestData.js --file <path> --category <category>
 *   node scripts/ingestData.js --dir <directory> --category <category>
 *   node scripts/ingestData.js --url <url> --category <category>
 *   node scripts/ingestData.js --text "content" --category <category> --source "name"
 *   node scripts/ingestData.js --seed   (load built-in tech knowledge)
 *   node scripts/ingestData.js --stats  (show knowledge base stats)
 * 
 * Categories: technology, networking, programming, hardware, software, 
 *             ai_ml, security, cloud, mobile, gaming, product_spec, general
 */

require('dotenv').config();
const mongoose = require('mongoose');
const path = require('path');

// Parse command line arguments
const args = process.argv.slice(2);
const getArg = (name) => {
  const idx = args.indexOf(name);
  return idx !== -1 && idx + 1 < args.length ? args[idx + 1] : null;
};
const hasFlag = (name) => args.includes(name);

async function main() {
  // Connect to MongoDB
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/thietbidientu';
  await mongoose.connect(mongoUri);
  console.log('✅ Connected to MongoDB');

  const DataIngestionService = require('../services/ai/rag/DataIngestionService');

  try {
    if (hasFlag('--stats')) {
      const stats = await DataIngestionService.getStats();
      console.log('\n📊 Knowledge Base Statistics:');
      console.log(`   Total documents: ${stats.total}`);
      console.log('\n   By Category:');
      stats.byCategory.forEach(c => console.log(`     ${c._id}: ${c.count}`));
      console.log('\n   By Source (top 20):');
      stats.bySource.forEach(s => console.log(`     ${s._id}: ${s.count}`));

    } else if (hasFlag('--seed')) {
      console.log('🌱 Seeding built-in tech knowledge...\n');
      await seedTechKnowledge(DataIngestionService);

    } else if (getArg('--file')) {
      const filePath = path.resolve(getArg('--file'));
      const category = getArg('--category') || 'general';
      console.log(`📄 Ingesting file: ${filePath} [${category}]`);
      const result = await DataIngestionService.ingestFile(filePath, { category });
      console.log('Result:', JSON.stringify(result, null, 2));

    } else if (getArg('--dir')) {
      const dirPath = path.resolve(getArg('--dir'));
      const category = getArg('--category') || 'general';
      console.log(`📁 Ingesting directory: ${dirPath} [${category}]`);
      const result = await DataIngestionService.ingestDirectory(dirPath, { category });
      console.log('Result:', JSON.stringify(result, null, 2));

    } else if (getArg('--url')) {
      const url = getArg('--url');
      const category = getArg('--category') || 'general';
      console.log(`🌐 Ingesting web page: ${url} [${category}]`);
      const result = await DataIngestionService.ingestWebPage(url, { category });
      console.log('Result:', JSON.stringify(result, null, 2));

    } else if (getArg('--text')) {
      const text = getArg('--text');
      const category = getArg('--category') || 'general';
      const source = getArg('--source') || 'cli_input';
      console.log(`📝 Ingesting text [${category}]`);
      const result = await DataIngestionService.ingestText(text, { category, source });
      console.log('Result:', JSON.stringify(result, null, 2));

    } else {
      printUsage();
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

function printUsage() {
  console.log(`
📚 TechStore Knowledge Base Ingestion Tool

Usage:
  node scripts/ingestData.js --file <path> --category <category>
  node scripts/ingestData.js --dir <directory> --category <category>
  node scripts/ingestData.js --url <url> --category <category>
  node scripts/ingestData.js --text "content" --category <category> --source "name"
  node scripts/ingestData.js --seed
  node scripts/ingestData.js --stats

Categories:
  technology, networking, programming, hardware, software,
  ai_ml, security, cloud, mobile, gaming, product_spec, general
  `);
}

/**
 * Seed the knowledge base with built-in tech articles
 */
async function seedTechKnowledge(ingestionService) {
  const articles = [
    {
      source: 'techstore_gpu_guide',
      category: 'hardware',
      text: `GPU (Graphics Processing Unit) - Card đồ họa là bộ xử lý chuyên dụng để render hình ảnh, video và đồ họa 3D.

## GPU hoạt động như thế nào?

GPU chứa hàng nghìn lõi xử lý nhỏ (CUDA cores cho NVIDIA, Stream Processors cho AMD) hoạt động song song. Khác với CPU có ít lõi mạnh, GPU có nhiều lõi yếu hơn nhưng xử lý song song rất hiệu quả.

### Kiến trúc GPU hiện đại:

**NVIDIA GeForce RTX 40 Series (Ada Lovelace)**:
- RTX 4090: 16384 CUDA cores, 24GB GDDR6X, 450W TDP
- RTX 4080: 9728 CUDA cores, 16GB GDDR6X, 320W TDP
- RTX 4070 Ti: 7680 CUDA cores, 12GB GDDR6X, 285W TDP
- RTX 4070: 5888 CUDA cores, 12GB GDDR6X, 200W TDP
- RTX 4060 Ti: 4352 CUDA cores, 8/16GB GDDR6, 160W TDP
- RTX 4060: 3072 CUDA cores, 8GB GDDR6, 115W TDP

**AMD Radeon RX 7000 Series (RDNA 3)**:
- RX 7900 XTX: 6144 Stream Processors, 24GB GDDR6, 355W
- RX 7900 XT: 5376 Stream Processors, 20GB GDDR6, 315W
- RX 7800 XT: 3840 Stream Processors, 16GB GDDR6, 263W
- RX 7700 XT: 3456 Stream Processors, 12GB GDDR6, 245W
- RX 7600: 2048 Stream Processors, 8GB GDDR6, 165W

### Công nghệ quan trọng:

**Ray Tracing**: Mô phỏng ánh sáng vật lý thực tế, tính toán đường đi của tia sáng cho bóng đổ, phản chiếu, khúc xạ chân thực.

**DLSS (NVIDIA) / FSR (AMD)**: Sử dụng AI để upscale hình ảnh từ độ phân giải thấp lên cao, tăng FPS mà vẫn giữ chất lượng hình ảnh.

**VRAM**: Bộ nhớ video trên card đồ họa. Game hiện đại cần:
- 1080p: 6-8GB VRAM
- 1440p: 8-12GB VRAM
- 4K: 12-24GB VRAM

### Chọn GPU theo nhu cầu:
- Gaming 1080p: RTX 4060, RX 7600
- Gaming 1440p: RTX 4070, RX 7800 XT
- Gaming 4K: RTX 4080/4090, RX 7900 XTX
- Đồ họa/Render: RTX 4070 Ti trở lên (cần nhiều VRAM)
- AI/Machine Learning: RTX 4090 (24GB VRAM + Tensor cores)`
    },
    {
      source: 'techstore_cpu_guide',
      category: 'hardware',
      text: `CPU (Central Processing Unit) - Bộ xử lý trung tâm, "bộ não" của máy tính.

## CPU hoạt động như thế nào?

CPU thực hiện các phép tính logic và số học theo chu kỳ xung nhịp (clock cycle). Mỗi chu kỳ, CPU fetch lệnh từ bộ nhớ, decode, execute và write back kết quả.

### Thông số quan trọng:
- **Cores (Lõi)**: Số lõi xử lý vật lý. Nhiều core = xử lý đa nhiệm tốt hơn.
- **Threads**: Số luồng xử lý. Hyper-threading cho phép mỗi core xử lý 2 threads.
- **Clock Speed**: Tốc độ xung nhịp (GHz). Base clock và Boost clock.
- **Cache**: Bộ nhớ đệm (L1, L2, L3). Cache lớn = ít phải truy cập RAM.
- **TDP**: Thermal Design Power - Công suất nhiệt. Ảnh hưởng đến tản nhiệt cần thiết.
- **Socket**: Chân cắm vật lý. CPU và Motherboard phải cùng socket.

### Intel vs AMD - So sánh chi tiết:

**Intel Core Gen 14 (Raptor Lake Refresh)**:
- i9-14900K: 24 cores (8P+16E) / 32 threads, 6.0GHz boost, 253W
- i7-14700K: 20 cores (8P+12E) / 28 threads, 5.6GHz boost, 253W
- i5-14600K: 14 cores (6P+8E) / 20 threads, 5.3GHz boost, 181W
- i5-14400F: 10 cores (6P+4E) / 16 threads, 4.7GHz boost, 148W
- Socket LGA 1700, hỗ trợ DDR4 và DDR5

**AMD Ryzen 7000 Series (Zen 4)**:
- Ryzen 9 7950X: 16 cores / 32 threads, 5.7GHz boost, 170W
- Ryzen 9 7900X: 12 cores / 24 threads, 5.6GHz boost, 170W
- Ryzen 7 7700X: 8 cores / 16 threads, 5.4GHz boost, 105W
- Ryzen 5 7600X: 6 cores / 12 threads, 5.3GHz boost, 105W
- Socket AM5, chỉ DDR5, PCIe 5.0

### Chọn CPU theo nhu cầu:
- Văn phòng: Intel i3/i5 hoặc Ryzen 5
- Gaming: Intel i5-14600K hoặc Ryzen 7 7700X
- Streaming + Gaming: Intel i7-14700K hoặc Ryzen 9 7900X
- Workstation/Render: Intel i9-14900K hoặc Ryzen 9 7950X
- Lập trình: Ryzen 7 7700X hoặc Intel i7 (nhiều core cho compile)

### CPU Laptop:
- Intel Core Ultra (Meteor Lake): Tích hợp NPU cho AI
- AMD Ryzen 7040/8040: Hiệu năng cao, tiết kiệm pin
- Apple M3: Hiệu năng/Watt xuất sắc cho macOS`
    },
    {
      source: 'techstore_ram_storage_guide',
      category: 'hardware',
      text: `RAM và Storage - Bộ nhớ và Lưu trữ trong máy tính

## RAM (Random Access Memory)

RAM là bộ nhớ tạm thời, tốc độ cao, lưu dữ liệu đang được CPU xử lý.

### DDR4 vs DDR5:
| Thông số | DDR4 | DDR5 |
|----------|------|------|
| Tốc độ | 2133-5333 MHz | 4800-8400 MHz |
| Điện áp | 1.2V | 1.1V |
| Dung lượng/thanh | Max 32GB | Max 64GB |
| Kênh | Dual Channel | Dual Channel (tích hợp trên thanh) |
| Giá | Rẻ hơn | Đắt hơn 20-40% |

### Cần bao nhiêu RAM?
- 8GB: Văn phòng, web, cơ bản
- 16GB: Gaming, lập trình, đa nhiệm
- 32GB: Đồ họa, render, nhiều tab Chrome
- 64GB+: Workstation, máy chủ, AI/ML

### Lưu ý khi chọn RAM:
- Chạy Dual Channel (2 thanh) luôn nhanh hơn 1 thanh
- XMP/DOCP profile để chạy đúng tốc độ quảng cáo
- Tương thích motherboard (DDR4 ≠ DDR5)

## Storage (Lưu trữ)

### SSD vs HDD:
| Thông số | SSD NVMe | SSD SATA | HDD |
|----------|----------|----------|-----|
| Đọc | 3,500-7,000 MB/s | 500 MB/s | 150 MB/s |
| Ghi | 2,000-5,000 MB/s | 400 MB/s | 120 MB/s |
| Độ bền | Cao | Cao | Trung bình |
| Tiếng ồn | Không | Không | Có |
| Giá/GB | Cao nhất | Trung bình | Rẻ nhất |

### Công nghệ SSD:
- **NVMe PCIe Gen 4**: Tốc độ đọc ~7,000 MB/s (Samsung 990 Pro, WD SN850X)
- **NVMe PCIe Gen 3**: Tốc độ đọc ~3,500 MB/s (giá tốt hơn)
- **SATA III**: Tốc độ đọc ~550 MB/s (giá rẻ, tương thích laptop cũ)
- **NAND types**: TLC (phổ biến), QLC (rẻ, bền kém hơn), SLC (server)

### Khuyến nghị cấu hình lưu trữ:
- Cơ bản: 256GB SSD NVMe
- Gaming: 1TB SSD NVMe
- Content Creator: 1TB NVMe + 2TB HDD
- Workstation: 2TB NVMe Gen 4`
    },
    {
      source: 'techstore_laptop_guide',
      category: 'technology',
      text: `Hướng dẫn chọn mua Laptop - Tất cả những gì cần biết

## PC hay Laptop - Nên chọn gì?

### Laptop phù hợp khi:
- Cần di chuyển, làm việc nhiều nơi
- Không gian hạn chế
- Cần pin và WiFi tích hợp
- Sử dụng văn phòng, học tập

### PC phù hợp khi:
- Cần hiệu năng tối đa với giá tốt
- Gaming nặng, render 3D
- Dễ nâng cấp linh kiện
- Không cần di chuyển

### So sánh chi tiết:
| Tiêu chí | Laptop | PC Desktop |
|----------|--------|-----------|
| Giá/hiệu năng | Đắt hơn 30-50% | Tốt hơn |
| Di động | ✅ | ❌ |
| Nâng cấp | Hạn chế | Dễ dàng |
| Tản nhiệt | Hạn chế | Tốt hơn |
| Màn hình | Tích hợp | Tùy chọn |
| Tiêu thụ điện | 50-150W | 300-800W |

## Phân khúc Laptop:

### Laptop Văn phòng (10-15 triệu):
- CPU: Intel i5 / Ryzen 5
- RAM: 8-16GB
- SSD: 256-512GB
- Màn hình: 14-15.6" Full HD IPS
- Ưu điểm: Nhẹ, pin lâu, đủ dùng office

### Laptop Gaming (15-30 triệu):
- CPU: Intel i5/i7 hoặc Ryzen 5/7
- GPU: RTX 4050/4060 Laptop
- RAM: 16GB DDR5
- SSD: 512GB-1TB
- Màn hình: 15.6-16" 144Hz+
- Ưu điểm: Chơi game, đồ họa nhẹ

### Laptop Cao cấp (30-60+ triệu):
- CPU: Intel i7/i9 hoặc Ryzen 9
- GPU: RTX 4070/4080 Laptop
- RAM: 32GB DDR5
- SSD: 1-2TB
- Màn hình: 16" QHD 165Hz+
- Ưu điểm: Gaming nặng, content creation

### Laptop Ultrabook (15-35 triệu):
- Mỏng nhẹ dưới 1.5kg
- Pin 10-15 giờ
- Phù hợp doanh nhân, sinh viên
- Ví dụ: MacBook Air, Dell XPS 13, ASUS Zenbook`
    },
    {
      source: 'techstore_ai_ml_guide',
      category: 'ai_ml',
      text: `Machine Learning và AI - Kiến thức cơ bản đến nâng cao

## Machine Learning là gì?

Machine Learning (Học máy) là nhánh của Trí tuệ nhân tạo (AI) cho phép máy tính học từ dữ liệu mà không cần lập trình cụ thể. Thay vì viết rules, ta cho máy học patterns từ data.

### Các loại Machine Learning:

**1. Supervised Learning (Học có giám sát)**:
- Dữ liệu đã được gán nhãn (labeled data)
- Phân loại (Classification): Spam detection, nhận diện hình ảnh
- Hồi quy (Regression): Dự đoán giá nhà, dự báo thời tiết
- Thuật toán phổ biến: Linear Regression, SVM, Random Forest, Neural Networks

**2. Unsupervised Learning (Học không giám sát)**:
- Dữ liệu chưa gán nhãn
- Phân cụm (Clustering): Phân nhóm khách hàng
- Giảm chiều (Dimensionality Reduction): PCA, t-SNE
- Thuật toán: K-Means, DBSCAN, Autoencoder

**3. Reinforcement Learning (Học tăng cường)**:
- Agent tương tác với Environment
- Học qua reward/punishment
- Ứng dụng: Game AI, Robot, Self-driving cars

## Deep Learning

Deep Learning sử dụng Neural Networks nhiều lớp (deep neural networks) để học các đặc trưng phức tạp.

### Kiến trúc phổ biến:
- **CNN (Convolutional Neural Network)**: Xử lý hình ảnh, video
- **RNN/LSTM**: Xử lý chuỗi, ngôn ngữ tự nhiên
- **Transformer**: GPT, BERT, LLM - cách mạng NLP
- **GAN**: Sinh ảnh, deepfake
- **Diffusion Models**: Stable Diffusion, DALL-E

## Large Language Models (LLM)

LLM là mô hình ngôn ngữ lớn được train trên lượng text khổng lồ.

### LLM phổ biến:
- **GPT-4 (OpenAI)**: 1.7 trillion parameters (ước tính)
- **Gemini (Google)**: Multimodal, hỗ trợ text + image + code
- **Claude (Anthropic)**: Focus vào safety và reasoning
- **LLaMA (Meta)**: Open-source, có thể fine-tune
- **Mistral**: Open-source, hiệu quả cao

### Ứng dụng LLM:
- Chatbot thông minh
- Code generation (GitHub Copilot)
- Dịch thuật
- Tóm tắt văn bản
- Retrieval-Augmented Generation (RAG)

## RAG (Retrieval-Augmented Generation)

RAG kết hợp retrieval (truy xuất thông tin) với generation (sinh văn bản):
1. Nhận câu hỏi từ user
2. Tìm tài liệu liên quan trong knowledge base (vector search)
3. Đưa tài liệu vào prompt của LLM
4. LLM sinh câu trả lời dựa trên context

### Lợi ích:
- Giảm hallucination (bịa thông tin)
- Cập nhật kiến thức không cần retrain
- Trả lời chính xác với dữ liệu riêng

### Cần gì cho RAG?
- Vector Database: Lưu embeddings
- Embedding Model: Chuyển text thành vector
- LLM: Sinh câu trả lời
- Chunking Strategy: Chia nhỏ tài liệu`
    },
    {
      source: 'techstore_networking_guide',
      category: 'networking',
      text: `Kiến thức Mạng máy tính cơ bản

## Mô hình OSI và TCP/IP

### 7 tầng OSI:
1. **Physical**: Cáp mạng, sóng WiFi, tín hiệu điện
2. **Data Link**: MAC address, Ethernet, Switch
3. **Network**: IP address, Router, ICMP
4. **Transport**: TCP (tin cậy), UDP (nhanh)
5. **Session**: Quản lý phiên kết nối
6. **Presentation**: Mã hóa, nén dữ liệu
7. **Application**: HTTP, FTP, DNS, SMTP

### TCP vs UDP:
| TCP | UDP |
|-----|-----|
| Đảm bảo gửi đến | Không đảm bảo |
| Có thứ tự | Không thứ tự |
| Chậm hơn | Nhanh hơn |
| Web, email, file | Video call, game, streaming |

## WiFi Standards:
- WiFi 5 (802.11ac): 3.5 Gbps, 5GHz
- WiFi 6 (802.11ax): 9.6 Gbps, 2.4+5GHz, OFDMA
- WiFi 6E: Thêm băng tần 6GHz
- WiFi 7 (802.11be): 46 Gbps, MLO, 4K QAM

## Ethernet Speeds:
- Fast Ethernet: 100 Mbps
- Gigabit: 1000 Mbps (phổ biến nhất)
- 2.5GbE: 2500 Mbps (gaming motherboards)
- 10GbE: 10 Gbps (server, workstation)

## Bảo mật mạng:
- **Firewall**: Lọc traffic vào/ra
- **VPN**: Mã hóa kết nối, bảo vệ privacy
- **WPA3**: Chuẩn mã hóa WiFi mới nhất
- **TLS/SSL**: Mã hóa web (HTTPS)
- **DNS Security**: DNSSEC, DoH, DoT`
    },
    {
      source: 'techstore_programming_guide',
      category: 'programming',
      text: `Ngôn ngữ lập trình và Công nghệ phần mềm

## Top ngôn ngữ lập trình 2024:

### 1. Python
- Ứng dụng: AI/ML, Data Science, Web (Django/Flask), Automation
- Ưu điểm: Dễ học, ecosystem lớn, thư viện phong phú
- Nhược điểm: Chậm hơn compiled languages
- Frameworks: TensorFlow, PyTorch, Django, FastAPI

### 2. JavaScript/TypeScript
- Ứng dụng: Web frontend + backend, mobile (React Native)
- Ưu điểm: Chạy trên browser, full-stack, community lớn
- Frameworks: React, Vue, Angular, Node.js, Next.js

### 3. Java
- Ứng dụng: Enterprise, Android, Big Data
- Ưu điểm: Cross-platform (JVM), ổn định, bảo mật
- Frameworks: Spring Boot, Hibernate

### 4. C/C++
- Ứng dụng: System programming, game engine, embedded
- Ưu điểm: Hiệu năng cao nhất, kiểm soát bộ nhớ
- Dùng trong: Unreal Engine, Linux kernel, drivers

### 5. Rust
- Ứng dụng: Systems programming, WebAssembly
- Ưu điểm: Memory safety, hiệu năng như C++
- Đang được dùng bởi: Mozilla, Microsoft, Linux kernel

### 6. Go
- Ứng dụng: Backend services, cloud infrastructure
- Ưu điểm: Concurrency model tốt, compile nhanh
- Dùng bởi: Docker, Kubernetes, Google

## Chọn máy tính cho lập trình:

### Lập trình Web:
- CPU: Intel i5 / Ryzen 5
- RAM: 16GB (nhiều tab browser + IDE)
- SSD: 512GB NVMe
- Ưu tiên: Bàn phím tốt, màn hình lớn

### AI/Machine Learning:
- CPU: Intel i7/i9 hoặc Ryzen 7/9
- GPU: NVIDIA RTX 4070+ (CUDA cores + Tensor cores)
- RAM: 32-64GB
- SSD: 1TB+ (datasets lớn)
- VRAM: 12GB+ (training models)

### Mobile Development:
- macOS: MacBook Pro M3 cho iOS + Android
- Windows: 16GB RAM, SSD cho Android emulator

### Game Development:
- CPU: Intel i7 / Ryzen 7
- GPU: RTX 4060+ (testing games)
- RAM: 32GB
- SSD: 1TB+ (game assets lớn)`
    },
    {
      source: 'techstore_monitor_guide',
      category: 'hardware',
      text: `Hướng dẫn chọn mua Màn hình máy tính

## Các thông số quan trọng:

### 1. Độ phân giải:
- Full HD (1920x1080): Phổ biến, đủ dùng cho 24"
- QHD/2K (2560x1440): Sweet spot cho 27", gaming tốt
- 4K UHD (3840x2160): Sắc nét, cần GPU mạnh
- Ultrawide (3440x1440): Đa nhiệm, immersive gaming

### 2. Tần số quét (Refresh Rate):
- 60Hz: Văn phòng, xem phim
- 75Hz: Cải thiện nhẹ so với 60Hz
- 144Hz: Gaming tiêu chuẩn, mượt rõ rệt
- 165-180Hz: Sweet spot gaming
- 240Hz: eSports competitive
- 360Hz: Pro gaming

### 3. Panel Types:
| Panel | Ưu điểm | Nhược điểm | Phù hợp |
|-------|---------|-----------|---------|
| IPS | Góc nhìn rộng, màu chính xác | Contrast thấp hơn VA | Đồ họa, văn phòng |
| VA | Contrast cao, đen sâu | Ghosting, góc nhìn hẹp hơn IPS | Xem phim, gaming |
| TN | Response time nhanh nhất | Góc nhìn hẹp, màu kém | eSports (ít phổ biến) |
| OLED | Contrast vô hạn, HDR tuyệt vời | Burn-in risk, đắt | Premium gaming, content |

### 4. Response Time:
- 5ms: Văn phòng
- 1ms (GtG): Gaming
- 0.03ms (OLED): Fastest

### 5. HDR (High Dynamic Range):
- HDR400: Entry level, ít khác biệt
- HDR600: Decent HDR
- HDR1000: True HDR experience
- HDR1400+: Premium

### 6. Adaptive Sync:
- G-Sync (NVIDIA): Premium, no tearing
- FreeSync (AMD): Free, hỗ trợ rộng
- G-Sync Compatible: FreeSync nhưng NVIDIA certified

## Khuyến nghị theo nhu cầu:
- Văn phòng: 24" FHD IPS 75Hz (3-5 triệu)
- Gaming phổ thông: 27" QHD IPS 165Hz (5-10 triệu)
- Gaming cao cấp: 27" QHD OLED 240Hz (10-20 triệu)
- Đồ họa: 27" 4K IPS 100% sRGB (8-15 triệu)
- Ultrawide: 34" UWQHD IPS 144Hz (8-15 triệu)`
    },
    {
      source: 'techstore_security_guide',
      category: 'security',
      text: `Bảo mật máy tính và An ninh mạng

## Các loại mối đe dọa:

### 1. Malware:
- **Virus**: Tự nhân bản, phá hoại files
- **Trojan**: Giả dạng phần mềm hợp lệ
- **Ransomware**: Mã hóa dữ liệu, đòi tiền chuộc
- **Spyware**: Thu thập thông tin người dùng
- **Worm**: Tự lan truyền qua mạng

### 2. Social Engineering:
- **Phishing**: Email/web giả mạo
- **Spear Phishing**: Phishing nhắm mục tiêu
- **Vishing**: Lừa đảo qua điện thoại

### 3. Network Attacks:
- **DDoS**: Làm quá tải server
- **Man-in-the-Middle**: Chặn giữa đường truyền
- **SQL Injection**: Tấn công qua input web
- **XSS**: Chèn script độc hại vào web

## Bảo vệ máy tính cá nhân:

### Phần mềm:
- Windows Defender (đủ tốt cho đa số)
- Malwarebytes (quét bổ sung)
- Cập nhật OS và phần mềm thường xuyên
- Không cài phần mềm crack/pirated

### Mật khẩu:
- Dùng Password Manager (Bitwarden, 1Password)
- Mật khẩu dài 12+ ký tự, kết hợp chữ/số/ký tự đặc biệt
- Bật 2FA (Two-Factor Authentication) cho tài khoản quan trọng
- Không dùng chung mật khẩu cho nhiều tài khoản

### Mạng:
- Dùng VPN khi kết nối WiFi công cộng
- Đổi mật khẩu router mặc định
- Tắt WPS trên router
- Dùng WPA3 nếu router hỗ trợ

### Backup:
- Rule 3-2-1: 3 bản sao, 2 loại media, 1 offsite
- Cloud backup: Google Drive, OneDrive
- Local backup: External HDD/SSD`
    },
    {
      source: 'techstore_build_pc_guide',
      category: 'hardware',
      text: `Hướng dẫn Build PC - Từ A đến Z

## Các linh kiện cần thiết:

### 1. CPU (Bộ xử lý)
Chọn dựa trên mục đích sử dụng và ngân sách.

### 2. Motherboard (Bo mạch chủ)
- Phải tương thích socket với CPU
- Intel LGA 1700: B760, Z790
- AMD AM5: B650, X670
- Chọn form factor: ATX, mATX, ITX

### 3. RAM
- DDR4 hoặc DDR5 (tùy motherboard)
- 2 thanh cho Dual Channel
- Chú ý QVL list tương thích

### 4. GPU (Card đồ họa)
- Phù hợp với mục đích sử dụng
- Kiểm tra clearance trong case
- PSU đủ công suất

### 5. Storage
- SSD NVMe cho OS và game
- HDD cho lưu trữ lớn

### 6. PSU (Nguồn)
- 80+ Bronze tối thiểu
- Đủ Watt cho GPU + CPU + headroom 20%
- Gaming: 650-850W
- High-end: 850-1000W

### 7. Case (Vỏ máy)
- Phù hợp form factor motherboard
- Đủ chỗ cho GPU dài
- Luồng gió tốt

## Build mẫu theo ngân sách:

### PC Gaming 15 triệu:
- CPU: Intel i5-14400F
- MB: B760M
- RAM: 16GB DDR4 3200MHz
- GPU: RTX 4060
- SSD: 512GB NVMe
- PSU: 650W 80+ Bronze
- Case: Mid Tower

### PC Gaming 25 triệu:
- CPU: Intel i5-14600KF
- MB: B760 ATX
- RAM: 32GB DDR5 5600MHz
- GPU: RTX 4070
- SSD: 1TB NVMe Gen 4
- PSU: 750W 80+ Gold
- Case: Mid Tower Airflow

### PC Gaming 40 triệu:
- CPU: Intel i7-14700KF
- MB: Z790 ATX
- RAM: 32GB DDR5 6000MHz
- GPU: RTX 4070 Ti
- SSD: 1TB NVMe Gen 4
- PSU: 850W 80+ Gold
- Case: Full Tower

### Workstation 50+ triệu:
- CPU: AMD Ryzen 9 7950X
- MB: X670E ATX
- RAM: 64GB DDR5 5600MHz
- GPU: RTX 4080
- SSD: 2TB NVMe Gen 4
- PSU: 1000W 80+ Platinum
- Case: Full Tower

## Lưu ý khi build:
1. Kiểm tra tương thích linh kiện trước khi mua
2. Không tiết kiệm quá nhiều ở PSU
3. Tản nhiệt CPU phù hợp TDP
4. Cân bằng ngân sách (không dồn hết vào GPU)
5. Dự tính nâng cấp tương lai`
    }
  ];

  let successCount = 0;
  for (const article of articles) {
    try {
      console.log(`📝 Ingesting: ${article.source} [${article.category}]`);
      const result = await ingestionService.ingestText(article.text, {
        source: article.source,
        category: article.category,
        chunkSize: 1000,
        overlap: 150
      });
      if (result.success) {
        successCount++;
        console.log(`   ✅ ${result.chunksCreated} chunks created\n`);
      } else {
        console.log(`   ❌ ${result.error}\n`);
      }
    } catch (error) {
      console.error(`   ❌ Error: ${error.message}\n`);
    }
  }

  console.log(`\n🎉 Seeding complete: ${successCount}/${articles.length} articles ingested`);

  const stats = await ingestionService.getStats();
  console.log(`📊 Total knowledge documents: ${stats.total}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
