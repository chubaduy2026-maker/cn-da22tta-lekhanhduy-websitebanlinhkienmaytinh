const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const { auth, optionalAuth, isStaffOrAdmin } = require('../middleware/auth');

// POST: Tạo đơn hàng mới
router.post('/', optionalAuth, async (req, res) => {
  try {
    console.log('📦 Creating order with data:', JSON.stringify(req.body, null, 2));
    const { customerInfo, paymentMethod, note, buyNowItem } = req.body;
    const sessionId = req.headers['x-session-id'];

    // Lấy userId từ middleware nếu user đã đăng nhập
    const userId = req.userId || null;

    let orderItems = [];
    let totalAmount = 0;

    // Trường hợp 1: Mua ngay (không qua giỏ hàng)
    if (buyNowItem) {
      const { productId, quantity } = buyNowItem;

      const product = await Product.findById(productId);
      if (!product) {
        return res.status(404).json({ message: 'Sản phẩm không tồn tại' });
      }

      if (product.stock < quantity) {
        return res.status(400).json({
          message: `Sản phẩm ${product.name} không đủ hàng. Còn ${product.stock} sản phẩm`
        });
      }

      orderItems.push({
        product: product._id,
        name: product.name,
        price: product.price,
        costPrice: product.costPrice || 0,
        quantity: quantity,
        image: product.image
      });

      totalAmount = product.price * quantity;

      // Giảm số lượng tồn kho
      product.stock -= quantity;
      await product.save();
    }
    // Trường hợp 2: Thanh toán từ giỏ hàng
    else {
      if (!sessionId) {
        return res.status(400).json({ message: 'Không tìm thấy session ID' });
      }

      // Tìm giỏ hàng theo userId (nếu đã đăng nhập) hoặc sessionId
      let cart;
      if (userId) {
        cart = await Cart.findOne({ userId }).populate('items.product');
        // Nếu không tìm thấy cart theo userId, thử tìm theo sessionId
        if (!cart) {
          cart = await Cart.findOne({ sessionId }).populate('items.product');
        }
      } else {
        cart = await Cart.findOne({ sessionId }).populate('items.product');
      }

      if (!cart || cart.items.length === 0) {
        return res.status(400).json({ message: 'Giỏ hàng trống' });
      }

      // Kiểm tra tồn kho và tạo items cho đơn hàng
      for (const item of cart.items) {
        const product = await Product.findById(item.product._id);

        if (!product) {
          return res.status(404).json({ message: `Sản phẩm ${item.product.name} không tồn tại` });
        }

        if (product.stock < item.quantity) {
          return res.status(400).json({
            message: `Sản phẩm ${product.name} không đủ hàng. Còn ${product.stock} sản phẩm`
          });
        }

        orderItems.push({
          product: product._id,
          name: product.name,
          price: product.price,
          costPrice: product.costPrice || 0,
          quantity: item.quantity,
          image: product.image
        });

        totalAmount += product.price * item.quantity;

        // Giảm số lượng tồn kho
        product.stock -= item.quantity;
        await product.save();
      }

      // Xóa giỏ hàng sau khi đặt hàng thành công
      cart.items = [];
      cart.totalAmount = 0;
      await cart.save();
    }

    // Tạo mã đơn hàng
    const orderNumber = `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    // Tạo đơn hàng
    const order = new Order({
      orderNumber,
      user: userId, // Lưu userId nếu có
      items: orderItems,
      customerInfo,
      totalAmount,
      paymentMethod,
      note,
      status: paymentMethod === 'ZaloPay' ? 'pending' : 'pending',
      paymentStatus: paymentMethod === 'ZaloPay' ? 'Pending' : 'Pending'
    });

    await order.save();

    console.log('✅ Order created successfully:', order._id);

    res.status(201).json({
      message: 'Đặt hàng thành công!',
      order
    });

  } catch (error) {
    console.error('❌ Error creating order:', error);
    res.status(500).json({ message: 'Lỗi khi tạo đơn hàng', error: error.message });
  }
});

// GET: Lấy danh sách đơn hàng của user hiện tại
router.get('/', auth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Chỉ lấy đơn hàng của user hiện tại
    const orders = await Order.find({ user: req.userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('items.product');

    const total = await Order.countDocuments({ user: req.userId });

    res.json({
      orders,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalOrders: total
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi lấy danh sách đơn hàng', error: error.message });
  }
});

// GET: Lấy chi tiết đơn hàng theo ID (chỉ của user hiện tại)
router.get('/:id', auth, async (req, res) => {
  try {
    const order = await Order.findOne({
      _id: req.params.id,
      user: req.userId // Chỉ cho phép xem đơn hàng của chính mình
    }).populate('items.product');

    if (!order) {
      return res.status(404).json({ message: 'Không tìm thấy đơn hàng' });
    }

    res.json(order);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi lấy thông tin đơn hàng', error: error.message });
  }
});

// GET: Tìm đơn hàng theo mã đơn hàng
router.get('/tracking/:orderNumber', async (req, res) => {
  try {
    const order = await Order.findOne({ orderNumber: req.params.orderNumber })
      .populate('items.product');

    if (!order) {
      return res.status(404).json({ message: 'Không tìm thấy đơn hàng' });
    }

    res.json(order);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi tra cứu đơn hàng', error: error.message });
  }
});

// PUT: Cập nhật trạng thái đơn hàng (Admin/Staff)
router.put('/:id/status', auth, isStaffOrAdmin, async (req, res) => {
  try {
    const { status } = req.body;

    const validStatuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: 'Trạng thái không hợp lệ' });
    }

    const order = await Order.findById(req.params.id).populate('items.product');

    if (!order) {
      return res.status(404).json({ message: 'Không tìm thấy đơn hàng' });
    }

    // Nếu đơn hàng bị hủy, hoàn trả số lượng sản phẩm vào kho
    if (status === 'cancelled' && order.status !== 'cancelled') {
      for (const item of order.items) {
        const product = await Product.findById(item.product._id);
        if (product) {
          product.stock += item.quantity;
          await product.save();
        }
      }
    }

    order.status = status;
    await order.save();

    res.json({ message: 'Cập nhật trạng thái thành công', order });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi cập nhật trạng thái', error: error.message });
  }
});

// PUT: Xác nhận giao hàng thành công (Admin/Staff)
router.put('/:id/deliver', auth, isStaffOrAdmin, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ message: 'Không tìm thấy đơn hàng' });
    }

    // Kiểm tra trạng thái hiện tại
    if (order.status === 'delivered') {
      return res.status(400).json({ message: 'Đơn hàng đã được giao' });
    }

    if (order.status === 'cancelled') {
      return res.status(400).json({ message: 'Không thể giao đơn hàng đã hủy' });
    }

    // Cập nhật trạng thái thành delivered
    order.status = 'delivered';
    order.deliveredAt = new Date();
    await order.save();

    res.json({
      message: 'Đã xác nhận giao hàng thành công',
      order
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi xác nhận giao hàng', error: error.message });
  }
});

// PUT: Hủy đơn hàng (User/Admin/Staff)
router.put('/:id/cancel', auth, async (req, res) => {
  try {
    const { reason } = req.body;
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ message: 'Không tìm thấy đơn hàng' });
    }

    // Kiểm tra trạng thái hiện tại
    if (order.status === 'cancelled') {
      return res.status(400).json({ message: 'Đơn hàng đã được hủy trước đó' });
    }

    if (order.status === 'delivered') {
      return res.status(400).json({ message: 'Không thể hủy đơn hàng đã giao' });
    }

    // Hoàn trả số lượng sản phẩm vào kho
    for (const item of order.items) {
      const product = await Product.findById(item.product);
      if (product) {
        product.stock += item.quantity;
        await product.save();
      }
    }

    // Cập nhật trạng thái thành cancelled
    order.status = 'cancelled';
    order.cancelledAt = new Date();
    order.cancelReason = reason || 'Không có lý do';
    await order.save();

    res.json({
      message: 'Đã hủy đơn hàng và hoàn trả sản phẩm vào kho',
      order
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi hủy đơn hàng', error: error.message });
  }
});

// PUT: Xác nhận thanh toán thành công (cho ZaloPay callback - không cần admin)
router.put('/:id/payment-success', optionalAuth, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ message: 'Không tìm thấy đơn hàng' });
    }

    // Chỉ cho phép cập nhật nếu đơn hàng đang pending
    if (order.status !== 'pending') {
      return res.status(400).json({ message: 'Đơn hàng đã được xử lý' });
    }

    // Cập nhật trạng thái thanh toán
    order.status = 'processing';
    order.paymentStatus = 'Paid';
    order.paidAt = new Date();
    await order.save();

    res.json({ 
      message: 'Xác nhận thanh toán thành công', 
      order 
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi xác nhận thanh toán', error: error.message });
  }
});

// PUT: Hủy đơn hàng bởi khách hàng (không cần admin)
router.put('/:id/customer-cancel', optionalAuth, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).populate('items.product');

    if (!order) {
      return res.status(404).json({ message: 'Không tìm thấy đơn hàng' });
    }

    // Chỉ cho phép hủy nếu đơn hàng đang pending hoặc processing
    if (order.status !== 'pending' && order.status !== 'processing') {
      return res.status(400).json({ message: 'Không thể hủy đơn hàng này' });
    }

    // Hoàn trả số lượng sản phẩm vào kho
    for (const item of order.items) {
      const product = await Product.findById(item.product._id || item.product);
      if (product) {
        product.stock += item.quantity;
        await product.save();
      }
    }

    order.status = 'cancelled';
    order.cancelledAt = new Date();
    order.cancelReason = 'Khách hàng hủy đơn';
    await order.save();

    res.json({ 
      message: 'Đã hủy đơn hàng', 
      order 
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi hủy đơn hàng', error: error.message });
  }
});

module.exports = router;
