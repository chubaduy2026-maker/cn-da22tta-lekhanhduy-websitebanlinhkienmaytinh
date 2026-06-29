import React, { useState, useEffect, useCallback } from 'react';
import { RiRobot2Line, RiSearchLine, RiBarChartLine, RiSettings4Line, RiRefreshLine, RiSendPlaneFill, RiPieChartLine } from 'react-icons/ri';
import { FiMessageCircle, FiTrendingUp, FiDatabase, FiCpu, FiActivity, FiCheckCircle, FiAlertCircle, FiZap, FiShoppingCart, FiUsers, FiTarget, FiEye, FiMousePointer, FiPackage } from 'react-icons/fi';
import axios from 'axios';
import Swal from 'sweetalert2';
import './AdminAI.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const AdminAI = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [aiStats, setAiStats] = useState(null);

  const [geminiStatus, setGeminiStatus] = useState(null);
  const [geminiTestMessage, setGeminiTestMessage] = useState('');
  const [geminiTestResponse, setGeminiTestResponse] = useState(null);
  const [geminiTesting, setGeminiTesting] = useState(false);
  const [aiUsageStats, setAiUsageStats] = useState(null);
  const [statsDays, setStatsDays] = useState(30);

  const [selectedConversation, setSelectedConversation] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const handleViewConversation = async (id) => {
    try {
      setDetailLoading(true);
      const response = await axios.get(`${API_URL}/ai/chatbot/admin/conversations/${id}`, getAuthHeader());
      if (response?.data?.success) {
        setSelectedConversation(response.data.conversation);
      } else {
        Swal.fire('Lỗi', response?.data?.message || 'Không thể lấy chi tiết cuộc hội thoại', 'error');
      }
    } catch (error) {
      console.error('Error fetching conversation details:', error);
      Swal.fire('Lỗi', error.response?.data?.message || 'Lỗi kết nối máy chủ', 'error');
    } finally {
      setDetailLoading(false);
    }
  };

  const getAuthHeader = useCallback(() => {
    const token = localStorage.getItem('token');
    return { headers: { Authorization: `Bearer ${token}` } };
  }, []);

  const loadAIStats = useCallback(async () => {
    try {
      setLoading(true);
      // Load basic stats from chatbot conversations
      const conversationsRes = await axios.get(`${API_URL}/ai/chatbot/admin/stats`, getAuthHeader()).catch(() => null);
      setAiStats(conversationsRes?.data || {
        totalConversations: 0,
        activeToday: 0,
        avgSatisfaction: 0,
        totalMessages: 0
      });
    } catch (error) {
      console.error('Error loading AI stats:', error);
    } finally {
      setLoading(false);
    }
  }, [getAuthHeader]);

  const loadConversations = useCallback(async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/ai/chatbot/admin/conversations`, getAuthHeader()).catch(() => null);
      setConversations(response?.data?.conversations || []);
    } catch (error) {
      console.error('Error loading conversations:', error);
    } finally {
      setLoading(false);
    }
  }, [getAuthHeader]);



  const loadGeminiStatus = useCallback(async () => {
    try {
      const response = await axios.get(`${API_URL}/ai/gemini/status`, getAuthHeader()).catch(() => null);
      setGeminiStatus(response?.data?.gemini || null);
    } catch (error) {
      console.error('Error loading Gemini status:', error);
    }
  }, [getAuthHeader]);

  const loadAIUsageStats = useCallback(async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/ai/v2/stats`, {
        ...getAuthHeader(),
        params: { days: statsDays }
      }).catch(() => null);
      setAiUsageStats(response?.data || null);
    } catch (error) {
      console.error('Error loading AI usage stats:', error);
    } finally {
      setLoading(false);
    }
  }, [getAuthHeader, statsDays]);

  useEffect(() => {
    if (activeTab === 'overview') {
      loadAIStats();
      loadGeminiStatus();
    } else if (activeTab === 'conversations') {
      loadConversations();
    } else if (activeTab === 'settings') {
      loadGeminiStatus();
    } else if (activeTab === 'stats') {
      loadAIUsageStats();
    }
  }, [activeTab, loadAIStats, loadConversations, loadGeminiStatus, loadAIUsageStats]);

  const handleGenerateEmbeddings = async () => {
    try {
      const result = await Swal.fire({
        title: 'Tạo Embeddings?',
        text: 'Quá trình này sẽ tạo embeddings cho tất cả sản phẩm. Có thể mất vài phút.',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Bắt đầu',
        cancelButtonText: 'Hủy'
      });

      if (!result.isConfirmed) return;

      Swal.fire({
        title: 'Đang tạo embeddings...',
        text: 'Quá trình đang chạy trong nền',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
      });

      await axios.post(`${API_URL}/ai/embeddings/generate`, {}, getAuthHeader());
      Swal.fire('Thành công', 'Đã bắt đầu tạo embeddings trong nền', 'success');
    } catch (error) {
      Swal.fire('Lỗi', 'Không thể tạo embeddings: ' + error.message, 'error');
    }
  };

  const handleInitializeTFIDF = async () => {
    try {
      const result = await Swal.fire({
        title: 'Khởi tạo TF-IDF?',
        text: 'Điều này sẽ cập nhật từ điển TF-IDF cho tìm kiếm.',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Khởi tạo',
        cancelButtonText: 'Hủy'
      });

      if (!result.isConfirmed) return;

      Swal.fire({
        title: 'Đang khởi tạo...',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
      });

      await axios.post(`${API_URL}/ai/tfidf/initialize`, {}, getAuthHeader());
      Swal.fire('Thành công', 'Đã khởi tạo TF-IDF thành công', 'success');
    } catch (error) {
      Swal.fire('Lỗi', 'Không thể khởi tạo TF-IDF: ' + error.message, 'error');
    }
  };

  const handleGeminiTest = async (e) => {
    e.preventDefault();
    if (!geminiTestMessage.trim()) return;

    try {
      setGeminiTesting(true);
      setGeminiTestResponse(null);
      
      const response = await axios.post(`${API_URL}/ai/gemini/chat`, {
        message: geminiTestMessage
      }, getAuthHeader());

      setGeminiTestResponse(response.data.response);
    } catch (error) {
      Swal.fire('Lỗi', error.response?.data?.message || 'Không thể kết nối với Gemini AI', 'error');
    } finally {
      setGeminiTesting(false);
    }
  };

  const tabs = [
    { id: 'overview', label: 'Tổng quan', icon: RiBarChartLine },
    { id: 'stats', label: 'Thống kê AI', icon: RiPieChartLine },
    { id: 'conversations', label: 'Hội thoại AI', icon: FiMessageCircle },
    { id: 'settings', label: 'Cài đặt', icon: RiSettings4Line }
  ];

  const renderOverview = () => (
    <div className="ai-overview">
      <div className="ai-stats-grid">
        <div className="ai-stat-card">
          <div className="stat-icon chatbot">
            <RiRobot2Line />
          </div>
          <div className="stat-info">
            <h4>Chatbot AI</h4>
            <p className="stat-value">{aiStats?.totalConversations || 0}</p>
            <span className="stat-label">Cuộc hội thoại</span>
          </div>
        </div>

        <div className="ai-stat-card">
          <div className="stat-icon search">
            <RiSearchLine />
          </div>
          <div className="stat-info">
            <h4>Tìm kiếm ngữ nghĩa</h4>
            <p className="stat-value status-active"><FiCheckCircle /> Hoạt động</p>
            <span className="stat-label">Hybrid Search</span>
          </div>
        </div>

        <div className="ai-stat-card">
          <div className="stat-icon gemini">
            <FiZap />
          </div>
          <div className="stat-info">
            <h4>Google Gemini AI</h4>
            <p className={`stat-value ${geminiStatus?.initialized ? 'status-active' : 'status-inactive'}`}>
              {geminiStatus?.initialized ? <><FiCheckCircle /> Hoạt động</> : <><FiAlertCircle /> Chưa cấu hình</>}
            </p>
            <span className="stat-label">{geminiStatus?.model || 'gemini-2.0-flash'}</span>
          </div>
        </div>

        <div className="ai-stat-card">
          <div className="stat-icon recommendation">
            <FiActivity />
          </div>
          <div className="stat-info">
            <h4>Đề xuất sản phẩm</h4>
            <p className="stat-value status-active"><FiCheckCircle /> Hoạt động</p>
            <span className="stat-label">Hybrid Recommendation</span>
          </div>
        </div>
      </div>

      <div className="ai-features-section">
        <h3>Các tính năng AI</h3>
        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-header">
              <RiRobot2Line className="feature-icon" />
              <h4>Chatbot Thông minh</h4>
            </div>
            <p>Hỗ trợ khách hàng 24/7 với khả năng truy vấn database, tư vấn sản phẩm, và kiểm tra đơn hàng.</p>
            <ul className="feature-list">
              <li>Intent recognition (15+ intents)</li>
              <li>Context-aware responses</li>
              <li>Product recommendation</li>
              <li>Order tracking</li>
            </ul>
          </div>

          <div className="feature-card">
            <div className="feature-header">
              <RiSearchLine className="feature-icon" />
              <h4>Tìm kiếm Ngữ nghĩa</h4>
            </div>
            <p>Tìm kiếm sản phẩm thông minh với nhiều thuật toán kết hợp.</p>
            <ul className="feature-list">
              <li>Keyword Search</li>
              <li>TF-IDF Search</li>
              <li>Embedding Search</li>
              <li>Hybrid Search</li>
            </ul>
          </div>

          <div className="feature-card">
            <div className="feature-header">
              <FiActivity className="feature-icon" />
              <h4>Hệ thống Đề xuất</h4>
            </div>
            <p>Đề xuất sản phẩm cá nhân hóa dựa trên hành vi người dùng.</p>
            <ul className="feature-list">
              <li>Collaborative Filtering</li>
              <li>Content-Based Filtering</li>
              <li>Rule-Based Recommendations</li>
              <li>Hybrid Recommendations</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );

  const renderConversations = () => (
    <div className="ai-conversations">
      <div className="section-header">
        <h3>Lịch sử Hội thoại AI</h3>
        <button className="refresh-btn" onClick={loadConversations} disabled={loading}>
          <RiRefreshLine className={loading ? 'spinning' : ''} /> Làm mới
        </button>
      </div>

      {conversations.length === 0 ? (
        <div className="empty-state">
          <RiRobot2Line size={60} />
          <p>Chưa có cuộc hội thoại nào</p>
        </div>
      ) : (
        <div className="conversations-list">
          {conversations.map((conv, index) => (
            <div 
              key={conv._id || index} 
              className="conversation-item clickable"
              onClick={() => handleViewConversation(conv._id)}
              title="Bấm để xem chi tiết tin nhắn"
            >
              <div className="conv-header">
                <span className="conv-id">#{conv.sessionId?.slice(-8) || index + 1}</span>
                <span className="conv-date">
                  {new Date(conv.createdAt || Date.now()).toLocaleDateString('vi-VN')}
                </span>
                <span className={`conv-status ${conv.status || 'active'}`}>
                  {conv.status === 'ended' ? 'Đã kết thúc' : 'Hoạt động'}
                </span>
              </div>
              <div className="conv-stats">
                <span><FiMessageCircle /> {conv.messageCount || 0} tin nhắn</span>
                {(() => {
                  const rating = typeof conv.satisfaction === 'object' ? conv.satisfaction?.overallRating : conv.satisfaction;
                  return rating ? <span>⭐ {rating}/5</span> : null;
                })()}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderSettings = () => (
    <div className="ai-settings">
      <div className="section-header">
        <h3>Cài đặt AI</h3>
      </div>

      <div className="settings-grid">
        <div className="settings-card">
          <div className="settings-header">
            <FiDatabase className="settings-icon" />
            <h4>Quản lý Embeddings</h4>
          </div>
          <p>Tạo và cập nhật embeddings cho sản phẩm để cải thiện tìm kiếm ngữ nghĩa.</p>
          <button className="settings-btn" onClick={handleGenerateEmbeddings}>
            <FiCpu /> Tạo Embeddings
          </button>
        </div>

        <div className="settings-card">
          <div className="settings-header">
            <RiSearchLine className="settings-icon" />
            <h4>TF-IDF Vocabulary</h4>
          </div>
          <p>Khởi tạo lại từ điển TF-IDF cho tìm kiếm từ khóa.</p>
          <button className="settings-btn" onClick={handleInitializeTFIDF}>
            <RiRefreshLine /> Khởi tạo TF-IDF
          </button>
        </div>

        <div className="settings-card gemini-card">
          <div className="settings-header">
            <FiZap className="settings-icon gemini" />
            <h4>Google Gemini AI</h4>
            <span className={`status-badge ${geminiStatus?.initialized ? 'active' : 'inactive'}`}>
              {geminiStatus?.initialized ? 'Active' : 'Inactive'}
            </span>
          </div>
          <p>AI đàm thoại thông minh sử dụng Google Gemini để xử lý ngôn ngữ tự nhiên.</p>
          
          {geminiStatus?.initialized ? (
            <div className="gemini-test-section">
              <form onSubmit={handleGeminiTest} className="gemini-test-form">
                <input
                  type="text"
                  placeholder="Nhập tin nhắn test..."
                  value={geminiTestMessage}
                  onChange={(e) => setGeminiTestMessage(e.target.value)}
                  className="gemini-test-input"
                  disabled={geminiTesting}
                />
                <button type="submit" className="gemini-test-btn" disabled={geminiTesting || !geminiTestMessage.trim()}>
                  <RiSendPlaneFill />
                </button>
              </form>
              {geminiTestResponse && (
                <div className="gemini-test-response">
                  <strong>Phản hồi:</strong>
                  <p>{geminiTestResponse.text}</p>
                  {geminiTestResponse.model && (
                    <span className="response-meta">Model: {geminiTestResponse.model}</span>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="gemini-setup-info">
              <p>Để sử dụng Gemini AI, thêm <code>GEMINI_API_KEY</code> vào file <code>.env</code></p>
              <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer">
                Lấy API Key tại Google AI Studio →
              </a>
            </div>
          )}
          
          <div className="settings-info" style={{marginTop: '1rem'}}>
            <span><FiCheckCircle /> Natural Language Understanding</span>
            <span><FiCheckCircle /> Context-aware Responses</span>
            <span><FiCheckCircle /> Product Recommendations</span>
          </div>
        </div>

        <div className="settings-card">
          <div className="settings-header">
            <RiRobot2Line className="settings-icon" />
            <h4>Chatbot Settings</h4>
          </div>
          <p>Cấu hình chatbot AI và các mẫu phản hồi.</p>
          <div className="settings-info">
            <span><FiCheckCircle /> 15+ Intent patterns</span>
            <span><FiCheckCircle /> Context-aware</span>
            <span><FiCheckCircle /> Product integration</span>
          </div>
        </div>

        <div className="settings-card">
          <div className="settings-header">
            <FiActivity className="settings-icon" />
            <h4>Recommendation Config</h4>
          </div>
          <p>Cấu hình hệ thống đề xuất sản phẩm.</p>
          <div className="settings-info">
            <span><FiCheckCircle /> Collaborative Filtering</span>
            <span><FiCheckCircle /> Content-Based</span>
            <span><FiCheckCircle /> Hybrid Model</span>
          </div>
        </div>
      </div>
    </div>
  );

  const featureIcons = {
    personalizedRecommendations: <FiUsers />,
    similarProducts: <FiTarget />,
    cartCrossSell: <FiShoppingCart />,
    frequentlyBoughtTogether: <FiPackage />,
    trending: <FiTrendingUp />,
    semanticSearch: <RiSearchLine />,
    abTesting: <FiActivity />
  };

  const featureColors = {
    personalizedRecommendations: '#e63946',
    similarProducts: '#7c3aed',
    cartCrossSell: '#3b82f6',
    frequentlyBoughtTogether: '#f59e0b',
    trending: '#10b981',
    semanticSearch: '#ec4899',
    abTesting: '#6366f1'
  };

  const renderStats = () => {
    const features = aiUsageStats?.features;
    const interactions = aiUsageStats?.interactions;

    return (
      <div className="ai-stats-tab">
        <div className="section-header">
          <h3><RiPieChartLine /> Thống kê sử dụng AI</h3>
          <div className="stats-controls">
            <select
              className="stats-period-select"
              value={statsDays}
              onChange={e => setStatsDays(Number(e.target.value))}
            >
              <option value={7}>7 ngày</option>
              <option value={14}>14 ngày</option>
              <option value={30}>30 ngày</option>
              <option value={60}>60 ngày</option>
              <option value={90}>90 ngày</option>
            </select>
            <button className="refresh-btn" onClick={loadAIUsageStats} disabled={loading}>
              <RiRefreshLine className={loading ? 'spinning' : ''} /> Làm mới
            </button>
          </div>
        </div>

        {!aiUsageStats ? (
          <div className="empty-state">
            <RiBarChartLine size={60} />
            <p>Đang tải dữ liệu thống kê...</p>
          </div>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="stats-summary-row">
              <div className="stats-summary-card">
                <div className="summary-icon" style={{ background: 'linear-gradient(135deg, #e63946, #c62828)' }}>
                  <FiActivity />
                </div>
                <div className="summary-info">
                  <span className="summary-value">{(aiUsageStats.totalRecommendationRequests || 0).toLocaleString()}</span>
                  <span className="summary-label">Tổng lượt gợi ý</span>
                </div>
              </div>
              <div className="stats-summary-card">
                <div className="summary-icon" style={{ background: 'linear-gradient(135deg, #7c3aed, #5b21b6)' }}>
                  <FiEye />
                </div>
                <div className="summary-info">
                  <span className="summary-value">{(aiUsageStats.totalUserInteractions || 0).toLocaleString()}</span>
                  <span className="summary-label">Tổng tương tác</span>
                </div>
              </div>
              <div className="stats-summary-card">
                <div className="summary-icon" style={{ background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)' }}>
                  <FiMousePointer />
                </div>
                <div className="summary-info">
                  <span className="summary-value">
                    {features ? Object.values(features).filter(f => f.clicks !== undefined).reduce((s, f) => s + (f.clicks || 0), 0).toLocaleString() : 0}
                  </span>
                  <span className="summary-label">Tổng lượt click</span>
                </div>
              </div>
              <div className="stats-summary-card">
                <div className="summary-icon" style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
                  <FiCheckCircle />
                </div>
                <div className="summary-info">
                  <span className="summary-value">
                    {features ? Object.values(features).filter(f => f.conversions !== undefined).reduce((s, f) => s + (f.conversions || 0), 0).toLocaleString() : 0}
                  </span>
                  <span className="summary-label">Chuyển đổi</span>
                </div>
              </div>
            </div>

            {/* Feature Cards */}
            <h4 className="stats-section-title">Chi tiết từng tính năng AI</h4>
            <div className="stats-features-grid">
              {features && Object.entries(features).map(([key, feature]) => (
                <div className="stats-feature-card" key={key}>
                  <div className="feature-card-header">
                    <div className="feature-card-icon" style={{ background: featureColors[key] || '#6b7280' }}>
                      {featureIcons[key] || <FiActivity />}
                    </div>
                    <div className="feature-card-title">
                      <h5>{feature.label}</h5>
                      <p>{feature.description}</p>
                    </div>
                  </div>

                  {key === 'abTesting' ? (
                    <div className="feature-card-body">
                      <div className="stat-row">
                        <span className="stat-row-label">Tổng số test</span>
                        <span className="stat-row-value">{(feature.totalTests || 0).toLocaleString()}</span>
                      </div>
                      {feature.variants && feature.variants.length > 0 ? (
                        <div className="ab-variants-table">
                          <div className="ab-row ab-header-row">
                            <span>Variant</span>
                            <span>Lượt dùng</span>
                            <span>Clicks</span>
                            <span>CTR</span>
                          </div>
                          {feature.variants.map(v => (
                            <div className="ab-row" key={v.variant}>
                              <span className="ab-variant-badge">Variant {v.variant}</span>
                              <span>{v.count.toLocaleString()}</span>
                              <span>{v.clicks.toLocaleString()}</span>
                              <span className="ctr-value">{v.ctr}%</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="no-data-text">Chưa có dữ liệu A/B test</p>
                      )}
                    </div>
                  ) : (
                    <div className="feature-card-body">
                      <div className="stat-row main-stat">
                        <span className="stat-row-label">Số lượt sử dụng</span>
                        <span className="stat-row-value highlight" style={{ color: featureColors[key] }}>
                          {(feature.count || 0).toLocaleString()}
                        </span>
                      </div>
                      {feature.clicks !== undefined && (
                        <div className="stat-row">
                          <span className="stat-row-label">Lượt click</span>
                          <span className="stat-row-value">{(feature.clicks || 0).toLocaleString()}</span>
                        </div>
                      )}
                      {feature.conversions !== undefined && (
                        <div className="stat-row">
                          <span className="stat-row-label">Chuyển đổi</span>
                          <span className="stat-row-value">{(feature.conversions || 0).toLocaleString()}</span>
                        </div>
                      )}
                      {feature.ctr !== undefined && feature.ctr !== '—' && (
                        <div className="stat-row">
                          <span className="stat-row-label">CTR</span>
                          <span className="stat-row-value ctr-value">{feature.ctr}%</span>
                        </div>
                      )}
                      {feature.avgLatency > 0 && (
                        <div className="stat-row">
                          <span className="stat-row-label">Avg Latency</span>
                          <span className="stat-row-value">{feature.avgLatency}ms</span>
                        </div>
                      )}
                      {feature.uniqueUsers !== undefined && (
                        <div className="stat-row">
                          <span className="stat-row-label">Users</span>
                          <span className="stat-row-value">{(feature.uniqueUsers || 0).toLocaleString()}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Interaction Breakdown */}
            {interactions && (
              <>
                <h4 className="stats-section-title">Phân bổ tương tác người dùng</h4>
                <div className="interactions-grid">
                  {[
                    { key: 'view', label: 'Xem sản phẩm', icon: <FiEye />, color: '#3b82f6' },
                    { key: 'search_click', label: 'Click từ tìm kiếm', icon: <RiSearchLine />, color: '#ec4899' },
                    { key: 'cart_add', label: 'Thêm giỏ hàng', icon: <FiShoppingCart />, color: '#f59e0b' },
                    { key: 'wishlist', label: 'Yêu thích', icon: <FiCheckCircle />, color: '#ef4444' },
                    { key: 'review', label: 'Đánh giá', icon: <FiMessageCircle />, color: '#8b5cf6' },
                    { key: 'purchase', label: 'Mua hàng', icon: <FiPackage />, color: '#10b981' }
                  ].map(item => (
                    <div className="interaction-card" key={item.key}>
                      <div className="interaction-icon" style={{ color: item.color, background: `${item.color}15` }}>
                        {item.icon}
                      </div>
                      <div className="interaction-info">
                        <span className="interaction-value" style={{ color: item.color }}>
                          {(interactions[item.key] || 0).toLocaleString()}
                        </span>
                        <span className="interaction-label">{item.label}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            <p className="stats-footer">
              Dữ liệu {aiUsageStats.period} • Cập nhật lúc {new Date(aiUsageStats.generatedAt).toLocaleString('vi-VN')}
            </p>
          </>
        )}
      </div>
    );
  };

  return (
    <div className="admin-ai">
      <div className="ai-header">
        <div className="ai-title">
          <RiRobot2Line size={32} />
          <h2>Quản Lý AI</h2>
        </div>
        <p className="ai-subtitle">Quản lý và giám sát các hệ thống AI của TechStore</p>
      </div>

      <div className="ai-tabs">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`ai-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <tab.icon />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      <div className="ai-content">
        {loading && (
          <div className="loading-overlay">
            <div className="loading-spinner"></div>
          </div>
        )}
        
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'stats' && renderStats()}
        {activeTab === 'conversations' && renderConversations()}
        {activeTab === 'settings' && renderSettings()}
      </div>

      {/* Modal chi tiết hội thoại */}
      {selectedConversation && (
        <div className="ai-modal-backdrop" onClick={() => setSelectedConversation(null)}>
          <div className="ai-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="ai-modal-header">
              <h3>Chi tiết cuộc hội thoại #{selectedConversation.sessionId?.slice(-8)}</h3>
              <button className="ai-modal-close" onClick={() => setSelectedConversation(null)}>
                &times;
              </button>
            </div>
            <div className="ai-modal-body">
              <div className="conversation-meta-info">
                <div className="meta-grid">
                  <div className="meta-item">
                    <strong>Session ID:</strong>
                    <span className="meta-val">{selectedConversation.sessionId}</span>
                  </div>
                  <div className="meta-item">
                    <strong>Khách hàng:</strong>
                    <span className="meta-val">
                      {selectedConversation.user 
                        ? `${selectedConversation.user.name} (${selectedConversation.user.email})` 
                        : 'Khách vãng lai'
                      }
                    </span>
                  </div>
                  <div className="meta-item">
                    <strong>Thời gian tạo:</strong>
                    <span className="meta-val">{new Date(selectedConversation.createdAt).toLocaleString('vi-VN')}</span>
                  </div>
                  <div className="meta-item">
                    <strong>Cập nhật cuối:</strong>
                    <span className="meta-val">{new Date(selectedConversation.updatedAt).toLocaleString('vi-VN')}</span>
                  </div>
                  <div className="meta-item">
                    <strong>Trạng thái:</strong>
                    <span className={`conv-status ${selectedConversation.status || 'active'}`}>
                      {selectedConversation.status === 'ended' ? 'Đã kết thúc' : 'Hoạt động'}
                    </span>
                  </div>
                  {selectedConversation.satisfaction?.overallRating && (
                    <div className="meta-item">
                      <strong>Đánh giá hài lòng:</strong>
                      <span className="meta-val">⭐ {selectedConversation.satisfaction.overallRating}/5</span>
                    </div>
                  )}
                  {selectedConversation.satisfaction?.feedback && (
                    <div className="meta-item full-width">
                      <strong>Ý kiến phản hồi:</strong>
                      <span className="meta-val">{selectedConversation.satisfaction.feedback}</span>
                    </div>
                  )}
                </div>
              </div>
              
              <h4 className="chat-history-title">Lịch sử tin nhắn ({selectedConversation.messages?.length || 0})</h4>
              <div className="chat-messages-container">
                {(!selectedConversation.messages || selectedConversation.messages.length === 0) ? (
                  <p className="no-messages">Không có tin nhắn nào trong cuộc hội thoại này.</p>
                ) : (
                  selectedConversation.messages.map((msg, idx) => (
                    <div key={msg._id || idx} className={`chat-message-bubble ${msg.role}`}>
                      <div className="message-sender">
                        {msg.role === 'user' ? 'Người dùng' : msg.role === 'assistant' ? 'TechBot AI' : 'Hệ thống'}
                      </div>
                      <div className="message-text">
                        {msg.content}
                      </div>
                      {msg.role === 'assistant' && msg.metadata?.products && msg.metadata.products.length > 0 && (
                        <div className="recommended-products-mini">
                          <p>📦 Sản phẩm đính kèm:</p>
                          <div className="mini-products-grid">
                            {msg.metadata.products.map((p, pIdx) => (
                              <a 
                                href={p.productUrl || `/product/${p.id}`} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                key={pIdx} 
                                className="mini-product-card"
                              >
                                {p.imageUrl && <img src={p.imageUrl} alt={p.name} className="mini-p-img" />}
                                <div className="mini-p-info">
                                  <span className="mini-p-name">{p.name}</span>
                                  <span className="mini-p-price">
                                    {p.price ? p.price.toLocaleString('vi-VN') + ' đ' : 'Liên hệ'}
                                  </span>
                                </div>
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                      <div className="message-time">
                        {new Date(msg.timestamp || selectedConversation.updatedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {detailLoading && (
        <div className="loading-overlay">
          <div className="loading-spinner"></div>
        </div>
      )}
    </div>
  );
};

export default AdminAI;
