import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FiCheckCircle, FiPackage, FiX, FiClock, FiTruck, FiAlertCircle } from 'react-icons/fi';
import { orderAPI } from '../services/api';
import Swal from 'sweetalert2';
import './OrderSuccess.css';

const OrderSuccess = () => {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    fetchOrder();
  }, [orderId]);

  const fetchOrder = async () => {
    try {
      const response = await orderAPI.getOrderById(orderId);
      setOrder(response.data);
    } catch (error) {
      console.error('Lỗi khi lấy thông tin đơn hàng:', error);
      Swal.fire('Lỗi', 'Không tìm thấy đơn hàng', 'error');
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(price);
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleString('vi-VN');
  };

  const handleCancelOrder = async () => {
    const result = await Swal.fire({
      title: 'Xác nhận hủy',
      text: 'Bạn có chắc chắn muốn hủy đơn hàng này?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Hủy đơn',
      cancelButtonText: 'Không'
    });
    if (!result.isConfirmed) return;

    try {
      setCancelling(true);
      await orderAPI.updateOrderStatus(orderId, 'cancelled');
      await fetchOrder(); // Reload order data
    } catch (error) {
      console.error('Lỗi khi hủy đơn hàng:', error);
      Swal.fire('Lỗi', error.response?.data?.message || 'Không thể hủy đơn hàng. Vui lòng thử lại.', 'error');
    } finally {
      setCancelling(false);
    }
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      pending: { label: 'Chờ xử lý', icon: FiClock, color: '#f59e0b' },
      processing: { label: 'Đang xử lý', icon: FiPackage, color: '#3b82f6' },
      shipped: { label: 'Đang giao hàng', icon: FiTruck, color: '#8b5cf6' },
      delivered: { label: 'Đã giao hàng', icon: FiCheckCircle, color: '#10b981' },
      cancelled: { label: 'Đã hủy', icon: FiX, color: '#ef4444' }
    };

    const config = statusConfig[status] || statusConfig.pending;
    const Icon = config.icon;

    return (
      <span className="status-badge" style={{ backgroundColor: config.color }}>
        <Icon size={16} />
        {config.label}
      </span>
    );
  };

  const getPaymentMethodLabel = (method) => {
    const methods = {
      'COD': 'Thanh toán khi nhận hàng',
      'Banking': 'Chuyển khoản ngân hàng',
      'Card': 'Thẻ tín dụng/Ghi nợ',
      'ZaloPay': 'Ví điện tử ZaloPay'
    };
    return methods[method] || method;
  };

  const canCancelOrder = () => {
    return order && (order.status === 'pending' || order.status === 'processing');
  };

  if (loading) {
    return <div className="loading">Đang tải...</div>;
  }

  if (!order) {
    return <div className="loading">Không tìm thấy đơn hàng</div>;
  }

  return (
    <div className="order-success-page">
      <div className="container">
        <div className="success-card">
          {order.status === 'cancelled' ? (
            <>
              <div className="status-icon cancelled">
                <FiX size={64} />
              </div>
              <h1 className="cancelled-title">Đơn hàng đã bị hủy</h1>
              <p className="cancelled-message">
                Đơn hàng này đã bị hủy. Nếu có thắc mắc, vui lòng liên hệ với chúng tôi.
              </p>
            </>
          ) : (
            <>
              <div className="status-icon success">
                <FiCheckCircle size={64} />
              </div>
              <h1 className="success-title">Đặt hàng thành công!</h1>
              <p className="success-message">
                Cảm ơn bạn đã đặt hàng. Chúng tôi sẽ liên hệ với bạn sớm nhất.
              </p>
            </>
          )}

          <div className="order-number-card">
            <FiPackage size={24} />
            <div className="order-number-info">
              <span className="order-label">Mã đơn hàng</span>
              <span className="order-value">{order.orderNumber}</span>
            </div>
            {getStatusBadge(order.status)}
          </div>

          <div className="order-details-card">
            <div className="details-header">
              <h2>Thông tin đơn hàng</h2>
            </div>

            <div className="info-section">
              <h3><FiPackage size={18} /> Thông tin khách hàng</h3>
              <div className="info-grid">
                <div className="info-item">
                  <span className="info-label">Họ tên:</span>
                  <span className="info-value">{order.customerInfo.name}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Email:</span>
                  <span className="info-value">{order.customerInfo.email}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Số điện thoại:</span>
                  <span className="info-value">{order.customerInfo.phone}</span>
                </div>
                <div className="info-item full-width">
                  <span className="info-label">Địa chỉ giao hàng:</span>
                  <span className="info-value">{order.customerInfo.address}</span>
                </div>
              </div>
            </div>

            <div className="info-section">
              <h3><FiPackage size={18} /> Sản phẩm đã đặt</h3>
              <div className="order-items-list">
                {order.items.map((item, index) => (
                  <div key={index} className="order-item-card">
                    <div className="item-info">
                      <span className="item-name">{item.name}</span>
                      <span className="item-quantity">Số lượng: {item.quantity}</span>
                    </div>
                    <div className="item-price">
                      {formatPrice(item.price * item.quantity)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="info-section">
              <h3><FiAlertCircle size={18} /> Thanh toán & Giao hàng</h3>
              <div className="info-grid">
                <div className="info-item">
                  <span className="info-label">Phương thức thanh toán:</span>
                  <span className="info-value">{getPaymentMethodLabel(order.paymentMethod)}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Ngày đặt hàng:</span>
                  <span className="info-value">{formatDate(order.createdAt)}</span>
                </div>
              </div>
            </div>

            {order.note && (
              <div className="info-section">
                <h3><FiAlertCircle size={18} /> Ghi chú</h3>
                <p className="order-note">{order.note}</p>
              </div>
            )}
          </div>

          <div className="action-buttons">
            <button onClick={() => navigate('/my-orders')} className="btn-view-orders">
              <FiPackage size={18} />
              Xem đơn hàng của tôi
            </button>
            {canCancelOrder() && (
              <button 
                onClick={handleCancelOrder} 
                className="btn-cancel-order"
                disabled={cancelling}
              >
                <FiX size={18} />
                {cancelling ? 'Đang hủy...' : 'Hủy đơn hàng'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderSuccess;
