import React, { useState, useEffect } from 'react';
import { FiEdit, FiTrash2, FiPlus, FiToggleLeft, FiToggleRight } from 'react-icons/fi';
import Swal from 'sweetalert2';
import './AdminFilters.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const AdminFilters = () => {
  const [filters, setFilters] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingFilter, setEditingFilter] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    displayName: '',
    type: 'select',
    category: '',
    options: [],
    order: 0,
    isActive: true
  });
  const [newOption, setNewOption] = useState({ value: '', label: '' });
  const [bulkOptionsText, setBulkOptionsText] = useState('');
  const [showBulkAdd, setShowBulkAdd] = useState(false);

  // Suggestions cho các thương hiệu phổ biến
  const brandSuggestions = [
    { value: 'asus', label: 'ASUS' },
    { value: 'acer', label: 'ACER' },
    { value: 'msi', label: 'MSI' },
    { value: 'dell', label: 'DELL' },
    { value: 'hp', label: 'HP' },
    { value: 'lenovo', label: 'LENOVO' },
    { value: 'apple', label: 'APPLE' },
    { value: 'samsung', label: 'SAMSUNG' },
    { value: 'lg', label: 'LG' },
    { value: 'gigabyte', label: 'GIGABYTE' },
    { value: 'corsair', label: 'CORSAIR' },
    { value: 'kingston', label: 'KINGSTON' },
    { value: 'intel', label: 'INTEL' },
    { value: 'amd', label: 'AMD' },
    { value: 'nvidia', label: 'NVIDIA' },
    { value: 'logitech', label: 'LOGITECH' },
    { value: 'razer', label: 'RAZER' },
  ];

  // Suggestions cho RAM
  const ramSuggestions = [
    { value: '4gb', label: '4GB' },
    { value: '8gb', label: '8GB' },
    { value: '16gb', label: '16GB' },
    { value: '32gb', label: '32GB' },
    { value: '64gb', label: '64GB' },
  ];

  // Suggestions cho Storage
  const storageSuggestions = [
    { value: '256gb', label: '256GB' },
    { value: '512gb', label: '512GB' },
    { value: '1tb', label: '1TB' },
    { value: '2tb', label: '2TB' },
  ];

  // Suggestions cho CPU
  const cpuSuggestions = [
    { value: 'i3', label: 'Intel Core i3' },
    { value: 'i5', label: 'Intel Core i5' },
    { value: 'i7', label: 'Intel Core i7' },
    { value: 'i9', label: 'Intel Core i9' },
    { value: 'ryzen3', label: 'AMD Ryzen 3' },
    { value: 'ryzen5', label: 'AMD Ryzen 5' },
    { value: 'ryzen7', label: 'AMD Ryzen 7' },
    { value: 'ryzen9', label: 'AMD Ryzen 9' },
  ];

  // Suggestions cho Screen Size
  const screenSuggestions = [
    { value: '13', label: '13 inch' },
    { value: '14', label: '14 inch' },
    { value: '15.6', label: '15.6 inch' },
    { value: '17', label: '17 inch' },
  ];

  // Lấy suggestions dựa trên tên filter
  const getSuggestions = () => {
    const name = formData.name.toLowerCase();
    const displayName = formData.displayName.toLowerCase();
    
    if (name === 'brand' || displayName.includes('thương hiệu') || displayName.includes('hãng')) {
      return brandSuggestions;
    }
    if (name === 'ram' || displayName.includes('ram')) {
      return ramSuggestions;
    }
    if (name === 'storage' || name === 'ssd' || displayName.includes('ổ cứng') || displayName.includes('dung lượng')) {
      return storageSuggestions;
    }
    if (name === 'cpu' || displayName.includes('cpu') || displayName.includes('bộ xử lý')) {
      return cpuSuggestions;
    }
    if (name === 'screen' || name === 'screen_size' || displayName.includes('màn hình')) {
      return screenSuggestions;
    }
    return null;
  };

  useEffect(() => {
    fetchFilters();
    fetchCategories();
  }, []);

  const fetchFilters = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/filters/all`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setFilters(data);
    } catch (error) {
      console.error('Lỗi khi lấy danh sách bộ lọc:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:5000/api/categories/all`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch categories');
      }
      
      const data = await response.json();
      console.log('Categories loaded:', data);
      setCategories(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Lỗi khi lấy danh mục:', error);
      setCategories([]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate options
    if (formData.type !== 'range' && formData.options.length === 0) {
      Swal.fire('Thông báo', 'Vui lòng thêm ít nhất 1 tùy chọn cho bộ lọc!', 'warning');
      return;
    }
    
    try {
      const token = localStorage.getItem('token');
      const url = editingFilter 
        ? `${API_URL}/filters/${editingFilter._id}`
        : `${API_URL}/filters`;
      
      const method = editingFilter ? 'PUT' : 'POST';
      
      console.log('Submitting filter data:', formData);
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      const data = await response.json();
      
      if (response.ok) {
        Swal.fire('Thành công', data.message, 'success');
        setShowModal(false);
        resetForm();
        fetchFilters();
      } else {
        Swal.fire('Lỗi', data.message, 'error');
      }
    } catch (error) {
      Swal.fire('Lỗi', 'Có lỗi xảy ra: ' + error.message, 'error');
    }
  };

  const handleEdit = (filter) => {
    setEditingFilter(filter);
    setFormData({
      name: filter.name,
      displayName: filter.displayName,
      type: filter.type,
      category: filter.category,
      options: filter.options || [],
      order: filter.order,
      isActive: filter.isActive
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    const result = await Swal.fire({
      title: 'Xác nhận xóa',
      text: 'Bạn có chắc muốn xóa bộ lọc này?',
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
      const response = await fetch(`${API_URL}/filters/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = await response.json();
      Swal.fire('Thành công', data.message, 'success');
      fetchFilters();
    } catch (error) {
      Swal.fire('Lỗi', 'Lỗi khi xóa: ' + error.message, 'error');
    }
  };

  const handleToggleStatus = async (id) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/filters/${id}/toggle`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = await response.json();
      if (response.ok) {
        fetchFilters();
      } else {
        Swal.fire('Lỗi', data.message, 'error');
      }
    } catch (error) {
      Swal.fire('Lỗi', 'Lỗi: ' + error.message, 'error');
    }
  };

  const addOption = () => {
    if (!newOption.value || !newOption.label) {
      Swal.fire('Thông báo', 'Vui lòng nhập đầy đủ giá trị và nhãn', 'warning');
      return;
    }

    // Kiểm tra trùng lặp
    const isDuplicate = formData.options.some(
      opt => opt.value.toLowerCase() === newOption.value.toLowerCase()
    );

    if (isDuplicate) {
      Swal.fire('Thông báo', 'Tùy chọn này đã tồn tại!', 'warning');
      return;
    }

    setFormData({
      ...formData,
      options: [...formData.options, { ...newOption }]
    });
    setNewOption({ value: '', label: '' });
  };

  const addQuickOption = (suggestion) => {
    // Kiểm tra trùng lặp
    const isDuplicate = formData.options.some(
      opt => opt.value.toLowerCase() === suggestion.value.toLowerCase()
    );

    if (isDuplicate) {
      Swal.fire('Thông báo', suggestion.label + ' đã có trong danh sách!', 'warning');
      return;
    }

    setFormData({
      ...formData,
      options: [...formData.options, { ...suggestion }]
    });
  };

  const addBulkOptions = () => {
    if (!bulkOptionsText.trim()) {
      Swal.fire('Thông báo', 'Vui lòng nhập danh sách tùy chọn', 'warning');
      return;
    }

    const lines = bulkOptionsText.split('\n').filter(line => line.trim());
    const newOptions = [];

    for (const line of lines) {
      const parts = line.split('|').map(p => p.trim());
      if (parts.length >= 2) {
        const value = parts[0];
        const label = parts[1];
        
        // Kiểm tra trùng lặp
        const isDuplicate = formData.options.some(
          opt => opt.value.toLowerCase() === value.toLowerCase()
        ) || newOptions.some(
          opt => opt.value.toLowerCase() === value.toLowerCase()
        );

        if (!isDuplicate && value && label) {
          newOptions.push({ value, label });
        }
      }
    }

    if (newOptions.length > 0) {
      setFormData({
        ...formData,
        options: [...formData.options, ...newOptions]
      });
      setBulkOptionsText('');
      setShowBulkAdd(false);
      Swal.fire('Thành công', `Đã thêm ${newOptions.length} tùy chọn!`, 'success');
    } else {
      Swal.fire('Thông báo', 'Không có tùy chọn hợp lệ nào để thêm!', 'warning');
    }
  };

  const removeOption = (index) => {
    setFormData({
      ...formData,
      options: formData.options.filter((_, i) => i !== index)
    });
  };

  const resetForm = () => {
    setFormData({
      name: '',
      displayName: '',
      type: 'select',
      category: '',
      options: [],
      order: 0,
      isActive: true
    });
    setNewOption({ value: '', label: '' });
    setBulkOptionsText('');
    setShowBulkAdd(false);
    setEditingFilter(null);
  };

  return (
    <div className="admin-filters">
      <div className="page-header">
        <h1>Quản lý bộ lọc</h1>
        <button className="btn-primary" onClick={() => setShowModal(true)}>
          <FiPlus /> Thêm bộ lọc
        </button>
      </div>

      {loading ? (
        <div className="loading">Đang tải...</div>
      ) : (
        <div className="filters-table-container">
          <table className="filters-table">
            <thead>
              <tr>
                <th>Tên hiển thị</th>
                <th>Tên trường</th>
                <th>Loại</th>
                <th>Danh mục</th>
                <th>Số tùy chọn</th>
                <th>Thứ tự</th>
                <th>Trạng thái</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {filters.map((filter) => (
                <tr key={filter._id}>
                  <td className="filter-name">{filter.displayName}</td>
                  <td><code>{filter.name}</code></td>
                  <td>
                    <span className={`type-badge type-${filter.type}`}>
                      {filter.type}
                    </span>
                  </td>
                  <td>{filter.category || <em style={{color: '#999'}}>Tất cả</em>}</td>
                  <td className="text-center">
                    <span className={filter.options?.length > 0 ? 'badge-success' : 'badge-warning'}>
                      {filter.options?.length || 0}
                    </span>
                  </td>
                  <td className="text-center">{filter.order}</td>
                  <td>
                    <button
                      className={`btn-toggle ${filter.isActive ? 'active' : 'inactive'}`}
                      onClick={() => handleToggleStatus(filter._id)}
                    >
                      {filter.isActive ? <FiToggleRight /> : <FiToggleLeft />}
                      {filter.isActive ? 'Hiện' : 'Ẩn'}
                    </button>
                  </td>
                  <td>
                    <div className="actions">
                      <button className="btn-edit" onClick={() => handleEdit(filter)}>
                        <FiEdit />
                      </button>
                      <button className="btn-delete" onClick={() => handleDelete(filter._id)}>
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

      {showModal && (
        <div className="modal-overlay" onClick={() => { setShowModal(false); resetForm(); }}>
          <div className="modal-content large-modal" onClick={(e) => e.stopPropagation()}>
            <h2>{editingFilter ? 'Cập nhật bộ lọc' : 'Thêm bộ lọc mới'}</h2>
            
            {/* Bảng ví dụ */}
            <div className="examples-table">
              <h4>📋 Ví dụ về nhập thông tin cho bộ lọc:</h4>
              <table className="guide-table">
                <thead>
                  <tr>
                    <th>Tên hiển thị</th>
                    <th>Tên trường (slug)</th>
                    <th>Giải thích</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Thương hiệu</td>
                    <td><code>brand</code></td>
                    <td>Lọc theo hãng sản xuất</td>
                  </tr>
                  <tr>
                    <td>Dung lượng RAM</td>
                    <td><code>ram</code></td>
                    <td>Lọc theo RAM (8GB, 16GB...)</td>
                  </tr>
                  <tr>
                    <td>Ổ cứng</td>
                    <td><code>storage</code></td>
                    <td>Lọc theo dung lượng ổ cứng</td>
                  </tr>
                  <tr>
                    <td>CPU</td>
                    <td><code>cpu</code></td>
                    <td>Lọc theo loại CPU</td>
                  </tr>
                  <tr>
                    <td>Card đồ họa</td>
                    <td><code>gpu</code></td>
                    <td>Lọc theo card màn hình</td>
                  </tr>
                  <tr>
                    <td>Màn hình</td>
                    <td><code>screen_size</code></td>
                    <td>Lọc theo kích thước màn hình</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="form-row">
                <div className="form-group">
                  <label>Tên hiển thị *</label>
                  <input
                    type="text"
                    value={formData.displayName}
                    onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                    placeholder="VD: Thương hiệu"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Tên trường (slug) *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value.replace(/\s+/g, '_') })}
                    placeholder="VD: brand hoặc PC"
                    required
                  />
                  <small>Có thể dùng chữ hoa, chữ thường, số và dấu gạch dưới</small>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Danh mục</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  >
                    <option value="">-- Chọn danh mục --</option>
                    {categories.filter(cat => cat.isActive).map(cat => (
                      <option key={cat._id} value={cat.name}>
                        {cat.icon && !cat.icon.startsWith('http') ? cat.icon + ' ' : ''}
                        {cat.name}
                      </option>
                    ))}
                  </select>
                  <small>Để trống nếu áp dụng cho tất cả danh mục</small>
                </div>

                <div className="form-group">
                  <label>Loại bộ lọc</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  >
                    <option value="select">Dropdown</option>
                    <option value="checkbox">Checkbox</option>
                    <option value="range">Range (Min-Max)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Thứ tự hiển thị</label>
                  <input
                    type="number"
                    value={formData.order}
                    onChange={(e) => setFormData({ ...formData, order: parseInt(e.target.value) || 0 })}
                    min="0"
                    placeholder="0"
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Tùy chọn {formData.type !== 'range' && <span style={{color: 'red'}}>*</span>}</label>
                {formData.options.length === 0 && (
                  <div style={{
                    padding: '0.75rem',
                    background: '#fff3cd',
                    border: '1px solid #ffc107',
                    borderRadius: '6px',
                    marginBottom: '0.5rem',
                    color: '#856404'
                  }}>
                    ⚠️ Chưa có tùy chọn nào. Vui lòng thêm ít nhất 1 tùy chọn để bộ lọc có thể hoạt động!
                  </div>
                )}

                {/* Quick Add Buttons - Thương hiệu phổ biến */}
                {getSuggestions() && (
                  <div className="quick-add-section">
                    <h4 style={{fontSize: '0.9rem', marginBottom: '0.5rem', color: '#64748b'}}>
                      ⚡ Thêm nhanh các tùy chọn phổ biến:
                    </h4>
                    <div className="quick-add-buttons">
                      {getSuggestions().map((suggestion, index) => {
                        const isAdded = formData.options.some(
                          opt => opt.value.toLowerCase() === suggestion.value.toLowerCase()
                        );
                        return (
                          <button
                            key={index}
                            type="button"
                            className={`quick-add-btn ${isAdded ? 'added' : ''}`}
                            onClick={() => addQuickOption(suggestion)}
                            disabled={isAdded}
                          >
                            {isAdded ? '✓ ' : ''}{suggestion.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Bulk Add Section */}
                <div className="bulk-add-section">
                  <button
                    type="button"
                    className="btn-toggle-bulk"
                    onClick={() => setShowBulkAdd(!showBulkAdd)}
                  >
                    {showBulkAdd ? '➖' : '➕'} Thêm nhiều tùy chọn cùng lúc
                  </button>

                  {showBulkAdd && (
                    <div className="bulk-add-form">
                      <p style={{fontSize: '0.875rem', color: '#64748b', marginBottom: '0.5rem'}}>
                        Nhập mỗi tùy chọn trên một dòng theo format: <code>giá_trị|Nhãn hiển thị</code>
                      </p>
                      <p style={{fontSize: '0.875rem', color: '#64748b', marginBottom: '0.5rem'}}>
                        Ví dụ:
                      </p>
                      <pre style={{
                        background: '#f8f9fa',
                        padding: '0.5rem',
                        borderRadius: '4px',
                        fontSize: '0.85rem',
                        marginBottom: '0.5rem'
                      }}>
asus|ASUS
dell|DELL
hp|HP
lenovo|LENOVO</pre>
                      <textarea
                        value={bulkOptionsText}
                        onChange={(e) => setBulkOptionsText(e.target.value)}
                        placeholder="asus|ASUS&#10;dell|DELL&#10;hp|HP"
                        rows="6"
                        style={{
                          width: '100%',
                          padding: '0.75rem',
                          border: '1px solid #ddd',
                          borderRadius: '6px',
                          fontFamily: 'monospace',
                          fontSize: '0.9rem'
                        }}
                      />
                      <button
                        type="button"
                        className="btn-bulk-add"
                        onClick={addBulkOptions}
                      >
                        ➕ Thêm tất cả
                      </button>
                    </div>
                  )}
                </div>

                <div className="options-list">
                  {formData.options.map((opt, index) => (
                    <div key={index} className="option-item">
                      <span>{opt.label} ({opt.value})</span>
                      <button type="button" onClick={() => removeOption(index)} className="btn-remove">×</button>
                    </div>
                  ))}
                </div>
                
                <div className="add-option-form">
                  <input
                    type="text"
                    placeholder="Giá trị (VD: asus)"
                    value={newOption.value}
                    onChange={(e) => setNewOption({ ...newOption, value: e.target.value })}
                  />
                  <input
                    type="text"
                    placeholder="Nhãn hiển thị (VD: ASUS)"
                    value={newOption.label}
                    onChange={(e) => setNewOption({ ...newOption, label: e.target.value })}
                  />
                  <button type="button" onClick={addOption} className="btn-add-option">
                    <FiPlus /> Thêm từng cái
                  </button>
                </div>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={() => { setShowModal(false); resetForm(); }}>
                  Hủy
                </button>
                <button type="submit" className="btn-submit">
                  {editingFilter ? 'Cập nhật' : 'Thêm mới'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminFilters;
