import React, { useState, useEffect } from 'react';
import { FiGift, FiX, FiCopy, FiCheck, FiClock, FiDollarSign } from 'react-icons/fi';
import { couponAPI } from '../services/api';
import './GiftBox.css';

const GiftBox = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [coupons, setCoupons] = useState([]);
    const [loading, setLoading] = useState(false);
    const [copiedCode, setCopiedCode] = useState(null);

    useEffect(() => {
        if (isOpen) {
            fetchCoupons();
        }
    }, [isOpen]);

    const fetchCoupons = async () => {
        try {
            setLoading(true);
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

    return (
        <>
            {/* Gift Button */}
            <button
                className={`gift-button ${isOpen ? 'hidden' : ''}`}
                onClick={() => setIsOpen(true)}
            >
                <FiGift size={24} />
                <span className="gift-badge">🎁</span>
            </button>

            {/* Gift Box Popup */}
            {isOpen && (
                <div className="gift-box">
                    <div className="gift-header">
                        <div className="gift-header-info">
                            <FiGift className="gift-icon" />
                            <h4>Mã Giảm Giá</h4>
                        </div>
                        <button className="close-btn" onClick={() => setIsOpen(false)}>
                            <FiX size={20} />
                        </button>
                    </div>

                    <div className="gift-content">
                        {loading ? (
                            <div className="gift-loading">Đang tải...</div>
                        ) : coupons.length === 0 ? (
                            <div className="gift-empty">
                                <FiGift size={40} />
                                <p>Chưa có mã giảm giá</p>
                            </div>
                        ) : (
                            <div className="coupon-list">
                                {coupons.map((coupon) => (
                                    <div key={coupon._id} className="coupon-item">
                                        <div className="coupon-discount">
                                            <span className="percent">{coupon.discountPercent}%</span>
                                            <span className="label">GIẢM</span>
                                        </div>
                                        <div className="coupon-info">
                                            <div className="coupon-code-row">
                                                <span className="code">{coupon.code}</span>
                                                <button
                                                    className={`copy-btn ${copiedCode === coupon.code ? 'copied' : ''}`}
                                                    onClick={() => copyCode(coupon.code)}
                                                >
                                                    {copiedCode === coupon.code ? <FiCheck /> : <FiCopy />}
                                                </button>
                                            </div>
                                            {coupon.description && (
                                                <p className="description">{coupon.description}</p>
                                            )}
                                            <div className="coupon-meta">
                                                {coupon.minOrderAmount > 0 && (
                                                    <span><FiDollarSign /> Từ {formatPrice(coupon.minOrderAmount)}</span>
                                                )}
                                                <span><FiClock /> {formatDate(coupon.expiryDate)}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </>
    );
};

export default GiftBox;
