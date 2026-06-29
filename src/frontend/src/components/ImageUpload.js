import React, { useState, useRef } from 'react';
import axios from 'axios';
import { FiUpload, FiX, FiImage } from 'react-icons/fi';
import Swal from 'sweetalert2';
import './ImageUpload.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

function ImageUpload({ value, onChange, multiple = false, maxFiles = 10 }) {
    const [imageUrl, setImageUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);

  const handleUpload = async (files) => {
    if (!files || files.length === 0) return;

    // Kiểm tra số lượng file nếu multiple
    if (multiple && value && value.length + files.length > maxFiles) {
      Swal.fire('Thông báo', `Bạn chỉ có thể upload tối đa ${maxFiles} ảnh!`, 'warning');
      return;
    }

    setUploading(true);
    const formData = new FormData();

    try {
      const token = localStorage.getItem('token');

      if (multiple) {
        Array.from(files).forEach(file => {
          formData.append('images', file);
        });

        const response = await axios.post(
          `${API_URL}/api/upload/multiple`,
          formData,
          {
            headers: {
              'Content-Type': 'multipart/form-data',
              'Authorization': `Bearer ${token}`
            }
          }
        );

        const newUrls = response.data.images.map(img => 
          `${API_URL}${img.url}`
        );
        
        onChange([...(value || []), ...newUrls]);
      } else {
        formData.append('image', files[0]);

        const response = await axios.post(
          `${API_URL}/api/upload/single`,
          formData,
          {
            headers: {
              'Content-Type': 'multipart/form-data',
              'Authorization': `Bearer ${token}`
            }
          }
        );

        onChange(`${API_URL}${response.data.imageUrl}`);
      }

      Swal.fire('Thành công', 'Upload ảnh thành công!', 'success');
    } catch (error) {
      console.error('Upload error:', error);
      Swal.fire('Lỗi', error.response?.data?.message || 'Có lỗi khi upload ảnh!', 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleFileChange = (e) => {
    handleUpload(e.target.files);
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleUpload(e.dataTransfer.files);
    }
  };

  const handleRemove = (urlToRemove) => {
    if (multiple) {
      onChange(value.filter(url => url !== urlToRemove));
    } else {
      onChange('');
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  // Render cho single image
  if (!multiple) {
    return (
      <div className="image-upload-single">
        {value ? (
          <div className="image-preview-single">
            <img src={value} alt="Preview" />
            <button
              type="button"
              className="remove-btn"
              onClick={() => handleRemove(value)}
            >
              <FiX />
            </button>
          </div>
        ) : (
          <div
            className={`upload-area ${dragActive ? 'drag-active' : ''}`}
            onClick={handleClick}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
            <FiUpload className="upload-icon" />
            <p className="upload-text">
              {uploading ? 'Đang upload...' : 'Click hoặc kéo thả ảnh vào đây'}
            </p>
            <p className="upload-hint">PNG, JPG, GIF, WEBP (max. 5MB)</p>
          </div>
        )}
      </div>
    );
  }

  // Render cho multiple images
  return (
    <div className="image-upload-multiple">
      <div className="image-preview-grid">
        {value && value.length > 0 && value.map((url, index) => (
          <div key={index} className="image-preview-item">
            <img src={url} alt={`Preview ${index + 1}`} />
            <button
              type="button"
              className="remove-btn"
              onClick={() => handleRemove(url)}
            >
              <FiX />
            </button>
          </div>
        ))}
        {(!value || value.length < maxFiles) && (
          <div
            className={`upload-area-small ${dragActive ? 'drag-active' : ''}`}
            onClick={handleClick}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
            <FiImage className="upload-icon-small" />
            <p className="upload-text-small">
              {uploading ? 'Uploading...' : 'Thêm ảnh'}
            </p>
          </div>
        )}
      </div>
      {/* Thêm input nhập link ảnh phụ */}
      {(!value || value.length < maxFiles) && (
        <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
          <input
            type="text"
            placeholder="Hoặc nhập URL ảnh phụ..."
            value={imageUrl}
            onChange={e => setImageUrl(e.target.value)}
            style={{ flex: 1, padding: 6, borderRadius: 6, border: '1px solid #ccc' }}
          />
          <button
            type="button"
            style={{ padding: '6px 12px', borderRadius: 6, background: '#dc2626', color: '#fff', border: 'none', fontWeight: 600, cursor: 'pointer' }}
            onClick={() => {
              if (imageUrl && /^https?:\/\//.test(imageUrl)) {
                if (!value || value.length < maxFiles) {
                  onChange([...(value || []), imageUrl]);
                  setImageUrl("");
                }
              } else {
                Swal.fire('Thông báo', 'Vui lòng nhập đúng định dạng URL ảnh!', 'warning');
              }
            }}
          >Thêm</button>
        </div>
      )}
      <p className="upload-hint">
        Click, kéo thả hoặc dán link để thêm ảnh (tối đa {maxFiles} ảnh, 5MB mỗi ảnh)
        {value && value.length > 0 && ` - Đã có ${value.length}/${maxFiles} ảnh`}
      </p>
    </div>
  );
}

export default ImageUpload;
