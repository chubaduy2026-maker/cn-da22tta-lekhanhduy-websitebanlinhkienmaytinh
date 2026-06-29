import React, { useState, useEffect } from 'react';
import { FiStar, FiCheckCircle, FiTrash2, FiEye, FiSearch, FiRefreshCw } from 'react-icons/fi';
import api from '../../services/api';
import Swal from 'sweetalert2';
import './AdminReviews.css';

const AdminReviews = () => {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedReview, setSelectedReview] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [filter, setFilter] = useState('all'); // all, pending, approved, rejected
  const [searchTerm, setSearchTerm] = useState('');
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalReviews: 0
  });

  useEffect(() => {
    fetchReviews();
  }, [filter, pagination.currentPage]);

  const fetchReviews = async () => {
    try {
      setLoading(true);
      const response = await api.get('/admin/reviews', {
        params: {
          page: pagination.currentPage,
          limit: 10,
          status: filter === 'all' ? '' : filter,
          search: searchTerm
        }
      });
      
      setReviews(response.data.reviews || []);
      setPagination({
        currentPage: response.data.currentPage || 1,
        totalPages: response.data.totalPages || 1,
        totalReviews: response.data.totalReviews || 0
      });
    } catch (error) {
      console.error('Error fetching reviews:', error);
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
      await api.delete(`/admin/reviews/${reviewId}`);
      fetchReviews();
      setShowModal(false);
      Swal.fire('Thành công', 'Đã xóa đánh giá!', 'success');
    } catch (error) {
      console.error('Error deleting review:', error);
      Swal.fire('Lỗi', 'Lỗi khi xóa đánh giá', 'error');
    }
  };

  const renderStars = (rating) => {
    return (
      <div className="stars-display">
        {[1, 2, 3, 4, 5].map(star => (
          <FiStar
            key={star}
            className={star <= rating ? 'star filled' : 'star'}
          />
        ))}
      </div>
    );
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      pending: { label: 'Chờ duyệt', className: 'pending' },
      approved: { label: 'Đã duyệt', className: 'approved' },
      rejected: { label: 'Từ chối', className: 'rejected' }
    };
    const config = statusConfig[status] || statusConfig.pending;
    return <span className={`status-badge ${config.className}`}>{config.label}</span>;
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setPagination({ ...pagination, currentPage: 1 });
    fetchReviews();
  };

  return (
    <div className="admin-reviews">
      <div className="page-header">
        <h1>🌟 Quản lý đánh giá</h1>
        <p>Duyệt và quản lý đánh giá sản phẩm từ khách hàng</p>
      </div>

      {/* Stats Cards */}
      <div className="review-stats">
        <div className="stat-card total">
          <div className="stat-icon">
            <FiStar />
          </div>
          <div className="stat-info">
            <h3>{pagination.totalReviews}</h3>
            <p>Tổng đánh giá</p>
          </div>
        </div>
        <div className="stat-card approved">
          <div className="stat-icon">
            <FiCheckCircle />
          </div>
          <div className="stat-info">
            <h3>{reviews.filter(r => r.status === 'approved').length}</h3>
            <p>Đã duyệt</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="filters-bar">
        <div className="filter-tabs">
          <button 
            className={`filter-tab ${filter === 'all' ? 'active' : ''}`}
            onClick={() => { setFilter('all'); setPagination({ ...pagination, currentPage: 1 }); }}
          >
            Tất cả
          </button>
          <button 
            className={`filter-tab ${filter === 'pending' ? 'active' : ''}`}
            onClick={() => { setFilter('pending'); setPagination({ ...pagination, currentPage: 1 }); }}
          >
            Chờ duyệt
          </button>
          <button 
            className={`filter-tab ${filter === 'approved' ? 'active' : ''}`}
            onClick={() => { setFilter('approved'); setPagination({ ...pagination, currentPage: 1 }); }}
          >
            Đã duyệt
          </button>
          <button 
            className={`filter-tab ${filter === 'rejected' ? 'active' : ''}`}
            onClick={() => { setFilter('rejected'); setPagination({ ...pagination, currentPage: 1 }); }}
          >
            Từ chối
          </button>
        </div>

        <form className="search-form" onSubmit={handleSearch}>
          <div className="search-input-wrapper">
            <FiSearch className="search-icon" />
            <input
              type="text"
              placeholder="Tìm theo tên sản phẩm, người dùng..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button type="submit" className="btn-search">Tìm kiếm</button>
          <button type="button" className="btn-refresh" onClick={fetchReviews}>
            <FiRefreshCw />
          </button>
        </form>
      </div>

      {/* Reviews Table */}
      {loading ? (
        <div className="loading-spinner">Đang tải...</div>
      ) : reviews.length === 0 ? (
        <div className="empty-state">
          <p>Không có đánh giá nào</p>
        </div>
      ) : (
        <div className="reviews-table-wrapper">
          <table className="reviews-table">
            <thead>
              <tr>
                <th>Sản phẩm</th>
                <th>Người đánh giá</th>
                <th>Đánh giá</th>
                <th>Nội dung</th>
                <th>Ngày tạo</th>
                <th>Trạng thái</th>
                <th>Hành động</th>
              </tr>
            </thead>
            <tbody>
              {reviews.map(review => (
                <tr key={review._id}>
                  <td className="product-cell">
                    <div className="product-info">
                      {review.product?.images?.[0] && (
                        <img src={review.product.images[0]} alt={review.product.name} />
                      )}
                      <span className="product-name">{review.product?.name || 'N/A'}</span>
                    </div>
                  </td>
                  <td className="user-cell">
                    <div className="user-info">
                      <span className="user-name">{review.user?.name || 'Ẩn danh'}</span>
                      {review.verified && (
                        <span className="verified-tag">
                          <FiCheckCircle /> Đã mua
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="rating-cell">
                    {renderStars(review.rating)}
                    <span className="rating-number">{review.rating}/5</span>
                  </td>
                  <td className="comment-cell">
                    <p className="comment-preview">
                      {review.comment?.substring(0, 100)}
                      {review.comment?.length > 100 && '...'}
                    </p>
                  </td>
                  <td className="date-cell">
                    {formatDate(review.createdAt)}
                  </td>
                  <td className="status-cell">
                    {getStatusBadge(review.status)}
                  </td>
                  <td className="actions-cell">
                    <div className="action-buttons">
                      <button 
                        className="btn-action btn-view"
                        onClick={() => { setSelectedReview(review); setShowModal(true); }}
                        title="Xem chi tiết"
                      >
                        <FiEye />
                      </button>
                      <button 
                        className="btn-action btn-delete"
                        onClick={() => handleDeleteReview(review._id)}
                        title="Xóa"
                      >
                        <FiTrash2 />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="pagination">
          <button 
            onClick={() => setPagination({ ...pagination, currentPage: pagination.currentPage - 1 })}
            disabled={pagination.currentPage === 1}
          >
            Trước
          </button>
          <span>Trang {pagination.currentPage} / {pagination.totalPages}</span>
          <button 
            onClick={() => setPagination({ ...pagination, currentPage: pagination.currentPage + 1 })}
            disabled={pagination.currentPage === pagination.totalPages}
          >
            Sau
          </button>
        </div>
      )}

      {/* Review Detail Modal */}
      {showModal && selectedReview && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Chi tiết đánh giá</h2>
              <button className="btn-close" onClick={() => setShowModal(false)}>×</button>
            </div>
            
            <div className="modal-body">
              <div className="review-detail-section">
                <h3>Sản phẩm</h3>
                <div className="product-detail">
                  {selectedReview.product?.images?.[0] && (
                    <img src={selectedReview.product.images[0]} alt={selectedReview.product.name} />
                  )}
                  <div>
                    <p className="product-name">{selectedReview.product?.name}</p>
                    <p className="product-price">
                      {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(selectedReview.product?.price || 0)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="review-detail-section">
                <h3>Người đánh giá</h3>
                <p><strong>Tên:</strong> {selectedReview.user?.name}</p>
                <p><strong>Email:</strong> {selectedReview.user?.email}</p>
                {selectedReview.verified && (
                  <p className="verified-badge-large">
                    <FiCheckCircle /> Đã mua sản phẩm này
                  </p>
                )}
              </div>

              <div className="review-detail-section">
                <h3>Nội dung đánh giá</h3>
                <div className="rating-display">
                  {renderStars(selectedReview.rating)}
                  <span>{selectedReview.rating}/5 sao</span>
                </div>
                <p className="full-comment">{selectedReview.comment}</p>
                <p className="review-date">Đánh giá lúc: {formatDate(selectedReview.createdAt)}</p>
              </div>

              <div className="review-detail-section">
                <h3>Trạng thái</h3>
                {getStatusBadge(selectedReview.status)}
              </div>
            </div>

            <div className="modal-footer">
              <button 
                className="btn btn-delete"
                onClick={() => handleDeleteReview(selectedReview._id)}
              >
                <FiTrash2 /> Xóa đánh giá
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminReviews;
