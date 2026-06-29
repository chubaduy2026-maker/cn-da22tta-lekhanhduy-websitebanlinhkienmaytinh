const mongoose = require('mongoose');

const techNewsSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 220,
  },
  summary: {
    type: String,
    trim: true,
    default: '',
    maxlength: 600,
  },
  thumbnail: {
    type: String,
    required: true,
    trim: true,
  },
  articleUrl: {
    type: String,
    required: true,
    trim: true,
  },
  source: {
    type: String,
    trim: true,
    default: '',
    maxlength: 120,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  order: {
    type: Number,
    default: 0,
  },
}, {
  timestamps: true,
});

techNewsSchema.index({ isActive: 1, order: 1, createdAt: -1 });

module.exports = mongoose.model('TechNews', techNewsSchema);
