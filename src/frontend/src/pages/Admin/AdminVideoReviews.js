import React, { useState, useEffect, useCallback } from 'react';
import { FiPlus, FiEdit2, FiTrash2, FiEye, FiEyeOff, FiVideo, FiSearch } from 'react-icons/fi';
import { videoReviewAPI, productAPI } from '../../services/api';
import Swal from 'sweetalert2';
import './AdminVideoReviews.css';

const AdminVideoReviews = () => {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [productSearch, setProductSearch] = useState('');
  const [productResults, setProductResults] = useState([]);
  const [searchingProducts, setSearchingProducts] = useState(false);
  const [form, setForm] = useState({
    title: '',
    videoUrl: '',
    thumbnail: '',
    product: null,
    reviewer: '',
    order: 0,
    isActive: true
  });

  const loadVideos = useCallback(async () => {
    try {
      setLoading(true);
      const res = await videoReviewAPI.adminGetAll();
      if (res.data.success) setVideos(res.data.videos);
    } catch (err) {
      Swal.fire('Lỗi', 'Không thể tải danh sách video', 'error');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadVideos();
  }, [loadVideos]);

  // Auto-extract YouTube thumbnail
  const extractYouTubeThumbnail = (url) => {
    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([^&?#]+)/);
    if (match) return `https://img.youtube.com/vi/${match[1]}/maxresdefault.jpg`;
    return '';
  };

  const handleVideoUrlChange = (url) => {
    setForm(prev => {
      const newForm = { ...prev, videoUrl: url };
      if (!prev.thumbnail || prev.thumbnail.includes('img.youtube.com')) {
        const autoThumb = extractYouTubeThumbnail(url);
        if (autoThumb) newForm.thumbnail = autoThumb;
      }
      return newForm;
    });
  };

  const searchProducts = async (query) => {
    setProductSearch(query);
    if (query.length < 2) {
      setProductResults([]);
      return;
    }

    // Detect product URL or ObjectId
    const idMatch = query.match(/product\/([a-f0-9]{24})/i) || query.match(/^([a-f0-9]{24})$/i);
    if (idMatch) {
      setSearchingProducts(true);
      try {
        const res = await productAPI.getById(idMatch[1]);
        if (res.data) {
          const product = res.data.product || res.data;
          selectProduct(product);
          setSearchingProducts(false);
          return;
        }
      } catch {
        // ID not found, fall through to name search
      }
      setSearchingProducts(false);
      return;
    }

    setSearchingProducts(true);
    try {
      const res = await productAPI.getAll({ search: query, limit: 5 });
      setProductResults(res.data.products || []);
    } catch {
      setProductResults([]);
    }
    setSearchingProducts(false);
  };

  const selectProduct = (product) => {
    setForm(prev => ({ ...prev, product }));
    setProductSearch('');
    setProductResults([]);
  };

  const resetForm = () => {
    setForm({ title: '', videoUrl: '', thumbnail: '', product: null, reviewer: '', order: 0, isActive: true });
    setEditingId(null);
    setShowForm(false);
    setProductSearch('');
    setProductResults([]);
  };

  const handleEdit = (video) => {
    setForm({
      title: video.title,
      videoUrl: video.videoUrl,
      thumbnail: video.thumbnail,
      product: video.product,
      reviewer: video.reviewer || '',
      order: video.order || 0,
      isActive: video.isActive
    });
    setEditingId(video._id);
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title || !form.videoUrl || !form.thumbnail || !form.product) {
      Swal.fire('Thiếu thông tin', 'Vui lòng điền đầy đủ tiêu đề, URL video, thumbnail và sản phẩm', 'warning');
      return;
    }

    try {
      const payload = {
        title: form.title,
        videoUrl: form.videoUrl,
        thumbnail: form.thumbnail,
        product: form.product._id,
        reviewer: form.reviewer,
        order: form.order,
        isActive: form.isActive
      };

      if (editingId) {
        await videoReviewAPI.update(editingId, payload);
        Swal.fire('Thành công', 'Đã cập nhật video review', 'success');
      } else {
        await videoReviewAPI.create(payload);
        Swal.fire('Thành công', 'Đã thêm video review mới', 'success');
      }
      resetForm();
      loadVideos();
    } catch (err) {
      Swal.fire('Lỗi', err.response?.data?.message || 'Có lỗi xảy ra', 'error');
    }
  };

  const handleDelete = async (id) => {
    const result = await Swal.fire({
      title: 'Xác nhận xóa?',
      text: 'Video review sẽ bị xóa vĩnh viễn',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#e63946',
      cancelButtonText: 'Hủy',
      confirmButtonText: 'Xóa'
    });
    if (!result.isConfirmed) return;

    try {
      await videoReviewAPI.delete(id);
      Swal.fire('Đã xóa', 'Video review đã được xóa', 'success');
      loadVideos();
    } catch {
      Swal.fire('Lỗi', 'Không thể xóa video', 'error');
    }
  };

  const toggleActive = async (video) => {
    try {
      await videoReviewAPI.update(video._id, { ...video, product: video.product?._id, isActive: !video.isActive });
      loadVideos();
    } catch {
      Swal.fire('Lỗi', 'Không thể thay đổi trạng thái', 'error');
    }
  };

  return (
    <div className="admin-video-reviews">
      <div className="avr-header">
        <div>
          <h2><FiVideo /> Video Review</h2>
          <p>Quản lý clip review sản phẩm hiển thị trên trang chủ</p>
        </div>
        <button className="avr-add-btn" onClick={() => { resetForm(); setShowForm(true); }}>
          <FiPlus /> Thêm video
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="avr-form-card">
          <h3>{editingId ? 'Sửa video review' : 'Thêm video review mới'}</h3>
          <form onSubmit={handleSubmit}>
            <div className="avr-form-grid">
              <div className="avr-field">
                <label>Tiêu đề *</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={e => setForm({ ...form, title: e.target.value })}
                  placeholder="VD: Review Laptop Acer Nitro 5 - Quá ngon trong tầm giá"
                />
              </div>

              <div className="avr-field">
                <label>URL Video (YouTube) *</label>
                <input
                  type="text"
                  value={form.videoUrl}
                  onChange={e => handleVideoUrlChange(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=..."
                />
              </div>

              <div className="avr-field">
                <label>URL Thumbnail *</label>
                <input
                  type="text"
                  value={form.thumbnail}
                  onChange={e => setForm({ ...form, thumbnail: e.target.value })}
                  placeholder="URL ảnh thumbnail (tự động lấy nếu dùng YouTube)"
                />
                {form.thumbnail && (
                  <img src={form.thumbnail} alt="Preview" className="avr-thumb-preview" />
                )}
              </div>

              <div className="avr-field">
                <label>Sản phẩm liên kết *</label>
                {form.product ? (
                  <div className="avr-selected-product">
                    <img src={form.product.image} alt={form.product.name} />
                    <span>{form.product.name}</span>
                    <button type="button" onClick={() => setForm({ ...form, product: null })}>✕</button>
                  </div>
                ) : (
                  <div className="avr-product-search">
                    <FiSearch className="search-icon" />
                    <input
                      type="text"
                      value={productSearch}
                      onChange={e => searchProducts(e.target.value)}
                      placeholder="Tìm theo tên hoặc dán URL sản phẩm..."
                    />
                    {productResults.length > 0 && (
                      <div className="avr-product-dropdown">
                        {productResults.map(p => (
                          <div key={p._id} className="avr-product-option" onClick={() => selectProduct(p)}>
                            <img src={p.image} alt={p.name} />
                            <div>
                              <span className="option-name">{p.name}</span>
                              <span className="option-price">{p.price?.toLocaleString('vi-VN')}₫</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {searchingProducts && <span className="avr-searching">Đang tìm...</span>}
                  </div>
                )}
              </div>

              <div className="avr-field half">
                <label>Người review</label>
                <input
                  type="text"
                  value={form.reviewer}
                  onChange={e => setForm({ ...form, reviewer: e.target.value })}
                  placeholder="VD: TechReview"
                />
              </div>

              <div className="avr-field half">
                <label>Thứ tự hiển thị</label>
                <input
                  type="number"
                  value={form.order}
                  onChange={e => setForm({ ...form, order: parseInt(e.target.value) || 0 })}
                  min="0"
                />
              </div>
            </div>

            <div className="avr-form-actions">
              <button type="submit" className="avr-save-btn">
                {editingId ? 'Cập nhật' : 'Thêm mới'}
              </button>
              <button type="button" className="avr-cancel-btn" onClick={resetForm}>
                Hủy
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Video List */}
      {loading ? (
        <div className="avr-loading">Đang tải...</div>
      ) : videos.length === 0 ? (
        <div className="avr-empty">
          <FiVideo size={48} />
          <p>Chưa có video review nào</p>
          <button onClick={() => setShowForm(true)}>Thêm video đầu tiên</button>
        </div>
      ) : (
        <div className="avr-grid">
          {videos.map(video => (
            <div className={`avr-card ${!video.isActive ? 'inactive' : ''}`} key={video._id}>
              <div className="avr-card-thumb">
                <img src={video.thumbnail} alt={video.title} />
                {!video.isActive && <div className="avr-inactive-badge">Đã ẩn</div>}
                <span className="avr-order-badge">#{video.order}</span>
              </div>
              <div className="avr-card-body">
                <h4>{video.title}</h4>
                {video.product && (
                  <div className="avr-card-product">
                    <img src={video.product.image} alt={video.product.name} />
                    <span>{video.product.name}</span>
                  </div>
                )}
                {video.reviewer && <p className="avr-reviewer">👤 {video.reviewer}</p>}
              </div>
              <div className="avr-card-actions">
                <button title={video.isActive ? 'Ẩn' : 'Hiện'} onClick={() => toggleActive(video)}>
                  {video.isActive ? <FiEye /> : <FiEyeOff />}
                </button>
                <button title="Sửa" onClick={() => handleEdit(video)}>
                  <FiEdit2 />
                </button>
                <button title="Xóa" className="delete" onClick={() => handleDelete(video._id)}>
                  <FiTrash2 />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminVideoReviews;
