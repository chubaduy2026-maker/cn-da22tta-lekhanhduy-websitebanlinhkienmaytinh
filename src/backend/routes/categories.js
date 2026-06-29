const express = require('express');
const router = express.Router();
const Category = require('../models/Category');
const Product = require('../models/Product');
const SUBCATEGORIES = require('./subcategories');
const { auth, isAdmin } = require('../middleware/auth');

// GET: Lấy tất cả danh mục (public)
router.get('/', async (req, res) => {
  try {
    const categories = await Category.find({ isActive: true })
      .sort({ order: 1, name: 1 });

    res.json(categories);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi lấy danh mục!', error: error.message });
  }
});

// GET: Lấy tất cả danh mục (admin - bao gồm cả inactive)
router.get('/all', auth, isAdmin, async (req, res) => {
  try {
    const categories = await Category.find()
      .sort({ order: 1, name: 1 });

    // Đếm số sản phẩm cho mỗi danh mục
    const categoriesWithCount = await Promise.all(
      categories.map(async (category) => {
        const productCount = await Product.countDocuments({ category: category.name });
        return {
          ...category.toObject(),
          productCount
        };
      })
    );

    res.json(categoriesWithCount);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi lấy danh mục!', error: error.message });
  }
});

// GET: Lấy chi tiết danh mục
router.get('/:id', async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);

    if (!category) {
      return res.status(404).json({ message: 'Không tìm thấy danh mục!' });
    }

    res.json(category);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi lấy danh mục!', error: error.message });
  }
});

// POST: Tạo danh mục mới (admin only)
router.post('/', auth, isAdmin, async (req, res) => {
  try {
    const { name, description, icon, order } = req.body;

    // Kiểm tra tên đã tồn tại
    const existingCategory = await Category.findOne({ name });
    if (existingCategory) {
      return res.status(400).json({ message: 'Tên danh mục đã tồn tại!' });
    }

    // Tạo slug từ name
    const slug = name
      .toLowerCase()
      .replace(/đ/g, 'd')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    const category = new Category({
      name,
      slug,
      description,
      icon: icon || '📦',
      order: order || 0
    });

    await category.save();

    res.status(201).json({
      message: 'Tạo danh mục thành công!',
      category
    });
  } catch (error) {
    res.status(400).json({ message: 'Lỗi khi tạo danh mục!', error: error.message });
  }
});

// PUT: Cập nhật danh mục (admin only)
router.put('/:id', auth, isAdmin, async (req, res) => {
  try {
    const { name, description, icon, order, isActive } = req.body;

    const category = await Category.findById(req.params.id);

    if (!category) {
      return res.status(404).json({ message: 'Không tìm thấy danh mục!' });
    }

    // Kiểm tra tên mới có trùng với danh mục khác không
    if (name && name !== category.name) {
      const existingCategory = await Category.findOne({ name });
      if (existingCategory) {
        return res.status(400).json({ message: 'Tên danh mục đã tồn tại!' });
      }

      // Cập nhật slug khi tên thay đổi
      category.slug = name
        .toLowerCase()
        .replace(/đ/g, 'd')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    }

    // Cập nhật các trường
    if (name) category.name = name;
    if (description !== undefined) category.description = description;
    if (icon) category.icon = icon;
    if (order !== undefined) category.order = order;
    if (isActive !== undefined) category.isActive = isActive;

    await category.save();

    res.json({
      message: 'Cập nhật danh mục thành công!',
      category
    });
  } catch (error) {
    res.status(400).json({ message: 'Lỗi khi cập nhật danh mục!', error: error.message });
  }
});

// DELETE: Xóa danh mục (admin only)
router.delete('/:id', auth, isAdmin, async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);

    if (!category) {
      return res.status(404).json({ message: 'Không tìm thấy danh mục!' });
    }

    // Kiểm tra xem có sản phẩm nào đang dùng danh mục này không
    const productCount = await Product.countDocuments({ category: category.name });

    if (productCount > 0) {
      return res.status(400).json({
        message: `Không thể xóa! Có ${productCount} sản phẩm đang sử dụng danh mục này.`
      });
    }

    await Category.findByIdAndDelete(req.params.id);

    res.json({ message: 'Xóa danh mục thành công!' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi xóa danh mục!', error: error.message });
  }
});

// GET: Lấy danh mục con theo danh mục chính
router.get('/subcategories/:category', (req, res) => {
  try {
    const category = req.params.category;
    const subcategories = SUBCATEGORIES[category] || [];

    res.json(subcategories);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi lấy danh mục con!', error: error.message });
  }
});

module.exports = router;
