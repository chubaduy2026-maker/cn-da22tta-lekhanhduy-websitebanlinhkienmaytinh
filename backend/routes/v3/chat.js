const express = require('express');
const crypto = require('crypto');

const router = express.Router();

const AIRouter = require('../../services/ai/core/AIRouter');
const ConversationMemoryService = require('../../services/ai/ConversationMemoryService');
const SemanticSearchService = require('../../services/ai/SemanticSearchService');
const ChatbotConversation = require('../../models/ChatbotConversation');
const { optionalAuth } = require('../../middleware/auth');

const SESSION_INACTIVITY_RESET_MS = 30 * 60 * 1000;
const CHAT_RATE_LIMIT_WINDOW_MS = Number(process.env.CHAT_RATE_LIMIT_WINDOW_MS || 15000);
const CHAT_RATE_LIMIT_MAX_REQUESTS = Number(process.env.CHAT_RATE_LIMIT_MAX_REQUESTS || 6);
const REQUEST_RATE_STORE = new Map();
const OUTPUT_GUARD_STATS = {
  totalResponses: 0,
  sanitizedResponses: 0,
  leakageDetected: 0,
  fallbackResponses: 0,
  lastSanitizedAt: null
};
const OUTPUT_GUARD_ALERT_STATE = {
  lastSignature: ''
};
const PHASE_TIMEOUTS = {
  ensureSessionMs: Number(process.env.CHAT_TIMEOUT_ENSURE_SESSION_MS || 5000),
  historyLoadMs: Number(process.env.CHAT_TIMEOUT_HISTORY_LOAD_MS || 4000),
  aiExecutionMs: Number(process.env.CHAT_TIMEOUT_AI_EXECUTION_MS || 20000),
  saveMessageMs: Number(process.env.CHAT_TIMEOUT_SAVE_MESSAGE_MS || 6000)
};
const OUTPUT_GUARD_THRESHOLDS = {
  sanitizeRateWarn: Number(process.env.OUTPUT_GUARD_SANITIZE_RATE_WARN || 0.05),
  fallbackRateWarn: Number(process.env.OUTPUT_GUARD_FALLBACK_RATE_WARN || 0.1),
  leakageDetectedWarn: Number(process.env.OUTPUT_GUARD_LEAKAGE_DETECTED_WARN || 1)
};

function createGuestSessionId() {
  return `guest_${crypto.randomBytes(32).toString('hex')}`;
}

function createUserSessionId(userId) {
  return `user_${userId}_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
}

function isValidGuestSessionId(value) {
  return typeof value === 'string' && /^guest_[a-f0-9]{64}$/.test(value);
}

function isValidOwnedUserSessionId(value, userId) {
  if (typeof value !== 'string' || typeof userId !== 'string' || !userId.trim()) {
    return false;
  }

  return value.startsWith(`user_${userId}_`);
}

async function resolveLatestActiveUserSessionId(userId) {
  if (typeof userId !== 'string' || !userId.trim()) {
    return '';
  }

  const latestConversation = await ChatbotConversation.findOne({
    user: userId,
    status: 'active'
  })
    .select('sessionId updatedAt')
    .sort({ updatedAt: -1 })
    .lean();

  return String(latestConversation?.sessionId || '').trim();
}

function resolveAbsoluteAssetUrl(req, assetPath) {
  if (!assetPath || typeof assetPath !== 'string') {
    return null;
  }

  if (/^https?:\/\//i.test(assetPath)) {
    return assetPath;
  }

  const protocol = (req.headers['x-forwarded-proto'] || req.protocol || 'http').toString().split(',')[0].trim();
  const host = req.get('host');
  const normalizedPath = assetPath.startsWith('/') ? assetPath : `/${assetPath}`;

  return `${protocol}://${host}${normalizedPath}`;
}

function mapProductForChat(req, product) {
  if (!product || typeof product !== 'object') {
    return null;
  }

  const rawImage = product.imageUrl || product.images?.[0] || product.image || null;
  const imageUrl = resolveAbsoluteAssetUrl(req, rawImage);
  const id = product._id?.toString?.() || product.id || null;
  const productUrl = typeof product.productUrl === 'string' && product.productUrl.trim()
    ? product.productUrl.trim()
    : (id ? `/product/${id}` : null);

  return {
    id,
    name: product.name || 'Sản phẩm',
    price: Number(product.price) || 0,
    brand: product.brand || '',
    category: product.category || '',
    imageUrl,
    productUrl
  };
}

function mergeProducts(primary = [], secondary = []) {
  const merged = [];
  const seen = new Set();

  for (const item of [...(Array.isArray(primary) ? primary : []), ...(Array.isArray(secondary) ? secondary : [])]) {
    if (!item) {
      continue;
    }

    const key = `${String(item.id || item.name || '').toLowerCase()}::${String(item.imageUrl || '').toLowerCase()}`;
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(item);
    }
  }

  return merged.slice(0, 5);
}

function applyFinalOutputGuard({ text = '', products = [] } = {}) {
  const original = String(text || '');
  const responseText = original;
  const cleanMessage = responseText
    .replace(/<function[^>]*>[\s\S]*?(?:<\/function>|$)/gi, ' ')
    .replace(/<tool_call[^>]*>[\s\S]*?(?:<\/tool_call>|$)/gi, ' ')
    .replace(/^\s*\[TOOL:[^\]]+\]\s*[\s\S]*$/gim, ' ')
    .replace(/\[TOOL:[^\]]+\]/gi, ' ')
    .trim();
  const sanitizedText = String(cleanMessage || '')
    .replace(/!\[[^\]]*\]\([^)]+\)/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  const activeProductsList = mergeProducts(products, []);
  const hasFunctionLeak = cleanMessage !== responseText;
  const changed = sanitizedText !== original;

  OUTPUT_GUARD_STATS.totalResponses += 1;
  if (changed) {
    OUTPUT_GUARD_STATS.sanitizedResponses += 1;
    OUTPUT_GUARD_STATS.lastSanitizedAt = new Date().toISOString();
  }
  if (hasFunctionLeak) {
    OUTPUT_GUARD_STATS.leakageDetected += 1;
  }

  return {
    text: sanitizedText,
    products: activeProductsList,
    changed,
    leakageDetected: hasFunctionLeak
  };
}

function buildOutputGuardMetrics() {
  const totalResponses = OUTPUT_GUARD_STATS.totalResponses;
  const sanitizeRate = totalResponses > 0
    ? Number((OUTPUT_GUARD_STATS.sanitizedResponses / totalResponses).toFixed(4))
    : 0;
  const fallbackRate = totalResponses > 0
    ? Number((OUTPUT_GUARD_STATS.fallbackResponses / totalResponses).toFixed(4))
    : 0;

  const alerts = [];
  if (sanitizeRate > OUTPUT_GUARD_THRESHOLDS.sanitizeRateWarn) {
    alerts.push(`sanitize_rate_high:${sanitizeRate}`);
  }
  if (fallbackRate > OUTPUT_GUARD_THRESHOLDS.fallbackRateWarn) {
    alerts.push(`fallback_rate_high:${fallbackRate}`);
  }
  if (OUTPUT_GUARD_STATS.leakageDetected >= OUTPUT_GUARD_THRESHOLDS.leakageDetectedWarn) {
    alerts.push(`leakage_detected:${OUTPUT_GUARD_STATS.leakageDetected}`);
  }

  return {
    ...OUTPUT_GUARD_STATS,
    sanitizeRate,
    fallbackRate,
    thresholds: OUTPUT_GUARD_THRESHOLDS,
    alerts,
    alerting: alerts.length > 0
  };
}

function buildObservabilitySnapshot() {
  const outputGuard = buildOutputGuardMetrics();
  const routerHealth = AIRouter.getHealthDetails();

  let level = 'ok';
  if (outputGuard.alerting) {
    level = outputGuard.fallbackRate >= 0.25 ? 'critical' : 'warning';
  }

  const now = new Date();
  return {
    level,
    timestamp: now.toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    process: {
      pid: process.pid,
      memoryMb: Math.round((process.memoryUsage().rss / 1024 / 1024) * 100) / 100
    },
    outputGuard,
    router: {
      status: routerHealth?.status || 'unknown',
      cache: routerHealth?.cache || {},
      routing: routerHealth?.routing || {}
    },
    actions: outputGuard.alerting
      ? [
          'Check provider health and fallback usage trends',
          'Run ai:test-output-guard and ai:test-forced-leakage',
          'Review recent chat logs for leakage patterns'
        ]
      : ['System is stable. Continue monitoring at regular intervals.']
  };
}

function maybeLogOutputGuardAlert(metrics) {
  if (!metrics || !metrics.alerting) {
    OUTPUT_GUARD_ALERT_STATE.lastSignature = '';
    return;
  }

  const signature = Array.isArray(metrics.alerts) ? metrics.alerts.join('|') : '';
  if (!signature || signature === OUTPUT_GUARD_ALERT_STATE.lastSignature) {
    return;
  }

  OUTPUT_GUARD_ALERT_STATE.lastSignature = signature;
  console.warn('[OUTPUT_GUARD_ALERT]', {
    alerts: metrics.alerts,
    sanitizeRate: metrics.sanitizeRate,
    fallbackRate: metrics.fallbackRate,
    leakageDetected: metrics.leakageDetected,
    totalResponses: metrics.totalResponses,
    timestamp: new Date().toISOString()
  });
}

function resetOutputGuardStats() {
  OUTPUT_GUARD_STATS.totalResponses = 0;
  OUTPUT_GUARD_STATS.sanitizedResponses = 0;
  OUTPUT_GUARD_STATS.leakageDetected = 0;
  OUTPUT_GUARD_STATS.fallbackResponses = 0;
  OUTPUT_GUARD_STATS.lastSanitizedAt = null;
  OUTPUT_GUARD_ALERT_STATE.lastSignature = '';
}

function formatVnd(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) {
    return null;
  }

  return `${amount.toLocaleString('vi-VN')} VND`;
}

function isImageFollowUpRequest(message = '') {
  return /^(có hình không|đâu|hình đâu|cho xem hình|xem ảnh|hình ảnh đâu|đâu rồi|xem hình)$/i.test(String(message || '').trim());
}

async function buildLocalFallbackResponse(req, message = '') {
  const normalizedMessage = String(message || '').trim();
  const greetingPattern = /^(xin\s*ch(a|à)o|ch(a|à)o(\s+(b(a|ạ)n|anh|ch(i|ị)|shop|ad|minh))?|hello|hi|hey)\b/i;
  const blessingPattern = /\b(chuc|chúc)\b.{0,40}\b(s(a|á)ng|chi(e|ề)u|t(o|ố)i|ng(a|à)y|cu(o|ố)i\s*tu(a|ầ)n|vui|tot|t(o|ố)t\s*l(a|à)nh|an\s*l(a|à)nh|ng(u|ủ)\s*ngon)\b/i;

  if (greetingPattern.test(normalizedMessage) || blessingPattern.test(normalizedMessage)) {
    return {
      text: 'Chào bạn, mình là trợ lý AI của TechStore. Mình có thể giúp gì cho bạn hôm nay?',
      products: []
    };
  }

  const genericNeedPattern = /^(toi can tim|m(i|ì)nh can tim|can tim|tim giup|tim san pham|nhu vay|nhu nay|giong nhu|san pham nhu)/i;
  const effectiveKeyword = genericNeedPattern.test(normalizedMessage)
    ? ''
    : normalizedMessage;

  const searchResult = await SemanticSearchService.searchProducts({
    keyword: effectiveKeyword,
    filters: {},
    limit: 5
  });

  const products = (Array.isArray(searchResult?.products) ? searchResult.products : [])
    .map((item) => mapProductForChat(req, item))
    .filter(Boolean)
    .slice(0, 5);

  if (products.length === 0) {
    return {
      text: 'Em chưa đủ dữ liệu để chốt đúng sản phẩm ngay lúc này. Anh/chị cho em thêm 2-3 tiêu chí (ví dụ: chuột gaming dưới 1 triệu, không dây, nhẹ tay) để em lọc chính xác hơn nhé.',
      products: []
    };
  }

  const bullets = products
    .map((p) => {
      const priceText = formatVnd(p.price);
      return priceText ? `- ${p.name}: ${priceText}` : `- ${p.name}`;
    })
    .join('\n');

  return {
    text: `Em gửi nhanh một số gợi ý phù hợp để anh/chị tham khảo:\n\n${bullets}`,
    products
  };
}

function extractRetryAfterSeconds(errorMessage = '') {
  if (typeof errorMessage !== 'string') {
    return null;
  }

  const secondsMatch = errorMessage.match(/retry\s+in\s+([\d.]+)s/i);
  if (secondsMatch && Number.isFinite(Number(secondsMatch[1]))) {
    return Math.max(1, Math.ceil(Number(secondsMatch[1])));
  }

  const delayMatch = errorMessage.match(/"retryDelay"\s*:\s*"(\d+)s"/i);
  if (delayMatch && Number.isFinite(Number(delayMatch[1]))) {
    return Math.max(1, Number(delayMatch[1]));
  }

  return null;
}

function compactImageMetadata(imageDataUri = '') {
  const raw = String(imageDataUri || '').trim();
  if (!raw) {
    return null;
  }

  const dataUriMatch = raw.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.*)$/);
  if (!dataUriMatch) {
    return '[image payload omitted]';
  }

  const mimeType = dataUriMatch[1];
  const base64Payload = dataUriMatch[2] || '';
  const approxBytes = Math.max(0, Math.floor((base64Payload.length * 3) / 4));

  return `[${mimeType};base64 omitted; chars=${base64Payload.length}; bytes~=${approxBytes}]`;
}

function classifyAIProviderFailure(errorMessage = '') {
  const text = String(errorMessage || '').toLowerCase();
  const isInternalPhaseTimeout = text.includes('ensure_session timed out')
    || text.includes('history_load timed out')
    || text.includes('save_user_message timed out')
    || text.includes('save_tool_message timed out')
    || text.includes('save_assistant_message timed out');

  if (isInternalPhaseTimeout) {
    return null;
  }

  const isRateLimit = text.includes('429')
    || text.includes('too many requests')
    || text.includes('quota exceeded')
    || text.includes('rate limit');
  const isTimeout = text.includes('timeout')
    || text.includes('timed out')
    || text.includes('etimedout')
    || text.includes('econnaborted');
  const isAuthFailure = text.includes('401')
    || text.includes('403')
    || text.includes('unauthorized')
    || text.includes('forbidden')
    || text.includes('invalid api key');
  const isNetworkFailure = text.includes('enotfound')
    || text.includes('econnreset')
    || text.includes('econnrefused')
    || text.includes('socket hang up')
    || text.includes('network error');
  const isCircuitOpen = text.includes('circuit is open');
  const isMissingProviderKey = text.includes('gemini_api_key') || text.includes('api key missing');
  const isGeminiProviderFailure = text.includes('gemini request failed')
    || text.includes('google api')
    || text.includes('gemini service not initialized')
    || text.includes('gemini initialization failed');
  const isProviderFailure = text.includes('all providers failed')
    || isRateLimit
    || isTimeout
    || isAuthFailure
    || isNetworkFailure
    || isCircuitOpen
    || isMissingProviderKey
    || isGeminiProviderFailure;
  const retryAfterSeconds = isRateLimit ? extractRetryAfterSeconds(errorMessage) : null;

  if (!isProviderFailure) {
    return null;
  }

  return {
    statusCode: isRateLimit ? 503 : 502,
    retryAfterSeconds,
    isMissingProviderKey
  };
}

function getLastUserMessageAt(conversation) {
  const messages = Array.isArray(conversation?.messages) ? conversation.messages : [];
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const item = messages[i];
    if (item?.role === 'user' && item?.timestamp) {
      const ts = new Date(item.timestamp);
      if (!Number.isNaN(ts.getTime())) {
        return ts;
      }
    }
  }
  return null;
}

function normalizeHistoryMessages(history = [], maxItems = 8) {
  const safe = Array.isArray(history) ? history : [];
  return safe
    .filter((item) => item && typeof item.content === 'string')
    .map((item) => {
      const roleRaw = String(item.role || '').toLowerCase();
      const role = roleRaw === 'assistant' ? 'assistant' : (roleRaw === 'user' ? 'user' : null);
      return {
        role,
        content: String(item.content || '').trim()
      };
    })
    .filter((item) => item.role && item.content.length > 0)
    .slice(-Math.max(1, Number(maxItems) || 8));
}

function checkRateLimit(key) {
  const now = Date.now();
  const bucket = REQUEST_RATE_STORE.get(key) || { timestamps: [] };
  bucket.timestamps = bucket.timestamps.filter((ts) => now - ts <= CHAT_RATE_LIMIT_WINDOW_MS);

  if (bucket.timestamps.length >= CHAT_RATE_LIMIT_MAX_REQUESTS) {
    const oldest = bucket.timestamps[0] || now;
    const retryAfterMs = Math.max(0, CHAT_RATE_LIMIT_WINDOW_MS - (now - oldest));
    REQUEST_RATE_STORE.set(key, bucket);
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000))
    };
  }

  bucket.timestamps.push(now);
  REQUEST_RATE_STORE.set(key, bucket);

  if (REQUEST_RATE_STORE.size > 5000) {
    const oldestKey = REQUEST_RATE_STORE.keys().next().value;
    if (oldestKey) {
      REQUEST_RATE_STORE.delete(oldestKey);
    }
  }

  return {
    allowed: true,
    retryAfterSeconds: null
  };
}

async function withTimeout(task, timeoutMs, phaseName) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        reject(new Error(`${phaseName} timed out after ${timeoutMs}ms`));
      }
    }, timeoutMs);

    Promise.resolve()
      .then(task)
      .then((result) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve(result);
        }
      })
      .catch((error) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          reject(error);
        }
      });
  });
}

async function persistMessageBestEffort({ sessionId, payload, phaseName, requestId }) {
  try {
    const saveResult = await withTimeout(
      () => ConversationMemoryService.saveMessage(sessionId, payload),
      PHASE_TIMEOUTS.saveMessageMs,
      phaseName
    );

    if (saveResult && saveResult.success === false) {
      throw new Error(saveResult.error || `${phaseName} failed`);
    }

    return true;
  } catch (persistError) {
    console.warn(`[${requestId}] [PERSIST_BEST_EFFORT] ${phaseName} failed`, {
      message: persistError?.message
    });
    return false;
  }
}

router.get('/chat/health', async (req, res) => {
  try {
    const now = Date.now();
    let activeRateLimitBuckets = 0;

    for (const bucket of REQUEST_RATE_STORE.values()) {
      const activeCount = (bucket?.timestamps || []).filter((ts) => now - ts <= CHAT_RATE_LIMIT_WINDOW_MS).length;
      if (activeCount > 0) {
        activeRateLimitBuckets += 1;
      }
    }

    const outputGuard = buildOutputGuardMetrics();
    maybeLogOutputGuardAlert(outputGuard);

    return res.json({
      success: true,
      data: {
        router: AIRouter.getHealthDetails(),
        outputGuard,
        rateLimit: {
          windowMs: CHAT_RATE_LIMIT_WINDOW_MS,
          maxRequests: CHAT_RATE_LIMIT_MAX_REQUESTS,
          trackedBuckets: REQUEST_RATE_STORE.size,
          activeBuckets: activeRateLimitBuckets
        },
        timeouts: PHASE_TIMEOUTS
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

router.get('/chat/observability', async (req, res) => {
  try {
    const snapshot = buildObservabilitySnapshot();
    maybeLogOutputGuardAlert(snapshot.outputGuard);

    return res.json({
      success: true,
      data: snapshot
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

router.get('/chat/provider-debug', optionalAuth, async (req, res) => {
  try {
    const debugToken = String(process.env.CHAT_PROVIDER_DEBUG_TOKEN || '').trim();
    const providedToken = String(req.headers['x-debug-token'] || '').trim();
    const isLocal = req.ip === '::1' || req.ip === '127.0.0.1' || req.ip === '::ffff:127.0.0.1';

    if (debugToken) {
      if (!providedToken || providedToken !== debugToken) {
        return res.status(403).json({
          success: false,
          message: 'Forbidden: invalid debug token'
        });
      }
    } else if (!isLocal) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: provider debug endpoint only allowed from localhost when no token is configured'
      });
    }

    return res.json({
      success: true,
      data: {
        provider: AIRouter.getProviderDiagnostics(),
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

router.post('/chat/health/reset', optionalAuth, async (req, res) => {
  try {
    const resetToken = String(process.env.CHAT_HEALTH_RESET_TOKEN || '').trim();
    const providedToken = String(req.headers['x-reset-token'] || '').trim();
    const isLocal = req.ip === '::1' || req.ip === '127.0.0.1' || req.ip === '::ffff:127.0.0.1';

    if (resetToken) {
      if (!providedToken || providedToken !== resetToken) {
        return res.status(403).json({
          success: false,
          message: 'Forbidden: invalid reset token'
        });
      }
    } else if (!isLocal) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: reset endpoint only allowed from localhost when no token is configured'
      });
    }

    resetOutputGuardStats();
    return res.json({
      success: true,
      message: 'Output guard metrics reset successfully',
      data: {
        outputGuard: buildOutputGuardMetrics()
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

router.get('/chat/sessions/:userId', optionalAuth, async (req, res) => {
  try {
    const requestedUserId = String(req.params.userId || '').trim();
    const authenticatedUserId = req.user?._id?.toString() || req.user?.id || null;
    const role = String(req.user?.role || '').toLowerCase();
    const isPrivileged = role === 'admin' || role === 'staff';

    if (!requestedUserId) {
      return res.status(400).json({
        success: false,
        message: 'userId là bắt buộc.'
      });
    }

    if (!authenticatedUserId) {
      return res.status(401).json({
        success: false,
        message: 'Vui lòng đăng nhập để xem danh sách phiên chat.'
      });
    }

    if (!isPrivileged && authenticatedUserId !== requestedUserId) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền xem danh sách phiên chat của người dùng này.'
      });
    }

    const conversations = await ChatbotConversation.find({
      user: requestedUserId,
      status: 'active'
    })
      .select('sessionId updatedAt messages')
      .sort({ updatedAt: -1 })
      .lean();

    const sessions = (Array.isArray(conversations) ? conversations : []).map((conversation) => {
      const firstUserMessage = (Array.isArray(conversation.messages) ? conversation.messages : [])
        .find((item) => item?.role === 'user' && String(item?.content || '').trim());

      const rawTitle = String(firstUserMessage?.content || 'Phiên chat mới').replace(/\s+/g, ' ').trim();
      const title = rawTitle.length > 60 ? `${rawTitle.slice(0, 57)}...` : rawTitle;

      return {
        sessionId: conversation.sessionId,
        updatedAt: conversation.updatedAt,
        title
      };
    });

    return res.json({
      success: true,
      data: sessions
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

router.get('/chat/history/:sessionId', optionalAuth, async (req, res) => {
  try {
    const requestedSessionId = String(req.params.sessionId || '').trim();
    const authenticatedUserId = req.user?._id?.toString() || req.user?.id || null;
    const role = String(req.user?.role || '').toLowerCase();
    const isPrivileged = role === 'admin' || role === 'staff';

    if (!requestedSessionId) {
      return res.status(400).json({
        success: false,
        message: 'sessionId là bắt buộc.'
      });
    }

    const conversation = await ChatbotConversation.findOne({
      sessionId: requestedSessionId,
      status: 'active'
    })
      .select('sessionId user messages updatedAt')
      .lean();

    if (!conversation) {
      return res.json({
        success: true,
        data: {
          sessionId: requestedSessionId,
          messages: []
        }
      });
    }

    const ownerId = conversation?.user?.toString?.() || '';
    if (ownerId && !isPrivileged && authenticatedUserId && ownerId !== authenticatedUserId) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền xem phiên chat này.'
      });
    }

    const messages = (Array.isArray(conversation.messages) ? conversation.messages : [])
      .map((item, index) => {
        const roleName = item?.role === 'assistant' ? 'ai' : (item?.role === 'system' ? 'system' : 'user');
        const text = String(item?.content || '').trim();
        const image = roleName === 'user' ? String(item?.metadata?.image || '').trim() : '';
        const products = roleName === 'ai' && Array.isArray(item?.metadata?.products)
          ? item.metadata.products
          : [];

        return {
          id: `${conversation.sessionId}_${index}_${new Date(item?.timestamp || Date.now()).getTime()}`,
          role: roleName,
          text,
          image: image || null,
          products,
          timestamp: item?.timestamp || null
        };
      })
      .filter((item) => item.text || item.image || (Array.isArray(item.products) && item.products.length > 0));

    return res.json({
      success: true,
      data: {
        sessionId: conversation.sessionId,
        updatedAt: conversation.updatedAt,
        messages
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

router.post('/chat', optionalAuth, async (req, res) => {
  const requestId = `v3_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

  try {
    console.log(`[${requestId}] [STEP 1] POST /api/v3/chat received`);

    const {
      message,
      imageBase64,
      sessionId: clientSessionId,
      userId: clientUserId,
      newChat: newChatRequested = false
    } = req.body || {};
    const normalizedMessage = typeof message === 'string' ? message.trim() : '';
    const normalizedImageBase64 = typeof imageBase64 === 'string' ? imageBase64.trim() : '';
    const hasImagePayload = /^data:image\/[a-zA-Z0-9.+-]+;base64,/.test(normalizedImageBase64);
    const effectiveMessage = normalizedMessage || (hasImagePayload ? 'Tìm sản phẩm từ hình ảnh này' : '');
    const normalizedClientSessionId = typeof clientSessionId === 'string' ? clientSessionId.trim() : '';
    const normalizedClientUserId = typeof clientUserId === 'string' ? clientUserId.trim() : '';
    console.log(`[${requestId}] [STEP 2] payload parsed`, {
      hasMessage: typeof message === 'string',
      messageLength: typeof message === 'string' ? message.length : 0,
      hasImagePayload,
      hasClientSessionId: Boolean(normalizedClientSessionId),
      hasClientUserId: Boolean(normalizedClientUserId),
      newChatRequested: Boolean(newChatRequested),
      clientSessionIdPreview: normalizedClientSessionId ? normalizedClientSessionId.slice(0, 18) : null
    });

    if (!effectiveMessage || !normalizedClientSessionId || !normalizedClientUserId) {
      console.warn(`[${requestId}] [STEP 2.1] invalid message payload`);
      return res.status(400).json({
        success: false,
        data: {
          text: 'Yêu cầu không hợp lệ. Bắt buộc gửi đầy đủ message (hoặc image), sessionId và userId.',
          products: []
        }
      });
    }

    const authenticatedUserId = req.user?._id?.toString() || req.user?.id || null;
    if (authenticatedUserId && authenticatedUserId !== normalizedClientUserId) {
      return res.status(403).json({
        success: false,
        data: {
          text: 'userId không khớp với token đăng nhập.',
          products: []
        }
      });
    }

    const userId = authenticatedUserId;
    console.log(`[${requestId}] [STEP 3] auth resolved`, {
      isAuthenticated: Boolean(userId),
      userId: userId || normalizedClientUserId
    });

    // Security-first session policy:
    // - Authenticated users can reuse owned session ids, otherwise fallback to latest active session.
    // - Guests only reuse strong server-issued guest ids that point to guest conversations.
    let effectiveSessionId = normalizedClientSessionId;
    console.log(`[${requestId}] [STEP 4] session bootstrap`, {
      mode: userId ? 'user' : 'guest',
      effectiveSessionId
    });

    if (userId && !isValidOwnedUserSessionId(effectiveSessionId, normalizedClientUserId)) {
      const latestOwnedSessionId = await resolveLatestActiveUserSessionId(userId);
      effectiveSessionId = latestOwnedSessionId || createUserSessionId(userId);
      console.warn(`[${requestId}] [STEP 4.1] invalid sessionId for authenticated user; auto-rotated`, {
        previousSessionIdPreview: normalizedClientSessionId ? normalizedClientSessionId.slice(0, 18) : null,
        effectiveSessionIdPreview: effectiveSessionId.slice(0, 18),
        reusedLatestSession: Boolean(latestOwnedSessionId)
      });
    }

    if (!userId && !isValidGuestSessionId(effectiveSessionId)) {
      return res.status(400).json({
        success: false,
        data: {
          text: 'sessionId guest không hợp lệ.',
          products: []
        }
      });
    }

    const rateLimitKey = userId ? `user:${userId}` : `session:${effectiveSessionId}`;
    const rateLimitResult = checkRateLimit(rateLimitKey);
    if (!rateLimitResult.allowed) {
      res.set('Retry-After', String(rateLimitResult.retryAfterSeconds));
      return res.status(429).json({
        success: false,
        debugId: requestId,
        data: {
          text: `Bạn gửi tin nhắn quá nhanh. Vui lòng thử lại sau khoảng ${rateLimitResult.retryAfterSeconds} giây.`,
          products: []
        }
      });
    }

    console.log(`[${requestId}] [STEP 5] ensuring session`, {
      effectiveSessionIdPreview: effectiveSessionId.slice(0, 18)
    });
    const ensuredSession = await withTimeout(
      () => ConversationMemoryService.ensureSession(effectiveSessionId, userId, {
        channel: 'api_v3_chat'
      }),
      PHASE_TIMEOUTS.ensureSessionMs,
      'ensure_session'
    );

    if (!ensuredSession.success) {
      throw new Error(ensuredSession.error || 'Không thể khởi tạo hội thoại');
    }
    console.log(`[${requestId}] [STEP 5.1] session ensured`);

    const lastUserMessageAt = getLastUserMessageAt(ensuredSession.conversation);
    const isInactiveTooLong = Boolean(lastUserMessageAt)
      && (Date.now() - lastUserMessageAt.getTime() > SESSION_INACTIVITY_RESET_MS);
    const shouldStartFreshSession = Boolean(newChatRequested) || isInactiveTooLong;
    if (shouldStartFreshSession) {
      console.log(`[${requestId}] [STEP 5.2] newChat/inactivity flagged; using client-provided sessionId`, {
        reason: newChatRequested ? 'new_chat_requested' : 'inactive_over_30m',
        effectiveSessionIdPreview: effectiveSessionId.slice(0, 18)
      });
    }

    console.log(`[${requestId}] [STEP 7] loading conversation history`);
    const historyResult = await withTimeout(
      () => ConversationMemoryService.getOptimizedHistory(effectiveSessionId, 8),
      PHASE_TIMEOUTS.historyLoadMs,
      'history_load'
    );
    const history = historyResult.success ? historyResult.recentHistory : [];
    const summary = historyResult.success ? historyResult.summary : '';
    const normalizedRecentHistory = normalizeHistoryMessages(history, 8);
    const historyForRouter = summary
      ? [{ role: 'system', content: `Ngữ cảnh cũ đã tóm tắt: ${summary}` }, ...normalizedRecentHistory]
      : normalizedRecentHistory;
    console.log(`[${requestId}] [STEP 7.1] history loaded`, {
      historySuccess: historyResult.success,
      historyCount: Array.isArray(history) ? history.length : 0,
      hasSummary: Boolean(summary)
    });

    console.log(`[${requestId}] [STEP 8] routing to AI engine`);
    const aiResult = await withTimeout(
      () => AIRouter.routeAndProcess({
        userMessage: effectiveMessage,
        imageBase64: hasImagePayload ? normalizedImageBase64 : undefined,
        history: historyForRouter,
        sessionId: effectiveSessionId,
        userId: normalizedClientUserId
      }),
      PHASE_TIMEOUTS.aiExecutionMs,
      'ai_execution'
    );

    if (!aiResult || typeof aiResult.text !== 'string') {
      throw new Error('AIRouter.routeAndProcess returned invalid response shape');
    }

    console.log(`[${requestId}] [STEP 8.1] AI engine completed`, {
      hasText: Boolean(aiResult.text),
      textLength: aiResult.text.length,
      sourcesCount: Array.isArray(aiResult.sources) ? aiResult.sources.length : 0,
      usage: aiResult?.usage || null
    });

    const routedProducts = Array.isArray(aiResult.raw?.result?.products)
      ? aiResult.raw.result.products
      : [];
    const activeProductsList = routedProducts
      .map((item) => mapProductForChat(req, item))
      .filter(Boolean)
      .slice(0, 5);
    const guardedOutput = applyFinalOutputGuard({
      text: aiResult.text,
      products: activeProductsList
    });
    const cleanMessage = guardedOutput.text;
    const finalizedProducts = guardedOutput.products;

    console.log(`[${requestId}] [STEP 9] saving user message`);
    const userMessageSaved = await persistMessageBestEffort({
      sessionId: effectiveSessionId,
      payload: {
        role: 'user',
        content: effectiveMessage,
        metadata: {
          source: 'api_v3_chat',
          userId: normalizedClientUserId,
          hasImagePayload,
          image: hasImagePayload ? compactImageMetadata(normalizedImageBase64) : null
        }
      },
      phaseName: 'save_user_message',
      requestId
    });
    console.log(`[${requestId}] [STEP 9.1] user message save finished`, {
      persisted: userMessageSaved
    });

    const toolTrace = Array.isArray(aiResult?.raw?.result?.toolTrace)
      ? aiResult.raw.result.toolTrace
      : [];

    if (toolTrace.length > 0) {
      console.log(`[${requestId}] [STEP 9.2] saving tool responses`, {
        toolCount: toolTrace.length
      });

      for (const traceItem of toolTrace.slice(0, 8)) {
        const toolName = String(traceItem?.name || 'tool').trim() || 'tool';

        await persistMessageBestEffort({
          sessionId: effectiveSessionId,
          payload: {
            role: 'system',
            content: `[TOOL:${toolName}]`,
            metadata: {
              source: 'gemini_tool_call',
              toolName,
              toolArguments: traceItem?.arguments || {},
              toolResult: traceItem?.result || {}
            }
          },
          phaseName: 'save_tool_message',
          requestId
        });
      }
    }

    console.log(`[${requestId}] [STEP 10] saving assistant message`);
    const assistantMessageSaved = await persistMessageBestEffort({
      sessionId: effectiveSessionId,
      payload: {
        role: 'assistant',
        content: cleanMessage,
        metadata: {
          source: 'api_v3_chat',
          sources: aiResult.sources || [],
          products: finalizedProducts,
          usage: aiResult?.usage || null
        }
      },
      phaseName: 'save_assistant_message',
      requestId
    });
    console.log(`[${requestId}] [STEP 10.1] assistant message save finished`, {
      persisted: assistantMessageSaved
    });
    console.log(`[${requestId}] [STEP 11] sending success response`);

    return res.json({
      success: true,
      sessionId: effectiveSessionId,
      data: {
        text: cleanMessage,
        products: finalizedProducts,
        usage: aiResult?.usage || null
      }
    });
  } catch (error) {
    console.error(`[${requestId}] POST /api/v3/chat error:`, {
      name: error?.name,
      message: error?.message,
      stack: error?.stack
    });

    const providerFailure = classifyAIProviderFailure(error?.message || '');
    if (providerFailure) {
      if (providerFailure.retryAfterSeconds) {
        res.set('Retry-After', String(providerFailure.retryAfterSeconds));
      }

      const incomingMessage = String(req.body?.message || '');
      const incomingImageBase64 = String(req.body?.imageBase64 || '').trim();
      const hasIncomingImagePayload = /^data:image\/[a-zA-Z0-9.+-]+;base64,/.test(incomingImageBase64);

      if (hasIncomingImagePayload) {
        const cachedProducts = Array.isArray(AIRouter.getLastSearchedProducts?.())
          ? AIRouter.getLastSearchedProducts().slice(0, 10)
          : [];

        if (cachedProducts.length > 0) {
          const guardedCached = applyFinalOutputGuard({
            text: 'Dạ, em đang tạm quá tải nhận diện ảnh, nhưng em vẫn gửi lại danh sách sản phẩm vừa tìm được để anh/chị tham khảo ạ.',
            products: cachedProducts
          });

          return res.status(200).json({
            success: true,
            debugId: requestId,
            sessionId: req.body?.sessionId || null,
            data: {
              text: guardedCached.text,
              products: guardedCached.products
            }
          });
        }

        const visionFallbackText = providerFailure.retryAfterSeconds
          ? `Em đang tạm quá tải ở bước nhận diện ảnh. Anh/chị vui lòng thử gửi lại ảnh sau khoảng ${providerFailure.retryAfterSeconds} giây giúp em nhé.`
          : 'Em đang tạm quá tải ở bước nhận diện ảnh nên chưa phân tích được hình vừa gửi. Anh/chị thử lại sau ít giây hoặc mô tả thêm tên sản phẩm để em hỗ trợ ngay ạ.';

        return res.status(200).json({
          success: true,
          debugId: requestId,
          sessionId: req.body?.sessionId || null,
          data: {
            text: visionFallbackText,
            products: []
          }
        });
      }

      if (isImageFollowUpRequest(incomingMessage)) {
        const cachedProducts = Array.isArray(AIRouter.getLastSearchedProducts?.())
          ? AIRouter.getLastSearchedProducts().slice(0, 10)
          : [];

        if (cachedProducts.length > 0) {
          const guardedCached = applyFinalOutputGuard({
            text: 'Dạ, hình ảnh và thông tin chi tiết các sản phẩm anh/chị vừa hỏi đây ạ!',
            products: cachedProducts
          });

          return res.status(200).json({
            success: true,
            debugId: requestId,
            sessionId: req.body?.sessionId || null,
            data: {
              text: guardedCached.text,
              products: guardedCached.products
            }
          });
        }
      }

      let fallbackPayload;
      try {
        fallbackPayload = await buildLocalFallbackResponse(req, req.body?.message || '');
      } catch (fallbackError) {
        fallbackPayload = {
          text: providerFailure.retryAfterSeconds
            ? `Em đang xử lý hơi chậm ở bước phân tích. Anh/chị thử lại sau khoảng ${providerFailure.retryAfterSeconds} giây giúp em nhé.`
            : 'Em chưa xử lý trọn vẹn yêu cầu ở lần này. Anh/chị gửi lại nhu cầu ngắn gọn hơn (loại sản phẩm, ngân sách) để em trả kết quả nhanh hơn nhé.',
          products: []
        };
      }

      OUTPUT_GUARD_STATS.fallbackResponses += 1;
      const guardedFallback = applyFinalOutputGuard({
        text: fallbackPayload.text,
        products: fallbackPayload.products
      });

      return res.status(200).json({
        success: true,
        debugId: requestId,
        sessionId: req.body?.sessionId || null,
        data: {
          text: guardedFallback.text,
          products: guardedFallback.products
        }
      });
    }

    return res.status(500).json({
      success: false,
      debugId: requestId,
      data: {
        text: 'Hệ thống AI đang bận hoặc gặp lỗi tạm thời. Vui lòng thử lại sau vài giây.',
        products: []
      }
    });
  }
});

module.exports = router;
