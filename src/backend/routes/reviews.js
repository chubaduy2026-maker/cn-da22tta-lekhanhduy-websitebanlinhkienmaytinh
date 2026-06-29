const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Review = require('../models/Review');
const Product = require('../models/Product');
const Order = require('../models/Order');
const { auth, optionalAuth } = require('../middleware/auth');

// Helper function: Cập nhật rating trung bình cho sản phẩm
const updateProductRating = async (productId) => {
  try {
    const stats = await Review.aggregate([
      { 
        $match: { 
          product: new mongoose.Types.ObjectId(productId),
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

    await Product.findByIdAndUpdate(productId, { 
      rating: rating,
      reviewCount: reviewCount
    });

    console.log(`📊 Updated product ${productId} rating: ${rating} (${reviewCount} reviews)`);
    return { rating, reviewCount };
  } catch (error) {
    console.error('Error updating product rating:', error);
  }
};

// Helper function: Tạo câu trả lời tự động dựa trên rating và nội dung đánh giá
const generateAutoReply = (rating, userName, productName) => {
  const firstName = userName?.split(' ').pop() || 'Quý khách';
  
  // Các mẫu câu trả lời theo mức rating
  const replies = {
    5: [
      `Cảm ơn ${firstName} đã tin tưởng và đánh giá 5 sao cho sản phẩm! 🌟 TechStore rất vui khi sản phẩm đáp ứng được kỳ vọng của bạn. Chúc bạn có trải nghiệm tuyệt vời với ${productName}! Hẹn gặp lại bạn trong những đơn hàng tiếp theo! 💙`,
      `TechStore xin chân thành cảm ơn ${firstName} đã dành 5 sao cho sản phẩm! ⭐ Sự hài lòng của bạn là động lực để chúng tôi tiếp tục cải thiện. Rất mong được phục vụ bạn trong tương lai! 🙏`,
      `Wow! Cảm ơn ${firstName} đã đánh giá 5 sao tuyệt vời! 🎉 TechStore rất hạnh phúc khi mang đến cho bạn sản phẩm chất lượng. Đừng quên ghé thăm shop để khám phá thêm nhiều sản phẩm hay nhé! 💙`
    ],
    4: [
      `Cảm ơn ${firstName} đã đánh giá 4 sao! ⭐ TechStore rất vui vì bạn hài lòng với sản phẩm. Nếu có bất kỳ góp ý nào để chúng tôi hoàn thiện hơn, đừng ngại liên hệ nhé! Chúc bạn sử dụng sản phẩm vui vẻ! 💙`,
      `TechStore cảm ơn ${firstName} đã tin tưởng! 🌟 Đánh giá 4 sao của bạn là nguồn động viên lớn cho shop. Hy vọng ${productName} sẽ phục vụ bạn tốt. Hẹn gặp lại! 🙏`
    ],
    3: [
      `Cảm ơn ${firstName} đã dành thời gian đánh giá! TechStore ghi nhận feedback của bạn và sẽ cố gắng cải thiện. Nếu có bất kỳ vấn đề gì, vui lòng liên hệ hotline 1900-xxxx để được hỗ trợ tốt nhất nhé! 💙`,
      `TechStore xin cảm ơn phản hồi của ${firstName}! Chúng tôi luôn lắng nghe và cải thiện chất lượng dịch vụ. Nếu cần hỗ trợ thêm về ${productName}, đừng ngại inbox shop nhé! 🙏`
    ],
    2: [
      `TechStore rất tiếc khi trải nghiệm của ${firstName} chưa được tốt. 😔 Chúng tôi sẽ ghi nhận góp ý và cải thiện. Vui lòng liên hệ hotline 1900-xxxx hoặc inbox shop để được hỗ trợ giải quyết vấn đề nhé! 💙`,
      `Cảm ơn ${firstName} đã phản hồi! TechStore rất lấy làm tiếc và mong muốn hỗ trợ bạn. Xin vui lòng liên hệ bộ phận CSKH để chúng tôi có thể giúp đỡ bạn tốt hơn! 🙏`
    ],
    1: [
      `TechStore thành thật xin lỗi ${firstName} vì trải nghiệm không tốt! 😢 Chúng tôi rất quan tâm đến phản hồi của bạn. Vui lòng liên hệ ngay hotline 0348137209 để được hỗ trợ và giải quyết vấn đề. TechStore cam kết sẽ cố gắng hết sức! 💙`,
      `TechStore xin gửi lời xin lỗi chân thành đến ${firstName}! Feedback của bạn rất quan trọng với chúng tôi. Shop sẽ liên hệ trực tiếp để hỗ trợ bạn. Cảm ơn bạn đã cho chúng tôi cơ hội cải thiện! 🙏`
    ]
  };

  // Chọn ngẫu nhiên một câu trả lời từ danh sách
  const replyOptions = replies[rating] || replies[3];
  const randomIndex = Math.floor(Math.random() * replyOptions.length);
  
  return replyOptions[randomIndex];
};

// GET: Lấy danh sách reviews của một sản phẩm
router.get('/product/:productId', async (req, res) => {
  try {
    const { productId } = req.params;
    const { page = 1, limit = 10, sort = 'recent' } = req.query;

    let sortOption = {};
    switch (sort) {
      case 'recent':
        sortOption = { createdAt: -1 };
        break;
      case 'oldest':
        sortOption = { createdAt: 1 };
        break;
      case 'highest':
        sortOption = { rating: -1, createdAt: -1 };
        break;
      case 'lowest':
        sortOption = { rating: 1, createdAt: -1 };
        break;
      case 'helpful':
        sortOption = { helpful: -1, createdAt: -1 };
        break;
      default:
        sortOption = { createdAt: -1 };
    }

    const reviews = await Review.find({ 
      product: productId,
      status: 'approved'
    })
      .populate('user', 'name email')
      .sort(sortOption)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const count = await Review.countDocuments({ 
      product: productId,
      status: 'approved'
    });

    // Tính rating trung bình
    const stats = await Review.aggregate([
      { 
        $match: { 
          product: new mongoose.Types.ObjectId(productId),
          status: 'approved'
        } 
      },
      {
        $group: {
          _id: null,
          averageRating: { $avg: '$rating' },
          totalReviews: { $sum: 1 },
          ratings: {
            $push: '$rating'
          }
        }
      }
    ]);

    // Đếm số lượng mỗi loại rating
    const ratingCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    if (stats.length > 0 && stats[0].ratings) {
      stats[0].ratings.forEach(rating => {
        ratingCounts[rating] = (ratingCounts[rating] || 0) + 1;
      });
    }

    res.json({
      reviews,
      totalPages: Math.ceil(count / limit),
      currentPage: parseInt(page),
      totalReviews: count,
      averageRating: stats.length > 0 ? stats[0].averageRating : 0,
      ratingCounts
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi lấy đánh giá', error: error.message });
  }
});

// GET: Kiểm tra user có thể đánh giá sản phẩm không
router.get('/can-review/:productId', auth, async (req, res) => {
  try {
    const { productId } = req.params;
    
    // Kiểm tra user đã mua và nhận sản phẩm này chưa
    const userOrders = await Order.find({
      user: req.userId,
      status: 'delivered',
      'items.product': productId
    });

    if (userOrders.length === 0) {
      return res.json({ 
        canReview: false, 
        reason: 'not_purchased',
        message: 'Bạn cần mua và nhận sản phẩm này trước khi đánh giá' 
      });
    }

    // Kiểm tra user đã đánh giá chưa
    const existingReview = await Review.findOne({
      product: productId,
      user: req.userId
    });

    if (existingReview) {
      return res.json({ 
        canReview: false, 
        reason: 'already_reviewed',
        message: 'Bạn đã đánh giá sản phẩm này rồi',
        existingReview
      });
    }

    res.json({ 
      canReview: true,
      message: 'Bạn có thể đánh giá sản phẩm này'
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi kiểm tra', error: error.message });
  }
});

// POST: Tạo review mới (yêu cầu đăng nhập và đã mua hàng)
router.post('/', auth, async (req, res) => {
  try {
    const { productId, rating, comment, images, orderId } = req.body;

    // Kiểm tra sản phẩm có tồn tại
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: 'Không tìm thấy sản phẩm' });
    }

    // Kiểm tra user đã mua và nhận sản phẩm này chưa (BẮT BUỘC)
    const userOrders = await Order.find({
      user: req.userId,
      status: 'delivered',
      'items.product': productId
    });

    if (userOrders.length === 0) {
      return res.status(403).json({ 
        message: 'Bạn cần mua và nhận sản phẩm này trước khi đánh giá' 
      });
    }

    // Kiểm tra user đã đánh giá sản phẩm này chưa
    const existingReview = await Review.findOne({
      product: productId,
      user: req.userId
    });

    if (existingReview) {
      return res.status(400).json({ 
        message: 'Bạn đã đánh giá sản phẩm này rồi. Vui lòng sửa đánh giá cũ nếu muốn thay đổi.' 
      });
    }

    // Tạo review mới
    const review = new Review({
      product: productId,
      user: req.userId,
      order: orderId || userOrders[0]._id,
      rating,
      comment,
      images: images || [],
      verified: true // Đã xác nhận mua hàng
    });

    await review.save();

    // Populate user info để lấy tên
    await review.populate('user', 'name email');

    // Tạo câu trả lời tự động từ admin
    const autoReply = generateAutoReply(rating, review.user.name, product.name);
    review.adminReply = {
      content: autoReply,
      repliedAt: new Date(),
      repliedBy: 'TechStore'
    };
    await review.save();

    // Cập nhật rating trung bình cho sản phẩm
    await updateProductRating(productId);

    console.log(`✅ Auto-reply generated for review by ${review.user.name} (Rating: ${rating})`);

    res.status(201).json({ 
      message: 'Đánh giá thành công', 
      review 
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi tạo đánh giá', error: error.message });
  }
});

// PUT: Cập nhật review (chỉ người tạo)
router.put('/:id', auth, async (req, res) => {
  try {
    const { rating, comment, images } = req.body;

    const review = await Review.findOne({
      _id: req.params.id,
      user: req.userId
    }).populate('product', 'name');

    if (!review) {
      return res.status(404).json({ message: 'Không tìm thấy đánh giá hoặc bạn không có quyền chỉnh sửa' });
    }

    const oldRating = review.rating;
    review.rating = rating || review.rating;
    review.comment = comment || review.comment;
    review.images = images || review.images;

    // Populate user info để lấy tên
    await review.populate('user', 'name email');

    // Nếu rating thay đổi, cập nhật lại phản hồi tự động
    if (rating && rating !== oldRating) {
      const autoReply = generateAutoReply(review.rating, review.user.name, review.product.name);
      review.adminReply = {
        content: autoReply,
        repliedAt: new Date(),
        repliedBy: 'TechStore'
      };
      console.log(`🔄 Auto-reply updated for review by ${review.user.name} (Rating: ${oldRating} → ${rating})`);
    }

    await review.save();
    
    // Cập nhật rating trung bình cho sản phẩm
    await updateProductRating(review.product._id || review.product);

    res.json({ message: 'Cập nhật đánh giá thành công', review });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi cập nhật đánh giá', error: error.message });
  }
});

// DELETE: Xóa review (chỉ người tạo)
router.delete('/:id', auth, async (req, res) => {
  try {
    const review = await Review.findOne({
      _id: req.params.id,
      user: req.userId
    });

    if (!review) {
      return res.status(404).json({ message: 'Không tìm thấy đánh giá hoặc bạn không có quyền xóa' });
    }

    const productId = review.product;
    await review.deleteOne();

    // Cập nhật rating trung bình cho sản phẩm
    await updateProductRating(productId);

    res.json({ message: 'Xóa đánh giá thành công' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi xóa đánh giá', error: error.message });
  }
});

// POST: Đánh dấu review hữu ích
router.post('/:id/helpful', auth, async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);

    if (!review) {
      return res.status(404).json({ message: 'Không tìm thấy đánh giá' });
    }

    // Kiểm tra user đã đánh dấu helpful chưa
    const alreadyHelpful = review.helpfulBy.includes(req.userId);

    if (alreadyHelpful) {
      // Bỏ helpful
      review.helpfulBy = review.helpfulBy.filter(id => id.toString() !== req.userId.toString());
      review.helpful = Math.max(0, review.helpful - 1);
    } else {
      // Thêm helpful
      review.helpfulBy.push(req.userId);
      review.helpful += 1;
    }

    await review.save();

    res.json({ 
      message: alreadyHelpful ? 'Đã bỏ đánh dấu hữu ích' : 'Đã đánh dấu hữu ích',
      helpful: review.helpful
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi cập nhật', error: error.message });
  }
});

// GET: Kiểm tra user đã review sản phẩm chưa
router.get('/check/:productId', auth, async (req, res) => {
  try {
    const review = await Review.findOne({
      product: req.params.productId,
      user: req.userId
    });

    res.json({ 
      hasReviewed: !!review,
      review: review || null
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi kiểm tra', error: error.message });
  }
});

module.exports = router;
