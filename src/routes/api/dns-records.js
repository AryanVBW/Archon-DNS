const express = require('express');
const router = express.Router();
const DnsRecord = require('../../db/models/DnsRecord');
const { authMiddleware } = require('./auth');
const logger = require('../../utils/logger');

// Admin middleware
const adminMiddleware = async (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      error: 'Access denied. Admin privileges required.'
    });
  }
  next();
};

// @route   GET /api/dns-records
// @desc    Get all DNS records
// @access  Private (Admin)
router.get('/', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const records = await DnsRecord.find().sort({ domain: 1 });
    
    res.status(200).json({
      success: true,
      count: records.length,
      data: records
    });
  } catch (err) {
    logger.error(`Get DNS records error: ${err.message}`);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

// @route   POST /api/dns-records
// @desc    Create a new DNS record
// @access  Private (Admin)
router.post('/', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { domain, type, value, ttl } = req.body;
    
    // Validate domain syntax
    const domainRegex = /^(?!-)[A-Za-z0-9-]{1,63}(?<!-)(\.[A-Za-z0-9-]{1,63})*(\.[A-Za-z]{2,})$/;
    if (!domain.match(domainRegex)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid domain format'
      });
    }
    
    // Validate required fields
    if (!domain || !type || !value) {
      return res.status(400).json({
        success: false,
        error: 'Please provide domain, type, and value'
      });
    }
    
    // Check if record already exists
    const existingRecord = await DnsRecord.findOne({ domain: domain.toLowerCase(), type });
    if (existingRecord) {
      return res.status(400).json({
        success: false,
        error: 'DNS record already exists for this domain and type'
      });
    }
    
    // Validate IP addresses for A and AAAA records
    if (type === 'A') {
      const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
      if (!value.match(ipv4Regex)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid IPv4 address format for A record'
        });
      }
    } else if (type === 'AAAA') {
      const ipv6Regex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/;
      if (!value.match(ipv6Regex)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid IPv6 address format for AAAA record'
        });
      }
    }
    
    // Create the DNS record
    const record = await DnsRecord.create({
      domain: domain.toLowerCase(),
      type,
      value,
      ttl: ttl || 3600
    });
    
    logger.info(`DNS record created: ${domain} (${type}) -> ${value}`);
    
    res.status(201).json({
      success: true,
      data: record
    });
  } catch (err) {
    logger.error(`Create DNS record error: ${err.message}`);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

// @route   GET /api/dns-records/:id
// @desc    Get a single DNS record
// @access  Private (Admin)
router.get('/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const record = await DnsRecord.findById(req.params.id);
    
    if (!record) {
      return res.status(404).json({
        success: false,
        error: 'DNS record not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: record
    });
  } catch (err) {
    logger.error(`Get DNS record error: ${err.message}`);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

// @route   PUT /api/dns-records/:id
// @desc    Update a DNS record
// @access  Private (Admin)
router.put('/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { value, ttl } = req.body;
    
    // Check if record exists
    let record = await DnsRecord.findById(req.params.id);
    if (!record) {
      return res.status(404).json({
        success: false,
        error: 'DNS record not found'
      });
    }
    
    // Validate input based on record type
    if (record.type === 'A') {
      const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
      if (!value.match(ipv4Regex)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid IPv4 address format for A record'
        });
      }
    } else if (record.type === 'AAAA') {
      const ipv6Regex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/;
      if (!value.match(ipv6Regex)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid IPv6 address format for AAAA record'
        });
      }
    }
    
    // Update the DNS record
    record = await DnsRecord.findByIdAndUpdate(
      req.params.id,
      { 
        value,
        ttl: ttl || record.ttl,
        updatedAt: Date.now()
      },
      {
        new: true,
        runValidators: true
      }
    );
    
    logger.info(`DNS record updated: ${record.domain} (${record.type}) -> ${value}`);
    
    res.status(200).json({
      success: true,
      data: record
    });
  } catch (err) {
    logger.error(`Update DNS record error: ${err.message}`);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

// @route   DELETE /api/dns-records/:id
// @desc    Delete a DNS record
// @access  Private (Admin)
router.delete('/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const record = await DnsRecord.findById(req.params.id);
    
    if (!record) {
      return res.status(404).json({
        success: false,
        error: 'DNS record not found'
      });
    }
    
    await record.deleteOne();
    
    logger.info(`DNS record deleted: ${record.domain} (${record.type})`);
    
    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (err) {
    logger.error(`Delete DNS record error: ${err.message}`);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

module.exports = router;