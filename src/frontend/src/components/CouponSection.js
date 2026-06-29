import React, { useState, useEffect } from 'react';
import { FiTag, FiCopy, FiCheck, FiClock, FiDollarSign } from 'react-icons/fi';
import { couponAPI } from '../services/api';
import './CouponSection.css';

const CouponSection = () => {
    const [coupons, setCoupons] = useState([]);
    const [loading, setLoading] = useState(true);
    const [copiedCode, setCopiedCode] = useState(null);

    useEffect(() => {
        fetchCoupons();
    }, []);

    const fetchCoupons = async () => {
        try {
            const response = await couponAPI.getAvailable();
            setCoupons(response.data);
        } catch (error) {
            console.error('Lỗi lấy mã giảm giá:', error);
        } finally {
            setLoading(false);
        }
    };

    const copyCode = (code) => {
        navigator.clipboard.writeText(code);
        setCopiedCode(code);
        setTimeout(() => setCopiedCode(null), 2000);
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

    if (loading) {
        return null;
    }

    if (coupons.length === 0) {
        return null;
    }

    return (
        <div className="coupon-section">
            <div className="coupon-section-header">
                <FiTag className="coupon-icon" />
                <h2>Mã Giảm Giá</h2>
                <span className="coupon-count">{coupons.length} mã có sẵn</span>
            </div>

            <div className="coupon-list">
                {coupons.map((coupon) => (
                    <div key={coupon._id} className="coupon-card">
                        <div className="coupon-left">
                            <div className="coupon-discount">
                                <span className="discount-value">{coupon.discountPercent}%</span>
                                <span className="discount-label">GIẢM</span>
                            </div>
                        </div>

                        <div className="coupon-middle">
                            <div className="coupon-code-display">
                                <span className="code-text">{coupon.code}</span>
                                <button
                                    className={`copy-btn ${copiedCode === coupon.code ? 'copied' : ''}`}
                                    onClick={() => copyCode(coupon.code)}
                                >
                                    {copiedCode === coupon.code ? (
                                        <><FiCheck /> Đã sao chép</>
                                    ) : (
                                        <><FiCopy /> Sao chép</>
                                    )}
                                </button>
                            </div>

                            {coupon.description && (
                                <p className="coupon-description">{coupon.description}</p>
                            )}

                            <div className="coupon-details">
                                {coupon.minOrderAmount > 0 && (
                                    <span className="coupon-detail">
                                        <FiDollarSign /> Đơn tối thiểu: {formatPrice(coupon.minOrderAmount)}
                                    </span>
                                )}
                                <span className="coupon-detail">
                                    <FiClock /> HSD: {formatDate(coupon.expiryDate)}
                                </span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default CouponSection;
