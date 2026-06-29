const mongoose = require('mongoose');

const cartItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
    default: 1
  }
});

const cartSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  sessionId: {
    type: String,
    default: null
  },
  items: [cartItemSchema],
  totalAmount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Validation: phải có ít nhất userId hoặc sessionId
cartSchema.pre('save', function(next) {
  if (!this.userId && !this.sessionId) {
    return next(new Error('Cart must have either userId or sessionId'));
  }
  next();
});

// Index riêng biệt với partialFilterExpression - chỉ áp dụng khi field có giá trị đúng type
cartSchema.index({ userId: 1 }, { unique: true, partialFilterExpression: { userId: { $type: "objectId" } }, name: 'userId_1_unique' });
cartSchema.index({ sessionId: 1 }, { unique: true, partialFilterExpression: { sessionId: { $type: "string" } }, name: 'sessionId_1_unique' });

module.exports = mongoose.model('Cart', cartSchema);
