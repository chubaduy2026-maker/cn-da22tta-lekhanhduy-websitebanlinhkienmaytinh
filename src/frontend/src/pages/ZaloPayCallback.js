import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { orderAPI, zalopayAPI } from '../services/api';
import './ZaloPayCallback.css';

const ZaloPayCallback = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState('pending'); // pending, checking, success, failed
  const [message, setMessage] = useState('');
  const [orderId, setOrderId] = useState(null);

  useEffect(() => {
    const storedOrderId = localStorage.getItem('pendingOrderId');
    if (storedOrderId) {
      setOrderId(storedOrderId);
    }
  }, []);

  // Giả định thanh toán thành công
  const handleSimulateSuccess = async () => {
    try {
      setStatus('checking');
      setMessage('Đang xử lý thanh toán...');

      const storedOrderId = localStorage.getItem('pendingOrderId');
      
      if (storedOrderId) {
        // Cập nhật trạng thái đơn hàng thành đã thanh toán (dùng API mới không cần admin)
        try {
          await orderAPI.confirmPayment(storedOrderId);
        } catch (err) {
          console.log('Could not update order status:', err);
        }
        
        setStatus('success');
        setMessage('🎉 Thanh toán thành công!');
        
        // Xóa pending order
        localStorage.removeItem('pendingOrderId');
        localStorage.removeItem('pendingOrderNumber');
        
        // Chuyển đến trang order success sau 2 giây
        setTimeout(() => {
          navigate(`/order-success/${storedOrderId}`);
        }, 2000);
      } else {
        setStatus('failed');
        setMessage('Không tìm thấy thông tin đơn hàng');
      }
    } catch (error) {
      console.error('Error:', error);
      setStatus('failed');
      setMessage('Lỗi khi xử lý thanh toán');
    }
  };

  // Quay lại trang thanh toán
  const handleGoBack = () => {
    navigate('/checkout');
  };

  // Hủy đơn hàng và quay về giỏ hàng
  const handleCancelOrder = async () => {
    const storedOrderId = localStorage.getItem('pendingOrderId');
    if (storedOrderId) {
      try {
        await orderAPI.customerCancelOrder(storedOrderId);
      } catch (err) {
        console.log('Could not cancel order:', err);
      }
      localStorage.removeItem('pendingOrderId');
      localStorage.removeItem('pendingOrderNumber');
    }
    navigate('/cart');
  };

  return (
    <div className="zalopay-callback-page">
      <div className="container">
        <div className="callback-card">
          {status === 'pending' && (
            <>
              <div className="zalopay-logo">
                <img src="/img/img-zalopay/zalopay-logo.png" alt="ZaloPay" onError={(e) => e.target.style.display = 'none'} />
              </div>
              <h2>Thanh toán ZaloPay</h2>
              <p className="subtitle">Bạn đã hủy thanh toán hoặc gặp sự cố?</p>
              
              <div className="callback-options">
                <div className="option-card simulate">
                  <div className="option-icon">✅</div>
                  <h3>Giả định thanh toán thành công</h3>
                  <p>Dùng cho mục đích demo/test. Đơn hàng sẽ được xác nhận như đã thanh toán.</p>
                  <button className="btn-simulate" onClick={handleSimulateSuccess}>
                    Xác nhận thanh toán (Demo)
                  </button>
                </div>

                <div className="option-card retry">
                  <div className="option-icon">🔄</div>
                  <h3>Thử lại thanh toán</h3>
                  <p>Quay lại trang thanh toán để chọn phương thức khác.</p>
                  <button className="btn-retry" onClick={handleGoBack}>
                    Quay lại thanh toán
                  </button>
                </div>

                <div className="option-card cancel">
                  <div className="option-icon">❌</div>
                  <h3>Hủy đơn hàng</h3>
                  <p>Hủy đơn hàng này và quay về giỏ hàng.</p>
                  <button className="btn-cancel" onClick={handleCancelOrder}>
                    Hủy đơn hàng
                  </button>
                </div>
              </div>
            </>
          )}
          
          {status === 'checking' && (
            <>
              <div className="spinner-large"></div>
              <h2>{message}</h2>
              <p>Vui lòng đợi trong giây lát...</p>
            </>
          )}
          
          {status === 'success' && (
            <>
              <div className="success-icon-large">✅</div>
              <h2>{message}</h2>
              <p>Đang chuyển đến trang xác nhận đơn hàng...</p>
            </>
          )}
          
          {status === 'failed' && (
            <>
              <div className="error-icon-large">❌</div>
              <h2>{message}</h2>
              <div className="failed-actions">
                <button className="btn-retry" onClick={handleGoBack}>
                  Quay lại thanh toán
                </button>
                <button className="btn-cancel" onClick={handleCancelOrder}>
                  Hủy đơn hàng
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ZaloPayCallback;
