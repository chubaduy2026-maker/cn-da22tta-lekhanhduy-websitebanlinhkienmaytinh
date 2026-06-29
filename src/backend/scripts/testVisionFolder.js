const fs = require('fs');
const path = require('path');
const axios = require('axios');

const API_BASE = process.env.API_BASE_URL || 'http://localhost:5000';
const CHAT_ENDPOINT = `${API_BASE.replace(/\/$/, '')}/api/v3/chat`;
const SUPPORTED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function guessMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  return 'image/jpeg';
}

function toDataUrl(filePath) {
  const bytes = fs.readFileSync(filePath);
  const mime = guessMimeType(filePath);
  return `data:${mime};base64,${bytes.toString('base64')}`;
}

function containsAskBackText(text) {
  const normalized = String(text || '').toLowerCase();
  return [
    'bạn cần tìm loại sản phẩm gì',
    'ban can tim loai san pham gi',
    'bạn có thể cho biết thêm chi tiết',
    'ban co the cho biet them chi tiet',
    'cho em thêm tiêu chí',
    'cho em them tieu chi',
    'vui lòng cho biết thêm',
    'vui long cho biet them'
  ].some((frag) => normalized.includes(frag));
}

function inferExpectedHint(fileName) {
  const value = String(fileName || '').toLowerCase();
  const hints = [
    { key: 'laptop', terms: ['laptop', 'notebook', 'macbook'] },
    { key: 'monitor', terms: ['monitor', 'manhinh', 'man-hinh', 'display'] },
    { key: 'mouse', terms: ['mouse', 'chuot'] },
    { key: 'keyboard', terms: ['keyboard', 'banphim', 'ban-phim'] },
    { key: 'headphone', terms: ['headphone', 'tainghe', 'tai-nghe'] }
  ];

  for (const hint of hints) {
    if (hint.terms.some((term) => value.includes(term))) {
      return hint;
    }
  }

  return null;
}

function productLooksRelevant(products, hint) {
  if (!hint || !Array.isArray(products) || products.length === 0) {
    return null;
  }

  const allText = products
    .slice(0, 5)
    .map((p) => `${String(p?.name || '')} ${String(p?.category || '')}`.toLowerCase())
    .join(' ');

  return hint.terms.some((term) => allText.includes(term));
}

async function sendVisionRequest({ message, imageBase64 }) {
  const response = await axios.post(
    CHAT_ENDPOINT,
    { message, imageBase64 },
    {
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json'
      }
    }
  );

  return response.data;
}

async function main() {
  const imageDir = process.env.TEST_IMAGE_DIR;
  const message = process.env.TEST_VISION_MESSAGE || 'toi muon tim san pham nhu nay';
  const strictCategoryMatch = String(process.env.TEST_STRICT_CATEGORY_MATCH || 'false').toLowerCase() === 'true';

  assert(Boolean(imageDir), 'Missing TEST_IMAGE_DIR. Example: TEST_IMAGE_DIR=D:\\vision-test-images');

  const absoluteDir = path.resolve(imageDir);
  assert(fs.existsSync(absoluteDir), `Image directory does not exist: ${absoluteDir}`);

  const files = fs.readdirSync(absoluteDir)
    .filter((name) => SUPPORTED_EXTENSIONS.has(path.extname(name).toLowerCase()))
    .sort();

  assert(files.length > 0, `No image files found in ${absoluteDir}`);

  console.log('Running batch visual search regression test...');
  console.log(`Directory: ${absoluteDir}`);
  console.log(`Images found: ${files.length}`);

  const rows = [];
  let passCount = 0;
  let failCount = 0;

  for (const fileName of files) {
    const filePath = path.join(absoluteDir, fileName);
    const expectedHint = inferExpectedHint(fileName);

    const row = {
      file: fileName,
      ok: false,
      askBackDetected: false,
      productsCount: 0,
      expected: expectedHint?.key || null,
      categoryMatch: null,
      textPreview: null,
      error: null
    };

    try {
      const imageBase64 = toDataUrl(filePath);
      const response = await sendVisionRequest({ message, imageBase64 });

      const text = String(response?.data?.text || '').trim();
      const products = Array.isArray(response?.data?.products) ? response.data.products : [];
      const askBackDetected = containsAskBackText(text);
      const categoryMatch = productLooksRelevant(products, expectedHint);

      row.askBackDetected = askBackDetected;
      row.productsCount = products.length;
      row.categoryMatch = categoryMatch;
      row.textPreview = text.slice(0, 140);

      const baseOk = Boolean(response?.success) && text.length > 0 && !askBackDetected;
      const categoryOk = strictCategoryMatch
        ? (categoryMatch !== false)
        : true;

      row.ok = baseOk && categoryOk;
    } catch (error) {
      row.error = error?.response?.data?.message || error.message;
      row.ok = false;
    }

    if (row.ok) {
      passCount += 1;
    } else {
      failCount += 1;
    }

    rows.push(row);
    console.log(`${row.ok ? 'PASS' : 'FAIL'} ${fileName} -> products=${row.productsCount}, askBack=${row.askBackDetected}${row.error ? `, error=${row.error}` : ''}`);
  }

  const summary = {
    endpoint: CHAT_ENDPOINT,
    directory: absoluteDir,
    total: rows.length,
    pass: passCount,
    fail: failCount,
    strictCategoryMatch,
    failedFiles: rows.filter((r) => !r.ok).map((r) => r.file),
    rows
  };

  console.log(JSON.stringify(summary, null, 2));

  if (failCount > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('FAIL:', error.message);
  process.exit(1);
});
