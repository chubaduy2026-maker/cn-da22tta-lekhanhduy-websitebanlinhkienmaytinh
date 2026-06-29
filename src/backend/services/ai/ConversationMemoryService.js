/**
 * Lean Conversation Memory Service
 * Sliding window only + optional summary of older context.
 */

const ChatbotConversation = require('../../models/ChatbotConversation');

class ConversationMemoryService {
  constructor() {
    this.maxHistoryLength = 80;
  }

  async createSession(userId = null, metadata = {}) {
    try {
      const sessionId = `session_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      const conversation = new ChatbotConversation({
        sessionId,
        user: userId || null,
        userContext: {
          isAuthenticated: Boolean(userId)
        },
        metadata,
        messages: [],
        status: 'active'
      });

      await conversation.save();

      return {
        success: true,
        sessionId,
        conversation
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async ensureSession(sessionId, userId = null, metadata = {}) {
    try {
      if (!sessionId || typeof sessionId !== 'string') {
        throw new Error('Invalid sessionId');
      }

      const conversation = await ChatbotConversation.getOrCreateConversation(sessionId, userId || null);

      if (userId && !conversation.user) {
        conversation.user = userId;
        conversation.userContext = {
          ...(conversation.userContext || {}),
          isAuthenticated: true
        };
      }

      if (metadata && Object.keys(metadata).length > 0) {
        conversation.metadata = {
          ...(conversation.metadata || {}),
          ...metadata
        };
      }

      await conversation.save();

      return {
        success: true,
        sessionId: conversation.sessionId,
        conversation
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async addMessage(sessionId, role, content, metadata = {}) {
    try {
      const conversation = await ChatbotConversation.findOne({ sessionId, status: 'active' });
      if (!conversation) {
        throw new Error('Conversation not found');
      }

      conversation.messages.push({
        role,
        content,
        timestamp: new Date(),
        metadata
      });

      if (conversation.messages.length > this.maxHistoryLength) {
        conversation.messages = conversation.messages.slice(-this.maxHistoryLength);
      }

      await conversation.save();

      return {
        success: true,
        messageCount: conversation.messages.length,
        conversation
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async saveMessage(sessionId, payload = {}) {
    return this.addMessage(
      sessionId,
      payload.role,
      payload.content,
      payload.metadata || {}
    );
  }

  async getSession(sessionId, options = {}) {
    try {
      const { includeMessages = true, messageLimit = 20 } = options;
      let query = ChatbotConversation.findOne({ sessionId, status: 'active' });

      if (!includeMessages) {
        query = query.select('-messages');
      }

      const conversation = await query.lean();
      if (!conversation) {
        return {
          success: false,
          error: 'Conversation not found'
        };
      }

      if (includeMessages && Array.isArray(conversation.messages) && messageLimit > 0) {
        conversation.messages = conversation.messages.slice(-messageLimit);
      }

      return {
        success: true,
        conversation
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * MODULE 3
   * Sliding window: keep only latest N messages as raw history.
   * Older messages are summarized and returned as short context text.
   */
  async getOptimizedHistory(sessionId, limit = 4) {
    try {
      const conversationResult = await this.getSession(sessionId, {
        includeMessages: true,
        messageLimit: 1000
      });

      if (!conversationResult.success) {
        return {
          success: true,
          recentHistory: [],
          summary: '',
          systemContext: ''
        };
      }

      const allMessages = Array.isArray(conversationResult.conversation.messages)
        ? conversationResult.conversation.messages
        : [];

      const safeLimit = Math.max(1, Number(limit) || 4);
      const recentHistory = allMessages.slice(-safeLimit).map((m) => ({
        role: m.role,
        content: m.content,
        timestamp: m.timestamp
      }));

      const olderMessages = allMessages.slice(0, Math.max(0, allMessages.length - safeLimit));
      const summary = olderMessages.length > 0
        ? this.summarizeOldContext(olderMessages)
        : '';

      const systemContext = summary
        ? `Ngữ cảnh trước đó (đã nén): ${summary}`
        : '';

      return {
        success: true,
        recentHistory,
        summary,
        systemContext
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        recentHistory: [],
        summary: '',
        systemContext: ''
      };
    }
  }

  /**
   * Simulated summarization for older context.
   * This is deterministic, lightweight, and does not call external LLM.
   */
  summarizeOldContext(messages = []) {
    if (!Array.isArray(messages) || messages.length === 0) {
      return '';
    }

    const snippets = messages
      .slice(-8)
      .map((m) => {
        const role = m.role === 'assistant' ? 'AI' : 'User';
        const content = String(m.content || '').replace(/\s+/g, ' ').trim();
        return `${role}: ${content.slice(0, 90)}`;
      })
      .filter(Boolean);

    return snippets.join(' | ').slice(0, 600);
  }

  async getHistory(sessionId, options = {}) {
    try {
      const { limit = 20 } = options;
      const optimized = await this.getOptimizedHistory(sessionId, limit);
      return {
        success: true,
        history: optimized.recentHistory || []
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        history: []
      };
    }
  }

  async updateContext(sessionId, contextUpdate = {}) {
    try {
      const conversation = await ChatbotConversation.findOne({ sessionId, status: 'active' });
      if (!conversation) {
        throw new Error('Conversation not found');
      }

      conversation.userContext = {
        ...(conversation.userContext || {}),
        ...(contextUpdate || {})
      };

      await conversation.save();

      return {
        success: true,
        context: conversation.userContext
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async clearSessionHistory(sessionId, options = {}) {
    try {
      const conversation = await ChatbotConversation.findOne({ sessionId, status: 'active' });
      if (!conversation) {
        throw new Error('Conversation not found');
      }

      conversation.messages = [];
      conversation.conversationSummary = {
        mainTopics: [],
        productsMentioned: [],
        userNeeds: [],
        unresolvedQuestions: [],
        recommendations: []
      };

      conversation.state = {
        currentState: 'greeting',
        pendingAction: {},
        collectedInfo: {},
        lastRecommendations: []
      };

      conversation.metadata = {
        ...(conversation.metadata || {}),
        startedAt: new Date(),
        lastMessageAt: null,
        messageCount: 0,
        userMessageCount: 0,
        assistantMessageCount: 0,
        resetReason: options.reason || 'manual_reset',
        resetAt: new Date()
      };

      await conversation.save();

      return {
        success: true,
        sessionId: conversation.sessionId,
        conversation
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = new ConversationMemoryService();
