import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FiPlus, FiEdit2, FiTrash2, FiPackage, FiToggleLeft, FiToggleRight } from 'react-icons/fi';
import Swal from 'sweetalert2';
import './AdminCategories.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

function AdminCategories() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    icon: '📦',
    order: 0,
    isActive: true
  });
  const [error, setError] = useState('');
  const [iconType, setIconType] = useState('emoji'); // 'emoji', 'upload', 'url'
  const [uploadingImage, setUploadingImage] = useState(false);

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/categories/all`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCategories(response.data);
    } catch (error) {
      console.error('Lỗi khi lấy danh mục:', error);
      setError('Không thể tải danh sách danh mục!');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (category = null) => {
    if (category) {
      setEditingCategory(category);
      setFormData({
        name: category.name,
        description: category.description || '',
        icon: category.icon || '📦',
        order: category.order || 0,
        isActive: category.isActive
      });
      // Xác định loại icon
      if (category.icon?.startsWith('http') || category.icon?.startsWith('/')) {
        setIconType('url');
      } else {
        setIconType('emoji');
      }
    } else {
      setEditingCategory(null);
      setFormData({
        name: '',
        description: '',
        icon: '📦',
        order: 0,
        isActive: true
      });
      setIconType('emoji');
    }
    setShowModal(true);
    setError('');
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingCategory(null);
    setError('');
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Kiểm tra loại file
    if (!file.type.startsWith('image/')) {
      Swal.fire('Lỗi', 'Vui lòng chọn file ảnh!', 'error');
      return;
    }

    // Kiểm tra kích thước (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      Swal.fire('Lỗi', 'Kích thước ảnh không được vượt quá 2MB!', 'error');
      return;
    }

    try {
      setUploadingImage(true);
      const token = localStorage.getItem('token');
      const formDataUpload = new FormData();
      formDataUpload.append('image', file);

      const response = await axios.post(`${API_URL}/upload`, formDataUpload, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      // Cập nhật icon với đường dẫn ảnh
      setFormData(prev => ({
        ...prev,
        icon: response.data.imageUrl
      }));

      Swal.fire('Thành công', 'Upload ảnh thành công!', 'success');
    } catch (error) {
      console.error('Lỗi khi upload ảnh:', error);
      Swal.fire('Lỗi', error.response?.data?.message || 'Có lỗi khi upload ảnh!', 'error');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleIconTypeChange = (type) => {
    setIconType(type);
    if (type === 'emoji') {
      setFormData(prev => ({ ...prev, icon: '📦' }));
    } else if (type === 'url') {
      setFormData(prev => ({ ...prev, icon: '' }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      const token = localStorage.getItem('token');
      
      if (editingCategory) {
        // Cập nhật
        await axios.put(
          `${API_URL}/categories/${editingCategory._id}`,
          formData,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        Swal.fire('Thành công', 'Cập nhật danh mục thành công!', 'success');
      } else {
        // Tạo mới
        await axios.post(
          `${API_URL}/categories`,
          formData,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        Swal.fire('Thành công', 'Thêm danh mục thành công!', 'success');
      }

      handleCloseModal();
      fetchCategories();
    } catch (error) {
      setError(error.response?.data?.message || 'Có lỗi xảy ra!');
    }
  };

  const handleDelete = async (id, name) => {
    const result = await Swal.fire({
      title: 'Xác nhận xóa',
      text: `Bạn có chắc muốn xóa danh mục "${name}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Xóa',
      cancelButtonText: 'Hủy'
    });

    if (!result.isConfirmed) return;

    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API_URL}/categories/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      Swal.fire('Đã xóa!', 'Xóa danh mục thành công!', 'success');
      fetchCategories();
    } catch (error) {
      Swal.fire('Lỗi', error.response?.data?.message || 'Có lỗi khi xóa danh mục!', 'error');
    }
  };

  const handleToggleActive = async (category) => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `${API_URL}/categories/${category._id}`,
        { isActive: !category.isActive },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      fetchCategories();
    } catch (error) {
      Swal.fire('Lỗi', 'Có lỗi khi cập nhật trạng thái!', 'error');
    }
  };

  if (loading) {
    return <div className="loading">Đang tải...</div>;
  }

  return (
    <div className="admin-categories">
      <div className="categories-header">
        <h1>
          <FiPackage /> Quản lý Danh mục
        </h1>
        <button className="btn-add" onClick={() => handleOpenModal()}>
          <FiPlus /> Thêm danh mục
        </button>
      </div>

      {error && !showModal && (
        <div className="alert alert-error">{error}</div>
      )}

      <div className="categories-table-container">
        <table className="categories-table">
          <thead>
            <tr>
              <th>Icon</th>
              <th>Tên danh mục</th>
              <th>Mô tả</th>
              <th>Số sản phẩm</th>
              <th>Thứ tự</th>
              <th>Trạng thái</th>
              <th>Hành động</th>
            </tr>
          </thead>
          <tbody>
            {categories.length === 0 ? (
              <tr>
                <td colSpan="7" className="no-data">
                  Chưa có danh mục nào
                </td>
              </tr>
            ) : (
              categories.map((category) => (
                <tr key={category._id}>
                  <td className="category-icon">
                    {category.icon?.startsWith('http') || category.icon?.startsWith('/') ? (
                      <img 
                        src={category.icon?.startsWith('http') ? category.icon : category.icon}
                        alt={category.name}
                        className="category-icon-image"
                        onError={(e) => e.target.style.display = 'none'}
                      />
                    ) : (
                      <span style={{ fontSize: '32px' }}>{category.icon}</span>
                    )}
                  </td>
                  <td className="category-name">{category.name}</td>
                  <td className="category-description">
                    {category.description || '-'}
                  </td>
                  <td className="category-count">
                    <span className="badge badge-info">
                      {category.productCount || 0} sản phẩm
                    </span>
                  </td>
                  <td className="category-order">{category.order}</td>
                  <td>
                    <button
                      className={`btn-toggle ${category.isActive ? 'active' : 'inactive'}`}
                      onClick={() => handleToggleActive(category)}
                      title={category.isActive ? 'Vô hiệu hóa' : 'Kích hoạt'}
                    >
                      {category.isActive ? (
                        <>
                          <FiToggleRight /> Hoạt động
                        </>
                      ) : (
                        <>
                          <FiToggleLeft /> Tắt
                        </>
                      )}
                    </button>
                  </td>
                  <td className="category-actions">
                    <button
                      className="btn-edit"
                      onClick={() => handleOpenModal(category)}
                      title="Chỉnh sửa"
                    >
                      <FiEdit2 />
                    </button>
                    <button
                      className="btn-delete"
                      onClick={() => handleDelete(category._id, category.name)}
                      title="Xóa"
                    >
                      <FiTrash2 />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal thêm/sửa */}
      {showModal && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingCategory ? 'Chỉnh sửa danh mục' : 'Thêm danh mục mới'}</h2>
              <button className="btn-close" onClick={handleCloseModal}>×</button>
            </div>

            {error && (
              <div className="alert alert-error">{error}</div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="name">Tên danh mục *</label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  placeholder="VD: Điện thoại"
                />
              </div>

              <div className="form-group">
                <label htmlFor="description">Mô tả</label>
                <textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  rows="3"
                  placeholder="Mô tả về danh mục..."
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Icon danh mục</label>
                  
                  <div className="icon-type-selector">
                    <label className="radio-label">
                      <input
                        type="radio"
                        name="iconType"
                        value="emoji"
                        checked={iconType === 'emoji'}
                        onChange={() => handleIconTypeChange('emoji')}
                      />
                      <span>Emoji</span>
                    </label>
                    <label className="radio-label">
                      <input
                        type="radio"
                        name="iconType"
                        value="upload"
                        checked={iconType === 'upload'}
                        onChange={() => handleIconTypeChange('upload')}
                      />
                      <span>Upload ảnh</span>
                    </label>
                    <label className="radio-label">
                      <input
                        type="radio"
                        name="iconType"
                        value="url"
                        checked={iconType === 'url'}
                        onChange={() => handleIconTypeChange('url')}
                      />
                      <span>URL ảnh</span>
                    </label>
                  </div>

                  {iconType === 'emoji' && (
                    <div className="icon-input-group">
                      <input
                        type="text"
                        id="icon"
                        name="icon"
                        value={formData.icon}
                        onChange={handleChange}
                        placeholder="📦"
                        maxLength="2"
                      />
                      <small>Chọn 1 emoji để đại diện</small>
                    </div>
                  )}

                  {iconType === 'upload' && (
                    <div className="icon-upload-group">
                      <input
                        type="file"
                        id="iconUpload"
                        accept="image/*"
                        onChange={handleImageUpload}
                        disabled={uploadingImage}
                      />
                      <small>Chọn ảnh từ máy tính (tối đa 2MB)</small>
                      {uploadingImage && <p className="uploading-text">Đang upload...</p>}
                      {formData.icon && formData.icon.startsWith('/uploads') && (
                        <div className="icon-preview">
                          <img src={`${API_URL}${formData.icon}`} alt="Preview" />
                          <p>Ảnh đã upload</p>
                        </div>
                      )}
                    </div>
                  )}

                  {iconType === 'url' && (
                    <div className="icon-input-group">
                      <input
                        type="url"
                        id="icon"
                        name="icon"
                        value={formData.icon}
                        onChange={handleChange}
                        placeholder="https://example.com/icon.png"
                      />
                      <small>Nhập URL của ảnh icon</small>
                      {formData.icon && (formData.icon.startsWith('http') || formData.icon.startsWith('/uploads')) && (
                        <div className="icon-preview">
                          <img 
                            src={formData.icon.startsWith('http') ? formData.icon : `${API_URL}${formData.icon}`} 
                            alt="Preview"
                            onError={(e) => {
                              e.target.style.display = 'none';
                              e.target.nextSibling.textContent = 'URL ảnh không hợp lệ';
                            }}
                          />
                          <p>Preview</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="form-group">
                  <label htmlFor="order">Thứ tự hiển thị</label>
                  <input
                    type="number"
                    id="order"
                    name="order"
                    value={formData.order}
                    onChange={handleChange}
                    min="0"
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    name="isActive"
                    checked={formData.isActive}
                    onChange={handleChange}
                  />
                  <span>Hiển thị danh mục</span>
                </label>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn-cancel" onClick={handleCloseModal}>
                  Hủy
                </button>
                <button type="submit" className="btn-submit">
                  {editingCategory ? 'Cập nhật' : 'Thêm mới'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminCategories;
