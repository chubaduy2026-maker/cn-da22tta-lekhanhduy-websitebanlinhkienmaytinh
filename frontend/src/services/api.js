import axios from 'axios';
import { API_BASE_URL } from '../config/apiConfig';

const API_URL = API_BASE_URL;

// Tạo session ID cho giỏ hàng
const getSessionId = () => {
  let sessionId = localStorage.getItem('sessionId');
  if (!sessionId) {
    sessionId = `session-${Date.now()}-${Math.random()}`;
    localStorage.setItem('sessionId', sessionId);
  }
  return sessionId;
};

// Xóa sessionId khi đăng nhập
export const clearSessionId = () => {
  localStorage.removeItem('sessionId');
};

// Axios instance với session ID
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  // Luôn gửi sessionId (cho cả user đã đăng nhập và chưa đăng nhập)
  config.headers['x-session-id'] = getSessionId();

  // Thêm token nếu có
  const token = localStorage.getItem('token');
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }

  return config;
});

// Product API
export const productAPI = {
  getAll: (params) => api.get('/products', { params }),
  getById: (id) => api.get(`/products/${id}`),
  search: (query) => api.get('/products/search', { params: { q: query } }),
  getCategories: () => api.get('/products/categories/list'),
  getBrands: () => api.get('/products/brands/list'),
};

// Cart API
export const cartAPI = {
  getCart: () => api.get('/cart'),
  addToCart: (productId, quantity) => api.post('/cart/add', { productId, quantity }),
  updateCart: (productId, quantity) => api.put('/cart/update', { productId, quantity }),
  removeFromCart: (productId) => api.delete(`/cart/remove/${productId}`),
  clearCart: () => api.delete('/cart/clear'),
};

// Order API
export const orderAPI = {
  createOrder: (orderData) => api.post('/orders', orderData),
  getOrders: async (params) => {
    const response = await api.get('/orders', { params });
    // Trả về mảng orders từ response
    return { data: response.data.orders || [] };
  },
  getOrderById: (id) => api.get(`/orders/${id}`),
  trackOrder: (orderNumber) => api.get(`/orders/tracking/${orderNumber}`),
  updateOrderStatus: (id, status) => api.put(`/orders/${id}/status`, { status }),
  // Thanh toán thành công (không cần admin)
  confirmPayment: (id) => api.put(`/orders/${id}/payment-success`),
  // Khách hàng hủy đơn (không cần admin)
  customerCancelOrder: (id) => api.put(`/orders/${id}/customer-cancel`),
};

// Auth API
export const authAPI = {
  register: (userData) => api.post('/auth/register', userData),
  login: (email, password) => api.post('/auth/login', { email, password }),
  getCurrentUser: () => api.get('/auth/me'),
  updateProfile: (userData) => api.put('/auth/profile', userData),
  changePassword: (currentPassword, newPassword) =>
    api.put('/auth/change-password', { currentPassword, newPassword }),
  logout: () => api.post('/auth/logout'),
  getUserReviews: () => api.get('/auth/reviews'),
};

// Admin API
export const adminAPI = {
  // Statistics
  getStats: () => api.get('/admin/stats'),
  getAIObservability: () => api.get('/v3/chat/observability'),

  // Users Management
  getUsers: (params) => api.get('/admin/users', { params }),
  updateUserRole: (userId, role) => api.put(`/admin/users/${userId}/role`, { role }),
  toggleUserStatus: (userId) => api.put(`/admin/users/${userId}/toggle-status`),
  deleteUser: (userId) => api.delete(`/admin/users/${userId}`),

  // Orders Management
  getAllOrders: (params) => api.get('/admin/orders', { params }),

  // Products Management (sử dụng productAPI nhưng với quyền admin)
  createProduct: (productData) => api.post('/products', productData),
  updateProduct: (id, productData) => api.put(`/products/${id}`, productData),
  deleteProduct: (id) => api.delete(`/products/${id}`),
};

// ZaloPay API
export const zalopayAPI = {
  createOrder: (orderId, amount, description) =>
    api.post('/zalopay/create', { orderId, amount, description }),
  checkStatus: (app_trans_id) =>
    api.post('/zalopay/check-status', { app_trans_id }),
};

// Reviews API
export const reviewAPI = {
  getProductReviews: (productId, params) => api.get(`/reviews/product/${productId}`, { params }),
  createReview: (reviewData) => api.post('/reviews', reviewData),
  updateReview: (id, reviewData) => api.put(`/reviews/${id}`, reviewData),
  deleteReview: (id) => api.delete(`/reviews/${id}`),
  markHelpful: (id) => api.post(`/reviews/${id}/helpful`),
  checkUserReview: (productId) => api.get(`/reviews/check/${productId}`),
  canReview: (productId) => api.get(`/reviews/can-review/${productId}`),
};

// Coupon API
export const couponAPI = {
  // Admin
  getAll: () => api.get('/coupons'),
  create: (couponData) => api.post('/coupons', couponData),
  update: (id, couponData) => api.put(`/coupons/${id}`, couponData),
  delete: (id) => api.delete(`/coupons/${id}`),
  // User
  getAvailable: () => api.get('/coupons/available'),
  validate: (code, orderAmount) => api.post('/coupons/validate', { code, orderAmount }),
  use: (code) => api.post('/coupons/use', { code }),
};

export const videoReviewAPI = {
  getAll: (limit = 8) => api.get('/video-reviews', { params: { limit } }),
  adminGetAll: () => api.get('/video-reviews/admin/all'),
  create: (data) => api.post('/video-reviews', data),
  update: (id, data) => api.put(`/video-reviews/${id}`, data),
  delete: (id) => api.delete(`/video-reviews/${id}`),
};

export const techNewsAPI = {
  getAll: (limit = 6) => api.get('/tech-news', { params: { limit } }),
  adminGetAll: () => api.get('/tech-news/admin/all'),
  create: (data) => api.post('/tech-news', data),
  update: (id, data) => api.put(`/tech-news/${id}`, data),
  delete: (id) => api.delete(`/tech-news/${id}`),
};

// AI API
export const aiAPI = {
  // Chatbot
  sendMessage: (sessionId, message, context = {}) => 
    api.post('/ai/chatbot/message', { sessionId, message, context }),
  getChatHistory: (sessionId, limit = 50) => 
    api.get(`/ai/chatbot/history/${sessionId}`, { params: { limit } }),
  endConversation: (sessionId, satisfaction) => 
    api.post(`/ai/chatbot/end/${sessionId}`, { satisfaction }),
  
  // Recommendations (v1 - legacy fallback)
  getProductRecommendations: (productId, type = 'hybrid', limit = 10) =>
    api.get(`/ai/recommendations/product/${productId}`, { params: { type, limit } }),
  getUserRecommendations: (limit = 10) =>
    api.get('/ai/recommendations/user', { params: { limit } }),
  getPopularProducts: (limit = 10, category = null) =>
    api.get('/ai/recommendations/popular', { params: { limit, category } }),
  getCartRecommendations: (cartItems, limit = 5) =>
    api.post('/ai/recommendations/cart', { cartItems }, { params: { limit } }),
  
  // Recommendations V2 - Advanced AI (SVD, NCF, FAISS, Association Rules)
  v2: {
    getProductRecommendations: (productId, limit = 10) =>
      api.get(`/ai/v2/recommend/product/${productId}`, { params: { limit } }),
    getUserRecommendations: (userId, limit = 10) =>
      api.get(`/ai/v2/recommend/user/${userId}`, { params: { limit } }),
    getTrending: (limit = 20, category = null) =>
      api.get('/ai/v2/recommend/trending', { params: { limit, category } }),
    getBestSellers: (limit = 12, days = 30, category = null) =>
      api.get('/ai/v2/recommend/best-sellers', { params: { limit, days, category } }),
    getCartRecommendations: (cartItems, limit = 5) =>
      api.post('/ai/v2/recommend/cart', { cartItems }, { params: { limit } }),
    trackInteraction: (data) =>
      api.post('/ai/v2/track', data),
    trackClick: (recommendationLogId, productId) =>
      api.post('/ai/v2/track-click', { recommendationLogId, productId }),
    getStatus: () =>
      api.get('/ai/v2/status'),
    triggerTraining: () =>
      api.post('/ai/v2/train'),
    getTrainingReport: () =>
      api.get('/ai/v2/training/report'),
    getABTestResults: () =>
      api.get('/ai/v2/ab-test/results'),
    getAIStats: (days = 30) =>
      api.get('/ai/v2/stats', { params: { days } }),
  },

  // Semantic Search
  search: (query, options = {}) =>
    api.get('/ai/search', { params: { q: query, ...options } }),

  // Gemini AI (Admin)
  getGeminiStatus: () =>
    api.get('/ai/gemini/status'),
  geminiChat: (message, context = {}) =>
    api.post('/ai/gemini/chat', { message, context }),
  geminiAnalyzeIntent: (message) =>
    api.post('/ai/gemini/analyze-intent', { message }),
};

export default api;
