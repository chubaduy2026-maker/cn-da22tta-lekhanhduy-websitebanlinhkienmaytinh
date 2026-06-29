const express = require('express');
const router = express.Router();
const Filter = require('../models/Filter');
const { auth, isAdmin } = require('../middleware/auth');

// GET: Lấy tất cả filters (public)
router.get('/', async (req, res) => {
  try {
    const { category } = req.query;
    
    let query = { isActive: true };
    
    // Nếu có category, tìm kiếm không phân biệt chữ hoa/thường
    if (category) {
      query.category = new RegExp(`^${category}$`, 'i');
    }
    
    const filters = await Filter.find(query).sort({ order: 1 });
    
    res.json(filters);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi lấy danh sách bộ lọc', error: error.message });
  }
});

// GET: Lấy tất cả filters cho admin
router.get('/all', auth, isAdmin, async (req, res) => {
  try {
    const filters = await Filter.find().sort({ category: 1, order: 1 });
    res.json(filters);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi lấy danh sách bộ lọc', error: error.message });
  }
});

// POST: Tạo filter mới (admin only)
router.post('/', auth, isAdmin, async (req, res) => {
  try {
    // Kiểm tra xem filter name đã tồn tại chưa
    const existingFilter = await Filter.findOne({ name: req.body.name });
    if (existingFilter) {
      return res.status(400).json({ 
        message: 'Tên trường bộ lọc đã tồn tại! Vui lòng chọn tên khác.' 
      });
    }
    
    const filter = new Filter(req.body);
    await filter.save();
    console.log('Filter created successfully:', filter);
    res.status(201).json({ message: 'Tạo bộ lọc thành công', filter });
  } catch (error) {
    console.error('Error creating filter:', error);
    
    // Xử lý lỗi duplicate key
    if (error.code === 11000) {
      return res.status(400).json({ 
        message: 'Tên bộ lọc đã tồn tại! Vui lòng chọn tên khác.' 
      });
    }
    
    res.status(400).json({ 
      message: 'Lỗi khi tạo bộ lọc: ' + error.message 
    });
  }
});

// PUT: Cập nhật filter (admin only)
router.put('/:id', auth, isAdmin, async (req, res) => {
  try {
    const filter = await Filter.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!filter) {
      return res.status(404).json({ message: 'Không tìm thấy bộ lọc' });
    }

    res.json({ message: 'Cập nhật bộ lọc thành công', filter });
  } catch (error) {
    res.status(400).json({ message: 'Lỗi khi cập nhật bộ lọc', error: error.message });
  }
});

// DELETE: Xóa filter (admin only)
router.delete('/:id', auth, isAdmin, async (req, res) => {
  try {
    const filter = await Filter.findByIdAndDelete(req.params.id);

    if (!filter) {
      return res.status(404).json({ message: 'Không tìm thấy bộ lọc' });
    }

    res.json({ message: 'Xóa bộ lọc thành công' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi xóa bộ lọc', error: error.message });
  }
});

// PUT: Toggle trạng thái active (admin only)
router.put('/:id/toggle', auth, isAdmin, async (req, res) => {
  try {
    const filter = await Filter.findById(req.params.id);
    
    if (!filter) {
      return res.status(404).json({ message: 'Không tìm thấy bộ lọc' });
    }

    filter.isActive = !filter.isActive;
    await filter.save();

    res.json({ message: 'Cập nhật trạng thái thành công', filter });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi cập nhật trạng thái', error: error.message });
  }
});

module.exports = router;
