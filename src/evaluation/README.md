# AI Evaluation System — TechStore Chatbot

Hệ thống đánh giá tự động cho AI chatbot RAG của TechStore.

## Cấu trúc thư mục

```
evaluation/
├── run_evaluation.js          ← Script chính, chạy từ đây
├── config.js                  ← Cấu hình (URL, threshold, timeout)
├── dataset/
│   └── benchmark_dataset.json ← 100 câu hỏi test
├── src/
│   ├── MetricsCalculator.js   ← Tính 4 chỉ số đánh giá
│   ├── EvaluationPipeline.js  ← Gọi API và chạy pipeline
│   └── ReportGenerator.js     ← Tạo báo cáo
└── results/                   ← Kết quả tự động lưu tại đây
    ├── report_<timestamp>.json
    └── report_<timestamp>.txt
```

---

## Cài đặt

```bash
# Từ thư mục gốc của project
cd "d:\đồ án chuyên ngành"
npm install axios   # Thư viện duy nhất cần cài (nếu chưa có)
```

> Node.js phiên bản 14+ là đủ. Không cần cài thêm thư viện ML nào.

---

## Cách chạy

### Bước 1 — Khởi động backend

```bash
cd "d:\đồ án chuyên ngành\backend"
npm run dev
```

Đảm bảo backend đang chạy tại `http://localhost:5000` và file `.env` có `GEMINI_API_KEY` hợp lệ.

### Bước 2 — Chạy đánh giá

```bash
cd "d:\đồ án chuyên ngành"

# Đánh giá đầy đủ 100 câu
node evaluation/run_evaluation.js

# Thử nhanh với 10 câu đầu
node evaluation/run_evaluation.js --limit 10

# Chỉ đánh giá một danh mục
node evaluation/run_evaluation.js --category product_query

# Kết hợp
node evaluation/run_evaluation.js --limit 5 --category recommendation

# Xem hướng dẫn
node evaluation/run_evaluation.js --help
```

### Bước 3 — Xem kết quả

Kết quả được in ra console ngay lập tức và lưu vào `evaluation/results/`.

---

## Các chỉ số đánh giá

### 1. Retrieval Accuracy (Độ chính xác truy xuất)

**Đo lường**: Sản phẩm được chatbot truy xuất có liên quan đến câu hỏi không?

**Thuật toán**: Jaccard Similarity giữa từ khóa sản phẩm truy xuất được và danh mục sản phẩm kỳ vọng.

```
Score = |keywords_retrieved ∩ keywords_expected| / |keywords_retrieved ∪ keywords_expected|
```

**Ngưỡng đề xuất**: ≥ 70%

**Cách diễn giải**:
- ≥ 80%: Xuất sắc — chatbot tìm đúng loại sản phẩm
- 60–79%: Tốt — hầu hết sản phẩm phù hợp
- < 60%: Cần cải thiện — vector search chưa tốt

---

### 2. Answer Correctness (Độ chính xác câu trả lời)

**Đo lường**: Câu trả lời của chatbot gần với đáp án chuẩn đến mức nào?

**Thuật toán**: Token-level F1 Score (kết hợp Precision và Recall trên từng từ).

```
Precision = từ_đúng / tổng_từ_trong_câu_trả_lời
Recall    = từ_đúng / tổng_từ_trong_đáp_án_chuẩn
F1        = 2 × (Precision × Recall) / (Precision + Recall)
```

**Ngưỡng đề xuất**: ≥ 60%

**Cách diễn giải**:
- ≥ 75%: Xuất sắc — câu trả lời gần với đáp án chuẩn
- 50–74%: Chấp nhận — đúng ý nhưng diễn đạt khác
- < 50%: Kém — câu trả lời sai hoặc không liên quan

---

### 3. Faithfulness (Độ trung thực / Phát hiện ảo giác)

**Đo lường**: Câu trả lời có được hỗ trợ bởi context đã truy xuất không? Có bịa đặt thông tin không?

**Thuật toán**: Tỷ lệ từ khóa trong câu trả lời xuất hiện trong context retrieval.

```
Score = từ_khóa_trả_lời_có_trong_context / tổng_từ_khóa_trả_lời
```

**Ngưỡng đề xuất**: ≥ 70%

**Cách diễn giải**:
- ≥ 80%: Xuất sắc — chatbot trả lời dựa trên dữ liệu thực
- 60–79%: Tốt — ít ảo giác
- < 60%: Nguy hiểm — nhiều thông tin bịa đặt (hallucination)

---

### 4. Latency (Độ trễ)

**Đo lường**: Thời gian từ khi gửi câu hỏi đến khi nhận được câu trả lời.

**Scoring**:
- ≤ 1 giây: điểm 1.0 (Nhanh)
- 1–5 giây: điểm giảm dần tuyến tính
- ≥ 10 giây: điểm 0.0 (Quá chậm)

**Ngưỡng đề xuất**: ≤ 5 giây

**Cách diễn giải**:
- < 2s: Xuất sắc (real-time feel)
- 2–5s: Chấp nhận được cho chatbot AI
- > 5s: Cần tối ưu (xem xét caching, timeout Gemini)

---

## Ví dụ kết quả

```
══════════════════════════════════════════════════════════
       TECHSTORE AI CHATBOT - EVALUATION REPORT
══════════════════════════════════════════════════════════
  Total Questions   : 100
  Successful        : 98
  Failed (API Error): 2
──────────────────────────────────────────────────────────
  METRIC RESULTS
──────────────────────────────────────────────────────────
  Retrieval Accuracy  : 87.3%   (85/98 passed threshold ≥70.0%)
  Answer Correctness  : 74.1%   (82/98 passed threshold ≥60.0%)
  Faithfulness        : 91.2%   (92/98 passed threshold ≥70.0%)
  Average Latency     : 2.14 seconds   (min: 0.82s, max: 8.45s)
──────────────────────────────────────────────────────────
  CATEGORY BREAKDOWN
──────────────────────────────────────────────────────────
  product_query             | RA:91.2% AC:78.3% FF:93.1%
  product_comparison        | RA:85.1% AC:71.4% FF:88.6%
  tech_explanation          | RA:80.3% AC:72.8% FF:94.2%
  recommendation            | RA:88.7% AC:75.2% FF:90.1%
  general_technical         | RA:82.4% AC:73.0% FF:89.8%
══════════════════════════════════════════════════════════
```

---

## Cách mở rộng dataset

Mỗi câu hỏi trong `dataset/benchmark_dataset.json` có cấu trúc:

```json
{
  "id": "Q101",
  "category": "product_query",
  "question": "Câu hỏi của bạn ở đây?",
  "ground_truth_answer": "Đáp án chuẩn đầy đủ để so sánh.",
  "expected_keywords": ["từ", "khóa", "kỳ", "vọng"],
  "relevant_product_categories": ["danh_muc_san_pham"],
  "difficulty": "easy"
}
```

| Trường | Mô tả |
|---|---|
| `id` | Mã định danh duy nhất (Q001–Q100) |
| `category` | Một trong 5 danh mục |
| `question` | Câu hỏi gửi đến chatbot |
| `ground_truth_answer` | Đáp án chuẩn do chuyên gia viết |
| `expected_keywords` | Từ khóa phải xuất hiện trong câu trả lời |
| `relevant_product_categories` | Danh mục sản phẩm cần được truy xuất |
| `difficulty` | `easy` / `medium` / `hard` |

---

## Cấu hình

Chỉnh sửa `config.js` để thay đổi:

```js
API_BASE_URL: 'http://localhost:5000'  // URL backend
CONCURRENCY: 3                          // Số request song song
REQUEST_TIMEOUT_MS: 30000              // Timeout mỗi câu
THRESHOLDS: {
  retrieval_accuracy: 0.70,   // Ngưỡng tối thiểu
  answer_correctness: 0.60,
  faithfulness: 0.70,
  latency_seconds: 5.0
}
```
