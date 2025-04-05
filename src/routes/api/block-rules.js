const express = require('express');
const router = express.Router();
const BlockRule = require('../../db/models/BlockRule');
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

// @route   GET /api/block-rules
// @desc    Get all block rules with optional filtering
// @access  Private (Admin)
router.get('/', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { category, isActive, search } = req.query;
    
    // Build query
    const query = {};
    
    if (category) {
      query.category = category;
    }
    
    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }
    
    if (search) {
      query.$text = { $search: search };
    }
    
    const rules = await BlockRule.find(query).sort({ domain: 1 });
    
    res.status(200).json({
      success: true,
      count: rules.length,
      data: rules
    });
  } catch (err) {
    logger.error(`Get block rules error: ${err.message}`);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

// @route   POST /api/block-rules
// @desc    Create a new block rule
// @access  Private (Admin)
router.post('/', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { domain, description, isRegex, isActive, redirectTo, category } = req.body;
    
    // Validate required fields
    if (!domain) {
      return res.status(400).json({
        success: false,
        error: 'Please provide a domain pattern'
      });
    }
    
    // Check if rule already exists
    const existingRule = await BlockRule.findOne({ domain: domain.toLowerCase() });
    if (existingRule) {
      return res.status(400).json({
        success: false,
        error: 'Block rule already exists for this domain'
      });
    }
    
    // If it's a regex, validate it
    if (isRegex) {
      try {
        new RegExp(domain);
      } catch (e) {
        return res.status(400).json({
          success: false,
          error: 'Invalid regular expression pattern'
        });
      }
    }
    
    // If redirectTo is provided, validate IP format
    if (redirectTo) {
      const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
      if (!redirectTo.match(ipv4Regex)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid IPv4 address format for redirect'
        });
      }
    }
    
    // Create the block rule
    const rule = await BlockRule.create({
      domain: domain.toLowerCase(),
      description: description || '',
      isRegex: isRegex || false,
      isActive: isActive !== undefined ? isActive : true,
      redirectTo: redirectTo || null,
      category: category || 'custom'
    });
    
    logger.info(`Block rule created: ${domain} (${category || 'custom'})`);
    
    res.status(201).json({
      success: true,
      data: rule
    });
  } catch (err) {
    logger.error(`Create block rule error: ${err.message}`);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

// @route   GET /api/block-rules/:id
// @desc    Get a single block rule
// @access  Private (Admin)
router.get('/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const rule = await BlockRule.findById(req.params.id);
    
    if (!rule) {
      return res.status(404).json({
        success: false,
        error: 'Block rule not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: rule
    });
  } catch (err) {
    logger.error(`Get block rule error: ${err.message}`);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

// @route   PUT /api/block-rules/:id
// @desc    Update a block rule
// @access  Private (Admin)
router.put('/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { description, isActive, redirectTo, category } = req.body;
    
    // Check if rule exists
    let rule = await BlockRule.findById(req.params.id);
    if (!rule) {
      return res.status(404).json({
        success: false,
        error: 'Block rule not found'
      });
    }
    
    // If redirectTo is provided, validate IP format
    if (redirectTo) {
      const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
      if (!redirectTo.match(ipv4Regex)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid IPv4 address format for redirect'
        });
      }
    }
    
    // Update the block rule
    rule = await BlockRule.findByIdAndUpdate(
      req.params.id,
      { 
        description: description !== undefined ? description : rule.description,
        isActive: isActive !== undefined ? isActive : rule.isActive,
        redirectTo: redirectTo !== undefined ? redirectTo : rule.redirectTo,
        category: category || rule.category,
        updatedAt: Date.now()
      },
      {
        new: true,
        runValidators: true
      }
    );
    
    logger.info(`Block rule updated: ${rule.domain}`);
    
    res.status(200).json({
      success: true,
      data: rule
    });
  } catch (err) {
    logger.error(`Update block rule error: ${err.message}`);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

// @route   DELETE /api/block-rules/:id
// @desc    Delete a block rule
// @access  Private (Admin)
router.delete('/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const rule = await BlockRule.findById(req.params.id);
    
    if (!rule) {
      return res.status(404).json({
        success: false,
        error: 'Block rule not found'
      });
    }
    
    await rule.deleteOne();
    
    logger.info(`Block rule deleted: ${rule.domain}`);
    
    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (err) {
    logger.error(`Delete block rule error: ${err.message}`);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

// @route   POST /api/block-rules/bulk-import
// @desc    Import multiple block rules
// @access  Private (Admin)
router.post('/bulk-import', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { rules, category, overwrite } = req.body;
    
    if (!Array.isArray(rules) || rules.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Please provide an array of domain patterns'
      });
    }
    
    const results = {
      total: rules.length,
      imported: 0,
      skipped: 0,
      errors: []
    };
    
    // Process each rule
    for (const domain of rules) {
      try {
        // Skip empty domains
        if (!domain.trim()) {
          results.skipped++;
          continue;
        }
        
        // Check if rule already exists
        const existingRule = await BlockRule.findOne({ domain: domain.toLowerCase() });
        
        if (existingRule) {
          if (overwrite) {
            // Update existing rule
            await BlockRule.updateOne(
              { _id: existingRule._id },
              { category: category || existingRule.category }
            );
            results.imported++;
          } else {
            results.skipped++;
          }
        } else {
          // Create new rule
          await BlockRule.create({
            domain: domain.toLowerCase(),
            description: '',
            isRegex: domain.includes('*'), // Basic check for wildcard patterns
            isActive: true,
            redirectTo: null,
            category: category || 'custom'
          });
          results.imported++;
        }
      } catch (error) {
        results.errors.push(`${domain}: ${error.message}`);
      }
    }
    
    logger.info(`Bulk import completed: ${results.imported} rules imported, ${results.skipped} skipped`);
    
    res.status(200).json({
      success: true,
      data: results
    });
  } catch (err) {
    logger.error(`Bulk import error: ${err.message}`);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

module.exports = router;