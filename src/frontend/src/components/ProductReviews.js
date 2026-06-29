import React, { useState, useEffect } from 'react';
import { FiStar, FiThumbsUp, FiCheckCircle, FiEdit2, FiTrash2, FiCamera, FiX } from 'react-icons/fi';
import { reviewAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import Swal from 'sweetalert2';
import './ProductReviews.css';

const ProductReviews = ({ productId }) => {
  const { isAuthenticated, user } = useAuth();
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reviewStats, setReviewStats] = useState(null);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState('recent');
  const [editingReview, setEditingReview] = useState(null);
  const [reviewImages, setReviewImages] = useState([]);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [canReview, setCanReview] = useState(false);
  const [reviewStatus, setReviewStatus] = useState({ reason: '', message: '' });
  
  const [reviewForm, setReviewForm] = useState({
    rating: 5,
    comment: ''
  });
  
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchReviews();
    if (isAuthenticated) {
      checkCanReview();
    }
  }, [productId, currentPage, sortBy, isAuthenticated]);

  const checkCanReview = async () => {
    try {
      const response = await reviewAPI.canReview(productId);
      setCanReview(response.data.canReview);
      setReviewStatus({
        reason: response.data.reason || '',
        message: response.data.message || ''
      });
      if (response.data.existingReview) {
        setEditingReview(response.data.existingReview);
      }
    } catch (error) {
      console.error('Error checking review status:', error);
      setCanReview(false);
    }
  };

  const fetchReviews = async () => {
    try {
      setLoading(true);
      const response = await reviewAPI.getProductReviews(productId, {
        page: currentPage,
        limit: 5,
        sort: sortBy
      });
      
      setReviews(response.data.reviews);
      setReviewStats({
        totalReviews: response.data.totalReviews,
        averageRating: response.data.averageRating,
        ratingCounts: response.data.ratingCounts,
        totalPages: response.data.totalPages
      });
    } catch (error) {
      console.error('Error fetching reviews:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitReview = async (e) => {
    e.preventDefault();
    
    if (!isAuthenticated) {
      Swal.fire('Thông báo', 'Vui lòng đăng nhập để đánh giá', 'warning');
      return;
    }

    try {
      setSubmitting(true);
      
      if (editingReview) {
        // Cập nhật review đang sửa
        await reviewAPI.updateReview(editingReview._id, {
          rating: reviewForm.rating,
          comment: reviewForm.comment,
          images: reviewImages
        });
        Swal.fire('Thành công', 'Đã cập nhật đánh giá thành công!', 'success');
        setEditingReview(null);
      } else {
        // Tạo review mới
        await reviewAPI.createReview({
          productId,
          rating: reviewForm.rating,
          comment: reviewForm.comment,
          images: reviewImages
        });
        Swal.fire('Thành công', 'Đã gửi đánh giá thành công!', 'success');
      }
      
      setReviewForm({ rating: 5, comment: '' });
      setReviewImages([]);
      setShowReviewForm(false);
      fetchReviews();
    } catch (error) {
      Swal.fire('Lỗi', error.response?.data?.message || 'Lỗi khi gửi đánh giá', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditReview = (review) => {
    setEditingReview(review);
    setReviewForm({
      rating: review.rating,
      comment: review.comment
    });
    setReviewImages(review.images || []);
    setShowReviewForm(true);
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
      Swal.fire('Thành công', 'Đã xóa đánh giá thành công!', 'success');
      fetchReviews();
    } catch (error) {
      Swal.fire('Lỗi', error.response?.data?.message || 'Lỗi khi xóa đánh giá', 'error');
    }
  };

  const handleCancelEdit = () => {
    setEditingReview(null);
    setReviewForm({ rating: 5, comment: '' });
    setReviewImages([]);
    setShowReviewForm(false);
  };

  // Xử lý upload hình ảnh
  const handleImageUpload = (e) => {
    const files = Array.from(e.target.files);
    if (files.length + reviewImages.length > 5) {
      Swal.fire('Thông báo', 'Tối đa 5 hình ảnh!', 'warning');
      return;
    }

    setUploadingImages(true);
    
    files.forEach(file => {
      if (file.size > 5 * 1024 * 1024) {
        Swal.fire('Thông báo', 'Kích thước mỗi ảnh không được vượt quá 5MB', 'warning');
        setUploadingImages(false);
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        setReviewImages(prev => [...prev, reader.result]);
        setUploadingImages(false);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (index) => {
    setReviewImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleMarkHelpful = async (reviewId) => {
    if (!isAuthenticated) {
      Swal.fire('Thông báo', 'Vui lòng đăng nhập', 'warning');
      return;
    }

    try {
      await reviewAPI.markHelpful(reviewId);
      fetchReviews();
    } catch (error) {
      console.error('Error marking helpful:', error);
    }
  };

  const renderStars = (rating, interactive = false, onRatingChange = null) => {
    return (
      <div className={`stars ${interactive ? 'interactive' : ''}`}>
        {[1, 2, 3, 4, 5].map(star => (
          <FiStar
            key={star}
            className={star <= rating ? 'filled' : ''}
            onClick={() => interactive && onRatingChange && onRatingChange(star)}
          />
        ))}
      </div>
    );
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('vi-VN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getRatingPercentage = (rating) => {
    if (!reviewStats || reviewStats.totalReviews === 0) return 0;
    return ((reviewStats.ratingCounts[rating] || 0) / reviewStats.totalReviews) * 100;
  };

  if (loading && currentPage === 1) {
    return <div className="reviews-loading">Đang tải đánh giá...</div>;
  }

  return (
    <div className="product-reviews">
      <div className="reviews-header">
        <h2>Đánh giá sản phẩm</h2>
      </div>

      {reviewStats && reviewStats.totalReviews > 0 && (
        <div className="reviews-summary">
          <div className="summary-rating">
            <div className="average-rating">{reviewStats.averageRating.toFixed(1)}</div>
            {renderStars(Math.round(reviewStats.averageRating))}
            <div className="total-reviews">{reviewStats.totalReviews} đánh giá</div>
          </div>

          <div className="rating-breakdown">
            {[5, 4, 3, 2, 1].map(rating => (
              <div key={rating} className="rating-row">
                <span className="rating-label">{rating} sao</span>
                <div className="rating-bar">
                  <div 
                    className="rating-fill" 
                    style={{ width: `${getRatingPercentage(rating)}%` }}
                  />
                </div>
                <span className="rating-count">{reviewStats.ratingCounts[rating] || 0}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="reviews-actions">
        {isAuthenticated ? (
          canReview ? (
            <button 
              className="write-review-btn"
              onClick={() => {
                setEditingReview(null);
                setReviewForm({ rating: 5, comment: '' });
                setReviewImages([]);
                setShowReviewForm(!showReviewForm);
              }}
            >
              Viết đánh giá
            </button>
          ) : (
            <div className="review-notice">
              {reviewStatus.reason === 'not_purchased' && (
                <span className="notice-warning">⚠️ Bạn cần mua và nhận sản phẩm này trước khi đánh giá</span>
              )}
              {reviewStatus.reason === 'already_reviewed' && (
                <span className="notice-info">✅ Bạn đã đánh giá sản phẩm này</span>
              )}
            </div>
          )
        ) : (
          <div className="review-notice">
            <span className="notice-warning">🔒 Vui lòng đăng nhập để đánh giá</span>
          </div>
        )}

        <select 
          className="sort-select"
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
        >
          <option value="recent">Mới nhất</option>
          <option value="oldest">Cũ nhất</option>
          <option value="highest">Điểm cao nhất</option>
          <option value="lowest">Điểm thấp nhất</option>
          <option value="helpful">Hữu ích nhất</option>
        </select>
      </div>

      {showReviewForm && (
        <form className="review-form" onSubmit={handleSubmitReview}>
          <h3>{editingReview ? 'Chỉnh sửa đánh giá' : 'Viết đánh giá của bạn'}</h3>
          
          <div className="form-group">
            <label>Đánh giá của bạn:</label>
            {renderStars(reviewForm.rating, true, (rating) => 
              setReviewForm({ ...reviewForm, rating })
            )}
          </div>

          <div className="form-group">
            <label>Nhận xét:</label>
            <textarea
              value={reviewForm.comment}
              onChange={(e) => setReviewForm({ ...reviewForm, comment: e.target.value })}
              placeholder="Chia sẻ trải nghiệm của bạn về sản phẩm..."
              required
              rows="5"
            />
          </div>

          <div className="form-group">
            <label>Thêm hình ảnh (tối đa 5 ảnh):</label>
            <div className="review-images-upload">
              {reviewImages.map((img, index) => (
                <div key={index} className="review-image-preview">
                  <img src={img} alt={`Preview ${index + 1}`} />
                  <button 
                    type="button" 
                    className="remove-image-btn"
                    onClick={() => removeImage(index)}
                  >
                    <FiX />
                  </button>
                </div>
              ))}
              {reviewImages.length < 5 && (
                <label className="add-image-btn">
                  <FiCamera />
                  <span>Thêm ảnh</span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleImageUpload}
                    hidden
                  />
                </label>
              )}
            </div>
            {uploadingImages && <span className="uploading-text">Đang tải ảnh...</span>}
          </div>

          <div className="form-actions">
            <button type="button" onClick={handleCancelEdit}>
              Hủy
            </button>
            <button type="submit" disabled={submitting || uploadingImages}>
              {submitting ? 'Đang gửi...' : (editingReview ? 'Cập nhật' : 'Gửi đánh giá')}
            </button>
          </div>
        </form>
      )}

      <div className="reviews-list">
        {reviews.length === 0 ? (
          <div className="no-reviews">
            <p>Chưa có đánh giá nào cho sản phẩm này</p>
            {isAuthenticated && (
              <button onClick={() => setShowReviewForm(true)}>
                Hãy là người đầu tiên đánh giá
              </button>
            )}
          </div>
        ) : (
          reviews.map(review => (
            <div key={review._id} className="review-item">
              <div className="review-header">
                <div className="reviewer-info">
                  <div className="reviewer-avatar">
                    {review.user?.avatar ? (
                      <img src={review.user.avatar} alt={review.user.name || 'Avatar'} />
                    ) : (
                      <span className="avatar-placeholder">
                        {(review.user?.name || 'A').charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="reviewer-details">
                    <div className="reviewer-name">
                      {review.user?.name || 'Ẩn danh'}
                      {review.verified && (
                        <span className="verified-badge" title="Đã mua sản phẩm">
                          <FiCheckCircle /> Đã mua hàng
                        </span>
                      )}
                    </div>
                    <div className="review-date">{formatDate(review.createdAt)}</div>
                  </div>
                </div>
                {renderStars(review.rating)}
              </div>

              <div className="review-content">
                <p>{review.comment}</p>
                
                {review.images && review.images.length > 0 && (
                  <div className="review-images-display">
                    {review.images.map((img, idx) => (
                      <img 
                        key={idx} 
                        src={img} 
                        alt={`Review ${idx + 1}`}
                        onClick={() => window.open(img, '_blank')}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Phản hồi từ Admin/Shop */}
              {review.adminReply && review.adminReply.content && (
                <div className="admin-reply">
                  <div className="admin-reply-header">
                    <span className="admin-badge">🏪 {review.adminReply.repliedBy || 'TechStore'}</span>
                    <span className="reply-date">
                      {review.adminReply.repliedAt && formatDate(review.adminReply.repliedAt)}
                    </span>
                  </div>
                  <div className="admin-reply-content">
                    {review.adminReply.content}
                  </div>
                </div>
              )}

              <div className="review-actions">
                <button 
                  className={`helpful-btn ${review.helpfulBy?.includes(user?._id) ? 'active' : ''}`}
                  onClick={() => handleMarkHelpful(review._id)}
                  disabled={!isAuthenticated}
                >
                  <FiThumbsUp /> Hữu ích ({review.helpful || 0})
                </button>
                
                {/* Nút sửa và xóa cho chủ đánh giá */}
                {isAuthenticated && user && review.user?._id === user._id && (
                  <div className="owner-actions">
                    <button 
                      className="edit-btn"
                      onClick={() => handleEditReview(review)}
                      title="Sửa đánh giá"
                    >
                      <FiEdit2 /> Sửa
                    </button>
                    <button 
                      className="delete-btn"
                      onClick={() => handleDeleteReview(review._id)}
                      title="Xóa đánh giá"
                    >
                      <FiTrash2 /> Xóa
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {reviewStats && reviewStats.totalPages > 1 && (
        <div className="reviews-pagination">
          <button 
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
          >
            Trước
          </button>
          <span>Trang {currentPage} / {reviewStats.totalPages}</span>
          <button 
            onClick={() => setCurrentPage(p => Math.min(reviewStats.totalPages, p + 1))}
            disabled={currentPage === reviewStats.totalPages}
          >
            Sau
          </button>
        </div>
      )}
    </div>
  );
};

export default ProductReviews;
