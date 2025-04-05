const mongoose = require('mongoose');

const DnsQueryLogSchema = new mongoose.Schema({
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  clientIp: {
    type: String,
    required: true,
    index: true
  },
  domain: {
    type: String,
    required: true,
    lowercase: true,
    index: true
  },
  queryType: {
    type: String,
    required: true
  },
  responseCode: {
    type: Number,
    required: true
  },
  blocked: {
    type: Boolean,
    default: false
  },
  redirected: {
    type: Boolean,
    default: false
  },
  redirectTarget: {
    type: String,
    default: null
  }
});

// Create compound indexes for efficient querying
DnsQueryLogSchema.index({ domain: 1, timestamp: -1 });
DnsQueryLogSchema.index({ clientIp: 1, timestamp: -1 });

// Create TTL index to automatically expire old logs after 30 days
DnsQueryLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

module.exports = mongoose.model('DnsQueryLog', DnsQueryLogSchema);