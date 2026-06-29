import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiShoppingCart, FiShoppingBag } from 'react-icons/fi';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import Swal from 'sweetalert2';
import { useInteractionTracker } from '../hooks/useRecommendations';
import './ProductCard.css';

// Framer Motion variants cho animations
const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { duration: 0.4, ease: "easeOut" }
  },
  hover: {
    y: -5,
    boxShadow: "0 22px 50px rgba(0,0,0,0.32)",
    transition: { duration: 0.3, ease: "easeOut" }
  },
  tap: {
    scale: 0.98,
    transition: { duration: 0.1 }
  }
};

const imageVariants = {
  hover: {
    scale: 1.04,
    transition: { duration: 0.4, ease: "easeOut" }
  }
};

const buttonVariants = {
  hover: {
    scale: 1.02,
    boxShadow: "0 10px 22px rgba(34, 211, 238, 0.18)",
    transition: { duration: 0.2 }
  },
  tap: {
    scale: 0.95,
    transition: { duration: 0.1 }
  }
};

const badgeVariants = {
  initial: { scale: 0, rotate: -15 },
  animate: { 
    scale: 1, 
    rotate: 0,
    transition: { type: "spring", stiffness: 500, damping: 25 }
  }
};

const ProductCard = ({ product, index = 0 }) => {
  const { addToCart } = useCart();
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [adding, setAdding] = React.useState(false);
  const { trackClick, trackAddToCart } = useInteractionTracker();

  const handleAddToCart = async (e) => {
    e.preventDefault();
    if (!isAuthenticated) {
      Swal.fire('Thông báo', 'Vui lòng đăng nhập để thêm vào giỏ hàng', 'warning');
      navigate('/login');
      return;
    }

    setAdding(true);
    const result = await addToCart(product._id, 1);

    if (result.success) {
      Swal.fire('Thành công', 'Đã thêm vào giỏ hàng!', 'success');
      trackAddToCart(product, 1);
    } else {
      Swal.fire('Lỗi', result.message, 'error');
    }
    setAdding(false);
  };

  const handleBuyNow = async (e) => {
    e.preventDefault();
    if (!isAuthenticated) {
      Swal.fire('Thông báo', 'Vui lòng đăng nhập để mua hàng', 'warning');
      navigate('/login');
      return;
    }

    if (product.stock === 0) return;

    // Chuyển thẳng đến trang thanh toán với thông tin sản phẩm
    navigate('/checkout', {
      state: {
        buyNowItem: {
          productId: product._id,
          name: product.name,
          price: product.price,
          image: product.images?.[0] || product.image,
          quantity: 1
        }
      }
    });
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(price);
  };

  const getSpecs = () => {
    if (!product.specifications) return [];
    const specsMap = product.specifications instanceof Map ? product.specifications : new Map(Object.entries(product.specifications));
    return Array.from(specsMap.entries()).slice(0, 4);
  };

  const calculateDiscount = () => {
    if (product.originalPrice && product.originalPrice > product.price) {
      return Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100);
    }
    return 0;
  };

  const discount = calculateDiscount();
  const specs = getSpecs();

  return (
    <motion.div
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      whileHover="hover"
      whileTap="tap"
      transition={{ delay: index * 0.05 }}
      className="product-card-wrapper"
    >
      <Link to={`/product/${product._id}`} className="product-card" onClick={() => trackClick(product, 'product_card')}>
        {discount > 0 && (
          <motion.div 
            className="discount-badge"
            variants={badgeVariants}
            initial="initial"
            animate="animate"
          >
            -{discount}%
          </motion.div>
        )}

        <div className="product-image">
          <motion.img 
            src={product.images?.[0] || product.image} 
            alt={product.name}
            variants={imageVariants}
            whileHover="hover"
          />
          {product.stock === 0 && <div className="out-of-stock">Hết hàng</div>}
        </div>

        <div className="product-info">
          <h3 className="product-name">{product.name}</h3>

          {specs.length > 0 && (
            <div className="product-specs">
              {specs.map(([key, value]) => (
                <div key={key} className="spec-item">
                  <span className="spec-icon">●</span>
                  <span>{value}</span>
              </div>
            ))}
          </div>
        )}

        <div className="product-footer">
          <div className="price-section">
            {product.originalPrice && product.originalPrice > product.price && (
              <div className="original-price">{formatPrice(product.originalPrice)}</div>
            )}
            <div className="product-price">{formatPrice(product.price)}</div>
          </div>

          <div className="action-buttons">
            <motion.button
              className="add-to-cart-btn"
              onClick={handleAddToCart}
              disabled={adding || product.stock === 0}
              title="Thêm vào giỏ hàng"
              variants={buttonVariants}
              whileHover="hover"
              whileTap="tap"
            >
              <FiShoppingCart />
              {adding ? 'Đang thêm...' : 'Thêm'}
            </motion.button>

            <motion.button
              className="buy-now-btn"
              onClick={handleBuyNow}
              disabled={adding || product.stock === 0}
              title="Mua ngay"
              variants={buttonVariants}
              whileHover="hover"
              whileTap="tap"
            >
              <FiShoppingBag />
              Mua
            </motion.button>
          </div>
        </div>

        {product.rating > 0 && (
          <div className="product-rating">
            <span className="stars">{'★'.repeat(Math.floor(product.rating))}{'☆'.repeat(5 - Math.floor(product.rating))}</span>
            <span className="rating-value">{product.rating.toFixed(1)}</span>
            <span className="review-count">({product.reviewCount || 0} đánh giá)</span>
          </div>
        )}
        {product.rating === 0 && (
          <div className="product-rating no-rating">
            <span className="stars">☆☆☆☆☆</span>
            <span className="review-count">Chưa có đánh giá</span>
          </div>
        )}

        {(product.aiMatchScore || (product.recommendationReasons && product.recommendationReasons.length > 0)) && (
          <div className="product-card-rec-details">
            {product.aiMatchScore && (
              <div className="card-rec-score">
                <span className="brain-emoji" role="img" aria-label="brain">🤖</span>
                <span className="score-percent">Độ phù hợp: {product.aiMatchScore}%</span>
              </div>
            )}
            {product.recommendationReasons && product.recommendationReasons.length > 0 && (
              <div className="card-rec-reasons">
                {product.recommendationReasons.slice(0, 2).map((reason, rIdx) => (
                  <div key={rIdx} className="card-rec-reason-item">
                    ✨ {reason}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </Link>
    </motion.div>
  );
};

export default ProductCard;
