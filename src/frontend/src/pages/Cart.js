import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiTrash2, FiShoppingBag } from 'react-icons/fi';
import { useCart } from '../context/CartContext';
import { useCartRecommendations } from '../hooks/useRecommendations';
import RecommendationSection from '../components/RecommendationSection';
import Swal from 'sweetalert2';
import './Cart.css';

const Cart = () => {
  const navigate = useNavigate();
  const { cart, updateCartItem, removeFromCart, clearCart } = useCart();

  // AI: Lấy ID sản phẩm trong giỏ để gợi ý mua kèm
  const cartProductIds = useMemo(() => {
    if (!cart?.items?.length) return [];
    return cart.items.map(item => item.product?._id).filter(Boolean);
  }, [cart?.items]);
  const { recommendations: cartRecs, loading: cartRecsLoading, source: cartRecsSource } = useCartRecommendations(cartProductIds, 8);

  const formatPrice = (price) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(price);
  };

  const handleQuantityChange = async (productId, newQuantity) => {
    if (newQuantity < 1) return;
    await updateCartItem(productId, newQuantity);
  };

  const handleRemove = async (productId) => {
    const result = await Swal.fire({
      title: 'Xác nhận',
      text: 'Bạn có chắc muốn xóa sản phẩm này?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Xóa',
      cancelButtonText: 'Hủy'
    });
    if (result.isConfirmed) {
      await removeFromCart(productId);
    }
  };

  const handleClearCart = async () => {
    const result = await Swal.fire({
      title: 'Xác nhận',
      text: 'Bạn có chắc muốn xóa toàn bộ giỏ hàng?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Xóa tất cả',
      cancelButtonText: 'Hủy'
    });
    if (result.isConfirmed) {
      await clearCart();
    }
  };

  const handleCheckout = () => {
    if (!cart || !cart.items || cart.items.length === 0) {
      Swal.fire('Thông báo', 'Giỏ hàng trống!', 'warning');
      return;
    }
    navigate('/checkout');
  };

  if (!cart || !cart.items || cart.items.length === 0) {
    return (
      <div className="cart-empty">
        <div className="container">
          <div className="empty-state">
            <FiShoppingBag size={80} />
            <h2>Giỏ hàng trống</h2>
            <p>Hãy thêm sản phẩm vào giỏ hàng để tiếp tục mua sắm</p>
            <button onClick={() => navigate('/')} className="continue-shopping">
              Tiếp tục mua sắm
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="cart-page">
      <div className="container">
        <div className="cart-header">
          <h1>Giỏ hàng của bạn</h1>
          <button onClick={handleClearCart} className="clear-cart-btn">
            <FiTrash2 /> Xóa tất cả
          </button>
        </div>

        <div className="cart-content">
          <div className="cart-items">
            {cart.items.map((item) => (
              <div key={item._id} className="cart-item">
                <img 
                  src={item.product.images?.[0] || item.product.image} 
                  alt={item.product.name}
                  className="cart-item-image"
                  onClick={() => navigate(`/product/${item.product._id}`)}
                />
                
                <div className="cart-item-info">
                  <h3 
                    className="cart-item-name"
                    onClick={() => navigate(`/product/${item.product._id}`)}
                  >
                    {item.product.name}
                  </h3>
                  <p className="cart-item-brand">{item.product.brand}</p>
                  <p className="cart-item-price">{formatPrice(item.product.price)}</p>
                </div>

                <div className="cart-item-actions">
                  <div className="quantity-controls">
                    <button
                      onClick={() => handleQuantityChange(item.product._id, item.quantity - 1)}
                      disabled={item.quantity <= 1}
                    >
                      -
                    </button>
                    <span className="quantity">{item.quantity}</span>
                    <button
                      onClick={() => handleQuantityChange(item.product._id, item.quantity + 1)}
                      disabled={item.quantity >= item.product.stock}
                    >
                      +
                    </button>
                  </div>

                  <div className="cart-item-total">
                    {formatPrice(item.product.price * item.quantity)}
                  </div>

                  <button
                    onClick={() => handleRemove(item.product._id)}
                    className="remove-item-btn"
                  >
                    <FiTrash2 size={18} />
                    <span>Xóa</span>
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="cart-summary">
            <h2>Tóm tắt đơn hàng</h2>
            
            <div className="summary-row">
              <span>Tạm tính:</span>
              <span>{formatPrice(cart.totalAmount)}</span>
            </div>

            <div className="summary-row">
              <span>Phí vận chuyển:</span>
              <span>Miễn phí</span>
            </div>

            <div className="summary-divider"></div>

            <div className="summary-row total">
              <span>💰 Tổng cộng:</span>
              <span className="total-price">{formatPrice(cart.totalAmount)}</span>
            </div>

            <button onClick={handleCheckout} className="checkout-btn">
              Tiến hành thanh toán
            </button>

            <button onClick={() => navigate('/')} className="continue-shopping-link">
              ← Tiếp tục mua sắm
            </button>
          </div>
        </div>

        {/* AI Recommendation: Sản phẩm mua kèm */}
        {cartRecs.length > 0 && (
          <RecommendationSection
            title="Có thể bạn cũng thích"
            icon="🛒"
            products={cartRecs}
            loading={cartRecsLoading}
            source={cartRecsSource}
          />
        )}
      </div>
    </div>
  );
};

export default Cart;
