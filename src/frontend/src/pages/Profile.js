import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authAPI, reviewAPI } from '../services/api';
import { FiUser, FiMail, FiPhone, FiMapPin, FiEdit2, FiCamera, FiLock, FiStar, FiPackage, FiTrash2 } from 'react-icons/fi';
import Swal from 'sweetalert2';
import './Profile.css';

const Profile = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState('info');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [userReviews, setUserReviews] = useState([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);

  // Form states
  const [profileData, setProfileData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    avatar: ''
  });

  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  const [isEditing, setIsEditing] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState('');

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      setProfileData({
        name: user.name || '',
        email: user.email || '',
        phone: user.phone || '',
        address: user.address || '',
        avatar: user.avatar || ''
      });
      setAvatarPreview(user.avatar || '');
    }
  }, [user]);

  useEffect(() => {
    if (activeTab === 'reviews' && user) {
      fetchUserReviews();
    }
  }, [activeTab, user]);

  const fetchUserReviews = async () => {
    try {
      setReviewsLoading(true);
      const response = await authAPI.getUserReviews();
      setUserReviews(response.data.reviews || []);
    } catch (error) {
      console.error('Error fetching reviews:', error);
      setUserReviews([]);
    } finally {
      setReviewsLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setProfileData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setMessage({ type: 'error', text: 'Kích thước ảnh không được vượt quá 5MB' });
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result);
        setProfileData(prev => ({
          ...prev,
          avatar: reader.result
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      setMessage({ type: '', text: '' });

      await authAPI.updateProfile({
        name: profileData.name,
        phone: profileData.phone,
        address: profileData.address,
        avatar: profileData.avatar
      });

      setMessage({ type: 'success', text: 'Cập nhật thông tin thành công!' });
      setIsEditing(false);

      // Refresh user data
      window.location.reload();
    } catch (error) {
      setMessage({
        type: 'error',
        text: error.response?.data?.message || 'Lỗi khi cập nhật thông tin'
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setMessage({ type: 'error', text: 'Mật khẩu mới không khớp!' });
      return;
    }

    if (passwordData.newPassword.length < 6) {
      setMessage({ type: 'error', text: 'Mật khẩu mới phải có ít nhất 6 ký tự!' });
      return;
    }

    try {
      setLoading(true);
      setMessage({ type: '', text: '' });

      await authAPI.changePassword(passwordData.currentPassword, passwordData.newPassword);

      setMessage({ type: 'success', text: 'Đổi mật khẩu thành công!' });
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
    } catch (error) {
      setMessage({
        type: 'error',
        text: error.response?.data?.message || 'Lỗi khi đổi mật khẩu'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteReview = async (reviewId) => {
    const result = await Swal.fire({
      title: 'Xác nhận xóa',
      text: 'Bạn có chắc muốn xóa đánh giá này?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Xóa',
      cancelButtonText: 'Hủy'
    });
    if (!result.isConfirmed) return;

    try {
      await reviewAPI.deleteReview(reviewId);
      setUserReviews(prev => prev.filter(r => r._id !== reviewId));
      setMessage({ type: 'success', text: 'Đã xóa đánh giá!' });
    } catch (error) {
      setMessage({ type: 'error', text: 'Lỗi khi xóa đánh giá' });
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('vi-VN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const renderStars = (rating) => {
    return [...Array(5)].map((_, i) => (
      <FiStar
        key={i}
        className={i < rating ? 'star-filled' : 'star-empty'}
        fill={i < rating ? '#f59e0b' : 'none'}
      />
    ));
  };

  if (authLoading) {
    return <div className="profile-loading">Đang tải...</div>;
  }

  if (!user) {
    return null;
  }

  return (
    <div className="profile-page">
      <div className="profile-container">
        <div className="profile-sidebar">
          <div className="profile-avatar-section">
            <div className="avatar-wrapper">
              <img
                src={avatarPreview || '/img/default-avatar.svg'}
                alt="Avatar"
                className="profile-avatar"
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = '/img/default-avatar.svg';
                }}
              />
              {isEditing && (
                <label className="avatar-upload-btn">
                  <FiCamera />
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarChange}
                    hidden
                  />
                </label>
              )}
            </div>
            <h2 className="profile-name">{user.name}</h2>
            {user?.role !== 'staff' && <p className="profile-email">{user.email}</p>}
          </div>

          <nav className="profile-nav">
            <button
              className={`nav-item ${activeTab === 'info' ? 'active' : ''}`}
              onClick={() => setActiveTab('info')}
            >
              <FiUser /> Thông tin cá nhân
            </button>
            <button
              className={`nav-item ${activeTab === 'password' ? 'active' : ''}`}
              onClick={() => setActiveTab('password')}
            >
              <FiLock /> Đổi mật khẩu
            </button>
            {user?.role !== 'staff' && (
              <button
                className={`nav-item ${activeTab === 'reviews' ? 'active' : ''}`}
                onClick={() => setActiveTab('reviews')}
              >
                <FiStar /> Đánh giá của tôi
              </button>
            )}
          </nav>
        </div>

        <div className="profile-content">
          {message.text && (
            <div className={`message ${message.type}`}>
              {message.text}
            </div>
          )}

          {/* Tab: Thông tin cá nhân */}
          {activeTab === 'info' && (
            <div className="profile-section">
              <div className="section-header">
                <h2>Thông tin cá nhân</h2>
                {!isEditing && (
                  <button className="edit-btn" onClick={() => setIsEditing(true)}>
                    <FiEdit2 /> Chỉnh sửa
                  </button>
                )}
              </div>

              <form onSubmit={handleProfileSubmit} className="profile-form">
                <div className="form-group">
                  <label><FiUser /> Họ và tên</label>
                  <input
                    type="text"
                    name="name"
                    value={profileData.name}
                    onChange={handleInputChange}
                    disabled={!isEditing}
                    required
                  />
                </div>

                <div className="form-group">
                  <label><FiMail /> Email</label>
                  <input
                    type="email"
                    name="email"
                    value={profileData.email}
                    disabled
                    className="disabled-input"
                  />
                  <small>Email không thể thay đổi</small>
                </div>

                <div className="form-group">
                  <label><FiPhone /> Số điện thoại</label>
                  <input
                    type="tel"
                    name="phone"
                    value={profileData.phone}
                    onChange={handleInputChange}
                    disabled={!isEditing}
                    placeholder="Nhập số điện thoại"
                  />
                </div>

                <div className="form-group">
                  <label><FiMapPin /> Địa chỉ</label>
                  <textarea
                    name="address"
                    value={profileData.address}
                    onChange={handleInputChange}
                    disabled={!isEditing}
                    placeholder="Nhập địa chỉ"
                    rows="3"
                  />
                </div>

                {isEditing && (
                  <div className="form-actions">
                    <button
                      type="button"
                      className="cancel-btn"
                      onClick={() => {
                        setIsEditing(false);
                        setProfileData({
                          name: user.name || '',
                          email: user.email || '',
                          phone: user.phone || '',
                          address: user.address || '',
                          avatar: user.avatar || ''
                        });
                        setAvatarPreview(user.avatar || '');
                      }}
                    >
                      Hủy
                    </button>
                    <button type="submit" className="save-btn" disabled={loading}>
                      {loading ? 'Đang lưu...' : 'Lưu thay đổi'}
                    </button>
                  </div>
                )}
              </form>
            </div>
          )}

          {/* Tab: Đổi mật khẩu */}
          {activeTab === 'password' && (
            <div className="profile-section">
              <div className="section-header">
                <h2>Đổi mật khẩu</h2>
              </div>

              {user.authProvider !== 'local' && (
                <div className="oauth-notice">
                  <p>⚠️ Bạn đã đăng nhập bằng Google.
                    Không thể đổi mật khẩu cho tài khoản liên kết.</p>
                </div>
              )}

              {user.authProvider === 'local' && (
                <form onSubmit={handlePasswordSubmit} className="password-form">
                  <div className="form-group">
                    <label>Mật khẩu hiện tại</label>
                    <input
                      type="password"
                      name="currentPassword"
                      value={passwordData.currentPassword}
                      onChange={handlePasswordChange}
                      required
                      placeholder="Nhập mật khẩu hiện tại"
                    />
                  </div>

                  <div className="form-group">
                    <label>Mật khẩu mới</label>
                    <input
                      type="password"
                      name="newPassword"
                      value={passwordData.newPassword}
                      onChange={handlePasswordChange}
                      required
                      minLength="6"
                      placeholder="Nhập mật khẩu mới (ít nhất 6 ký tự)"
                    />
                  </div>

                  <div className="form-group">
                    <label>Xác nhận mật khẩu mới</label>
                    <input
                      type="password"
                      name="confirmPassword"
                      value={passwordData.confirmPassword}
                      onChange={handlePasswordChange}
                      required
                      placeholder="Nhập lại mật khẩu mới"
                    />
                  </div>

                  <div className="form-actions">
                    <button type="submit" className="save-btn" disabled={loading}>
                      {loading ? 'Đang xử lý...' : 'Đổi mật khẩu'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* Tab: Đánh giá của tôi */}
          {activeTab === 'reviews' && (
            <div className="profile-section">
              <div className="section-header">
                <h2>Đánh giá của tôi</h2>
              </div>

              {reviewsLoading ? (
                <div className="reviews-loading">Đang tải đánh giá...</div>
              ) : userReviews.length === 0 ? (
                <div className="no-reviews">
                  <FiStar size={48} />
                  <p>Bạn chưa có đánh giá nào</p>
                  <button onClick={() => navigate('/')} className="shop-btn">
                    Mua sắm ngay
                  </button>
                </div>
              ) : (
                <div className="reviews-list">
                  {userReviews.map((review) => (
                    <div key={review._id} className="review-card">
                      <div className="review-product">
                        <img
                          src={review.product?.images?.[0] || 'https://via.placeholder.com/80'}
                          alt={review.product?.name}
                          onClick={() => navigate(`/product/${review.product?._id}`)}
                        />
                        <div className="product-info">
                          <h4 onClick={() => navigate(`/product/${review.product?._id}`)}>
                            {review.product?.name || 'Sản phẩm đã bị xóa'}
                          </h4>
                          <div className="review-rating">
                            {renderStars(review.rating)}
                          </div>
                          <span className="review-date">{formatDate(review.createdAt)}</span>
                        </div>
                      </div>

                      <div className="review-content">
                        <p>{review.comment}</p>

                        {review.images && review.images.length > 0 && (
                          <div className="review-images">
                            {review.images.map((img, idx) => (
                              <img
                                key={idx}
                                src={img}
                                alt={`Review ${idx + 1}`}
                                onClick={() => window.open(img, '_blank')}
                                style={{ cursor: 'pointer' }}
                              />
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="review-actions">
                        <button
                          className="delete-review-btn"
                          onClick={() => handleDeleteReview(review._id)}
                        >
                          <FiTrash2 /> Xóa
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Profile;
