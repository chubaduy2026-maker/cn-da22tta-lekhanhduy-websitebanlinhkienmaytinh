const express = require('express');
const router = express.Router();
const { optionalAuth } = require('../middleware/auth');
const { BehaviorTrackerService } = require('../services/ai');

// POST /api/behavior/track - Lưu trữ hành vi người dùng
router.post('/track', optionalAuth, async (req, res) => {
  try {
    const userId = req.user?._id?.toString();
    // Prioritize x-session-id from headers as set by Axios interceptor
    const sessionId = req.headers['x-session-id'] || req.body.sessionId;
    
    if (!sessionId) {
      return res.status(400).json({ success: false, message: 'Session ID is required' });
    }

    const eventData = {
      userId,
      sessionId,
      eventType: req.body.eventType,
      productId: req.body.productId,
      keyword: req.body.keyword,
      category: req.body.category,
      brand: req.body.brand,
      price: Number(req.body.price) || 0,
      metadata: req.body.metadata || {}
    };

    const result = await BehaviorTrackerService.trackBehavior(eventData);

    if (result.success) {
      return res.json({ success: true, message: 'Behavior tracked successfully' });
    } else {
      return res.status(400).json({ success: false, message: result.error });
    }
  } catch (error) {
    console.error('Track behavior route error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
