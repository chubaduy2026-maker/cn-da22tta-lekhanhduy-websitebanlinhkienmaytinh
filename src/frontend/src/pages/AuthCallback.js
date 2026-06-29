import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import './AuthCallback.css';

const AuthCallback = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [status, setStatus] = useState('Đang xử lý đăng nhập...');

  useEffect(() => {
    const handleCallback = () => {
      const params = new URLSearchParams(location.search);
      const token = params.get('token');
      const error = params.get('error');

      if (error) {
        navigate('/login?error=' + error);
        return;
      }

      if (token) {
        // Chỉ lưu token - AuthContext sẽ tự lấy user info
        localStorage.setItem('token', token);
        localStorage.removeItem('sessionId');
        
        setStatus('Đăng nhập thành công!');
        
        // Redirect về trang chủ - App sẽ tự load user
        window.location.href = '/';
      } else {
        navigate('/login?error=missing_token');
      }
    };

    handleCallback();
  }, [location, navigate]);

  return (
    <div className="auth-callback-page">
      <div className="callback-spinner">
        <div className="spinner-circle"></div>
        <h2>{status}</h2>
        <p>Vui lòng chờ trong giây lát</p>
      </div>
    </div>
  );
};

export default AuthCallback;
