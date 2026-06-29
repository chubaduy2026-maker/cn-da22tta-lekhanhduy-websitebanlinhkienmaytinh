const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const passport = require('../config/passport');
const User = require('../models/User');
const Cart = require('../models/Cart');
const { auth } = require('../middleware/auth');

// Cấu hình nodemailer transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || 'Leduytctv2019@gmail.com',
    pass: process.env.EMAIL_PASS || 'your-app-password' // Cần tạo App Password từ Google
  }
});

// POST: Đăng ký user mới
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, phone, address } = req.body;

    // Kiểm tra email đã tồn tại
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'Email đã được sử dụng!' });
    }

    // Kiểm tra xem đây có phải user đầu tiên không
    const userCount = await User.countDocuments();
    const isFirstUser = userCount === 0;

    // Tạo user mới - User đầu tiên sẽ là admin
    const user = new User({
      name,
      email,
      password,
      phone,
      address,
      role: isFirstUser ? 'admin' : 'customer'
    });

    await user.save();

    // Tạo token
    const token = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET || 'your_jwt_secret_key_here',
      { expiresIn: '7d' }
    );

    // Thông báo đặc biệt nếu là admin đầu tiên
    const message = isFirstUser 
      ? 'Đăng ký thành công! Bạn là admin đầu tiên của hệ thống.' 
      : 'Đăng ký thành công!';

    res.status(201).json({
      message,
      user,
      token
    });
  } catch (error) {
    res.status(400).json({ message: 'Lỗi khi đăng ký!', error: error.message });
  }
});

// POST: Đăng nhập
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Tìm user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: 'Email hoặc mật khẩu không đúng!' });
    }

    // Kiểm tra tài khoản có active không
    if (!user.isActive) {
      return res.status(401).json({ message: 'Tài khoản đã bị khóa!' });
    }

    // Kiểm tra password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Email hoặc mật khẩu không đúng!' });
    }

    // Chuyển giỏ hàng từ session sang user (nếu có)
    const sessionId = req.headers['x-session-id'];
    if (sessionId) {
      try {
        const sessionCart = await Cart.findOne({ sessionId });
        if (sessionCart && sessionCart.items.length > 0) {
          // Tìm hoặc tạo cart của user
          let userCart = await Cart.findOne({ userId: user._id });
          
          if (userCart) {
            // Merge items từ session cart vào user cart
            for (const sessionItem of sessionCart.items) {
              const existingIndex = userCart.items.findIndex(
                item => item.product.toString() === sessionItem.product.toString()
              );
              
              if (existingIndex > -1) {
                userCart.items[existingIndex].quantity += sessionItem.quantity;
              } else {
                userCart.items.push(sessionItem);
              }
            }
          } else {
            // Chuyển session cart thành user cart
            sessionCart.userId = user._id;
            sessionCart.sessionId = null;
            userCart = sessionCart;
          }
          
          // Tính lại tổng tiền
          await userCart.populate('items.product');
          userCart.totalAmount = userCart.items.reduce((total, item) => {
            return total + (item.product.price * item.quantity);
          }, 0);
          
          await userCart.save();
          
          // Xóa session cart nếu đã chuyển thành user cart
          if (sessionCart._id.toString() !== userCart._id.toString()) {
            await Cart.deleteOne({ sessionId });
          }
        }
      } catch (cartError) {
        console.error('Lỗi khi chuyển giỏ hàng:', cartError);
        // Không block login nếu có lỗi cart
      }
    }

    // Tạo token
    const token = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET || 'your_jwt_secret_key_here',
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Đăng nhập thành công!',
      user,
      token
    });
  } catch (error) {
    res.status(400).json({ message: 'Lỗi khi đăng nhập!', error: error.message });
  }
});

// GET: Lấy thông tin user hiện tại
router.get('/me', auth, async (req, res) => {
  res.json(req.user);
});

// PUT: Cập nhật thông tin user
router.put('/profile', auth, async (req, res) => {
  try {
    const { name, phone, address, avatar } = req.body;
    const updates = {};

    if (name) updates.name = name;
    if (phone) updates.phone = phone;
    if (address) updates.address = address;
    if (avatar) updates.avatar = avatar;

    const user = await User.findByIdAndUpdate(
      req.user._id,
      updates,
      { new: true, runValidators: true }
    );

    res.json({ message: 'Cập nhật thông tin thành công!', user });
  } catch (error) {
    res.status(400).json({ message: 'Lỗi khi cập nhật!', error: error.message });
  }
});

// PUT: Đổi mật khẩu
router.put('/change-password', auth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(req.user._id);
    
    // Kiểm tra mật khẩu hiện tại
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({ message: 'Mật khẩu hiện tại không đúng!' });
    }

    // Cập nhật mật khẩu mới
    user.password = newPassword;
    await user.save();

    res.json({ message: 'Đổi mật khẩu thành công!' });
  } catch (error) {
    res.status(400).json({ message: 'Lỗi khi đổi mật khẩu!', error: error.message });
  }
});

// POST: Đăng xuất (client sẽ xóa token)
router.post('/logout', auth, (req, res) => {
  res.json({ message: 'Đăng xuất thành công!' });
});

// GET: Lấy tất cả reviews của user hiện tại
router.get('/reviews', auth, async (req, res) => {
  try {
    const Review = require('../models/Review');
    const reviews = await Review.find({ user: req.user._id })
      .populate('product', 'name images price')
      .sort({ createdAt: -1 });
    
    res.json({ reviews });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi lấy đánh giá!', error: error.message });
  }
});

// POST: Quên mật khẩu - Gửi email reset
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'Email không tồn tại trong hệ thống!' });
    }

    // Tạo reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    
    // Hash token và lưu vào database
    user.resetPasswordToken = crypto
      .createHash('sha256')
      .update(resetToken)
      .digest('hex');
    
    // Token có hiệu lực trong 1 giờ
    user.resetPasswordExpires = Date.now() + 60 * 60 * 1000;
    
    await user.save();

    // Tạo reset URL
    const resetUrl = `http://localhost:3000/reset-password/${resetToken}`;

    // Cấu hình email
    const mailOptions = {
      from: `"TechStore" <${process.env.EMAIL_USER || 'Leduytctv2019@gmail.com'}>`,
      to: user.email,
      subject: 'Đặt lại mật khẩu TechStore',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta name="color-scheme" content="light dark">
          <meta name="supported-color-schemes" content="light dark">
        </head>
        <body style="margin: 0; padding: 0; background: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;">
          <div style="max-width: 600px; margin: 0 auto; padding: 0; background: linear-gradient(135deg, #f0f4ff 0%, #e0e7ff 100%);">
            <div style="background: linear-gradient(135deg, #0080ff 0%, #00d4ff 100%); padding: 40px; text-align: center; box-shadow: 0 4px 20px rgba(0, 128, 255, 0.3);">
              <h1 style="color: #ffffff; margin: 0; font-size: 36px; text-shadow: 0 2px 10px rgba(0, 0, 0, 0.2); font-weight: 700;">🖥️ TechStore</h1>
            </div>
            <div style="padding: 40px 35px; background-color: #ffffff;">
              <h2 style="color: #000000; margin-top: 0; font-size: 24px; font-weight: 700;">Xin chào ${user.name},</h2>
              <p style="color: #000000; font-size: 16px; line-height: 1.8; margin: 16px 0;">Bạn đã yêu cầu đặt lại mật khẩu cho tài khoản TechStore của mình.</p>
              <p style="color: #000000; font-size: 16px; line-height: 1.8; margin: 16px 0;">Vui lòng click vào nút bên dưới để đặt lại mật khẩu:</p>
              <div style="text-align: center; margin: 40px 0;">
                <a href="${resetUrl}" style="background: linear-gradient(135deg, #0080ff 0%, #00d4ff 100%); color: #ffffff; padding: 18px 45px; text-decoration: none; border-radius: 10px; font-weight: bold; display: inline-block; font-size: 17px; box-shadow: 0 4px 20px rgba(0, 128, 255, 0.4); mso-hide: all;">✨ Đặt lại mật khẩu</a>
              </div>
              <div style="background-color: #e0f2ff; padding: 20px; border-radius: 10px; margin: 30px 0; border-left: 4px solid #0080ff;">
                <p style="color: #0066cc; font-size: 15px; margin: 0; font-weight: 700;">⏰ Link này sẽ hết hạn sau 1 giờ.</p>
              </div>
              <p style="color: #333333; font-size: 14px; margin: 16px 0;">Nếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này.</p>
              <div style="border-top: 2px solid #e5e7eb; margin: 35px 0 20px 0; padding-top: 20px;">
                <p style="color: #666666; font-size: 12px; text-align: center; margin: 0;">© 2025 TechStore. All rights reserved.</p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `
    };

    // Gửi email
    try {
      await transporter.sendMail(mailOptions);
      console.log('\n==============================================');
      console.log('📧 EMAIL RESET PASSWORD ĐÃ ĐƯỢC GỬI');
      console.log('==============================================');
      console.log(`Gửi đến: ${user.email}`);
      console.log(`Tên: ${user.name}`);
      console.log('==============================================\n');
    } catch (emailError) {
      console.error('Lỗi gửi email:', emailError);
      // Vẫn log link để debug nếu gửi email thất bại
      console.log('\n==============================================');
      console.log('⚠️ KHÔNG GỬI ĐƯỢC EMAIL - LINK RESET PASSWORD:');
      console.log('==============================================');
      console.log(`Link: ${resetUrl}`);
      console.log('==============================================\n');
    }

    res.json({ 
      message: 'Email đặt lại mật khẩu đã được gửi! Vui lòng kiểm tra hộp thư của bạn.'
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi gửi email reset!', error: error.message });
  }
});

// POST: Reset mật khẩu với token
router.post('/reset-password/:token', async (req, res) => {
  try {
    const { password } = req.body;

    // Hash token từ URL
    const resetPasswordToken = crypto
      .createHash('sha256')
      .update(req.params.token)
      .digest('hex');

    // Tìm user với token hợp lệ và chưa hết hạn
    const user = await User.findOne({
      resetPasswordToken,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ message: 'Token không hợp lệ hoặc đã hết hạn!' });
    }

    // Cập nhật mật khẩu mới
    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.json({ message: 'Đặt lại mật khẩu thành công! Vui lòng đăng nhập.' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi reset mật khẩu!', error: error.message });
  }
});

// ============= GOOGLE OAUTH =============

// Google login
router.get('/google',
  passport.authenticate('google', {
    scope: ['profile', 'email']
  })
);

// Google callback
router.get('/google/callback',
  passport.authenticate('google', { 
    session: false,
    failureRedirect: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/login?error=google_auth_failed`
  }),
  async (req, res) => {
    try {
      console.log('✅ Google auth success! User:', req.user.email);
      
      // Tạo JWT token với thông tin user cơ bản
      const token = jwt.sign(
        { 
          userId: req.user._id, 
          role: req.user.role,
          name: req.user.name,
          email: req.user.email,
          avatar: req.user.avatar
        },
        process.env.JWT_SECRET || 'your_jwt_secret_key_here',
        { expiresIn: '7d' }
      );

      // Chuyển giỏ hàng từ session sang user (nếu có)
      const sessionId = req.query.sessionId;
      if (sessionId) {
        try {
          const sessionCart = await Cart.findOne({ sessionId });
          if (sessionCart && sessionCart.items.length > 0) {
            let userCart = await Cart.findOne({ userId: req.user._id });
            
            if (userCart) {
              for (const sessionItem of sessionCart.items) {
                const existingIndex = userCart.items.findIndex(
                  item => item.product.toString() === sessionItem.product.toString()
                );
                
                if (existingIndex > -1) {
                  userCart.items[existingIndex].quantity += sessionItem.quantity;
                } else {
                  userCart.items.push(sessionItem);
                }
              }
              await userCart.save();
            } else {
              sessionCart.userId = req.user._id;
              sessionCart.sessionId = undefined;
              await sessionCart.save();
            }
            
            await Cart.deleteOne({ sessionId });
          }
        } catch (cartError) {
          console.error('Error merging carts:', cartError);
        }
      }

      // Redirect về frontend chỉ với token
      const frontendURL = process.env.FRONTEND_URL || 'http://localhost:3000';
      res.redirect(`${frontendURL}/auth/callback?token=${token}`);
    } catch (error) {
      console.error('❌ Google callback error:', error);
      res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/login?error=auth_failed`);
    }
  }
);

module.exports = router;
