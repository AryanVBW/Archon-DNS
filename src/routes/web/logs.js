const express = require('express');
const router = express.Router();
const { isAuthenticated } = require('./index');
const DnsQueryLog = require('../../db/models/DnsQueryLog');
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

// Apply authentication check to all logs routes
router.use(requireAuth);
router.use(requireAdmin);

// Logs dashboard page
router.get('/', async (req, res) => {
  try {
    // Get filter and pagination parameters
    const domain = req.query.domain;
    const clientIp = req.query.clientIp;
    const blocked = req.query.blocked;
    const startDate = req.query.startDate;
    const endDate = req.query.endDate;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;
    
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
    
    // Get logs with pagination
    const logs = await DnsQueryLog.find(query)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit);
    
    // Get total count for pagination
    const total = await DnsQueryLog.countDocuments(query);
    
    // Get client IP list (for filtering)
    const clients = await DnsQueryLog.aggregate([
      { $group: { _id: '$clientIp' } },
      { $sort: { _id: 1 } },
      { $limit: 50 }
    ]);
    
    res.render('logs/index', {
      title: 'DNS Query Logs - Archon DNS',
      logs,
      clients: clients.map(c => c._id),
      filters: {
        domain,
        clientIp,
        blocked,
        startDate,
        endDate
      },
      pagination: {
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        total
      },
      activeRoute: 'logs'
    });
  } catch (err) {
    logger.error(`Logs page error: ${err.message}`);
    res.status(500).render('error', {
      title: 'Error - Archon DNS',
      message: 'Failed to load DNS query logs'
    });
  }
});

// Stats and analytics page
router.get('/stats', async (req, res) => {
  try {
    const startDate = req.query.startDate || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // Default 7 days
    const endDate = req.query.endDate || new Date();
    
    // Build date range filter
    const dateFilter = {
      timestamp: {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      }
    };
    
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
    
    // Get daily distribution
    const dailyDistribution = await DnsQueryLog.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: {
            year: { $year: '$timestamp' },
            month: { $month: '$timestamp' },
            day: { $dayOfMonth: '$timestamp' }
          },
          total: { $sum: 1 },
          blocked: { $sum: { $cond: ['$blocked', 1, 0] } }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
    ]);
    
    // Format daily distribution for chart display
    const formattedDailyStats = dailyDistribution.map(item => {
      const date = new Date(item._id.year, item._id.month - 1, item._id.day);
      return {
        date: date.toISOString().split('T')[0],
        total: item.total,
        blocked: item.blocked
      };
    });
    
    res.render('logs/stats', {
      title: 'DNS Query Statistics - Archon DNS',
      dateRange: {
        start: new Date(startDate).toISOString().split('T')[0],
        end: new Date(endDate).toISOString().split('T')[0]
      },
      stats: {
        totalQueries,
        blockedQueries,
        redirectedQueries,
        blockRate: totalQueries > 0 ? (blockedQueries / totalQueries * 100).toFixed(2) : 0,
        redirectRate: totalQueries > 0 ? (redirectedQueries / totalQueries * 100).toFixed(2) : 0,
      },
      topDomains: topDomains.map(item => ({
        domain: item._id,
        count: item.count
      })),
      topClients: topClients.map(item => ({
        ip: item._id,
        count: item.count
      })),
      queryTypes: queryTypes.map(item => ({
        type: item._id,
        count: item.count
      })),
      dailyStats: formattedDailyStats,
      activeRoute: 'logs'
    });
  } catch (err) {
    logger.error(`Stats page error: ${err.message}`);
    res.status(500).render('error', {
      title: 'Error - Archon DNS',
      message: 'Failed to load DNS query statistics'
    });
  }
});

// Log maintenance page
router.get('/maintenance', (req, res) => {
  res.render('logs/maintenance', {
    title: 'Log Maintenance - Archon DNS',
    activeRoute: 'logs'
  });
});

module.exports = router;