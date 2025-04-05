const express = require('express');
const router = express.Router();
const { isAuthenticated } = require('./index');
const BlockRule = require('../../db/models/BlockRule');
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

// Apply authentication check to all blocking routes
router.use(requireAuth);

// Blocking rules management page
router.get('/', requireAdmin, async (req, res) => {
  try {
    // Get filter and pagination parameters
    const category = req.query.category;
    const isActive = req.query.isActive;
    const search = req.query.search;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    // Build query
    const query = {};
    
    if (category) {
      query.category = category;
    }
    
    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }
    
    if (search) {
      query.$or = [
        { domain: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Get rules with pagination
    const rules = await BlockRule.find(query)
      .sort({ domain: 1 })
      .skip(skip)
      .limit(limit);
    
    // Get total count for pagination
    const total = await BlockRule.countDocuments(query);
    
    // Get category statistics
    const categories = await BlockRule.aggregate([
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    
    res.render('blocking/index', {
      title: 'Block Rules - Archon DNS',
      rules,
      categories: categories.map(cat => ({
        name: cat._id,
        count: cat.count
      })),
      filters: {
        category,
        isActive,
        search
      },
      pagination: {
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        total
      },
      activeRoute: 'blocking'
    });
  } catch (err) {
    logger.error(`Block rules page error: ${err.message}`);
    res.status(500).render('error', {
      title: 'Error - Archon DNS',
      message: 'Failed to load block rules'
    });
  }
});

// Create block rule page
router.get('/create', requireAdmin, (req, res) => {
  res.render('blocking/create', {
    title: 'Create Block Rule - Archon DNS',
    categories: ['ads', 'malware', 'adult', 'social', 'custom', 'other'],
    activeRoute: 'blocking'
  });
});

// Edit block rule page
router.get('/edit/:id', requireAdmin, async (req, res) => {
  try {
    const rule = await BlockRule.findById(req.params.id);
    
    if (!rule) {
      return res.status(404).render('error', {
        title: 'Not Found - Archon DNS',
        message: 'Block rule not found'
      });
    }
    
    res.render('blocking/edit', {
      title: 'Edit Block Rule - Archon DNS',
      rule,
      categories: ['ads', 'malware', 'adult', 'social', 'custom', 'other'],
      activeRoute: 'blocking'
    });
  } catch (err) {
    logger.error(`Edit block rule page error: ${err.message}`);
    res.status(500).render('error', {
      title: 'Error - Archon DNS',
      message: 'Failed to load block rule'
    });
  }
});

// Block rule details page
router.get('/view/:id', requireAdmin, async (req, res) => {
  try {
    const rule = await BlockRule.findById(req.params.id);
    
    if (!rule) {
      return res.status(404).render('error', {
        title: 'Not Found - Archon DNS',
        message: 'Block rule not found'
      });
    }
    
    res.render('blocking/view', {
      title: 'Block Rule Details - Archon DNS',
      rule,
      activeRoute: 'blocking'
    });
  } catch (err) {
    logger.error(`View block rule page error: ${err.message}`);
    res.status(500).render('error', {
      title: 'Error - Archon DNS',
      message: 'Failed to load block rule'
    });
  }
});

// Bulk import block rules page
router.get('/import', requireAdmin, (req, res) => {
  res.render('blocking/import', {
    title: 'Import Block Rules - Archon DNS',
    categories: ['ads', 'malware', 'adult', 'social', 'custom', 'other'],
    activeRoute: 'blocking'
  });
});

// Predefined blocklists page
router.get('/blocklists', requireAdmin, (req, res) => {
  // List of popular blocklists sources
  const blocklists = [
    {
      id: 'stevenblack',
      name: 'Steven Black Hosts',
      description: 'Curated list of hosts files from multiple sources',
      url: 'https://raw.githubusercontent.com/StevenBlack/hosts/master/hosts',
      categories: ['ads', 'malware']
    },
    {
      id: 'adguard',
      name: 'AdGuard DNS Filter',
      description: 'Blocks ads, tracking, and phishing websites',
      url: 'https://adguardteam.github.io/AdGuardSDNSFilter/Filters/filter.txt',
      categories: ['ads', 'tracking']
    },
    {
      id: 'malware-domains',
      name: 'Malware Domains',
      description: 'Just domains that are serving malware',
      url: 'https://mirror1.malwaredomains.com/files/justdomains',
      categories: ['malware']
    },
    {
      id: 'pornography',
      name: 'Porn domains',
      description: 'Block adult websites',
      url: 'https://raw.githubusercontent.com/chadmayfield/my-pihole-blocklists/master/lists/pi_blocklist_porn_top1m.list',
      categories: ['adult']
    },
    {
      id: 'social',
      name: 'Social Networks',
      description: 'Block social media sites',
      url: 'https://raw.githubusercontent.com/StevenBlack/hosts/master/alternates/social/hosts',
      categories: ['social']
    }
  ];
  
  res.render('blocking/blocklists', {
    title: 'Predefined Blocklists - Archon DNS',
    blocklists,
    activeRoute: 'blocking'
  });
});

module.exports = router;