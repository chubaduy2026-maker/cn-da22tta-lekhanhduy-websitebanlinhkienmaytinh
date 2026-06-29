const express = require('express');

const chatbotController = require('../controllers/chatbotController');
const ChatbotConversation = require('../models/ChatbotConversation');
const { auth } = require('../middleware/auth');

const router = express.Router();

router.post('/message', chatbotController.message);

/**
 * GET /api/ai/chatbot/admin/stats
 * Lấy thống kê tổng quan về hội thoại Chatbot
 */
router.get('/admin/stats', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const [totalConversations, activeToday, satisfactionResult, messagesResult] = await Promise.all([
      ChatbotConversation.countDocuments(),
      ChatbotConversation.countDocuments({
        updatedAt: { $gte: startOfDay }
      }),
      ChatbotConversation.aggregate([
        { $match: { 'satisfaction.overallRating': { $ne: null } } },
        { $group: { _id: null, avgRating: { $avg: '$satisfaction.overallRating' } } }
      ]),
      ChatbotConversation.aggregate([
        { $group: { _id: null, total: { $sum: { $size: { $ifNull: ['$messages', []] } } } } }
      ])
    ]);

    const avgSatisfaction = satisfactionResult[0]?.avgRating || 0;
    const totalMessages = messagesResult[0]?.total || 0;

    return res.json({
      success: true,
      totalConversations,
      activeToday,
      avgSatisfaction: Math.round(avgSatisfaction * 10) / 10,
      totalMessages
    });
  } catch (error) {
    console.error('Chatbot stats error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/ai/chatbot/admin/conversations
 * Lấy danh sách cuộc hội thoại Chatbot gần đây
 */
router.get('/admin/conversations', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }

    const conversations = await ChatbotConversation.find()
      .select('sessionId status satisfaction messages createdAt updatedAt')
      .sort({ updatedAt: -1 })
      .limit(50)
      .lean();

    const formatted = conversations.map(c => ({
      _id: c._id,
      sessionId: c.sessionId,
      status: c.status,
      satisfaction: c.satisfaction?.overallRating || null,
      createdAt: c.createdAt,
      messageCount: c.messages ? c.messages.length : 0
    }));

    return res.json({
      success: true,
      conversations: formatted
    });
  } catch (error) {
    console.error('Chatbot conversations error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/ai/chatbot/admin/conversations/:id
 * Lấy chi tiết tin nhắn của một cuộc hội thoại cụ thể
 */
router.get('/admin/conversations/:id', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }

    const conversation = await ChatbotConversation.findById(req.params.id)
      .populate('user', 'name email')
      .lean();

    if (!conversation) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy cuộc hội thoại' });
    }

    return res.json({
      success: true,
      conversation
    });
  } catch (error) {
    console.error('Chatbot conversation detail error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;