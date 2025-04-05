const mongoose = require('mongoose');

const BlockRuleSchema = new mongoose.Schema({
  domain: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    index: true
  },
  description: {
    type: String,
    default: ''
  },
  isRegex: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true
  },
  redirectTo: {
    type: String,
    default: null
  },
  category: {
    type: String,
    enum: ['ads', 'malware', 'adult', 'social', 'custom', 'other'],
    default: 'custom'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

BlockRuleSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Create text index for search functionality
BlockRuleSchema.index({ domain: 'text', description: 'text' });

module.exports = mongoose.model('BlockRule', BlockRuleSchema);