import React, { useState, useEffect } from 'react';
import { FiPlus, FiEdit2, FiTrash2, FiPercent, FiCalendar, FiUsers, FiCheck, FiX } from 'react-icons/fi';
import { couponAPI } from '../../services/api';
import Swal from 'sweetalert2';
import './AdminCoupons.css';

const AdminCoupons = () => {
    const [coupons, setCoupons] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingCoupon, setEditingCoupon] = useState(null);
    const [formData, setFormData] = useState({
        code: '',
        description: '',
        discountPercent: 10,
        maxUses: 100,
        minOrderAmount: 0,
        expiryDate: '',
        isActive: true
    });

    useEffect(() => {
        fetchCoupons();
    }, []);

    const fetchCoupons = async () => {
        try {
            setLoading(true);
            const response = await couponAPI.getAll();
            setCoupons(response.data);
        } catch (error) {
            console.error('Lỗi lấy danh sách mã giảm giá:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingCoupon) {
                await couponAPI.update(editingCoupon._id, formData);
            } else {
                await couponAPI.create(formData);
            }
            fetchCoupons();
            closeModal();
        } catch (error) {
            Swal.fire('Lỗi', error.response?.data?.message || 'Có lỗi xảy ra', 'error');
        }
    };

    const handleDelete = async (id) => {
        const result = await Swal.fire({
            title: 'Xác nhận xóa',
            text: 'Bạn có chắc muốn xóa mã giảm giá này?',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Xóa',
            cancelButtonText: 'Hủy'
        });
        if (result.isConfirmed) {
            try {
                await couponAPI.delete(id);
                fetchCoupons();
                Swal.fire('Thành công', 'Đã xóa mã giảm giá!', 'success');
            } catch (error) {
                Swal.fire('Lỗi', 'Lỗi xóa mã giảm giá', 'error');
            }
        }
    };

    const openAddModal = () => {
        setEditingCoupon(null);
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 30);
        setFormData({
            code: '',
            description: '',
            discountPercent: 10,
            maxUses: 100,
            minOrderAmount: 0,
            expiryDate: tomorrow.toISOString().split('T')[0],
            isActive: true
        });
        setShowModal(true);
    };

    const openEditModal = (coupon) => {
        setEditingCoupon(coupon);
        setFormData({
            code: coupon.code,
            description: coupon.description || '',
            discountPercent: coupon.discountPercent,
            maxUses: coupon.maxUses,
            minOrderAmount: coupon.minOrderAmount || 0,
            expiryDate: new Date(coupon.expiryDate).toISOString().split('T')[0],
            isActive: coupon.isActive
        });
        setShowModal(true);
    };

    const closeModal = () => {
        setShowModal(false);
        setEditingCoupon(null);
    };

    const formatDate = (date) => {
        return new Date(date).toLocaleDateString('vi-VN', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    };

    const formatPrice = (price) => {
        return price.toLocaleString('vi-VN') + 'đ';
    };

    const isExpired = (date) => new Date(date) < new Date();

    if (loading) {
        return <div className="admin-coupons-loading">Đang tải...</div>;
    }

    return (
        <div className="admin-coupons">
            <div className="admin-coupons-header">
                <h1>Quản lý Mã Giảm Giá</h1>
                <button className="add-coupon-btn" onClick={openAddModal}>
                    <FiPlus /> Thêm mã mới
                </button>
            </div>

            <div className="coupons-stats">
                <div className="stat-card">
                    <FiPercent className="stat-icon" />
                    <div className="stat-info">
                        <span className="stat-value">{coupons.length}</span>
                        <span className="stat-label">Tổng mã</span>
                    </div>
                </div>
                <div className="stat-card">
                    <FiCheck className="stat-icon active" />
                    <div className="stat-info">
                        <span className="stat-value">{coupons.filter(c => c.isActive && !isExpired(c.expiryDate)).length}</span>
                        <span className="stat-label">Đang hoạt động</span>
                    </div>
                </div>
                <div className="stat-card">
                    <FiUsers className="stat-icon" />
                    <div className="stat-info">
                        <span className="stat-value">{coupons.reduce((sum, c) => sum + c.usedCount, 0)}</span>
                        <span className="stat-label">Lượt sử dụng</span>
                    </div>
                </div>
            </div>

            <div className="coupons-table-container">
                <table className="coupons-table">
                    <thead>
                        <tr>
                            <th>Mã</th>
                            <th>Mô tả</th>
                            <th>Giảm giá</th>
                            <th>Đã dùng</th>
                            <th>Đơn tối thiểu</th>
                            <th>Hết hạn</th>
                            <th>Trạng thái</th>
                            <th>Thao tác</th>
                        </tr>
                    </thead>
                    <tbody>
                        {coupons.length === 0 ? (
                            <tr>
                                <td colSpan="8" className="empty-message">
                                    Chưa có mã giảm giá nào. Hãy tạo mã mới!
                                </td>
                            </tr>
                        ) : (
                            coupons.map((coupon) => (
                                <tr key={coupon._id}>
                                    <td>
                                        <span className="coupon-code">{coupon.code}</span>
                                    </td>
                                    <td className="description-cell">{coupon.description || '-'}</td>
                                    <td>
                                        <span className="discount-badge">{coupon.discountPercent}%</span>
                                    </td>
                                    <td>
                                        <span className={`usage ${coupon.usedCount >= coupon.maxUses ? 'full' : ''}`}>
                                            {coupon.usedCount}/{coupon.maxUses}
                                        </span>
                                    </td>
                                    <td>{coupon.minOrderAmount > 0 ? formatPrice(coupon.minOrderAmount) : 'Không'}</td>
                                    <td>
                                        <span className={`expiry ${isExpired(coupon.expiryDate) ? 'expired' : ''}`}>
                                            {formatDate(coupon.expiryDate)}
                                        </span>
                                    </td>
                                    <td>
                                        {coupon.isActive && !isExpired(coupon.expiryDate) && coupon.usedCount < coupon.maxUses ? (
                                            <span className="status active">
                                                <FiCheck /> Hoạt động
                                            </span>
                                        ) : (
                                            <span className="status inactive">
                                                <FiX /> {isExpired(coupon.expiryDate) ? 'Hết hạn' : coupon.usedCount >= coupon.maxUses ? 'Hết lượt' : 'Tắt'}
                                            </span>
                                        )}
                                    </td>
                                    <td>
                                        <div className="action-buttons">
                                            <button className="edit-btn" onClick={() => openEditModal(coupon)} title="Sửa">
                                                <FiEdit2 />
                                            </button>
                                            <button className="delete-btn" onClick={() => handleDelete(coupon._id)} title="Xóa">
                                                <FiTrash2 />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Modal Form */}
            {showModal && (
                <div className="modal-overlay" onClick={closeModal}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <h2>{editingCoupon ? 'Sửa mã giảm giá' : 'Thêm mã giảm giá mới'}</h2>
                        <form onSubmit={handleSubmit}>
                            <div className="form-group">
                                <label>Mã giảm giá *</label>
                                <input
                                    type="text"
                                    value={formData.code}
                                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                                    placeholder="VD: SALE10, NEWYEAR2025"
                                    required
                                    maxLength={20}
                                />
                            </div>

                            <div className="form-group">
                                <label>Mô tả</label>
                                <input
                                    type="text"
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    placeholder="VD: Giảm 10% cho đơn hàng đầu tiên"
                                />
                            </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label>% Giảm giá *</label>
                                    <input
                                        type="number"
                                        value={formData.discountPercent}
                                        onChange={(e) => setFormData({ ...formData, discountPercent: parseInt(e.target.value) || 0 })}
                                        min="1"
                                        max="100"
                                        required
                                    />
                                </div>

                                <div className="form-group">
                                    <label>Số lượt tối đa *</label>
                                    <input
                                        type="number"
                                        value={formData.maxUses}
                                        onChange={(e) => setFormData({ ...formData, maxUses: parseInt(e.target.value) || 0 })}
                                        min="1"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label>Đơn tối thiểu (đ)</label>
                                    <input
                                        type="number"
                                        value={formData.minOrderAmount}
                                        onChange={(e) => setFormData({ ...formData, minOrderAmount: parseInt(e.target.value) || 0 })}
                                        min="0"
                                        step="100000"
                                    />
                                </div>

                                <div className="form-group">
                                    <label>Ngày hết hạn *</label>
                                    <input
                                        type="date"
                                        value={formData.expiryDate}
                                        onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                                        required
                                    />
                                </div>
                            </div>

                            <div className="form-group checkbox-group">
                                <label>
                                    <input
                                        type="checkbox"
                                        checked={formData.isActive}
                                        onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                                    />
                                    Kích hoạt mã giảm giá
                                </label>
                            </div>

                            <div className="modal-buttons">
                                <button type="button" className="cancel-btn" onClick={closeModal}>
                                    Hủy
                                </button>
                                <button type="submit" className="submit-btn">
                                    {editingCoupon ? 'Cập nhật' : 'Tạo mã'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminCoupons;
