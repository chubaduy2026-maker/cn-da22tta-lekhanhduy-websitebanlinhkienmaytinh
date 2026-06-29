import React, { useEffect, useRef, useState } from 'react';
import { MessageCircle, X, Sparkles, ImageIcon, Mic, Send } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import './GeminiChatUI.css';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000';
const SESSION_KEY = 'techstore_chat_session';
const USER_KEY = 'techstore_chat_user';
const LAST_USER_MESSAGE_AT_KEY = 'techstore_chat_last_user_message_at';
const SESSION_INACTIVITY_RESET_MS = 30 * 60 * 1000;
const normalizedApiBase = API_BASE.replace(/\/$/, '');
const CHAT_MODE = (process.env.REACT_APP_CHAT_MODE || 'v3').toLowerCase();
const CHAT_ENDPOINT = CHAT_MODE === 'rag-local'
  ? (normalizedApiBase.endsWith('/api')
    ? `${normalizedApiBase}/ai/rag-local/chat`
    : `${normalizedApiBase}/api/ai/rag-local/chat`)
  : (normalizedApiBase.endsWith('/api')
    ? `${normalizedApiBase}/v3/chat`
    : `${normalizedApiBase}/api/v3/chat`);
const CHAT_HISTORY_ENDPOINT = normalizedApiBase.endsWith('/api')
  ? `${normalizedApiBase}/v3/chat/history`
  : `${normalizedApiBase}/api/v3/chat/history`;

const WELCOME_MESSAGE = {
  id: 1,
  role: 'ai',
  text: 'Chào bạn, mình là trợ lý AI của TechStore. Mình có thể giúp gì cho bạn hôm nay?'
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

function normalizeForMatch(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function shouldRecoverProductsFromHistory(text) {
  const normalized = normalizeForMatch(text);
  return /xem\s+(hinh|anh)|the\s+san\s+pham\s+ben\s+duoi|xem\s+chi\s+tiet\s+o\s+cac\s+the/.test(normalized);
}

function isImageFollowUpUserMessage(text) {
  const normalized = normalizeForMatch(text);
  return /^(co\s+hinh\s+khong|dau|hinh\s+dau|cho\s+xem\s+hinh|xem\s+anh|hinh\s+anh\s+dau|dau\s+roi|xem\s+hinh)$/.test(normalized);
}

function getLatestProductsFromHistory(messages = []) {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const candidate = messages[i];
    if (Array.isArray(candidate?.products) && candidate.products.length > 0) {
      return candidate.products.slice(0, 5);
    }
  }

  return [];
}

function normalizeImageUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return '';
  }

  try {
    return encodeURI(rawUrl.trim());
  } catch (error) {
    return rawUrl.trim();
  }
}

function resolveAssetUrl(rawUrl) {
  const normalized = normalizeImageUrl(rawUrl);
  if (!normalized) {
    return '';
  }

  if (/^https?:\/\//i.test(normalized)) {
    return normalized;
  }

  if (normalized.startsWith('//')) {
    return `https:${normalized}`;
  }

  const assetBase = normalizedApiBase.replace(/\/api$/i, '');
  if (normalized.startsWith('/')) {
    return `${assetBase}${normalized}`;
  }

  return `${assetBase}/${normalized}`;
}

function decodeJwtPayload(token) {
  try {
    const payload = String(token || '').split('.')[1];
    if (!payload) {
      return null;
    }

    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    return JSON.parse(window.atob(padded));
  } catch (error) {
    return null;
  }
}

function getUserIdFromToken(token) {
  const payload = decodeJwtPayload(token);
  const userId = payload?.userId || payload?._id || payload?.id || null;
  return userId ? String(userId) : '';
}

function createClientSessionId(userId = '') {
  if (userId) {
    return `user_${userId}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }

  const randomHex = Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
  return `guest_${randomHex}`;
}

function isSessionCompatibleWithUser(sessionId = '', userId = '') {
  const normalizedSessionId = String(sessionId || '').trim();
  if (!normalizedSessionId) {
    return false;
  }

  if (userId && !String(userId).startsWith('guest_')) {
    return normalizedSessionId.startsWith(`user_${userId}_`);
  }

  return /^guest_[a-f0-9]{64}$/.test(normalizedSessionId);
}

function getOrCreateClientUserId() {
  const token = localStorage.getItem('token');
  const tokenUserId = getUserIdFromToken(token);
  if (tokenUserId) {
    localStorage.setItem(USER_KEY, tokenUserId);
    return tokenUserId;
  }

  const existing = String(localStorage.getItem(USER_KEY) || '').trim();
  if (existing) {
    return existing;
  }

  const guestUserId = `guest_${Math.random().toString(36).slice(2, 12)}${Date.now().toString(36)}`;
  localStorage.setItem(USER_KEY, guestUserId);
  return guestUserId;
}

function ProductImage({ src, alt }) {
  const [failed, setFailed] = useState(false);
  const safeSrc = resolveAssetUrl(src);

  useEffect(() => {
    setFailed(false);
  }, [safeSrc]);

  if (!safeSrc || failed) {
    return (
      <div className="ts-chat-product-image-placeholder" aria-label="Image unavailable">
        <ImageIcon size={16} />
      </div>
    );
  }

  return (
    <img
      src={safeSrc}
      alt={alt || 'Sản phẩm'}
      className="ts-chat-product-image"
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}

function MarkdownImage({ src, alt }) {
  const [failed, setFailed] = useState(false);
  const safeSrc = resolveAssetUrl(src);

  useEffect(() => {
    setFailed(false);
  }, [safeSrc]);

  if (!safeSrc || failed) {
    return (
      <span className="ts-chat-inline-image-fallback">
        [Khong the tai hinh anh]
      </span>
    );
  }

  return (
    <img
      src={safeSrc}
      alt={alt || 'Hinh anh san pham'}
      className="ts-chat-inline-image"
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  );
}

function MarkdownTable({ children, ...props }) {
  return (
    <div className="ts-chat-table-wrap">
      <table {...props}>{children}</table>
    </div>
  );
}

export default function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [inputText, setInputText] = useState('');
  const [selectedImageBase64, setSelectedImageBase64] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState(() => {
    const userId = getOrCreateClientUserId();
    const existingSession = String(localStorage.getItem(SESSION_KEY) || '').trim();
    if (existingSession) {
      return existingSession;
    }
    const generated = createClientSessionId(userId && !userId.startsWith('guest_') ? userId : '');
    localStorage.setItem(SESSION_KEY, generated);
    return generated;
  });
  const [forceNewChat, setForceNewChat] = useState(false);

  const textareaRef = useRef(null);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const chatBoxRef = useRef(null);
  const chatTriggerRef = useRef(null);

  const [messages, setMessages] = useState([WELCOME_MESSAGE]);

  useEffect(() => {
    let isMounted = true;

    const loadChatHistory = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          return;
        }

        const userId = getUserIdFromToken(token);
        if (!userId) {
          return;
        }

        const response = await fetch(`${CHAT_HISTORY_ENDPOINT}/${encodeURIComponent(userId)}`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });

        const payload = await parseChatResponse(response);
        if (!response.ok || !payload?.success) {
          return;
        }

        const historyMessages = Array.isArray(payload?.data?.messages)
          ? payload.data.messages
          : [];

        if (!isMounted) {
          return;
        }

        const mappedMessages = historyMessages
          .map((msg, index) => ({
            id: msg.id || `${Date.now()}_${index}`,
            role: msg.role === 'user' ? 'user' : 'ai',
            text: String(msg.text || '').trim(),
            image: msg.image || null,
            products: Array.isArray(msg.products) ? msg.products : [],
            type: msg.type || msg.metadata?.type || 'knowledge',
            intent: msg.intent || msg.metadata?.intent || msg.type || 'knowledge'
          }))
          .filter((msg) => msg.text || msg.image || (Array.isArray(msg.products) && msg.products.length > 0));

        setMessages(mappedMessages.length > 0 ? mappedMessages : [WELCOME_MESSAGE]);

        const restoredSessionId = String(payload?.data?.sessionId || '').trim();
        if (restoredSessionId) {
          setSessionId(restoredSessionId);
          localStorage.setItem(SESSION_KEY, restoredSessionId);
        }
      } catch (error) {
        // Keep default welcome state when history loading fails.
      }
    };

    loadChatHistory();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const tokenUserId = getUserIdFromToken(token);
    const resolvedUserId = tokenUserId || getOrCreateClientUserId();

    if (isSessionCompatibleWithUser(sessionId, resolvedUserId)) {
      return;
    }

    const mappedUserId = resolvedUserId && !resolvedUserId.startsWith('guest_')
      ? resolvedUserId
      : '';
    const rotatedSessionId = createClientSessionId(mappedUserId);
    setSessionId(rotatedSessionId);
    localStorage.setItem(SESSION_KEY, rotatedSessionId);
    localStorage.removeItem(LAST_USER_MESSAGE_AT_KEY);
  }, [sessionId]);

  useEffect(() => {
    if (!textareaRef.current) return;
    textareaRef.current.style.height = 'auto';
    textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
  }, [inputText]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, isLoading]);

  const handleClickOutside = (event) => {
    if (!isOpen) {
      return;
    }

    const clickedInsideChatBox = chatBoxRef.current && chatBoxRef.current.contains(event.target);
    const clickedOnTrigger = chatTriggerRef.current && chatTriggerRef.current.contains(event.target);

    if (!clickedInsideChatBox && !clickedOnTrigger) {
      setIsOpen(false);
    }
  };

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const formatCurrency = (value) => {
    const amount = Number(value);
    if (!Number.isFinite(amount)) {
      return '';
    }
    return amount.toLocaleString('vi-VN');
  };

  const parseChatResponse = async (response) => {
    const contentType = response.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      return response.json();
    }

    const rawText = await response.text();
    const looksLikeHtml = /<!doctype html>|<html/i.test(rawText);

    if (looksLikeHtml) {
      throw new Error('Chatbot chưa kết nối đúng API. Vui lòng kiểm tra backend đang chạy ở cổng 5000.');
    }

    throw new Error(rawText?.trim() || 'Phản hồi từ server không hợp lệ.');
  };

  const resetChatSession = () => {
    setSessionId('');
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(LAST_USER_MESSAGE_AT_KEY);
  };

  const handleNewChat = () => {
    const userId = getOrCreateClientUserId();
    const mappedUserId = userId.startsWith('guest_') ? '' : userId;
    const newSessionId = createClientSessionId(mappedUserId);

    setSessionId(newSessionId);
    localStorage.setItem(SESSION_KEY, newSessionId);
    localStorage.removeItem(LAST_USER_MESSAGE_AT_KEY);

    setForceNewChat(true);
    setSelectedImageBase64(null);
    setMessages([WELCOME_MESSAGE]);
  };

  const compressImageFileToBase64 = (file, options = {}) => new Promise((resolve, reject) => {
    const maxWidth = Number(options.maxWidth) || 800;
    const quality = Number(options.quality) || 0.7;

    let objectUrl = '';

    try {
      objectUrl = URL.createObjectURL(file);
      const img = new Image();

      img.onload = () => {
        try {
          const originalWidth = Number(img.naturalWidth || img.width || 0);
          const originalHeight = Number(img.naturalHeight || img.height || 0);

          if (!originalWidth || !originalHeight) {
            reject(new Error('Kích thước ảnh không hợp lệ.'));
            return;
          }

          const scale = Math.min(1, maxWidth / originalWidth);
          const targetWidth = Math.max(1, Math.round(originalWidth * scale));
          const targetHeight = Math.max(1, Math.round(originalHeight * scale));

          const canvas = document.createElement('canvas');
          canvas.width = targetWidth;
          canvas.height = targetHeight;

          const ctx = canvas.getContext('2d', { alpha: false });
          if (!ctx) {
            reject(new Error('Không thể khởi tạo bộ nén ảnh.'));
            return;
          }

          ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
          const compressedBase64 = canvas.toDataURL('image/jpeg', quality);

          if (!compressedBase64 || !compressedBase64.startsWith('data:image/')) {
            reject(new Error('Không thể nén ảnh đã chọn.'));
            return;
          }

          resolve(compressedBase64);
        } catch (error) {
          reject(error);
        } finally {
          if (objectUrl) {
            URL.revokeObjectURL(objectUrl);
          }
        }
      };

      img.onerror = () => {
        if (objectUrl) {
          URL.revokeObjectURL(objectUrl);
        }
        reject(new Error('Không thể tải ảnh để nén.'));
      };

      img.src = objectUrl;
    } catch (error) {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
      reject(error);
    }
  });

  const handlePickImageClick = () => {
    if (isLoading) return;
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleImageSelected = async (event) => {
    try {
      const file = event?.target?.files?.[0];
      if (!file) {
        return;
      }

      if (!file.type || !file.type.startsWith('image/')) {
        throw new Error('Vui lòng chọn đúng file hình ảnh.');
      }

      const compressedBase64DataUrl = await compressImageFileToBase64(file, {
        maxWidth: 800,
        quality: 0.7
      });

      setSelectedImageBase64(compressedBase64DataUrl);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          role: 'ai',
          text: error?.message || 'Không thể xử lý ảnh đã chọn. Vui lòng thử lại.'
        }
      ]);
    } finally {
      if (event?.target) {
        event.target.value = '';
      }
    }
  };

  const handlePaste = async (e) => {
    if (isLoading) {
      return;
    }

    const items = Array.from(e?.clipboardData?.items || []);
    const imageItem = items.find((item) => String(item?.type || '').startsWith('image/'));

    if (!imageItem) {
      return;
    }

    e.preventDefault();

    try {
      const pastedFile = imageItem.getAsFile();
      if (!pastedFile) {
        throw new Error('Không thể đọc ảnh từ clipboard.');
      }

      const compressedBase64DataUrl = await compressImageFileToBase64(pastedFile, {
        maxWidth: 800,
        quality: 0.7
      });

      setSelectedImageBase64(compressedBase64DataUrl);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          role: 'ai',
          text: error?.message || 'Không thể xử lý ảnh dán từ clipboard. Vui lòng thử lại.'
        }
      ]);
    }
  };

  const handleRemoveSelectedImage = () => {
    setSelectedImageBase64(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSendMessage = async () => {
    const trimmed = inputText.trim();
    const hasImage = Boolean(selectedImageBase64);
    if ((!trimmed && !hasImage) || isLoading) return;

    const outgoingMessage = trimmed;
    const outgoingImageBase64 = selectedImageBase64;

    setMessages((prev) => [
      ...prev,
      {
        id: Date.now(),
        role: 'user',
        text: outgoingMessage || 'Đã gửi 1 ảnh để tìm kiếm trực quan.',
        image: outgoingImageBase64 || null
      }
    ]);
    setInputText('');
    setSelectedImageBase64(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    setIsLoading(true);

    try {
      const now = Date.now();
      const lastUserMessageAt = Number(localStorage.getItem(LAST_USER_MESSAGE_AT_KEY) || 0);
      const shouldRotateByInactivity = Boolean(sessionId)
        && Number.isFinite(lastUserMessageAt)
        && lastUserMessageAt > 0
        && (now - lastUserMessageAt > SESSION_INACTIVITY_RESET_MS);

      const clientUserId = getOrCreateClientUserId();
      let outboundSessionId = String(sessionId || '').trim();
      if (shouldRotateByInactivity) {
        const mappedUserId = clientUserId.startsWith('guest_') ? '' : clientUserId;
        outboundSessionId = createClientSessionId(mappedUserId);
        resetChatSession();
        setSessionId(outboundSessionId);
        localStorage.setItem(SESSION_KEY, outboundSessionId);
      }

      if (forceNewChat && !outboundSessionId) {
        const mappedUserId = clientUserId.startsWith('guest_') ? '' : clientUserId;
        const generatedSessionId = createClientSessionId(mappedUserId);
        outboundSessionId = generatedSessionId;
        setSessionId(generatedSessionId);
        localStorage.setItem(SESSION_KEY, generatedSessionId);
      }

      if (!outboundSessionId) {
        const mappedUserId = clientUserId.startsWith('guest_') ? '' : clientUserId;
        outboundSessionId = createClientSessionId(mappedUserId);
        setSessionId(outboundSessionId);
        localStorage.setItem(SESSION_KEY, outboundSessionId);
      }

      const token = localStorage.getItem('token');
      const response = await fetch(CHAT_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          message: outgoingMessage,
          imageBase64: outgoingImageBase64,
          topK: 4,
          candidateK: 8,
          history: messages.slice(-6).map((m) => ({
            role: m.role === 'ai' ? 'assistant' : 'user',
            content: m.text
          })),
          sessionId: outboundSessionId || undefined,
          userId: clientUserId,
          newChat: shouldRotateByInactivity || forceNewChat
        })
      });

      const payload = await parseChatResponse(response);

      if (!response.ok || !payload?.success) {
        throw new Error(payload?.data?.text || payload?.message || 'Không thể kết nối chatbot lúc này.');
      }

      if (payload.sessionId && payload.sessionId !== sessionId) {
        setSessionId(payload.sessionId);
        localStorage.setItem(SESSION_KEY, payload.sessionId);
      }

      localStorage.setItem(LAST_USER_MESSAGE_AT_KEY, String(now));
      setForceNewChat(false);

      const aiText = payload?.data?.text || payload?.answer || 'Xin lỗi, mình chưa có phản hồi phù hợp.';
      const apiProducts = Array.isArray(payload?.data?.products) ? payload.data.products : [];
      const responseType = payload?.data?.type || payload?.type || 'knowledge';
      const responseIntent = payload?.data?.intent || payload?.intent || responseType;

      setMessages((prev) => [
        ...prev,
        (() => {
          const fallbackProducts = getLatestProductsFromHistory(prev);
          const recoveredProducts = (apiProducts.length === 0
            && shouldRecoverProductsFromHistory(aiText)
            && isImageFollowUpUserMessage(outgoingMessage))
            ? fallbackProducts
            : apiProducts;

          return {
            id: Date.now() + 1,
            role: 'ai',
            text: aiText,
            products: recoveredProducts,
            type: responseType,
            intent: responseIntent,
            mode: payload?.data?.meta?.mode || (CHAT_MODE === 'rag-local' ? 'rag-local' : 'normal'),
            provider: payload?.data?.meta?.provider || '',
            degraded: Boolean(payload?.data?.meta?.degraded)
          };
        })()
      ]);
    } catch (error) {
      setForceNewChat(false);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          role: 'ai',
          text: error?.message || 'Đã có lỗi xảy ra, vui lòng thử lại sau.'
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTextareaKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="ts-chat-widget">
      {isOpen && (
        <div ref={chatBoxRef} className="ts-chat-panel" role="dialog" aria-label="TechStore AI Chat">
          <header className="ts-chat-header">
            <div className="ts-chat-brand">
              <div className="ts-chat-brand-icon">
                <Sparkles size={16} color="#ffffff" />
              </div>
              <h1>TechStore AI</h1>
            </div>

            <div className="ts-chat-header-actions">
              <button
                onClick={handleNewChat}
                className="ts-chat-new"
                type="button"
                aria-label="New chat"
                disabled={isLoading}
              >
                New Chat
              </button>

              <button
                onClick={() => setIsOpen(false)}
                className="ts-chat-close"
                type="button"
                aria-label="Đóng chat"
              >
                <X size={18} />
              </button>
            </div>
          </header>

          <main className="ts-chat-body">
            <div className="ts-chat-stream">
              {messages.map((msg) => (
                <div key={msg.id} className={`ts-chat-row ${msg.role === 'user' ? 'user' : 'ai'}`}>
                  {msg.role === 'ai' && (
                    <div className="ts-ai-bubble-wrap">
                      <div className="ts-ai-avatar">
                        <Sparkles size={14} color="#ffffff" />
                      </div>
                      <div className="ts-chat-bubble ts-chat-bubble-ai">
                        <div className="ts-chat-markdown">
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                              img: ({ src, alt }) => <MarkdownImage src={src} alt={alt} />,
                              table: ({ node, ...props }) => <MarkdownTable {...props} />
                            }}
                          >
                            {msg.text || ''}
                          </ReactMarkdown>
                        </div>
                        {PRODUCT_CARD_TYPES.includes(msg.type) &&
                         PRODUCT_CARD_INTENTS.includes(msg.intent || msg.type) &&
                         Array.isArray(msg.products) && msg.products.length > 0 && (
                          <div className="ts-chat-product-list">
                            {msg.products.map((product) => (
                              <a
                                key={product.id || `${product.name}-${product.imageUrl || ''}`}
                                href={product.productUrl || '#'}
                                className="ts-chat-product-card"
                                target="_blank"
                                rel="noreferrer"
                                onClick={(e) => {
                                  if (!product.productUrl) {
                                    e.preventDefault();
                                  }
                                }}
                              >
                                {product.imageUrl ? (
                                  <ProductImage
                                    src={product.imageUrl}
                                    alt={product.name || 'Sản phẩm'}
                                  />
                                ) : (
                                  <div className="ts-chat-product-image-placeholder" aria-label="Image unavailable">
                                    <ImageIcon size={16} />
                                  </div>
                                )}
                                <div className="ts-chat-product-content">
                                  <h4>{product.name || 'Sản phẩm'}</h4>
                                  {product.brand && <p>{product.brand}</p>}
                                  {product.price ? <strong>{formatCurrency(product.price)} VND</strong> : null}
                                </div>
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {msg.role === 'user' && (
                    <div className={`ts-chat-bubble ${msg.image ? 'ts-chat-bubble-user-media' : 'ts-chat-bubble-user'}`}>
                      {msg.image && (
                        <img
                          src={msg.image}
                          className="max-w-xs rounded-2xl mb-2 object-cover overflow-hidden"
                          alt="User upload"
                        />
                      )}
                      {msg.text}
                    </div>
                  )}
                </div>
              ))}

              {isLoading && (
                <div className="ts-chat-row ai">
                  <div className="ts-ai-bubble-wrap">
                    <div className="ts-ai-avatar">
                      <Sparkles size={14} color="#ffffff" />
                    </div>
                    <div className="ts-chat-bubble ts-chat-bubble-ai">
                      <div className="ts-chat-typing">
                        <span />
                        <span />
                        <span />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </main>

          <div className="ts-chat-composer-wrap">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              hidden
              onChange={handleImageSelected}
            />

            {selectedImageBase64 && (
              <div className="ts-chat-image-preview-wrap">
                <img
                  src={selectedImageBase64}
                  alt="Ảnh đã chọn"
                  className="ts-chat-image-preview"
                />
                <button
                  type="button"
                  className="ts-chat-image-preview-remove"
                  onClick={handleRemoveSelectedImage}
                  aria-label="Xóa ảnh đã chọn"
                  disabled={isLoading}
                >
                  <X size={12} />
                </button>
              </div>
            )}

            <div className="ts-chat-composer">
              <button
                className="ts-chat-icon-btn"
                type="button"
                onClick={handlePickImageClick}
                disabled={isLoading}
                aria-label="Upload image"
              >
                <ImageIcon size={16} />
              </button>

              <textarea
                ref={textareaRef}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onPaste={handlePaste}
                onKeyDown={handleTextareaKeyDown}
                placeholder="Hỏi AI tư vấn..."
                className="ts-chat-textarea"
                rows={1}
                disabled={isLoading}
              />

              <div className="ts-chat-actions">
                {!inputText.trim() && !selectedImageBase64 ? (
                  <button
                    className="ts-chat-icon-btn"
                    type="button"
                    disabled={isLoading}
                    aria-label="Voice input"
                  >
                    <Mic size={16} />
                  </button>
                ) : (
                  <button
                    className="ts-chat-send-btn"
                    type="button"
                    onClick={handleSendMessage}
                    disabled={isLoading}
                    aria-label="Send message"
                  >
                    <Send size={16} />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <button
        ref={chatTriggerRef}
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen((prev) => !prev);
        }}
        className="ts-chat-trigger"
        type="button"
        aria-label={isOpen ? 'Đóng chat' : 'Mở chat'}
      >
        {isOpen ? <X size={22} /> : <MessageCircle size={24} />}
      </button>
    </div>
  );
}
