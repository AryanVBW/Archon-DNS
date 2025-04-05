const express = require('express');
const router = express.Router();
const { isAuthenticated } = require('./index');
const DnsRecord = require('../../db/models/DnsRecord');
const logger = require('../../utils/logger');

// Authentication check middleware
const requireAuth = (req, res, next) => {
  if (!res.locals.isAuthenticated) {
    return res.redirect('/login');
  }
  next();
};

// Admin check middleware
const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).render('error', {
      title: 'Access Denied - Archon DNS',
      message: 'You do not have permission to access this page'
    });
  }
  next();
};

// Apply authentication check to all DNS routes
router.use(requireAuth);

// DNS records management page
router.get('/', requireAdmin, async (req, res) => {
  try {
    // Get pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    // Get records with pagination
    const records = await DnsRecord.find()
      .sort({ domain: 1 })
      .skip(skip)
      .limit(limit);
    
    // Get total count for pagination
    const total = await DnsRecord.countDocuments();
    
    res.render('dns/index', {
      title: 'DNS Records - Archon DNS',
      records,
      pagination: {
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        total
      },
      activeRoute: 'dns'
    });
  } catch (err) {
    logger.error(`DNS records page error: ${err.message}`);
    res.status(500).render('error', {
      title: 'Error - Archon DNS',
      message: 'Failed to load DNS records'
    });
  }
});

// Create DNS record page
router.get('/create', requireAdmin, (req, res) => {
  res.render('dns/create', {
    title: 'Create DNS Record - Archon DNS',
    activeRoute: 'dns'
  });
});

// Edit DNS record page
router.get('/edit/:id', requireAdmin, async (req, res) => {
  try {
    const record = await DnsRecord.findById(req.params.id);
    
    if (!record) {
      return res.status(404).render('error', {
        title: 'Not Found - Archon DNS',
        message: 'DNS record not found'
      });
    }
    
    res.render('dns/edit', {
      title: 'Edit DNS Record - Archon DNS',
      record,
      activeRoute: 'dns'
    });
  } catch (err) {
    logger.error(`Edit DNS record page error: ${err.message}`);
    res.status(500).render('error', {
      title: 'Error - Archon DNS',
      message: 'Failed to load DNS record'
    });
  }
});

// DNS record details page
router.get('/view/:id', requireAdmin, async (req, res) => {
  try {
    const record = await DnsRecord.findById(req.params.id);
    
    if (!record) {
      return res.status(404).render('error', {
        title: 'Not Found - Archon DNS',
        message: 'DNS record not found'
      });
    }
    
    res.render('dns/view', {
      title: 'DNS Record Details - Archon DNS',
      record,
      activeRoute: 'dns'
    });
  } catch (err) {
    logger.error(`View DNS record page error: ${err.message}`);
    res.status(500).render('error', {
      title: 'Error - Archon DNS',
      message: 'Failed to load DNS record'
    });
  }
});

// Bulk import DNS records page
router.get('/import', requireAdmin, (req, res) => {
  res.render('dns/import', {
    title: 'Import DNS Records - Archon DNS',
    activeRoute: 'dns'
  });
});

module.exports = router;