const express = require('express');
const router = express.Router();
const TechNews = require('../models/TechNews');
const { auth, isAdmin } = require('../middleware/auth');

// GET: Public - lay danh sach tin tuc dang active
router.get('/', async (req, res) => {
  try {
    const { limit = 6 } = req.query;
    const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 6, 1), 20);

    const items = await TechNews.find({ isActive: true })
      .sort({ order: 1, createdAt: -1 })
      .limit(safeLimit);

    res.json({ success: true, items });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET: Admin - lay tat ca tin tuc
router.get('/admin/all', auth, isAdmin, async (req, res) => {
  try {
    const items = await TechNews.find().sort({ order: 1, createdAt: -1 });
    res.json({ success: true, items });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST: Admin - tao tin tuc
router.post('/', auth, isAdmin, async (req, res) => {
  try {
    const { title, summary, thumbnail, articleUrl, source, order } = req.body;

    if (!title || !thumbnail || !articleUrl) {
      return res.status(400).json({
        success: false,
        message: 'Thiếu thông tin bắt buộc (title, thumbnail, articleUrl)',
      });
    }

    const item = new TechNews({
      title,
      summary: summary || '',
      thumbnail,
      articleUrl,
      source: source || '',
      order: order || 0,
    });

    await item.save();
    res.status(201).json({ success: true, item });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT: Admin - cap nhat tin tuc
router.put('/:id', auth, isAdmin, async (req, res) => {
  try {
    const { title, summary, thumbnail, articleUrl, source, isActive, order } = req.body;

    const item = await TechNews.findByIdAndUpdate(
      req.params.id,
      { title, summary, thumbnail, articleUrl, source, isActive, order },
      { new: true, runValidators: true }
    );

    if (!item) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy tin tức' });
    }

    res.json({ success: true, item });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE: Admin - xoa tin tuc
router.delete('/:id', auth, isAdmin, async (req, res) => {
  try {
    const item = await TechNews.findByIdAndDelete(req.params.id);

    if (!item) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy tin tức' });
    }

    res.json({ success: true, message: 'Đã xóa tin tức công nghệ' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
