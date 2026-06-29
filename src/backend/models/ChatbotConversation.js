/**
 * ChatbotConversation Model
 * Lưu trữ conversation history và context cho AI Chatbot
 * 
 * @module models/ChatbotConversation
 * @description Schema cho AI Chatbot - Context-aware conversation
 */
const mongoose = require('mongoose');

// Schema cho mỗi message trong conversation
const messageSchema = new mongoose.Schema({
  role: {
    type: String,
    required: true,
    enum: ['user', 'assistant', 'system']
  },
  content: {
    type: String,
    required: true
  },
  // Parsed intent từ message
  intent: {
    type: String,
    enum: [
      'greeting',
      'product_inquiry',
      'product_search',
      'product_comparison',
      'price_inquiry',
      'stock_check',
      'order_status',
      'order_tracking',
      'payment_help',
      'shipping_info',
      'return_policy',
      'warranty_info',
      'technical_support',
      'complaint',
      'feedback',
      'general_question',
      'farewell',
      'unknown'
    ]
  },
  // Confidence của intent detection
  intentConfidence: { type: Number, min: 0, max: 1 },
  // Entities được trích xuất
  entities: [{
    type: {
      type: String,
      enum: ['product', 'category', 'brand', 'price', 'minPrice', 'maxPrice', 'order_number', 'date', 'quantity', 'feature']
    },
    value: String,
    confidence: Number
  }],
  // Database queries được thực hiện
  databaseQueries: [{
    collectionName: String,
    query: mongoose.Schema.Types.Mixed,
    resultCount: Number,
    executionTime: Number
  }],
  // Products/Orders được reference trong response
  referencedItems: {
    products: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
    orders: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Order' }],
    categories: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Category' }]
  },
  // Response metadata
  responseMetadata: {
    generationTime: Number, // ms
    tokensUsed: Number,
    model: String,
    fallbackUsed: { type: Boolean, default: false }
  },
  // Runtime metadata for API v3 persistence (image uploads, retrieved products, source tags)
  metadata: {
    source: String,
    hasImagePayload: { type: Boolean, default: false },
    image: String,
    sources: [mongoose.Schema.Types.Mixed],
    products: [mongoose.Schema.Types.Mixed]
  },
  // Feedback từ user
  feedback: {
    helpful: { type: Boolean, default: null },
    rating: { type: Number, min: 1, max: 5 },
    comment: String
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
}, { _id: true });

// Schema chính cho Chatbot Conversation
const chatbotConversationSchema = new mongoose.Schema({
  // User info
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },
  // Session ID cho anonymous users
  sessionId: {
    type: String,
    required: true,
    index: true
  },
  
  // === USER CONTEXT ===
  userContext: {
    // Thông tin cơ bản
    isAuthenticated: { type: Boolean, default: false },
    userName: String,
    userEmail: String,
    // Lịch sử mua hàng
    purchaseHistory: {
      totalOrders: { type: Number, default: 0 },
      totalSpent: { type: Number, default: 0 },
      favoriteCategories: [String],
      recentOrders: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Order' }]
    },
    // Giỏ hàng hiện tại
    currentCart: {
      itemCount: { type: Number, default: 0 },
      cartTotal: { type: Number, default: 0 },
      items: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }]
    },
    // Browsing history trong session
    browsingHistory: [{
      product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
      category: String,
      timestamp: Date
    }],
    // Sản phẩm đang xem
    currentProduct: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    currentPage: String,
    // Device info
    deviceType: {
      type: String,
      enum: ['desktop', 'mobile', 'tablet'],
      default: 'desktop'
    }
  },

  // === CONVERSATION ===
  messages: [messageSchema],
  
  // Conversation summary (để maintain context trong long conversations)
  conversationSummary: {
    mainTopics: [String],
    productsMentioned: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
    userNeeds: [String],
    unresolvedQuestions: [String],
    recommendations: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }]
  },

  // === CONVERSATION METADATA ===
  metadata: {
    startedAt: { type: Date, default: Date.now },
    lastMessageAt: Date,
    messageCount: { type: Number, default: 0 },
    userMessageCount: { type: Number, default: 0 },
    assistantMessageCount: { type: Number, default: 0 },
    avgResponseTime: { type: Number, default: 0 }, // ms
    // Conversation flow
    primaryIntent: String,
    resolved: { type: Boolean, default: false },
    // Escalation
    escalatedToHuman: { type: Boolean, default: false },
    escalationReason: String,
    handledByStaff: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },

  // === CONVERSATION STATE ===
  state: {
    // Current state trong conversation flow
    currentState: {
      type: String,
      enum: [
        'greeting',
        'product_discovery',
        'product_comparison',
        'order_inquiry',
        'support_ticket',
        'checkout_help',
        'general_chat',
        'farewell',
        'waiting_for_input'
      ],
      default: 'greeting'
    },
    // Pending actions
    pendingAction: {
      action: String,
      parameters: mongoose.Schema.Types.Mixed,
      expiresAt: Date
    },
    // Collected information
    collectedInfo: mongoose.Schema.Types.Mixed,
    // Last product recommendations
    lastRecommendations: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }]
  },

  // === SATISFACTION & QUALITY ===
  satisfaction: {
    overallRating: { type: Number, min: 1, max: 5 },
    helpful: { type: Boolean, default: null },
    wouldRecommend: { type: Boolean, default: null },
    feedback: String,
    surveyCompleted: { type: Boolean, default: false }
  },

  // Conversation status
  status: {
    type: String,
    enum: ['active', 'completed', 'abandoned', 'escalated'],
    default: 'active',
    index: true
  },
  
  // TTL - Auto delete old conversations
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
  }
}, {
  timestamps: true
});

// Indexes
chatbotConversationSchema.index({ createdAt: -1 });
chatbotConversationSchema.index({ 'userContext.isAuthenticated': 1 });
chatbotConversationSchema.index({ 'metadata.resolved': 1 });
chatbotConversationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Pre-save hook: Update metadata
chatbotConversationSchema.pre('save', function(next) {
  if (this.messages && this.messages.length > 0) {
    this.metadata.messageCount = this.messages.length;
    this.metadata.userMessageCount = this.messages.filter(m => m.role === 'user').length;
    this.metadata.assistantMessageCount = this.messages.filter(m => m.role === 'assistant').length;
    this.metadata.lastMessageAt = this.messages[this.messages.length - 1].timestamp;
  }
  next();
});

// Static method: Get or create conversation
chatbotConversationSchema.statics.getOrCreateConversation = async function(sessionId, userId = null) {
  let conversation = await this.findOne({
    sessionId,
    status: 'active'
  });

  if (!conversation) {
    conversation = new this({
      sessionId,
      user: userId,
      userContext: {
        isAuthenticated: !!userId
      }
    });
    await conversation.save();
  }

  return conversation;
};

// Instance method: Add message
chatbotConversationSchema.methods.addMessage = async function(role, content, metadata = {}) {
  const message = {
    role,
    content,
    timestamp: new Date(),
    ...metadata
  };
  
  this.messages.push(message);
  await this.save();
  
  return message;
};

// Static method: Get conversation analytics
chatbotConversationSchema.statics.getAnalytics = async function(options = {}) {
  const { startDate, endDate = new Date() } = options;
  
  const matchStage = {};
  if (startDate) {
    matchStage.createdAt = { $gte: startDate, $lte: endDate };
  }

  const analytics = await this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalConversations: { $sum: 1 },
        resolvedConversations: {
          $sum: { $cond: ['$metadata.resolved', 1, 0] }
        },
        escalatedConversations: {
          $sum: { $cond: ['$metadata.escalatedToHuman', 1, 0] }
        },
        avgMessageCount: { $avg: '$metadata.messageCount' },
        avgResponseTime: { $avg: '$metadata.avgResponseTime' },
        avgSatisfactionRating: { $avg: '$satisfaction.overallRating' }
      }
    }
  ]);

  return analytics[0] || {
    totalConversations: 0,
    resolvedConversations: 0,
    escalatedConversations: 0,
    avgMessageCount: 0,
    avgResponseTime: 0,
    avgSatisfactionRating: 0
  };
};

module.exports = mongoose.model('ChatbotConversation', chatbotConversationSchema);
