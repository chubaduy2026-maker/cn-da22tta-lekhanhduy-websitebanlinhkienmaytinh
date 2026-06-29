import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Camera, Info, MessageCircle, RefreshCcw, Send, Sparkles, X, Expand, Maximize2, Minimize2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { chatbotAPI } from '../services/api';
import './ChatbotBox.css';

// ─── Helpers ───────────────────────────────────────────────────────
function getBadgeLabel(type) {
  const MAP = {
    greeting: '👋 Chào hỏi',
    thanks: '🙏 Cảm ơn',
    goodbye: '👋 Tạm biệt',
    smalltalk: '💬 Chat',
    product_search: '🔍 Sản phẩm',
    product_results: '🔍 Sản phẩm',
    compare: '⚖️ So sánh',
    recommendation: '💡 Gợi ý',
    pc_build: '🖥️ Build PC',
    tech_knowledge: '📚 Kiến thức',
    knowledge: '📚 Kiến thức',
    vision_search: '📷 Tìm bằng ảnh',
    out_of_scope: '❓ Ngoài phạm vi',
    error: '⚠️ Lỗi'
  };
  return MAP[type] || type || 'AI';
}

const SESSION_KEY = 'techstore_chatbot_session';
const DEFAULT_IMG = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><rect width="80" height="80" fill="%23f0f4fd" rx="10"/><text x="50%25" y="54%25" dominant-baseline="middle" text-anchor="middle" font-size="30">📦</text></svg>';

const WELCOME_MESSAGE = {
  id: 'welcome',
  role: 'assistant',
  content: 'Chào bạn! 👋 Mình là **TechBot** — trợ lý AI của TechStore.\n\nMình có thể giúp bạn:\n- 🔍 Tìm kiếm & tư vấn sản phẩm\n- ⚖️ So sánh laptop, linh kiện\n- 🖥️ Build cấu hình PC\n- 📷 Tìm sản phẩm qua hình ảnh\n- 📚 Giải thích kiến thức công nghệ\n\nBạn cần hỗ trợ gì?',
  quickReplies: [
    { title: '💻 Laptop gaming dưới 25tr', payload: 'Laptop gaming dưới 25 triệu' },
    { title: '🖥️ Build PC 30 triệu', payload: 'Build PC gaming 30 triệu' },
    { title: '📚 SSD NVMe là gì?', payload: 'SSD NVMe là gì và khác SSD thường thế nào?' }
  ]
};

const PRODUCT_CARD_TYPES = ['product_results', 'product_compare', 'vision_search'];
const PRODUCT_CARD_INTENTS = [
  'product_search',
  'product_query',
  'product_advice',
  'product_compare',
  'product_price_stock',
  'pc_build',
  'recommendation_request',
  'vision_search'
];

function createGuestSessionId() {
  if (window.crypto?.getRandomValues) {
    const bytes = new Uint8Array(32);
    window.crypto.getRandomValues(bytes);
    return `guest_${Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')}`;
  }
  return `guest_${Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('')}`;
}

function buildMessage(role, content, extra = {}) {
  return {
    id: `${role}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    role,
    content,
    ...extra
  };
}

function formatPrice(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n);
}

function getTopSpecs(specifications, max = 3) {
  if (!specifications) return [];
  const entries = Object.entries(specifications instanceof Map
    ? Object.fromEntries(specifications)
    : specifications);
  return entries.slice(0, max).map(([k, v]) => `${k}: ${v}`);
}

// ─── Sub-components ────────────────────────────────────────────────

/** Card sản phẩm với ảnh, giá nổi bật, thông số */
function ProductCard({ product }) {
  const [imgError, setImgError] = useState(false);
  const imgSrc = (!imgError && (product.imageUrl || product.image || product.images?.[0]))
    ? (product.imageUrl || product.image || product.images?.[0])
    : DEFAULT_IMG;

  const price = formatPrice(product.salePrice || product.price);
  const originalPrice = product.salePrice && product.price && product.price > product.salePrice
    ? formatPrice(product.price)
    : null;
  const specs = getTopSpecs(product.specifications || product.specs);
  const rating = Number(product.rating || 0);
  const href = product.productUrl || (product.id ? `/product/${product.id}` : null);

  return (
    <article className="chatbot-product-card">
      <div className="chatbot-product-layout">
        {/* Ảnh thumbnail */}
        <div className="chatbot-product-img-wrap">
          <img
            src={imgSrc}
            alt={product.imageAlt || product.name || 'Sản phẩm'}
            className="chatbot-product-img"
            onError={() => setImgError(true)}
            loading="lazy"
          />
        </div>

        {/* Nội dung */}
        <div className="chatbot-product-content">
          {/* Brand + Category pills */}
          <div className="chatbot-product-pills">
            {product.brand && (
              <span className="chatbot-pill chatbot-pill--brand">{product.brand}</span>
            )}
            {product.category && (
              <span className="chatbot-pill chatbot-pill--cat">{product.category}</span>
            )}
          </div>

          {/* Tên sản phẩm */}
          <h4 className="chatbot-product-name">{product.name}</h4>

          {/* Giá bán */}
          <div className="chatbot-product-pricing">
            {price ? (
              <>
                <span className="chatbot-product-price">{price}</span>
                {originalPrice && (
                  <span className="chatbot-product-original-price">{originalPrice}</span>
                )}
              </>
            ) : (
              <span className="chatbot-product-price chatbot-product-price--contact">Liên hệ</span>
            )}
          </div>

          {/* Rating */}
          {rating > 0 && (
            <div className="chatbot-product-rating">
              {'★'.repeat(Math.round(rating))}{'☆'.repeat(5 - Math.round(rating))}
              <span>{rating.toFixed(1)}</span>
              {product.reviewCount > 0 && <span>({product.reviewCount})</span>}
            </div>
          )}

          {/* Top 3 thông số */}
          {specs.length > 0 && (
            <ul className="chatbot-product-specs">
              {specs.map((s, i) => <li key={i}>{s}</li>)}
            </ul>
          )}

          {/* Tồn kho + Xem chi tiết */}
          <div className="chatbot-product-footer">
            {product.stock !== undefined && (
              <span className="chatbot-stock">
                {product.stock > 0 ? `✓ Còn ${product.stock}` : '✗ Hết hàng'}
              </span>
            )}
            {href && (
              <a
                href={href}
                className="chatbot-product-link"
                target="_blank"
                rel="noopener noreferrer"
              >
                Xem chi tiết →
              </a>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

/** Preview ảnh đang chờ gửi */
function ImagePreview({ src, onRemove }) {
  return (
    <div className="chatbot-img-preview">
      <img src={src} alt="Ảnh đã chọn" />
      <button type="button" className="chatbot-img-preview-remove" onClick={onRemove} aria-label="Xóa ảnh">
        <X size={12} />
      </button>
    </div>
  );
}

/** Typing indicator với animation dots */
function TypingIndicator({ label = 'Đang phân tích...' }) {
  return (
    <article className="chatbot-message assistant">
      <div className="chatbot-assistant-wrap">
        <span className="chatbot-avatar"><Sparkles size={14} /></span>
        <div className="chatbot-bubble assistant chatbot-typing">
          <span>{label}</span>
          <div className="chatbot-typing-dots">
            <span /><span /><span />
          </div>
        </div>
      </div>
    </article>
  );
}

// ─── Main Component ────────────────────────────────────────────────
export default function ChatbotBox() {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [messages, setMessages] = useState([WELCOME_MESSAGE]);
  const [isSending, setIsSending] = useState(false);
  const [isVisionMode, setIsVisionMode] = useState(false);   // Đang xử lý ảnh
  const [pendingImage, setPendingImage] = useState(null);    // { dataUrl, base64, mimeType }
  const [isDragging, setIsDragging] = useState(false);       // Trạng thái kéo thả
  const [sessionId, setSessionId] = useState(() => {
    const saved = localStorage.getItem(SESSION_KEY);
    if (saved) return saved;
    const generated = createGuestSessionId();
    localStorage.setItem(SESSION_KEY, generated);
    return generated;
  });
  const [viewMode, setViewMode] = useState('normal'); // normal | expanded | fullscreen

  // Smart scroll states
  const [showScrollButton, setShowScrollButton] = useState(false);

  const textareaRef = useRef(null);
  const messageListRef = useRef(null);
  const fileInputRef = useRef(null);
  const typingIntervalRef = useRef(null);

  const recentHistory = useMemo(() =>
    messages
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .slice(-10)
      .map(m => ({ role: m.role, content: m.content })),
    [messages]
  );

  const isAnyMessageStreaming = useMemo(() => messages.some(m => m.isStreaming), [messages]);

  // Smart scroll check
  const checkIsNearBottom = useCallback(() => {
    const el = messageListRef.current;
    if (!el) return true;
    const threshold = 80;
    return el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
  }, []);

  const handleScroll = useCallback(() => {
    const el = messageListRef.current;
    if (!el) return;
    const nearBottom = checkIsNearBottom();
    setShowScrollButton(!nearBottom);
  }, [checkIsNearBottom]);

  const scrollToBottomSmooth = useCallback(() => {
    const el = messageListRef.current;
    if (!el) return;
    el.scrollTo({
      top: el.scrollHeight,
      behavior: 'smooth'
    });
  }, []);

  // Auto-scroll ONLY when chat panel is opened or sending starts
  useEffect(() => {
    if (isOpen && messageListRef.current) {
      messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
    }
  }, [isOpen, isSending]);

  // Auto-resize textarea
  useEffect(() => {
    if (!textareaRef.current) return;
    textareaRef.current.style.height = 'auto';
    textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
  }, [inputValue]);

  const resetConversation = useCallback(() => {
    if (typingIntervalRef.current) {
      clearInterval(typingIntervalRef.current);
      typingIntervalRef.current = null;
    }
    const fresh = createGuestSessionId();
    localStorage.setItem(SESSION_KEY, fresh);
    setSessionId(fresh);
    setMessages([WELCOME_MESSAGE]);
    setInputValue('');
    setPendingImage(null);
    setIsSending(false);
    setShowScrollButton(false);
  }, []);

  // simulated typewriter streaming
  const typeAssistantMessage = useCallback((fullText, assistantMessageId) => {
    if (typingIntervalRef.current) {
      clearInterval(typingIntervalRef.current);
    }

    // Split words and spacing cleanly
    const chunks = fullText.match(/([^\s]+|\s+)/g) || [fullText];
    let currentIndex = 0;

    const isLongText = fullText.length > 300;
    const intervalSpeed = isLongText ? 22 : 14; // ms per chunk

    typingIntervalRef.current = setInterval(() => {
      if (currentIndex >= chunks.length) {
        clearInterval(typingIntervalRef.current);
        typingIntervalRef.current = null;

        setMessages(prev =>
          prev.map(msg =>
            msg.id === assistantMessageId
              ? { ...msg, content: fullText, isStreaming: false }
              : msg
          )
        );

        if (checkIsNearBottom()) {
          setTimeout(scrollToBottomSmooth, 20);
        }
        return;
      }

      const nextChunk = chunks[currentIndex];
      currentIndex++;

      setMessages(prev =>
        prev.map(msg =>
          msg.id === assistantMessageId
            ? { ...msg, content: msg.content + nextChunk }
            : msg
        )
      );

      if (checkIsNearBottom()) {
        scrollToBottomSmooth();
      }
    }, intervalSpeed);
  }, [checkIsNearBottom, scrollToBottomSmooth]);

  const stopGenerating = useCallback(() => {
    if (typingIntervalRef.current) {
      clearInterval(typingIntervalRef.current);
      typingIntervalRef.current = null;
    }
    setMessages(prev =>
      prev.map(msg =>
        msg.isStreaming
          ? { ...msg, isStreaming: false }
          : msg
      )
    );
    setIsSending(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (typingIntervalRef.current) {
        clearInterval(typingIntervalRef.current);
      }
    };
  }, []);

  // ── Gửi tin nhắn văn bản ─────────────────────────────────────────
  const sendMessage = useCallback(async (overrideText = null) => {
    const trimmed = String(overrideText ?? inputValue).trim();
    if ((!trimmed && !pendingImage) || isSending || isAnyMessageStreaming) return;

    if (pendingImage) {
      return sendImageMessage(trimmed);
    }

    const userMsg = buildMessage('user', trimmed);
    setMessages(prev => [...prev, userMsg]);
    setInputValue('');
    setIsSending(true);

    // Force auto-scroll down for new user message
    setTimeout(scrollToBottomSmooth, 50);

    try {
      const response = await chatbotAPI.sendMessage({
        sessionId,
        message: trimmed,
        history: [...recentHistory, { role: 'user', content: trimmed }],
        context: { url: window.location.href }
      });

      const payload = response?.data || response;
      if (!payload?.success) throw new Error(payload?.message || 'Không thể kết nối chatbot.');

      setIsSending(false);

      const assistantMsgId = `assistant_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      const newAssistantMsg = {
        id: assistantMsgId,
        role: 'assistant',
        content: '',
        isStreaming: true,
        products: Array.isArray(payload.products) ? payload.products : (Array.isArray(payload.data?.products) ? payload.data.products : []),
        sources: Array.isArray(payload.sources) ? payload.sources : [],
        type: payload.type || payload.data?.type || 'knowledge',
        intent: payload.intent || payload.data?.intent || '',
        quickReplies: Array.isArray(payload.quickReplies) ? payload.quickReplies : []
      };

      setMessages(prev => [...prev, newAssistantMsg]);

      const fullText = payload.answer || payload.data?.text || 'Mình chưa có phản hồi phù hợp.';
      typeAssistantMessage(fullText, assistantMsgId);

    } catch (err) {
      setIsSending(false);
      setMessages(prev => [...prev, buildMessage('assistant', err.message || 'Đã có lỗi xảy ra, vui lòng thử lại.')]);
      setTimeout(scrollToBottomSmooth, 50);
    }
  }, [inputValue, pendingImage, isSending, isAnyMessageStreaming, sessionId, recentHistory, scrollToBottomSmooth, typeAssistantMessage]);

  // ── Gửi ảnh (Vision Search) ───────────────────────────────────────
  const sendImageMessage = useCallback(async (caption = '') => {
    if (!pendingImage || isSending || isAnyMessageStreaming) return;

    const imgContent = caption
      ? `📷 **Tìm sản phẩm qua ảnh**\n${caption}`
      : '📷 **Tìm sản phẩm qua ảnh**';
    setMessages(prev => [...prev,
      buildMessage('user', imgContent, { imagePreview: pendingImage.dataUrl })
    ]);
    setInputValue('');
    setPendingImage(null);
    setIsVisionMode(true);
    setIsSending(true);

    setTimeout(scrollToBottomSmooth, 50);

    try {
      const response = await chatbotAPI.sendImage({
        sessionId,
        imageBase64: pendingImage.base64,
        mimeType: pendingImage.mimeType,
        history: recentHistory,
        message: caption
      });

      const payload = response?.data || response;
      if (!payload?.success) throw new Error(payload?.message || 'Lỗi phân tích ảnh.');

      setIsSending(false);
      setIsVisionMode(false);

      const assistantMsgId = `assistant_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      const newAssistantMsg = {
        id: assistantMsgId,
        role: 'assistant',
        content: '',
        isStreaming: true,
        products: Array.isArray(payload.products) ? payload.products : (Array.isArray(payload.data?.products) ? payload.data.products : []),
        sources: Array.isArray(payload.sources) ? payload.sources : [],
        type: payload.type || payload.data?.type || 'vision_search',
        intent: payload.intent || payload.data?.intent || '',
        quickReplies: Array.isArray(payload.quickReplies) ? payload.quickReplies : []
      };

      setMessages(prev => [...prev, newAssistantMsg]);

      const fullText = payload.answer || payload.data?.text || 'Đã phân tích ảnh xong.';
      typeAssistantMessage(fullText, assistantMsgId);

    } catch (err) {
      setIsSending(false);
      setIsVisionMode(false);
      setMessages(prev => [...prev,
        buildMessage('assistant', 'Mình gặp sự cố khi phân tích ảnh. Bạn thử gõ tên sản phẩm nhé!')
      ]);
      setTimeout(scrollToBottomSmooth, 50);
    }
  }, [pendingImage, isSending, isAnyMessageStreaming, sessionId, recentHistory, scrollToBottomSmooth, typeAssistantMessage]);

  // ── Xử lý đọc file ảnh (chung cho chọn file, dán, kéo thả) ───────
  const processImageFile = useCallback((file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Vui lòng chọn file ảnh (JPG, PNG, WEBP).');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      alert('Ảnh quá lớn (tối đa 10MB). Vui lòng chọn ảnh nhỏ hơn.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target.result;
      const base64 = dataUrl.split(',')[1];
      setPendingImage({ dataUrl, base64, mimeType: file.type });
    };
    reader.readAsDataURL(file);
  }, []);

  const handleFileChange = useCallback((e) => {
    const file = e.target.files?.[0];
    processImageFile(file);
    e.target.value = ''; // Reset input
  }, [processImageFile]);

  // ── Xử lý Paste ảnh (Ctrl+V) ─────────────────────────────────────
  const handlePaste = useCallback((e) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image/') === 0) {
        e.preventDefault();
        const file = items[i].getAsFile();
        processImageFile(file);
        break;
      }
    }
  }, [processImageFile]);

  // ── Xử lý Drag & Drop ảnh ────────────────────────────────────────
  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer?.files?.[0];
    if (file && file.type.startsWith('image/')) {
      processImageFile(file);
    }
  }, [processImageFile]);

  const handleQuickReply = useCallback((reply) => {
    const text = (reply && (reply.payload || reply.title || reply)) || '';
    if (!text) return;
    sendMessage(text);
  }, [sendMessage]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }, [sendMessage]);

  const canSend = !isSending && !isAnyMessageStreaming && (!!inputValue.trim() || !!pendingImage);

  return (
    <div className={`chatbot-box ${isOpen ? 'is-open' : ''}`}>
      {isOpen && (
        <section
          className={`chatbot-panel ${isDragging ? 'chatbot-panel--dragging' : ''} chatbot-panel--${viewMode}`}
          aria-label="TechStore AI Chatbot"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {isDragging && (
            <div className="chatbot-drag-overlay">
              <Sparkles size={32} />
              <p>Thả ảnh vào đây để tìm kiếm</p>
            </div>
          )}

          {/* ── Header ── */}
          <header className="chatbot-header">
            <div className="chatbot-brand">
              <span className="chatbot-brand-icon"><Sparkles size={16} /></span>
              <div className="chatbot-brand-info">
                <h2>TechStore AI</h2>
                <p>Tư vấn • So sánh • Kiến thức công nghệ</p>
              </div>
            </div>
            <div className="chatbot-header-actions">
              <button
                type="button"
                className="chatbot-reset-btn"
                onClick={resetConversation}
                disabled={isSending || isAnyMessageStreaming}
                title="Tạo cuộc trò chuyện mới"
              >
                <RefreshCcw size={13} />
                Mới
              </button>
              <button
                type="button"
                className="chatbot-view-btn"
                onClick={() => setViewMode(prev => prev === 'normal' ? 'expanded' : prev === 'expanded' ? 'fullscreen' : 'normal')}
                title={viewMode === 'normal' ? 'Mở rộng' : viewMode === 'expanded' ? 'Toàn màn hình' : 'Thu nhỏ'}
              >
                {viewMode === 'normal' ? <Expand size={15} /> : viewMode === 'expanded' ? <Maximize2 size={15} /> : <Minimize2 size={15} />}
              </button>
              <button
                type="button"
                className="chatbot-close-btn"
                onClick={() => setIsOpen(false)}
                aria-label="Đóng chatbot"
              >
                <X size={18} />
              </button>
            </div>
          </header>

          {/* ── Messages ── */}
          <div className="chatbot-body" ref={messageListRef} onScroll={handleScroll}>
            <div className="chatbot-stream">
              {messages.map((msg) => (
                <article key={msg.id} className={`chatbot-message ${msg.role}`}>
                  {msg.role === 'assistant' ? (
                    <div className="chatbot-assistant-wrap">
                      <span className="chatbot-avatar"><Sparkles size={14} /></span>
                      <div className={`chatbot-bubble assistant ${msg.isStreaming ? 'chatbot-bubble--streaming' : ''}`}>
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={{
                            h1: ({ node, children, ...props }) => <h1 className="chatbot-message-title h1" {...props}>{children}</h1>,
                            h2: ({ node, children, ...props }) => <h2 className="chatbot-message-title h2" {...props}>{children}</h2>,
                            h3: ({ node, children, ...props }) => <h3 className="chatbot-message-title h3" {...props}>{children}</h3>,
                            h4: ({ node, children, ...props }) => <h4 className="chatbot-message-title h4" {...props}>{children}</h4>,
                            p: ({ node, ...props }) => <p className="chatbot-message-p" {...props} />,
                            ul: ({ node, ...props }) => <ul className="chatbot-message-ul" {...props} />,
                            ol: ({ node, ...props }) => <ol className="chatbot-message-ol" {...props} />,
                            li: ({ node, ...props }) => <li className="chatbot-message-li" {...props} />,
                            strong: ({ node, ...props }) => <strong className="chatbot-message-strong" {...props} />,
                            code: ({ node, ...props }) => <code className="chatbot-message-code" {...props} />,
                            table: ({ node, ...props }) => (
                              <div className="chatbot-table-wrap">
                                <table {...props} />
                              </div>
                            )
                          }}
                        >
                          {msg.content}
                        </ReactMarkdown>

                        {/* Type badge */}
                        {msg.type && msg.type !== 'knowledge' && (
                          <div className="chatbot-meta-row">
                            <span className="chatbot-type-pill">{getBadgeLabel(msg.type)}</span>
                          </div>
                        )}

                        {/* Product cards */}
                        {PRODUCT_CARD_TYPES.includes(msg.type) &&
                         PRODUCT_CARD_INTENTS.includes(msg.intent || msg.type) &&
                         Array.isArray(msg.products) && msg.products.length > 0 && (
                          <div className="chatbot-products">
                            {msg.products.map((p) => (
                              <ProductCard key={p.id || p.name} product={p} />
                            ))}
                          </div>
                        )}

                        {/* Sources */}
                        {Array.isArray(msg.sources) && msg.sources.length > 0 && (
                          <div className="chatbot-sources">
                            {msg.sources.slice(0, 4).map((s, i) => (
                              <span key={i} className="chatbot-source-pill">
                                <Info size={11} />
                                {s.title || s.source}
                                {s.confidence && <em>{` ${Math.round(s.confidence * 100)}%`}</em>}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Quick replies - show only when typing is completed */}
                        {!msg.isStreaming && Array.isArray(msg.quickReplies) && msg.quickReplies.length > 0 && (
                          <div className="chatbot-quick-replies">
                            {msg.quickReplies.map((qr, i) => (
                              <button
                                key={i}
                                type="button"
                                className="chatbot-quick-reply-btn"
                                onClick={() => handleQuickReply(qr)}
                              >
                                {qr.title || qr}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    /* User bubble */
                    <div className="chatbot-bubble user">
                      {msg.imagePreview && (
                        <img
                          src={msg.imagePreview}
                          alt="Ảnh bạn gửi"
                          className="chatbot-bubble-img"
                        />
                      )}
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          p: ({ node, ...props }) => <p className="chatbot-message-p" {...props} />
                        }}
                      >
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                  )}
                </article>
              ))}

              {/* Typing indicator */}
              {isSending && (
                <TypingIndicator
                  label={isVisionMode ? 'Đang phân tích ảnh...' : 'Đang phân tích yêu cầu...'}
                />
              )}
            </div>
          </div>

          {/* Floating smart scroll button */}
          {showScrollButton && (
            <button
              type="button"
              className="chatbot-scroll-bottom-btn"
              onClick={scrollToBottomSmooth}
              aria-label="Cuộn xuống cuối"
            >
              ↓ Xuống cuối
            </button>
          )}

          {/* ── Footer / Input ── */}
          <footer className="chatbot-footer">
            <div className="chatbot-input-area">
              {/* Stop generation overlay if bot is streaming */}
              {isAnyMessageStreaming && (
                <div className="chatbot-stop-generation-wrap">
                  <button
                    type="button"
                    className="chatbot-stop-btn"
                    onClick={stopGenerating}
                  >
                    ⏹ Dừng trả lời
                  </button>
                </div>
              )}

              {/* Preview ảnh đang chờ */}
              {pendingImage && (
                <ImagePreview
                  src={pendingImage.dataUrl}
                  onRemove={() => setPendingImage(null)}
                />
              )}

              <div className="chatbot-input-row">
                {/* Upload ảnh */}
                <button
                  type="button"
                  className={`chatbot-upload-btn ${pendingImage ? 'chatbot-upload-btn--active' : ''}`}
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isSending || isAnyMessageStreaming}
                  aria-label="Tìm kiếm bằng hình ảnh"
                  title="📷 Tìm sản phẩm qua ảnh"
                >
                  <Camera size={18} />
                </button>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  onChange={handleFileChange}
                  style={{ display: 'none' }}
                  aria-hidden="true"
                />

                {/* Textarea */}
                <textarea
                  ref={textareaRef}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onPaste={handlePaste}
                  placeholder={pendingImage
                    ? 'Thêm mô tả cho ảnh (tùy chọn)...'
                    : 'Hỏi hoặc dán (Ctrl+V) ảnh vào đây...'}
                  rows={1}
                  disabled={isSending || isAnyMessageStreaming}
                />

                {/* Gửi */}
                <button
                  type="button"
                  className="chatbot-send-btn"
                  onClick={() => sendMessage()}
                  disabled={!canSend}
                  aria-label="Gửi tin nhắn"
                >
                  <Send size={16} />
                </button>
              </div>
            </div>
          </footer>
        </section>
      )}

      {/* ── Launcher Button ── */}
      <button
        type="button"
        className="chatbot-launcher"
        onClick={() => setIsOpen(v => !v)}
        aria-label="Mở chatbot TechStore"
      >
        {isOpen ? <X size={20} /> : <MessageCircle size={22} />}
      </button>
    </div>
  );
}
