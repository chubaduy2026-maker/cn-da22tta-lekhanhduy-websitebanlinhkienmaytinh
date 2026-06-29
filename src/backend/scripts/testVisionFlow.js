const fs = require('fs');
const path = require('path');
const axios = require('axios');

const API_BASE = process.env.API_BASE_URL || 'http://localhost:5000';
const CHAT_ENDPOINT = `${API_BASE.replace(/\/$/, '')}/api/v3/chat`;
const PROVIDER_DEBUG_ENDPOINT = `${API_BASE.replace(/\/$/, '')}/api/v3/chat/provider-debug`;

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function guessMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.webp') return 'image/webp';
  return 'image/jpeg';
}

function readImageAsDataUrl(imagePath) {
  const absolute = path.resolve(imagePath);
  const bytes = fs.readFileSync(absolute);
  const mime = guessMimeType(absolute);
  return `data:${mime};base64,${bytes.toString('base64')}`;
}

async function sendVisionRequest({ imageBase64, message }) {
  const response = await axios.post(
    CHAT_ENDPOINT,
    {
      message,
      imageBase64
    },
    {
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json'
      }
    }
  );

  return response.data;
}

async function fetchProviderDebug() {
  try {
    const response = await axios.get(PROVIDER_DEBUG_ENDPOINT, {
      timeout: 15000,
      headers: {
        ...(process.env.CHAT_PROVIDER_DEBUG_TOKEN
          ? { 'x-debug-token': process.env.CHAT_PROVIDER_DEBUG_TOKEN }
          : {})
      }
    });

    return response.data;
  } catch (error) {
    return {
      success: false,
      error: error?.response?.data?.message || error.message
    };
  }
}

function containsAskBackText(text) {
  const normalized = String(text || '').toLowerCase();
  return [
    'bạn cần tìm loại sản phẩm gì',
    'ban can tim loai san pham gi',
    'bạn có thể cho biết thêm chi tiết',
    'ban co the cho biet them chi tiet',
    'cho em thêm tiêu chí',
    'cho em them tieu chi'
  ].some((frag) => normalized.includes(frag));
}

(async () => {
  try {
    const imagePath = process.env.TEST_IMAGE_PATH;
    const inlineImage = process.env.TEST_IMAGE_BASE64;
    const message = process.env.TEST_VISION_MESSAGE || 'toi muon tim san pham nhu nay';
    const expectProducts = String(process.env.TEST_EXPECT_PRODUCTS || 'true').toLowerCase() !== 'false';

    assert(Boolean(imagePath || inlineImage), 'Missing input image. Set TEST_IMAGE_PATH or TEST_IMAGE_BASE64.');

    const imageBase64 = inlineImage || readImageAsDataUrl(imagePath);
    console.log('Running visual search regression test...');
    console.log(`Image payload present: ${Boolean(imageBase64)}`);

    const chat = await sendVisionRequest({ imageBase64, message });
    assert(chat && chat.success === true, 'Visual search request failed');

    const text = String(chat?.data?.text || '').trim();
    const products = Array.isArray(chat?.data?.products) ? chat.data.products : [];

    assert(text.length > 0, 'Visual search text is empty');
    assert(!containsAskBackText(text), 'Regression detected: model asked back user instead of acting on image.');

    if (expectProducts) {
      assert(products.length > 0, 'Expected product cards but got empty list.');
    }

    const diagnostics = await fetchProviderDebug();
    const provider = diagnostics?.data?.provider || null;

    console.log('PASS: visual search flow is healthy.');
    console.log(JSON.stringify({
      endpoint: CHAT_ENDPOINT,
      message,
      textPreview: text.slice(0, 220),
      productsCount: products.length,
      firstProduct: products[0]?.name || null,
      providerLastSuccess: provider?.lastSuccess || null,
      providerLastError: provider?.lastError || null
    }, null, 2));
  } catch (error) {
    console.error('FAIL:', error.message);
    process.exit(1);
  }
})();
