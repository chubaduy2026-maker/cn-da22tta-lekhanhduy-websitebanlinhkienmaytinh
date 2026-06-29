const express = require('express');
const router = express.Router();
const Coupon = require('../models/Coupon');
const { auth, isAdmin, isStaffOrAdmin } = require('../middleware/auth');

// ========== ADMIN ROUTES ==========

// Lấy tất cả mã giảm giá (Admin/Staff)
router.get('/', auth, isStaffOrAdmin, async (req, res) => {
    try {
        const coupons = await Coupon.find().sort({ createdAt: -1 });
        res.json(coupons);
    } catch (error) {
        console.error('Lỗi lấy danh sách mã giảm giá:', error);
        res.status(500).json({ message: 'Lỗi server' });
    }
});

// Tạo mã giảm giá mới (Admin/Staff)
router.post('/', auth, isStaffOrAdmin, async (req, res) => {
    try {
        const { code, description, discountPercent, maxUses, minOrderAmount, expiryDate, isActive } = req.body;

        // Kiểm tra mã đã tồn tại
        const existingCoupon = await Coupon.findOne({ code: code.toUpperCase() });
        if (existingCoupon) {
            return res.status(400).json({ message: 'Mã giảm giá đã tồn tại' });
        }

        const coupon = new Coupon({
            code: code.toUpperCase(),
            description,
            discountPercent,
            maxUses: maxUses || 100,
            minOrderAmount: minOrderAmount || 0,
            expiryDate,
            isActive: isActive !== undefined ? isActive : true
        });

        await coupon.save();
        res.status(201).json(coupon);
    } catch (error) {
        console.error('Lỗi tạo mã giảm giá:', error);
        res.status(500).json({ message: 'Lỗi server' });
    }
});

// Cập nhật mã giảm giá (Admin/Staff)
router.put('/:id', auth, isStaffOrAdmin, async (req, res) => {
    try {
        const { code, description, discountPercent, maxUses, minOrderAmount, expiryDate, isActive } = req.body;

        // Kiểm tra mã trùng (nếu đổi code)
        if (code) {
            const existingCoupon = await Coupon.findOne({
                code: code.toUpperCase(),
                _id: { $ne: req.params.id }
            });
            if (existingCoupon) {
                return res.status(400).json({ message: 'Mã giảm giá đã tồn tại' });
            }
        }

        const coupon = await Coupon.findByIdAndUpdate(
            req.params.id,
            {
                code: code?.toUpperCase(),
                description,
                discountPercent,
                maxUses,
                minOrderAmount,
                expiryDate,
                isActive
            },
            { new: true, runValidators: true }
        );

        if (!coupon) {
            return res.status(404).json({ message: 'Không tìm thấy mã giảm giá' });
        }

        res.json(coupon);
    } catch (error) {
        console.error('Lỗi cập nhật mã giảm giá:', error);
        res.status(500).json({ message: 'Lỗi server' });
    }
});

// Xóa mã giảm giá (Admin/Staff)
router.delete('/:id', auth, isStaffOrAdmin, async (req, res) => {
    try {
        const coupon = await Coupon.findByIdAndDelete(req.params.id);
        if (!coupon) {
            return res.status(404).json({ message: 'Không tìm thấy mã giảm giá' });
        }
        res.json({ message: 'Đã xóa mã giảm giá' });
    } catch (error) {
        console.error('Lỗi xóa mã giảm giá:', error);
        res.status(500).json({ message: 'Lỗi server' });
    }
});

// ========== USER ROUTES ==========

// Lấy mã giảm giá có sẵn cho user (public)
router.get('/available', async (req, res) => {
    try {
        const now = new Date();
        const coupons = await Coupon.find({
            isActive: true,
            expiryDate: { $gt: now },
            $expr: { $lt: ['$usedCount', '$maxUses'] }
        }).select('code description discountPercent minOrderAmount expiryDate');

        res.json(coupons);
    } catch (error) {
        console.error('Lỗi lấy mã giảm giá:', error);
        res.status(500).json({ message: 'Lỗi server' });
    }
});

// Validate mã giảm giá
router.post('/validate', async (req, res) => {
    try {
        const { code, orderAmount } = req.body;

        if (!code) {
            return res.status(400).json({ message: 'Vui lòng nhập mã giảm giá' });
        }

        const coupon = await Coupon.findOne({ code: code.toUpperCase() });

        if (!coupon) {
            return res.status(404).json({ message: 'Mã giảm giá không tồn tại' });
        }

        if (!coupon.isActive) {
            return res.status(400).json({ message: 'Mã giảm giá đã bị vô hiệu hóa' });
        }

        if (coupon.usedCount >= coupon.maxUses) {
            return res.status(400).json({ message: 'Mã giảm giá đã hết lượt sử dụng' });
        }

        if (new Date() > coupon.expiryDate) {
            return res.status(400).json({ message: 'Mã giảm giá đã hết hạn' });
        }

        if (orderAmount && orderAmount < coupon.minOrderAmount) {
            return res.status(400).json({
                message: `Đơn hàng tối thiểu ${coupon.minOrderAmount.toLocaleString('vi-VN')}đ để sử dụng mã này`
            });
        }

        const discountAmount = coupon.calculateDiscount(orderAmount || 0);

        res.json({
            valid: true,
            code: coupon.code,
            discountPercent: coupon.discountPercent,
            discountAmount,
            minOrderAmount: coupon.minOrderAmount,
            description: coupon.description
        });
    } catch (error) {
        console.error('Lỗi validate mã giảm giá:', error);
        res.status(500).json({ message: 'Lỗi server' });
    }
});

// Sử dụng mã giảm giá (tăng usedCount)
router.post('/use', async (req, res) => {
    try {
        const { code } = req.body;

        const coupon = await Coupon.findOneAndUpdate(
            {
                code: code.toUpperCase(),
                isActive: true,
                expiryDate: { $gt: new Date() },
                $expr: { $lt: ['$usedCount', '$maxUses'] }
            },
            { $inc: { usedCount: 1 } },
            { new: true }
        );

        if (!coupon) {
            return res.status(400).json({ message: 'Mã giảm giá không hợp lệ' });
        }

        res.json({ message: 'Đã áp dụng mã giảm giá', coupon });
    } catch (error) {
        console.error('Lỗi sử dụng mã giảm giá:', error);
        res.status(500).json({ message: 'Lỗi server' });
    }
});

module.exports = router;
