const express = require('express');
const router = express.Router();
const DnsQueryLog = require('../../db/models/DnsQueryLog');
const BlockRule = require('../../db/models/BlockRule');
const DnsRecord = require('../../db/models/DnsRecord');
const { authMiddleware } = require('./auth');
const logger = require('../../utils/logger');

// @route   GET /api/stats/dashboard
// @desc    Get dashboard statistics
// @access  Private
router.get('/dashboard', authMiddleware, async (req, res) => {
  try {
    // Get time ranges
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - (24 * 60 * 60 * 1000));
    const oneWeekAgo = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
    
    // Get query counts
    const totalQueries = await DnsQueryLog.countDocuments();
    const queriesLast24h = await DnsQueryLog.countDocuments({ timestamp: { $gte: oneDayAgo } });
    const queriesLastWeek = await DnsQueryLog.countDocuments({ timestamp: { $gte: oneWeekAgo } });
    
    // Get block counts
    const totalBlocked = await DnsQueryLog.countDocuments({ blocked: true });
    const blockedLast24h = await DnsQueryLog.countDocuments({ 
      blocked: true,
      timestamp: { $gte: oneDayAgo }
    });
    
    // Get rule counts
    const totalBlockRules = await BlockRule.countDocuments();
    const totalCustomDnsRecords = await DnsRecord.countDocuments();
    
    // Get top 5 domains in last 24 hours
    const topDomains = await DnsQueryLog.aggregate([
      { $match: { timestamp: { $gte: oneDayAgo } } },
      { $group: { _id: '$domain', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]);
    
    // Get top 5 blocked domains in last 24 hours
    const topBlockedDomains = await DnsQueryLog.aggregate([
      { $match: { timestamp: { $gte: oneDayAgo }, blocked: true } },
      { $group: { _id: '$domain', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]);
    
    // Get query history (last 24 hours by hour)
    const queryHistory = await DnsQueryLog.aggregate([
      { $match: { timestamp: { $gte: oneDayAgo } } },
      {
        $group: {
          _id: {
            year: { $year: '$timestamp' },
            month: { $month: '$timestamp' },
            day: { $dayOfMonth: '$timestamp' },
            hour: { $hour: '$timestamp' }
          },
          total: { $sum: 1 },
          blocked: { $sum: { $cond: ['$blocked', 1, 0] } }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1, '_id.hour': 1 } }
    ]);
    
    // Format query history for chart display
    const formattedHistory = queryHistory.map(item => {
      const date = new Date(
        item._id.year,
        item._id.month - 1,
        item._id.day,
        item._id.hour
      );
      
      return {
        timestamp: date,
        hour: item._id.hour,
        total: item.total,
        blocked: item.blocked
      };
    });
    
    res.status(200).json({
      success: true,
      data: {
        queries: {
          total: totalQueries,
          last24h: queriesLast24h,
          lastWeek: queriesLastWeek
        },
        blocked: {
          total: totalBlocked,
          last24h: blockedLast24h,
          percentage: totalQueries > 0 ? ((totalBlocked / totalQueries) * 100).toFixed(2) : 0
        },
        rules: {
          blockRules: totalBlockRules,
          customDnsRecords: totalCustomDnsRecords
        },
        topDomains: topDomains.map(item => ({ 
          domain: item._id, 
          count: item.count 
        })),
        topBlockedDomains: topBlockedDomains.map(item => ({ 
          domain: item._id, 
          count: item.count 
        })),
        queryHistory: formattedHistory
      }
    });
  } catch (err) {
    logger.error(`Dashboard stats error: ${err.message}`);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

module.exports = router;