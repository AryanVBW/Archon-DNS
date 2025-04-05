const express = require('express');
const router = express.Router();
const DnsQueryLog = require('../../db/models/DnsQueryLog');
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

// @route   GET /api/query-logs
// @desc    Get DNS query logs with filtering and pagination
// @access  Private (Admin)
router.get('/', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const {
      domain,
      clientIp,
      blocked,
      redirected,
      startDate,
      endDate,
      page = 1,
      limit = 50,
      sort = '-timestamp'
    } = req.query;
    
    // Build query
    const query = {};
    
    if (domain) {
      query.domain = { $regex: domain, $options: 'i' };
    }
    
    if (clientIp) {
      query.clientIp = clientIp;
    }
    
    if (blocked !== undefined) {
      query.blocked = blocked === 'true';
    }
    
    if (redirected !== undefined) {
      query.redirected = redirected === 'true';
    }
    
    // Date range filter
    if (startDate || endDate) {
      query.timestamp = {};
      
      if (startDate) {
        query.timestamp.$gte = new Date(startDate);
      }
      
      if (endDate) {
        query.timestamp.$lte = new Date(endDate);
      }
    }
    
    // Pagination
    const pageNum = parseInt(page, 10) || 1;
    const pageSize = parseInt(limit, 10) || 50;
    const skip = (pageNum - 1) * pageSize;
    
    // Execute query
    const logs = await DnsQueryLog.find(query)
      .sort(sort)
      .skip(skip)
      .limit(pageSize);
    
    // Get total count
    const total = await DnsQueryLog.countDocuments(query);
    
    // Send response
    res.status(200).json({
      success: true,
      count: logs.length,
      total,
      pagination: {
        page: pageNum,
        limit: pageSize,
        totalPages: Math.ceil(total / pageSize)
      },
      data: logs
    });
  } catch (err) {
    logger.error(`Get query logs error: ${err.message}`);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

// @route   GET /api/query-logs/stats
// @desc    Get statistics from DNS query logs
// @access  Private (Admin)
router.get('/stats', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    // Build date range filter
    const dateFilter = {};
    if (startDate || endDate) {
      dateFilter.timestamp = {};
      
      if (startDate) {
        dateFilter.timestamp.$gte = new Date(startDate);
      }
      
      if (endDate) {
        dateFilter.timestamp.$lte = new Date(endDate);
      }
    }
    
    // Get total queries
    const totalQueries = await DnsQueryLog.countDocuments(dateFilter);
    
    // Get blocked queries
    const blockedQueries = await DnsQueryLog.countDocuments({
      ...dateFilter,
      blocked: true
    });
    
    // Get redirected queries
    const redirectedQueries = await DnsQueryLog.countDocuments({
      ...dateFilter,
      redirected: true
    });
    
    // Get top 10 domains
    const topDomains = await DnsQueryLog.aggregate([
      { $match: dateFilter },
      { $group: { _id: '$domain', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);
    
    // Get top 10 clients
    const topClients = await DnsQueryLog.aggregate([
      { $match: dateFilter },
      { $group: { _id: '$clientIp', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);
    
    // Get query type distribution
    const queryTypes = await DnsQueryLog.aggregate([
      { $match: dateFilter },
      { $group: { _id: '$queryType', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    
    // Get hourly distribution
    const hourlyDistribution = await DnsQueryLog.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: { $hour: '$timestamp' },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id': 1 } }
    ]);
    
    res.status(200).json({
      success: true,
      data: {
        totalQueries,
        blockedQueries,
        redirectedQueries,
        blockRate: totalQueries > 0 ? (blockedQueries / totalQueries * 100).toFixed(2) : 0,
        redirectRate: totalQueries > 0 ? (redirectedQueries / totalQueries * 100).toFixed(2) : 0,
        topDomains: topDomains.map(item => ({ domain: item._id, count: item.count })),
        topClients: topClients.map(item => ({ ip: item._id, count: item.count })),
        queryTypes: queryTypes.map(item => ({ type: item._id, count: item.count })),
        hourlyDistribution: hourlyDistribution.map(item => ({ hour: item._id, count: item.count }))
      }
    });
  } catch (err) {
    logger.error(`Get query stats error: ${err.message}`);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

// @route   DELETE /api/query-logs
// @desc    Delete all query logs or by filter
// @access  Private (Admin)
router.delete('/', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { olderThan, domain, clientIp } = req.body;
    
    // Build delete query
    const deleteQuery = {};
    
    if (olderThan) {
      const olderThanDate = new Date();
      olderThanDate.setDate(olderThanDate.getDate() - parseInt(olderThan));
      deleteQuery.timestamp = { $lt: olderThanDate };
    }
    
    if (domain) {
      deleteQuery.domain = domain;
    }
    
    if (clientIp) {
      deleteQuery.clientIp = clientIp;
    }
    
    // Require at least one filter
    if (Object.keys(deleteQuery).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Please provide at least one filter criteria'
      });
    }
    
    const result = await DnsQueryLog.deleteMany(deleteQuery);
    
    logger.info(`Deleted ${result.deletedCount} query logs`);
    
    res.status(200).json({
      success: true,
      data: {
        deletedCount: result.deletedCount
      }
    });
  } catch (err) {
    logger.error(`Delete query logs error: ${err.message}`);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

module.exports = router;