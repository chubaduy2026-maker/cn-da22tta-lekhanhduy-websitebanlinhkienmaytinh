const ChatbotService = require('../services/chatbot/ChatbotService');

async function message(req, res) {
  try {
    const { message, sessionId, history } = req.body || {};

    const result = await ChatbotService.handleMessage({
      message,
      sessionId,
      history,
      userId: req.user?._id || req.user?.id || null
    });

    return res.json({
      success: true,
      answer: result.answer,
      products: result.products || [],
      sources: result.sources || [],
      type: result.type || 'knowledge',
      quickReplies: Array.isArray(result.quickReplies) ? result.quickReplies : []
    });
  } catch (error) {
    console.error('Chatbot message error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Không thể xử lý câu hỏi lúc này.'
    });
  }
}

module.exports = {
  message
};