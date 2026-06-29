import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { FiMail, FiArrowLeft, FiCheckCircle } from 'react-icons/fi';
import './ForgotPassword.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [emailSent, setEmailSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setError('');

    try {
      const response = await axios.post(`${API_URL}/auth/forgot-password`, {
        email
      });

      setMessage(response.data.message);
      setEmailSent(true);
      setEmail('');
    } catch (err) {
      setError(err.response?.data?.message || 'Có lỗi xảy ra!');
    } finally {
      setLoading(false);
    }
  };

  const containerStyle = {
    backgroundImage: `linear-gradient(135deg, rgba(153, 170, 245, 0.05) 0%, rgba(118, 75, 162, 0.5) 100%), url('/img/img-nen-dangnhap/pexels-lulizler-3165335.jpg')`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat'
  };

  return (
    <div className="forgot-password-container" style={containerStyle}>
      <div className="forgot-password-box">
        <div className="forgot-password-header">
          <FiMail className="icon-large" />
          <h2>Quên mật khẩu</h2>
          <p>Nhập email của bạn để nhận link đặt lại mật khẩu</p>
        </div>

        {message && (
          <div className="alert alert-success">
            <FiCheckCircle className="success-icon" />
            <div>
              <p className="success-title">Gửi email thành công!</p>
              <p>{message}</p>
              <p className="email-note">Nếu không thấy email, vui lòng kiểm tra thư mục Spam.</p>
            </div>
          </div>
        )}

        {error && (
          <div className="alert alert-error">
            {error}
          </div>
        )}

        {!emailSent && (
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="email">
                <FiMail /> Email
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Nhập email của bạn"
                required
              />
            </div>

            <button type="submit" className="btn-submit" disabled={loading}>
              {loading ? 'Đang gửi...' : 'Gửi link reset mật khẩu'}
            </button>
          </form>
        )}

        {emailSent && (
          <button 
            className="btn-submit btn-resend" 
            onClick={() => setEmailSent(false)}
          >
            Gửi lại email
          </button>
        )}

        <div className="back-to-login">
          <Link to="/login">
            <FiArrowLeft /> Quay lại đăng nhập
          </Link>
        </div>
      </div>
    </div>
  );
}

export default ForgotPassword;
