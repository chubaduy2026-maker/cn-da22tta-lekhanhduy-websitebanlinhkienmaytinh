const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Product = require('../models/Product');
const Order = require('../models/Order');
const Review = require('../models/Review');
const { auth, isAdmin, isStaffOrAdmin } = require('../middleware/auth');

// Note: Removed global router.use(auth, isAdmin) to allow granular permissions

// GET: Dashboard statistics (Admin Only)
router.get('/stats', auth, isAdmin, async (req, res) => {
  try {
    const totalUsers = await User.countDocuments({ role: 'customer' });
    const totalProducts = await Product.countDocuments();
    // Chỉ đếm đơn hàng chưa bị hủy
    const totalOrders = await Order.countDocuments({ status: { $ne: 'cancelled' } });

    const financialStats = await Order.aggregate([
      { $match: { status: 'delivered' } },
      { $unwind: '$items' },
      {
        $group: {
          _id: null,
          revenue: {
            $sum: {
              $multiply: [
                { $ifNull: ['$items.quantity', 0] },
                { $ifNull: ['$items.price', 0] }
              ]
            }
          },
          totalCost: {
            $sum: {
              $multiply: [
                { $ifNull: ['$items.quantity', 0] },
                { $ifNull: ['$items.costPrice', 0] }
              ]
            }
          }
        }
      }
    ]);

    const revenue = financialStats[0]?.revenue || 0;
    const totalCost = financialStats[0]?.totalCost || 0;
    const profit = revenue - totalCost;

    const pendingOrders = await Order.countDocuments({ status: 'pending' });
    const lowStockProducts = await Product.countDocuments({ stock: { $lte: 1 } });

    res.json({
      totalUsers,
      totalProducts,
      totalOrders,
      totalRevenue: revenue,
      revenue,
      totalCost,
      profit,
      pendingOrders,
      lowStockProducts
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi lấy thống kê!', error: error.message });
  }
});

// USER MANAGEMENT (ADMIN ONLY)
// GET: Lấy danh sách users
router.get('/users', auth, isAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const users = await User.find()
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });

    const total = await User.countDocuments();

    res.json({
      users,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalUsers: total
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi lấy danh sách users!', error: error.message });
  }
});

// PUT: Cập nhật role user
router.put('/users/:id/role', auth, isAdmin, async (req, res) => {
  try {
    const { role } = req.body;

    if (!['customer', 'admin', 'staff'].includes(role)) {
      return res.status(400).json({ message: 'Role không hợp lệ!' });
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { role },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ message: 'Không tìm thấy user!' });
    }

    res.json({ message: 'Cập nhật role thành công!', user });
  } catch (error) {
    res.status(400).json({ message: 'Lỗi khi cập nhật!', error: error.message });
  }
});

// PUT: Khóa/Mở khóa user
router.put('/users/:id/toggle-status', auth, isAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: 'Không tìm thấy user!' });
    }

    user.isActive = !user.isActive;
    await user.save();

    res.json({
      message: user.isActive ? 'Đã mở khóa user!' : 'Đã khóa user!',
      user
    });
  } catch (error) {
    res.status(400).json({ message: 'Lỗi khi cập nhật!', error: error.message });
  }
});

// DELETE: Xóa user và tất cả đơn hàng liên quan
router.delete('/users/:id', auth, isAdmin, async (req, res) => {
  try {
    const userId = req.params.id;

    // Xóa tất cả đơn hàng của user này
    const deletedOrders = await Order.deleteMany({ user: userId });

    // Xóa user
    const user = await User.findByIdAndDelete(userId);

    if (!user) {
      return res.status(404).json({ message: 'Không tìm thấy user!' });
    }

    res.json({
      message: 'Đã xóa user và tất cả đơn hàng liên quan!',
      deletedOrdersCount: deletedOrders.deletedCount
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi xóa user!', error: error.message });
  }
});

// ORDER MANAGEMENT - Enhanced (Admin/Staff)
// GET: Lấy tất cả đơn hàng với filter
router.get('/orders', auth, isStaffOrAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const status = req.query.status;

    let filter = {};
    if (status) filter.status = status;

    const orders = await Order.find(filter)
      .populate('items.product')
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });

    const total = await Order.countDocuments(filter);

    res.json({
      orders,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalOrders: total
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi lấy đơn hàng!', error: error.message });
  }
});

// DELETE: Xóa đơn hàng (Admin Only - sensitive action)
router.delete('/orders/:id', auth, isAdmin, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ message: 'Không tìm thấy đơn hàng!' });
    }

    // Nếu đơn hàng chưa giao hoặc đã hủy, hoàn trả sản phẩm vào kho
    if (order.status !== 'delivered' && order.status !== 'cancelled') {
      for (const item of order.items) {
        const product = await Product.findById(item.product);
        if (product) {
          product.stock += item.quantity;
          await product.save();
        }
      }
    }

    await Order.findByIdAndDelete(req.params.id);

    res.json({ message: 'Đã xóa đơn hàng!' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi xóa đơn hàng!', error: error.message });
  }
});

// ==================== REVIEW MANAGEMENT (Admin/Staff) ====================

// GET: Lấy tất cả đánh giá với filter
router.get('/reviews', auth, isStaffOrAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const { rating, status } = req.query;

    let filter = {};
    if (rating) filter.rating = parseInt(rating);
    if (status) filter.status = status;

    const reviews = await Review.find(filter)
      .populate('user', 'name email')
      .populate('product', 'name images price originalPrice')
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });

    const total = await Review.countDocuments(filter);

    // Thống kê
    const stats = {
      total: await Review.countDocuments(),
      approved: await Review.countDocuments({ status: 'approved' }),
      pending: await Review.countDocuments({ status: 'pending' }),
      rejected: await Review.countDocuments({ status: 'rejected' }),
      avgRating: await Review.aggregate([
        { $group: { _id: null, avg: { $avg: '$rating' } } }
      ]).then(r => r[0]?.avg?.toFixed(1) || 0)
    };

    res.json({
      reviews,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalReviews: total,
      stats
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi lấy đánh giá!', error: error.message });
  }
});

// PUT: Cập nhật trạng thái đánh giá (Admin/Staff)
router.put('/reviews/:id/status', auth, isStaffOrAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    const review = await Review.findById(req.params.id);
    if (!review) {
      return res.status(404).json({ message: 'Không tìm thấy đánh giá!' });
    }

    review.status = status || (review.status === 'approved' ? 'rejected' : 'approved');
    await review.save();

    const messages = {
      approved: 'Đã duyệt đánh giá!',
      rejected: 'Đã từ chối đánh giá!',
      pending: 'Đã chuyển về chờ duyệt!'
    };

    res.json({
      message: messages[review.status] || 'Đã cập nhật!',
      review
    });
  } catch (error) {
    res.status(400).json({ message: 'Lỗi khi cập nhật!', error: error.message });
  }
});

// DELETE: Xóa đánh giá (Admin/Staff)
router.delete('/reviews/:id', auth, isStaffOrAdmin, async (req, res) => {
  try {
    const review = await Review.findByIdAndDelete(req.params.id);
    if (!review) {
      return res.status(404).json({ message: 'Không tìm thấy đánh giá!' });
    }

    // Cập nhật rating trung bình cho sản phẩm sau khi xóa review
    const mongoose = require('mongoose');
    const stats = await Review.aggregate([
      {
        $match: {
          product: review.product,
          status: 'approved'
        }
      },
      {
        $group: {
          _id: null,
          averageRating: { $avg: '$rating' },
          totalReviews: { $sum: 1 }
        }
      }
    ]);

    const rating = stats.length > 0 ? Math.round(stats[0].averageRating * 10) / 10 : 0;
    const reviewCount = stats.length > 0 ? stats[0].totalReviews : 0;

    await Product.findByIdAndUpdate(review.product, {
      rating: rating,
      reviewCount: reviewCount
    });

    res.json({ message: 'Đã xóa đánh giá!' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi xóa đánh giá!', error: error.message });
  }
});

// POST: Cập nhật rating cho tất cả sản phẩm (sync từ reviews) - Admin Only
router.post('/sync-ratings', auth, isAdmin, async (req, res) => {
  try {
    const mongoose = require('mongoose');
    const products = await Product.find({});
    let updated = 0;

    for (const product of products) {
      const stats = await Review.aggregate([
        {
          $match: {
            product: product._id,
            status: 'approved'
          }
        },
        {
          $group: {
            _id: null,
            averageRating: { $avg: '$rating' },
            totalReviews: { $sum: 1 }
          }
        }
      ]);

      const rating = stats.length > 0 ? Math.round(stats[0].averageRating * 10) / 10 : 0;
      const reviewCount = stats.length > 0 ? stats[0].totalReviews : 0;

      await Product.findByIdAndUpdate(product._id, {
        rating: rating,
        reviewCount: reviewCount
      });
      updated++;
    }

    res.json({
      message: `Đã cập nhật rating cho ${updated} sản phẩm!`,
      updated
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi đồng bộ rating!', error: error.message });
  }
});

module.exports = router;
