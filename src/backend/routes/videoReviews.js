const express = require('express');
const router = express.Router();
const VideoReview = require('../models/VideoReview');
const { auth, isAdmin } = require('../middleware/auth');

// GET: Public — lấy video reviews đang active (cho trang chủ)
router.get('/', async (req, res) => {
  try {
    const { limit = 8 } = req.query;
    const videos = await VideoReview.find({ isActive: true })
      .populate('product', 'name price image category brand')
      .sort({ order: 1, createdAt: -1 })
      .limit(Math.min(parseInt(limit) || 8, 20));

    res.json({ success: true, videos });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET: Admin — lấy tất cả video reviews
router.get('/admin/all', auth, isAdmin, async (req, res) => {
  try {
    const videos = await VideoReview.find()
      .populate('product', 'name price image')
      .sort({ order: 1, createdAt: -1 });

    res.json({ success: true, videos });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST: Admin — thêm video review
router.post('/', auth, isAdmin, async (req, res) => {
  try {
    const { title, videoUrl, thumbnail, product, reviewer, order } = req.body;

    if (!title || !videoUrl || !thumbnail || !product) {
      return res.status(400).json({
        success: false,
        message: 'Thiếu thông tin bắt buộc (title, videoUrl, thumbnail, product)'
      });
    }

    const video = new VideoReview({
      title,
      videoUrl,
      thumbnail,
      product,
      reviewer: reviewer || '',
      order: order || 0
    });

    await video.save();
    await video.populate('product', 'name price image');

    res.status(201).json({ success: true, video });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT: Admin — cập nhật video review
router.put('/:id', auth, isAdmin, async (req, res) => {
  try {
    const { title, videoUrl, thumbnail, product, reviewer, isActive, order } = req.body;

    const video = await VideoReview.findByIdAndUpdate(
      req.params.id,
      { title, videoUrl, thumbnail, product, reviewer, isActive, order },
      { new: true, runValidators: true }
    ).populate('product', 'name price image');

    if (!video) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy video' });
    }

    res.json({ success: true, video });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE: Admin — xoá video review
router.delete('/:id', auth, isAdmin, async (req, res) => {
  try {
    const video = await VideoReview.findByIdAndDelete(req.params.id);
    if (!video) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy video' });
    }
    res.json({ success: true, message: 'Đã xóa video review' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
