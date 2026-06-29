const mongoose = require('mongoose');

const filterSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  displayName: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['select', 'checkbox', 'range'],
    default: 'select'
  },
  category: {
    type: String,
    required: true
  },
  options: [{
    value: String,
    label: String,
    icon: String,
    count: { type: Number, default: 0 }
  }],
  order: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Compound unique index: name + category
filterSchema.index({ name: 1, category: 1 }, { unique: true });

module.exports = mongoose.model('Filter', filterSchema);
