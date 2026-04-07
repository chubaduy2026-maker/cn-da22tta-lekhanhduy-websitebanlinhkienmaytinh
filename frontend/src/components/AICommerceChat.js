import React, { useEffect, useRef, useState } from 'react';
import { FiImage, FiMic, FiSend, FiZap } from 'react-icons/fi';
import { API_BASE_URL } from '../config/apiConfig';
import './AICommerceChat.css';

const CHAT_ENDPOINT = `${API_BASE_URL}/v3/chat`;
const SESSION_STORAGE_KEY = 'ai_chat_session';

const INITIAL_MESSAGES = [
  {
    id: 'welcome',
    role: 'assistant',
    content: 'Chao ban, minh la tro ly AI cua TechStore. Ban can tim laptop, build PC hay so sanh linh kien nao?'
  }
];

function createMessage(role, content) {
  return {
    id: `${role}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    role,
    content
  };
}

export default function AICommerceChat() {
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState(() => localStorage.getItem(SESSION_STORAGE_KEY) || '');
  const [messages, setMessages] = useState(INITIAL_MESSAGES);

  const textareaRef = useRef(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (!textareaRef.current) {
      return;
    }

    textareaRef.current.style.height = 'auto';
    textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
  }, [inputText]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, isLoading]);

  const handleResetChat = () => {
    localStorage.removeItem(SESSION_STORAGE_KEY);
    setSessionId('');
    setMessages(INITIAL_MESSAGES);
  };

  const handleSendMessage = async () => {
    const trimmed = inputText.trim();

    if (!trimmed || isLoading) {
      return;
    }

    setMessages((prev) => [...prev, createMessage('user', trimmed)]);
    setInputText('');
    setIsLoading(true);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(CHAT_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          message: trimmed,
          sessionId: sessionId || undefined
        })
      });

      const payload = await response.json();

      if (!response.ok || !payload?.success) {
        throw new Error(payload?.data?.text || payload?.message || 'Khong the ket noi chatbot luc nay.');
      }

      if (payload.sessionId && payload.sessionId !== sessionId) {
        setSessionId(payload.sessionId);
        localStorage.setItem(SESSION_STORAGE_KEY, payload.sessionId);
      }

      const assistantText = payload?.data?.text || 'Xin loi, minh chua co phan hoi phu hop.';
      setMessages((prev) => [...prev, createMessage('assistant', assistantText)]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        createMessage('assistant', error.message || 'Da co loi xay ra, vui long thu lai sau.')
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTextareaKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="gemini-chat-page">
      <header className="gemini-chat-header">
        <div className="gemini-chat-brand">
          <span className="gemini-chat-brand-icon">
            <FiZap />
          </span>
          <div>
            <h2>Tro ly AI TechStore</h2>
            <p>Tra loi nhanh, ro rang, tap trung vao mua sam cong nghe</p>
          </div>
        </div>
        <button className="gemini-reset-btn" type="button" onClick={handleResetChat}>
          Cuoc hoi thoai moi
        </button>
      </header>

      <main className="gemini-chat-main">
        <div className="gemini-chat-stream">
          {messages.map((message) => (
            <section key={message.id} className={`gemini-message-row ${message.role}`}>
              <span className="gemini-message-role">{message.role === 'assistant' ? 'AI' : 'Ban'}</span>
              <p className="gemini-message-text">{message.content}</p>
            </section>
          ))}

          {isLoading && (
            <section className="gemini-message-row assistant is-loading">
              <span className="gemini-message-role">AI</span>
              <p className="gemini-message-text">AI dang phan tich yeu cau...</p>
            </section>
          )}

          <div ref={messagesEndRef} />
        </div>
      </main>

      <footer className="gemini-chat-composer-wrap">
        <div className="gemini-chat-composer">
          <button className="composer-icon-btn" type="button" disabled={isLoading} aria-label="Upload image">
            <FiImage />
          </button>

          <textarea
            ref={textareaRef}
            value={inputText}
            onChange={(event) => setInputText(event.target.value)}
            onKeyDown={handleTextareaKeyDown}
            placeholder="Hoi AI ve laptop, gaming PC, linh kien..."
            rows={1}
            disabled={isLoading}
          />

          {!inputText.trim() ? (
            <button className="composer-icon-btn" type="button" disabled={isLoading} aria-label="Voice input">
              <FiMic />
            </button>
          ) : (
            <button
              className="composer-send-btn"
              type="button"
              onClick={handleSendMessage}
              disabled={isLoading}
              aria-label="Send message"
            >
              <FiSend />
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}
