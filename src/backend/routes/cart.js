const express = require('express');
const router = express.Router();
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const { optionalAuth } = require('../middleware/auth');

// Helper function để lấy userId hoặc sessionId
const getCartIdentifier = (req) => {
  // Nếu user đã đăng nhập, chỉ dùng userId, KHÔNG dùng sessionId
  if (req.userId) {
    return { userId: req.userId };
  }
  
  // Nếu chưa đăng nhập, lấy sessionId từ header hoặc tạo mới
  let sessionId = req.headers['x-session-id'];
  if (!sessionId || sessionId === 'null' || sessionId === 'undefined') {
    sessionId = `session-${Date.now()}-${Math.random()}`;
  }
  
  return { sessionId };
};

// GET: Lấy giỏ hàng (có thể có hoặc không có auth)
router.get('/', optionalAuth, async (req, res) => {
  try {
    const identifier = getCartIdentifier(req);
    
    // Tìm cart trước
    let cart = await Cart.findOne(identifier).populate('items.product');
    
    // Nếu chưa có, tạo mới
    if (!cart) {
      // Tạo object cart với chỉ field cần thiết
      const cartData = {
        items: [],
        totalAmount: 0
      };
      
      // Chỉ thêm field nào có giá trị
      if (identifier.userId) {
        cartData.userId = identifier.userId;
      }
      if (identifier.sessionId) {
        cartData.sessionId = identifier.sessionId;
      }
      
      try {
        cart = new Cart(cartData);
        await cart.save();
        await cart.populate('items.product');
      } catch (createError) {
        // Nếu bị lỗi duplicate key (race condition), tìm lại
        if (createError.code === 11000) {
          console.log('Duplicate key in GET /cart, finding existing');
          await new Promise(resolve => setTimeout(resolve, 50));
          cart = await Cart.findOne(identifier).populate('items.product');
          if (!cart) {
            // Vẫn không tìm thấy, tạo cart rỗng để trả về
            cart = { items: [], totalAmount: 0 };
          }
        } else {
          throw createError;
        }
      }
    }

    res.json(cart);
  } catch (error) {
    console.error('Lỗi GET cart:', error);
    res.status(500).json({ message: 'Lỗi khi lấy giỏ hàng', error: error.message });
  }
});

// POST: Thêm sản phẩm vào giỏ hàng
router.post('/add', optionalAuth, async (req, res) => {
  try {
    console.log('\n=== ADD TO CART ===');
    console.log('userId:', req.userId, 'type:', typeof req.userId);
    console.log('Body:', req.body);
    
    const { productId, quantity = 1 } = req.body;
    
    // Validate productId
    if (!productId) {
      return res.status(400).json({ message: 'Thiếu thông tin sản phẩm' });
    }
    
    const identifier = getCartIdentifier(req);
    console.log('Identifier:', identifier, 'userId type:', identifier.userId ? identifier.userId.constructor.name : 'N/A');

    // Kiểm tra sản phẩm có tồn tại
    const product = await Product.findById(productId);
    if (!product) {
      console.log('Product not found:', productId);
      return res.status(404).json({ message: 'Không tìm thấy sản phẩm' });
    }

    console.log('Product found:', product.name);

    // Kiểm tra tồn kho
    if (product.stock < quantity) {
      return res.status(400).json({ message: 'Sản phẩm không đủ hàng trong kho' });
    }

    let cart = await Cart.findOne(identifier);
    console.log('Existing cart:', cart ? cart._id : 'null');

    if (!cart) {
      // Tạo object cart với chỉ field cần thiết
      const cartData = {
        items: [],
        totalAmount: 0
      };
      
      // Chỉ thêm field nào có giá trị
      if (identifier.userId) {
        cartData.userId = identifier.userId;
      }
      if (identifier.sessionId) {
        cartData.sessionId = identifier.sessionId;
      }
      
      console.log('Creating cart with data:', cartData);
      
      // Thử tạo cart mới
      try {
        cart = new Cart(cartData);
        await cart.save();
        console.log('✅ Created new cart:', cart._id);
      } catch (createError) {
        console.error('❌ Error creating cart:', createError.message);
        
        // Nếu bị duplicate key, có thể cart vừa được tạo bởi request khác
        if (createError.code === 11000) {
          console.log('⚠️  Duplicate key - trying to find existing cart again...');
          // Đợi một chút rồi tìm lại
          await new Promise(resolve => setTimeout(resolve, 100));
          cart = await Cart.findOne(identifier);
          
          if (cart) {
            console.log('✅ Found existing cart after duplicate error:', cart._id);
          } else {
            console.error('❌ Still cannot find cart after duplicate error');
            return res.status(500).json({ 
              message: 'Lỗi khi tạo giỏ hàng. Vui lòng thử lại.',
              error: 'Database race condition'
            });
          }
        } else {
          // Lỗi khác không phải duplicate key
          throw createError;
        }
      }
    }

    // Kiểm tra sản phẩm đã có trong giỏ hàng chưa
    const existingItemIndex = cart.items.findIndex(
      item => item.product.toString() === productId
    );

    if (existingItemIndex > -1) {
      // Cập nhật số lượng
      const newQuantity = cart.items[existingItemIndex].quantity + quantity;
      if (newQuantity > product.stock) {
        return res.status(400).json({ 
          message: `Chỉ còn ${product.stock} sản phẩm trong kho` 
        });
      }
      cart.items[existingItemIndex].quantity = newQuantity;
    } else {
      // Thêm sản phẩm mới
      cart.items.push({ product: productId, quantity });
    }

    // Tính tổng tiền
    await cart.populate('items.product');
    cart.totalAmount = cart.items.reduce((total, item) => {
      return total + (item.product.price * item.quantity);
    }, 0);

    await cart.save();

    res.json({ message: 'Đã thêm sản phẩm vào giỏ hàng', cart });
  } catch (error) {
    console.error('Error in /cart/add:', error);
    res.status(500).json({ 
      message: 'Lỗi khi thêm vào giỏ hàng', 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// PUT: Cập nhật số lượng sản phẩm trong giỏ hàng
router.put('/update', optionalAuth, async (req, res) => {
  try {
    const { productId, quantity } = req.body;
    const identifier = getCartIdentifier(req);

    if (quantity < 1) {
      return res.status(400).json({ message: 'Số lượng phải lớn hơn 0' });
    }

    const cart = await Cart.findOne(identifier);
    if (!cart) {
      return res.status(404).json({ message: 'Không tìm thấy giỏ hàng' });
    }

    const itemIndex = cart.items.findIndex(
      item => item.product.toString() === productId
    );

    if (itemIndex === -1) {
      return res.status(404).json({ message: 'Sản phẩm không có trong giỏ hàng' });
    }

    cart.items[itemIndex].quantity = quantity;

    // Tính lại tổng tiền
    await cart.populate('items.product');
    cart.totalAmount = cart.items.reduce((total, item) => {
      return total + (item.product.price * item.quantity);
    }, 0);

    await cart.save();

    res.json({ message: 'Đã cập nhật giỏ hàng', cart });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi cập nhật giỏ hàng', error: error.message });
  }
});

// DELETE: Xóa sản phẩm khỏi giỏ hàng
router.delete('/remove/:productId', optionalAuth, async (req, res) => {
  try {
    const { productId } = req.params;
    const identifier = getCartIdentifier(req);

    const cart = await Cart.findOne(identifier);
    if (!cart) {
      return res.status(404).json({ message: 'Không tìm thấy giỏ hàng' });
    }

    cart.items = cart.items.filter(
      item => item.product.toString() !== productId
    );

    // Tính lại tổng tiền
    await cart.populate('items.product');
    cart.totalAmount = cart.items.reduce((total, item) => {
      return total + (item.product.price * item.quantity);
    }, 0);

    await cart.save();

    res.json({ message: 'Đã xóa sản phẩm khỏi giỏ hàng', cart });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi xóa sản phẩm', error: error.message });
  }
});

// DELETE: Xóa toàn bộ giỏ hàng
router.delete('/clear', optionalAuth, async (req, res) => {
  try {
    const identifier = getCartIdentifier(req);

    const cart = await Cart.findOne(identifier);
    if (!cart) {
      return res.status(404).json({ message: 'Không tìm thấy giỏ hàng' });
    }

    cart.items = [];
    cart.totalAmount = 0;
    await cart.save();

    res.json({ message: 'Đã xóa toàn bộ giỏ hàng', cart });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi xóa giỏ hàng', error: error.message });
  }
});

module.exports = router;
