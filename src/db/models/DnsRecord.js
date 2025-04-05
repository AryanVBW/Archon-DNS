const mongoose = require('mongoose');

const DnsRecordSchema = new mongoose.Schema({
  domain: {
    type: String,
    required: [true, 'Please add a domain name'],
    trim: true,
    index: true,
    lowercase: true
  },
  type: {
    type: String,
    required: [true, 'Please add a record type'],
    enum: ['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS', 'SOA', 'PTR']
  },
  value: {
    type: String,
    required: [true, 'Please add a record value']
  },
  ttl: {
    type: Number,
    default: 3600 // Default TTL of 1 hour in seconds
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

// Create compound index for domain and type
DnsRecordSchema.index({ domain: 1, type: 1 });

module.exports = mongoose.model('DnsRecord', DnsRecordSchema);