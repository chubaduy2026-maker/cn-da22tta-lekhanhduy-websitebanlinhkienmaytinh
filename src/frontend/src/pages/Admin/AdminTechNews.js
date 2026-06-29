import React, { useCallback, useEffect, useState } from 'react';
import { FiPlus, FiEdit2, FiTrash2, FiEye, FiEyeOff, FiFileText } from 'react-icons/fi';
import Swal from 'sweetalert2';
import { techNewsAPI } from '../../services/api';
import './AdminTechNews.css';

const emptyForm = {
  title: '',
  summary: '',
  thumbnail: '',
  articleUrl: '',
  source: '',
  order: 0,
  isActive: true,
};

const AdminTechNews = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const loadItems = useCallback(async () => {
    try {
      setLoading(true);
      const response = await techNewsAPI.adminGetAll();
      if (response.data.success) {
        setItems(response.data.items || []);
      }
    } catch (error) {
      Swal.fire('Lỗi', 'Không thể tải danh sách tin tức', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(false);
  };

  const handleEdit = (item) => {
    setForm({
      title: item.title || '',
      summary: item.summary || '',
      thumbnail: item.thumbnail || '',
      articleUrl: item.articleUrl || '',
      source: item.source || '',
      order: item.order || 0,
      isActive: item.isActive,
    });
    setEditingId(item._id);
    setShowForm(true);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!form.title || !form.thumbnail || !form.articleUrl) {
      Swal.fire('Thiếu thông tin', 'Vui lòng nhập tiêu đề, thumbnail và link bài viết', 'warning');
      return;
    }

    try {
      if (editingId) {
        await techNewsAPI.update(editingId, form);
        Swal.fire('Thành công', 'Đã cập nhật tin tức', 'success');
      } else {
        await techNewsAPI.create(form);
        Swal.fire('Thành công', 'Đã thêm tin tức mới', 'success');
      }
      resetForm();
      loadItems();
    } catch (error) {
      Swal.fire('Lỗi', error.response?.data?.message || 'Có lỗi xảy ra', 'error');
    }
  };

  const handleDelete = async (id) => {
    const result = await Swal.fire({
      title: 'Xóa tin tức?',
      text: 'Bài viết sẽ bị xóa vĩnh viễn',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Xóa',
      cancelButtonText: 'Hủy',
      confirmButtonColor: '#e63946',
    });

    if (!result.isConfirmed) return;

    try {
      await techNewsAPI.delete(id);
      Swal.fire('Đã xóa', 'Tin tức đã được xóa', 'success');
      loadItems();
    } catch (error) {
      Swal.fire('Lỗi', 'Không thể xóa tin tức', 'error');
    }
  };

  const toggleActive = async (item) => {
    try {
      await techNewsAPI.update(item._id, {
        title: item.title,
        summary: item.summary || '',
        thumbnail: item.thumbnail,
        articleUrl: item.articleUrl,
        source: item.source || '',
        order: item.order || 0,
        isActive: !item.isActive,
      });
      loadItems();
    } catch (error) {
      Swal.fire('Lỗi', 'Không thể đổi trạng thái hiển thị', 'error');
    }
  };

  return (
    <div className="admin-tech-news">
      <div className="atn-header">
        <div>
          <h2><FiFileText /> Tin tức công nghệ</h2>
          <p>Quản lý các bài tin tức hiển thị tại trang chi tiết sản phẩm</p>
        </div>
        <button className="atn-add-btn" onClick={() => { resetForm(); setShowForm(true); }}>
          <FiPlus /> Thêm tin tức
        </button>
      </div>

      {showForm && (
        <div className="atn-form-card">
          <h3>{editingId ? 'Sửa tin tức' : 'Thêm tin tức mới'}</h3>
          <form onSubmit={handleSubmit}>
            <div className="atn-form-grid">
              <div className="atn-field">
                <label>Tiêu đề *</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(event) => setForm({ ...form, title: event.target.value })}
                  placeholder="VD: 5 mẹo bảo vệ laptop khỏi virus"
                />
              </div>

              <div className="atn-field">
                <label>Link bài viết *</label>
                <input
                  type="text"
                  value={form.articleUrl}
                  onChange={(event) => setForm({ ...form, articleUrl: event.target.value })}
                  placeholder="https://..."
                />
              </div>

              <div className="atn-field">
                <label>URL thumbnail *</label>
                <input
                  type="text"
                  value={form.thumbnail}
                  onChange={(event) => setForm({ ...form, thumbnail: event.target.value })}
                  placeholder="https://..."
                />
                {form.thumbnail && <img src={form.thumbnail} alt="Preview" className="atn-thumb-preview" />}
              </div>

              <div className="atn-field">
                <label>Tóm tắt ngắn</label>
                <textarea
                  value={form.summary}
                  onChange={(event) => setForm({ ...form, summary: event.target.value })}
                  rows={3}
                  placeholder="Mô tả ngắn hiển thị trong quản trị"
                />
              </div>

              <div className="atn-field half">
                <label>Nguồn</label>
                <input
                  type="text"
                  value={form.source}
                  onChange={(event) => setForm({ ...form, source: event.target.value })}
                  placeholder="VD: TechStore Blog"
                />
              </div>

              <div className="atn-field half">
                <label>Thứ tự hiển thị</label>
                <input
                  type="number"
                  value={form.order}
                  onChange={(event) => setForm({ ...form, order: parseInt(event.target.value, 10) || 0 })}
                  min="0"
                />
              </div>
            </div>

            <div className="atn-form-actions">
              <button type="submit" className="atn-save-btn">{editingId ? 'Cập nhật' : 'Thêm mới'}</button>
              <button type="button" className="atn-cancel-btn" onClick={resetForm}>Hủy</button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="atn-loading">Đang tải...</div>
      ) : items.length === 0 ? (
        <div className="atn-empty">
          <FiFileText size={46} />
          <p>Chưa có tin tức công nghệ nào</p>
          <button onClick={() => setShowForm(true)}>Thêm bài đầu tiên</button>
        </div>
      ) : (
        <div className="atn-grid">
          {items.map((item) => (
            <div className={`atn-card ${!item.isActive ? 'inactive' : ''}`} key={item._id}>
              <div className="atn-card-thumb">
                <img src={item.thumbnail} alt={item.title} />
                {!item.isActive && <div className="atn-inactive-badge">Đã ẩn</div>}
                <span className="atn-order-badge">#{item.order || 0}</span>
              </div>
              <div className="atn-card-body">
                <h4>{item.title}</h4>
                {item.source && <p className="atn-source">Nguồn: {item.source}</p>}
                {item.summary && <p className="atn-summary">{item.summary}</p>}
                <a href={item.articleUrl} target="_blank" rel="noopener noreferrer" className="atn-link">
                  Xem liên kết bài viết
                </a>
              </div>
              <div className="atn-card-actions">
                <button title={item.isActive ? 'Ẩn' : 'Hiện'} onClick={() => toggleActive(item)}>
                  {item.isActive ? <FiEye /> : <FiEyeOff />}
                </button>
                <button title="Sửa" onClick={() => handleEdit(item)}>
                  <FiEdit2 />
                </button>
                <button title="Xóa" className="delete" onClick={() => handleDelete(item._id)}>
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

export default AdminTechNews;
