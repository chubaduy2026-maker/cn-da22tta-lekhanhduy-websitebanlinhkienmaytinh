const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const path = require('path');
const fs = require('fs');
const { auth, isAdmin } = require('../middleware/auth');

// POST: Upload single image
router.post('/single', auth, isAdmin, upload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Vui lòng chọn file ảnh!' });
    }

    const imageUrl = `/uploads/${req.file.filename}`;
    
    res.json({
      message: 'Upload ảnh thành công!',
      imageUrl: imageUrl,
      filename: req.file.filename
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi upload ảnh!', error: error.message });
  }
});

// POST: Upload multiple images
router.post('/multiple', auth, isAdmin, upload.array('images', 10), (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: 'Vui lòng chọn ít nhất một file ảnh!' });
    }

    const imageUrls = req.files.map(file => ({
      url: `/uploads/${file.filename}`,
      filename: file.filename
    }));
    
    res.json({
      message: `Upload ${req.files.length} ảnh thành công!`,
      images: imageUrls
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi upload ảnh!', error: error.message });
  }
});

// DELETE: Xóa ảnh
router.delete('/:filename', auth, isAdmin, (req, res) => {
  try {
    const filename = req.params.filename;
    const filepath = path.join(__dirname, '../uploads', filename);

    // Kiểm tra file có tồn tại không
    if (fs.existsSync(filepath)) {
      fs.unlinkSync(filepath);
      res.json({ message: 'Xóa ảnh thành công!' });
    } else {
      res.status(404).json({ message: 'Không tìm thấy file ảnh!' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi xóa ảnh!', error: error.message });
  }
});

// Error handling middleware cho multer
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ message: 'File quá lớn! Giới hạn 5MB.' });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({ message: 'Quá nhiều file! Tối đa 10 ảnh.' });
    }
  }
  
  if (error.message) {
    return res.status(400).json({ message: error.message });
  }
  
  res.status(500).json({ message: 'Lỗi khi upload file!' });
});

module.exports = router;
