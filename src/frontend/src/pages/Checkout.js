import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { orderAPI, zalopayAPI, couponAPI } from '../services/api';
import { FiCreditCard, FiTruck, FiDollarSign, FiTag, FiX, FiCheck } from 'react-icons/fi';
import AddressSelector from '../components/AddressSelector';
import Swal from 'sweetalert2';
import { useInteractionTracker } from '../hooks/useRecommendations';
import './Checkout.css';

const Checkout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { cart, clearCart } = useCart();
  const { trackPurchase } = useInteractionTracker();
  const [loading, setLoading] = useState(false);
  const [showQRCode, setShowQRCode] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState('pending'); // pending, checking, success, failed
  const [countdown, setCountdown] = useState(null);
  const [checkingPayment, setCheckingPayment] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const formRef = useRef(null);

  // Kiểm tra nếu là mua ngay
  const buyNowItem = location.state?.buyNowItem;

  // Scroll đến form khi click "Mua ngay" từ trang chi tiết sản phẩm
  useEffect(() => {
    if (buyNowItem && formRef.current) {
      setTimeout(() => {
        formRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  }, [buyNowItem]);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    paymentMethod: 'COD',
    note: '',
  });

  // Coupon states
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponError, setCouponError] = useState('');

  const formatPrice = (price) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(price);
  };

  const formatPriceNumber = (price) => {
    return new Intl.NumberFormat('vi-VN').format(price);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });

    // Hiện QR code khi chọn chuyển khoản
    if (name === 'paymentMethod') {
      setShowQRCode(value === 'Banking');
      if (value === 'Banking') {
        setPaymentStatus('pending');
        setCountdown(null);
        setCheckingPayment(false);
      }
    }
  };

  // Simulate payment checking when QR code is shown
  useEffect(() => {
    let timer;
    if (showQRCode && paymentStatus === 'checking') {
      // Start countdown from 5 seconds
      setCountdown(5);

      const countdownInterval = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(countdownInterval);
            // Simulate successful payment after countdown
            setPaymentStatus('success');
            setShowSuccessModal(true);

            // Play success sound
            const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBTGH0fPTgjMGHm7A7+OZURE');
            audio.play().catch(e => console.log('Audio play failed:', e));

            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(countdownInterval);
    }
  }, [showQRCode, paymentStatus]);

  const handleCheckPayment = () => {
    setCheckingPayment(true);
    setPaymentStatus('checking');
  };

  const handleZaloPayPayment = async (orderId) => {
    try {
      setLoading(true);
      const totalAmount = getTotalAmount();

      const response = await zalopayAPI.createOrder(
        orderId,
        totalAmount,
        `Thanh toán đơn hàng`
      );

      if (response.data.success && response.data.order_url) {
        // Mở trang thanh toán ZaloPay
        window.location.href = response.data.order_url;
      } else {
        Swal.fire('Lỗi', 'Không thể tạo liên kết thanh toán ZaloPay', 'error');
      }
    } catch (error) {
      console.error('ZaloPay payment error:', error);
      Swal.fire('Lỗi', 'Lỗi khi tạo thanh toán ZaloPay: ' + (error.response?.data?.message || error.message), 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.name || !formData.email || !formData.phone || !formData.address) {
      Swal.fire('Thông báo', 'Vui lòng điền đầy đủ thông tin!', 'warning');
      return;
    }

    // Kiểm tra thanh toán cho phương thức Banking
    if (formData.paymentMethod === 'Banking' && paymentStatus !== 'success') {
      Swal.fire('Thông báo', 'Vui lòng quét mã QR và kiểm tra thanh toán trước khi đặt hàng!', 'warning');
      return;
    }

    // Kiểm tra: Nếu không phải mua ngay và giỏ hàng trống
    if (!buyNowItem && (!cart || !cart.items || cart.items.length === 0)) {
      Swal.fire('Thông báo', 'Giỏ hàng trống!', 'warning');
      navigate('/');
      return;
    }

    try {
      setLoading(true);
      const orderData = {
        customerInfo: {
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          address: formData.address,
        },
        paymentMethod: formData.paymentMethod,
        note: formData.note,
      };

      // Thêm thông tin coupon nếu có
      if (appliedCoupon) {
        orderData.couponCode = appliedCoupon.code;
        orderData.discountPercent = appliedCoupon.discountPercent;
        orderData.discountAmount = appliedCoupon.discountAmount;
        orderData.originalAmount = getSubtotalAmount();
        orderData.totalAmount = getFinalAmount();

        // Gọi API để đánh dấu mã đã sử dụng
        try {
          await couponAPI.use(appliedCoupon.code);
        } catch (err) {
          console.error('Error marking coupon as used:', err);
        }
      }

      // Nếu là mua ngay, thêm thông tin sản phẩm
      if (buyNowItem) {
        orderData.buyNowItem = {
          productId: buyNowItem.productId,
          quantity: buyNowItem.quantity
        };
      }

      const response = await orderAPI.createOrder(orderData);

      // Ghi nhận hành vi mua hàng cho hệ thống gợi ý AI
      displayItems.forEach((item) => {
        const prod = {
          _id: item.product?._id || item.productId || item._id,
          category: item.product?.category,
          brand: item.product?.brand,
          price: item.product?.price
        };
        trackPurchase(prod, item.quantity);
      });

      // Nếu chọn ZaloPay, chuyển hướng đến trang thanh toán
      if (formData.paymentMethod === 'ZaloPay') {
        // Lưu orderId vào localStorage để kiểm tra sau
        localStorage.setItem('pendingOrderId', response.data.order._id);
        localStorage.setItem('pendingOrderNumber', response.data.order.orderNumber);
        await handleZaloPayPayment(response.data.order._id);
        return;
      }

      Swal.fire('Thành công', `${response.data.message}\nMã đơn hàng: ${response.data.order.orderNumber}`, 'success');

      // Nếu thanh toán từ giỏ hàng, xóa giỏ hàng
      if (!buyNowItem) {
        await clearCart();
      }

      // Chuyển đến trang xác nhận
      navigate(`/order-success/${response.data.order._id}`);
    } catch (error) {
      Swal.fire('Lỗi', error.response?.data?.message || 'Lỗi khi đặt hàng', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Kiểm tra nếu cả hai đều trống
  if (!buyNowItem && (!cart || !cart.items || cart.items.length === 0)) {
    return (
      <div className="checkout-empty">
        <div className="container">
          <div className="empty-state">
            <h2>Giỏ hàng trống</h2>
            <p>Vui lòng thêm sản phẩm vào giỏ hàng trước khi thanh toán</p>
            <button onClick={() => navigate('/')} className="back-to-shop">
              Quay lại mua sắm
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Tính tổng tiền gốc (subtotal)
  const getSubtotalAmount = () => {
    if (buyNowItem) {
      return buyNowItem.price * buyNowItem.quantity;
    }
    return cart?.totalAmount || 0;
  };

  // Tính tổng tiền (cũ - dùng cho getTotalAmount)
  const getTotalAmount = () => {
    return getSubtotalAmount();
  };

  // Tính số tiền được giảm
  const getDiscountAmount = () => {
    if (!appliedCoupon) return 0;
    return appliedCoupon.discountAmount || 0;
  };

  // Tính tổng tiền sau giảm giá
  const getFinalAmount = () => {
    return getSubtotalAmount() - getDiscountAmount();
  };

  // Áp dụng mã giảm giá
  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) {
      setCouponError('Vui lòng nhập mã giảm giá');
      return;
    }

    try {
      setCouponLoading(true);
      setCouponError('');

      const response = await couponAPI.validate(couponCode, getSubtotalAmount());

      if (response.data.valid) {
        setAppliedCoupon(response.data);
        setCouponCode('');
      }
    } catch (error) {
      setCouponError(error.response?.data?.message || 'Mã giảm giá không hợp lệ');
      setAppliedCoupon(null);
    } finally {
      setCouponLoading(false);
    }
  };

  // Xóa mã giảm giá
  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponError('');
  };

  // Lấy danh sách items để hiển thị
  const getDisplayItems = () => {
    if (buyNowItem) {
      return [{
        _id: buyNowItem.productId,
        product: {
          name: buyNowItem.name,
          price: buyNowItem.price,
          image: buyNowItem.image
        },
        quantity: buyNowItem.quantity
      }];
    }
    return cart?.items || [];
  };

  const displayItems = getDisplayItems();
  const totalAmount = getTotalAmount();

  return (
    <div className="checkout-page">
      <div className="container">
        <h1 className="checkout-title">Thanh toán</h1>

        <div className="checkout-grid">
          <div className="checkout-form-section" ref={formRef}>
            <form onSubmit={handleSubmit} className="checkout-form">
              <h2>Thông tin giao hàng</h2>

              <div className="form-group">
                <label htmlFor="name">Họ và tên *</label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  placeholder="Nhập họ và tên"
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="email">Email *</label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    placeholder="example@email.com"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="phone">Số điện thoại *</label>
                  <input
                    type="tel"
                    id="phone"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    required
                    placeholder="0123456789"
                  />
                </div>
              </div>

              <div className="form-group address-group">
                <label>Địa chỉ giao hàng *</label>
                <AddressSelector
                  value={formData.address}
                  onChange={(value) => setFormData({ ...formData, address: value })}
                  required
                />
              </div>

              <div className="form-group payment-method-group">
                <label>Phương thức thanh toán *</label>
                <div className="payment-options">
                  <label className={`payment-option ${formData.paymentMethod === 'COD' ? 'active' : ''}`}>
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="COD"
                      checked={formData.paymentMethod === 'COD'}
                      onChange={handleChange}
                    />
                    <div className="payment-icon">
                      <FiTruck size={20} />
                    </div>
                    <div className="payment-info">
                      <span className="payment-title">Thanh toán khi nhận hàng</span>
                      <span className="payment-desc">COD - Trả tiền mặt khi giao hàng</span>
                    </div>
                  </label>

                  <label className={`payment-option ${formData.paymentMethod === 'Banking' || formData.paymentMethod === 'ZaloPay' ? 'active' : ''}`}>
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="Banking"
                      checked={formData.paymentMethod === 'Banking' || formData.paymentMethod === 'ZaloPay'}
                      onChange={handleChange}
                    />
                    <div className="payment-icon banking-icon">
                      <FiDollarSign size={20} />
                    </div>
                    <div className="payment-info">
                      <span className="payment-title">Chuyển khoản / Ví điện tử</span>
                      <span className="payment-desc">QR Banking hoặc ZaloPay</span>
                    </div>
                  </label>

                  {/* Sub-options for Banking/ZaloPay */}
                  {(formData.paymentMethod === 'Banking' || formData.paymentMethod === 'ZaloPay') && (
                    <div className="payment-sub-options">
                      <label className={`payment-sub-option ${formData.paymentMethod === 'Banking' ? 'active' : ''}`}>
                        <input
                          type="radio"
                          name="paymentMethod"
                          value="Banking"
                          checked={formData.paymentMethod === 'Banking'}
                          onChange={handleChange}
                        />
                        <span className="sub-option-icon">🏦</span>
                        <span className="sub-option-text">Chuyển khoản ngân hàng</span>
                      </label>
                      <label className={`payment-sub-option ${formData.paymentMethod === 'ZaloPay' ? 'active' : ''}`}>
                        <input
                          type="radio"
                          name="paymentMethod"
                          value="ZaloPay"
                          checked={formData.paymentMethod === 'ZaloPay'}
                          onChange={handleChange}
                        />
                        <img src="/img/img-zalopay/zalopay-logo.png" alt="ZaloPay" className="sub-option-logo" />
                        <span className="sub-option-text">Ví ZaloPay</span>
                      </label>
                    </div>
                  )}

                  <label className={`payment-option ${formData.paymentMethod === 'Card' ? 'active' : ''}`}>
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="Card"
                      checked={formData.paymentMethod === 'Card'}
                      onChange={handleChange}
                    />
                    <div className="payment-icon">
                      <FiCreditCard size={20} />
                    </div>
                    <div className="payment-info">
                      <span className="payment-title">Thẻ tín dụng/Ghi nợ</span>
                      <span className="payment-desc">Visa, Mastercard, JCB</span>
                    </div>
                  </label>
                </div>
              </div>

              {/* QR Code Section */}
              {showQRCode && (
                <div className="qr-code-section">
                  <div className="qr-code-header">
                    <h3>🏦 Thông tin chuyển khoản</h3>
                    <p>Quét mã QR bên dưới để thanh toán</p>
                  </div>

                  {paymentStatus === 'success' && (
                    <div className="payment-success-banner">
                      <div className="success-icon">✅</div>
                      <div className="success-text">
                        <h4>Thanh toán thành công!</h4>
                        <p>Đã nhận được thanh toán của bạn</p>
                      </div>
                    </div>
                  )}

                  {paymentStatus === 'checking' && (
                    <div className="payment-checking-banner">
                      <div className="checking-icon">
                        <div className="spinner"></div>
                      </div>
                      <div className="checking-text">
                        <h4>Đang kiểm tra thanh toán...</h4>
                        <p>Vui lòng chờ {countdown} giây</p>
                      </div>
                    </div>
                  )}

                  <div className="qr-code-content">
                    <div className="qr-code-image">
                      <img
                        src="/img/img-thanhtoan-chuyenkhoannganhang/chuyenkhoannganhang.png"
                        alt="QR Code Thanh toán"
                      />
                    </div>

                    <div className="bank-info">
                      <div className="bank-info-item">
                        <span className="label">Ngân hàng:</span>
                        <span className="value">MBbank</span>
                      </div>
                      <div className="bank-info-item">
                        <span className="label">Số tài khoản:</span>
                        <span className="value">0348137209</span>
                      </div>
                      <div className="bank-info-item">
                        <span className="label">Chủ tài khoản:</span>
                        <span className="value">SHOP LINH KIEN MAY TINH</span>
                      </div>
                      <div className="bank-info-item highlight">
                        <span className="label">Số tiền:</span>
                        <span className="value amount">{formatPriceNumber(totalAmount)} VNĐ</span>
                      </div>
                      <div className="bank-info-item">
                        <span className="label">Nội dung CK:</span>
                        <span className="value">THANHTOAN_SANPHAM</span>
                      </div>
                    </div>
                  </div>

                  <div className="qr-code-actions">
                    {paymentStatus === 'pending' && (
                      <button
                        type="button"
                        className="check-payment-btn"
                        onClick={handleCheckPayment}
                        disabled={checkingPayment}
                      >
                        🔍 Kiểm tra thanh toán
                      </button>
                    )}

                    {paymentStatus === 'success' && (
                      <div className="payment-confirmed">
                        <span className="confirmed-icon">✔️</span>
                        <span>Thanh toán đã được xác nhận</span>
                      </div>
                    )}
                  </div>

                  <div className="qr-code-note">
                    <p>⚠️ Vui lòng chuyển đúng số tiền và nội dung để đơn hàng được xử lý nhanh nhất</p>
                  </div>
                </div>
              )}

              <div className="form-group">
                <label htmlFor="note">Ghi chú (không bắt buộc)</label>
                <textarea
                  id="note"
                  name="note"
                  value={formData.note}
                  onChange={handleChange}
                  rows="3"
                  placeholder="Ghi chú thêm về đơn hàng..."
                />
              </div>

              <button type="submit" className="submit-order-btn" disabled={loading}>
                {loading ? 'Đang xử lý...' : 'Đặt hàng'}
              </button>
            </form>
          </div>

          <div className="order-summary-section">
            <div className="order-summary">
              <h2>Đơn hàng của bạn</h2>

              {buyNowItem && (
                <div className="buy-now-badge">🚀 Mua ngay - Thanh toán nhanh</div>
              )}

              <div className="order-items">
                {displayItems.map((item) => (
                  <div key={item._id} className="order-item">
                    <img src={item.product.images?.[0] || item.product.image} alt={item.product.name} />
                    <div className="order-item-info">
                      <h4>{item.product.name}</h4>
                      <p>Số lượng: {item.quantity}</p>
                    </div>
                    <div className="order-item-price">
                      {formatPrice(item.product.price * item.quantity)}
                    </div>
                  </div>
                ))}
              </div>

              {/* Coupon Section */}
              <div className="coupon-input-section">
                <div className="coupon-input-header">
                  <FiTag className="coupon-icon" />
                  <span>Mã giảm giá</span>
                </div>

                {appliedCoupon ? (
                  <div className="applied-coupon">
                    <div className="applied-coupon-info">
                      <span className="coupon-badge">
                        <FiCheck /> {appliedCoupon.code}
                      </span>
                      <span className="coupon-discount-text">
                        Giảm {appliedCoupon.discountPercent}%
                      </span>
                    </div>
                    <button
                      type="button"
                      className="remove-coupon-btn"
                      onClick={handleRemoveCoupon}
                    >
                      <FiX />
                    </button>
                  </div>
                ) : (
                  <div className="coupon-input-wrapper">
                    <input
                      type="text"
                      value={couponCode}
                      onChange={(e) => {
                        setCouponCode(e.target.value.toUpperCase());
                        setCouponError('');
                      }}
                      placeholder="Nhập mã giảm giá"
                      className={couponError ? 'error' : ''}
                    />
                    <button
                      type="button"
                      className="apply-coupon-btn"
                      onClick={handleApplyCoupon}
                      disabled={couponLoading}
                    >
                      {couponLoading ? '...' : 'Áp dụng'}
                    </button>
                  </div>
                )}

                {couponError && (
                  <p className="coupon-error">{couponError}</p>
                )}
              </div>

              <div className="order-totals">
                <div className="total-row">
                  <span>Tạm tính:</span>
                  <span>{formatPrice(getSubtotalAmount())}</span>
                </div>
                <div className="total-row">
                  <span>Phí vận chuyển:</span>
                  <span>Miễn phí</span>
                </div>

                {appliedCoupon && (
                  <div className="total-row discount-row">
                    <span>
                      <FiTag className="discount-icon" />
                      Giảm giá ({appliedCoupon.discountPercent}%):
                    </span>
                    <span className="discount-amount">-{formatPrice(getDiscountAmount())}</span>
                  </div>
                )}

                <div className="total-divider"></div>
                <div className="total-row grand-total">
                  <span>💰 Tổng cộng:</span>
                  <span className="grand-total-price">{formatPrice(getFinalAmount())}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Success Modal */}
      {showSuccessModal && (
        <div className="payment-success-modal-overlay" onClick={() => setShowSuccessModal(false)}>
          <div className="payment-success-modal" onClick={(e) => e.stopPropagation()}>
            <div className="success-modal-animation">
              <div className="success-checkmark">
                <div className="check-icon">
                  <span className="icon-line line-tip"></span>
                  <span className="icon-line line-long"></span>
                  <div className="icon-circle"></div>
                  <div className="icon-fix"></div>
                </div>
              </div>
            </div>

            <h2 className="success-modal-title">🎉 Thanh toán thành công!</h2>
            <p className="success-modal-message">
              Chúng tôi đã nhận được khoản thanh toán của bạn
            </p>

            <div className="success-modal-details">
              <div className="detail-row">
                <span className="detail-label">Số tiền:</span>
                <span className="detail-value">{formatPriceNumber(getTotalAmount())} VNĐ</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Phương thức:</span>
                <span className="detail-value">Chuyển khoản ngân hàng</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Trạng thái:</span>
                <span className="detail-value success-status">✓ Đã xác nhận</span>
              </div>
            </div>

            <div className="success-modal-actions">
              <button
                className="modal-close-btn"
                onClick={() => setShowSuccessModal(false)}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Checkout;
