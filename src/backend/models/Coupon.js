const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema({
    code: {
        type: String,
        required: true,
        unique: true,
        uppercase: true,
        trim: true
    },
    description: {
        type: String,
        default: ''
    },
    discountPercent: {
        type: Number,
        required: true,
        min: 1,
        max: 100
    },
    maxUses: {
        type: Number,
        required: true,
        default: 100
    },
    usedCount: {
        type: Number,
        default: 0
    },
    minOrderAmount: {
        type: Number,
        default: 0
    },
    expiryDate: {
        type: Date,
        required: true
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

// Kiểm tra mã còn hiệu lực
couponSchema.methods.isValid = function () {
    return this.isActive &&
        this.usedCount < this.maxUses &&
        new Date() < this.expiryDate;
};

// Tính số tiền được giảm
couponSchema.methods.calculateDiscount = function (orderAmount) {
    if (orderAmount < this.minOrderAmount) {
        return 0;
    }
    return Math.round(orderAmount * this.discountPercent / 100);
};

module.exports = mongoose.model('Coupon', couponSchema);
