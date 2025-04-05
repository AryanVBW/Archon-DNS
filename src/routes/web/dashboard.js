const express = require('express');
const router = express.Router();
const { isAuthenticated } = require('./index');
const DnsQueryLog = require('../../db/models/DnsQueryLog');
const BlockRule = require('../../db/models/BlockRule');
const DnsRecord = require('../../db/models/DnsRecord');

// Authentication check middleware
const requireAuth = (req, res, next) => {
  if (!res.locals.isAuthenticated) {
    return res.redirect('/login');
  }
  next();
};

// Apply authentication check to all dashboard routes
router.use(requireAuth);

// Dashboard home
router.get('/', async (req, res) => {
  try {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - (24 * 60 * 60 * 1000));
    
    // Get basic stats
    const totalQueries = await DnsQueryLog.countDocuments();
    const queriesLast24h = await DnsQueryLog.countDocuments({ 
      timestamp: { $gte: oneDayAgo } 
    });
    const blockedQueries = await DnsQueryLog.countDocuments({ blocked: true });
    const totalBlockRules = await BlockRule.countDocuments();
    const totalDnsRecords = await DnsRecord.countDocuments();
    
    // Get top 5 domains
    const topDomains = await DnsQueryLog.aggregate([
      { $match: { timestamp: { $gte: oneDayAgo } } },
      { $group: { _id: '$domain', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]);
    
    // Get top 5 blocked domains
    const topBlockedDomains = await DnsQueryLog.aggregate([
      { $match: { timestamp: { $gte: oneDayAgo }, blocked: true } },
      { $group: { _id: '$domain', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]);
    
    // Get recent query logs
    const recentLogs = await DnsQueryLog.find()
      .sort({ timestamp: -1 })
      .limit(10);
    
    res.render('dashboard/index', {
      title: 'Dashboard - Archon DNS',
      stats: {
        totalQueries,
        queriesLast24h,
        blockedQueries,
        blockRate: totalQueries > 0 ? ((blockedQueries / totalQueries) * 100).toFixed(2) : 0,
        totalBlockRules,
        totalDnsRecords
      },
      topDomains: topDomains.map(item => ({ 
        domain: item._id, 
        count: item.count 
      })),
      topBlockedDomains: topBlockedDomains.map(item => ({ 
        domain: item._id, 
        count: item.count 
      })),
      recentLogs,
      activeRoute: 'dashboard'
    });
  } catch (err) {
    console.error(err);
    res.status(500).render('error', {
      title: 'Error - Archon DNS',
      message: 'Failed to load dashboard data'
    });
  }
});

// System status and info
router.get('/system', async (req, res) => {
  try {
    const os = require('os');
    
    // Get system information
    const systemInfo = {
      platform: os.platform(),
      arch: os.arch(),
      hostname: os.hostname(),
      cpus: os.cpus().length,
      totalMemory: (os.totalmem() / (1024 * 1024 * 1024)).toFixed(2) + ' GB',
      freeMemory: (os.freemem() / (1024 * 1024 * 1024)).toFixed(2) + ' GB',
      uptime: (os.uptime() / 3600).toFixed(2) + ' hours'
    };
    
    // Get application status
    const dbStatus = mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected';
    
    res.render('dashboard/system', {
      title: 'System Info - Archon DNS',
      systemInfo,
      dbStatus,
      activeRoute: 'system'
    });
  } catch (err) {
    console.error(err);
    res.status(500).render('error', {
      title: 'Error - Archon DNS',
      message: 'Failed to load system information'
    });
  }
});

module.exports = router;