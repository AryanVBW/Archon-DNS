const dns2 = require('dns2');
const { Packet } = dns2;
const mongoose = require('mongoose');
const ip = require('ip');
const config = require('../config/config');
const logger = require('./utils/logger');
const DnsRecord = require('./db/models/DnsRecord');
const BlockRule = require('./db/models/BlockRule');
const DnsQueryLog = require('./db/models/DnsQueryLog');

class DnsServer {
  constructor() {
    this.server = dns2.createServer();
    this.cache = new Map();
    this.isRunning = false;
    this.initEventHandlers();
  }

  initEventHandlers() {
    this.server.on('request', this.handleRequest.bind(this));
    this.server.on('error', this.handleError.bind(this));
    this.server.on('listening', this.handleListening.bind(this));
    this.server.on('close', this.handleClose.bind(this));
  }

  async handleRequest(request, send, remoteInfo) {
    const startTime = process.hrtime();
    const { questions } = request;
    
    if (!questions || questions.length === 0) {
      return send({ answers: [] });
    }
    
    const question = questions[0];
    const { name, type } = question;
    const clientIp = remoteInfo.address;
    
    try {
      // Create query log entry (placeholder - will be updated)
      const queryLog = {
        timestamp: new Date(),
        domain: name.toLowerCase(),
        clientIp,
        queryType: Packet.TYPE[type] || 'UNKNOWN',
        responseTime: 0,
        blocked: false,
        redirected: false
      };
      
      // Check cache first
      const cacheKey = `${name}:${type}`;
      if (config.dns.cache.enabled && this.cache.has(cacheKey)) {
        const cachedResponse = this.cache.get(cacheKey);
        if (cachedResponse.expiry > Date.now()) {
          logger.debug(`Cache hit for ${name} (${Packet.TYPE[type]})`);
          
          // Complete query log with response from cache
          queryLog.responseTime = process.hrtime(startTime)[1] / 1000000; // Convert to ms
          this.logQuery(queryLog);
          
          return send(cachedResponse.response);
        } else {
          // Remove expired cache entry
          this.cache.delete(cacheKey);
        }
      }
      
      // Check if domain is blocked
      const isBlocked = await this.checkIfBlocked(name);
      
      if (isBlocked.blocked) {
        logger.info(`Blocked DNS request: ${name} (${Packet.TYPE[type]}) from ${clientIp}`);
        
        // Update query log for blocked request
        queryLog.blocked = true;
        queryLog.blockReason = isBlocked.reason;
        queryLog.responseTime = process.hrtime(startTime)[1] / 1000000; // Convert to ms
        this.logQuery(queryLog);
        
        if (isBlocked.redirectIp) {
          // Redirect to specified IP
          queryLog.redirected = true;
          queryLog.redirectIp = isBlocked.redirectIp;
          
          const answers = [{
            name,
            type,
            class: Packet.CLASS.IN,
            ttl: 60,
            address: isBlocked.redirectIp
          }];
          
          return send({ answers });
        } else {
          // Return empty response (NXDomain)
          return send({ answers: [] });
        }
      }
      
      // Check for custom DNS records
      const customRecord = await this.getCustomRecord(name, type);
      if (customRecord) {
        logger.debug(`Custom DNS record found for ${name} (${Packet.TYPE[type]})`);
        
        // Update query log for custom record
        queryLog.custom = true;
        queryLog.responseTime = process.hrtime(startTime)[1] / 1000000; // Convert to ms
        this.logQuery(queryLog);
        
        return send({ answers: [customRecord] });
      }
      
      // Forward to upstream DNS server
      const response = await this.forwardRequest(request);
      
      // Cache the response
      if (config.dns.cache.enabled && response.answers && response.answers.length > 0) {
        const ttl = Math.min(
          response.answers.reduce((min, answer) => Math.min(min, answer.ttl || 60), Infinity),
          config.dns.cache.ttl
        );
        
        this.cache.set(cacheKey, {
          response,
          expiry: Date.now() + ttl * 1000
        });
        
        // Periodically clean cache when it gets too large
        if (this.cache.size > config.dns.cache.maxSize) {
          this.cleanCache();
        }
      }
      
      // Complete query log with response
      queryLog.responseTime = process.hrtime(startTime)[1] / 1000000; // Convert to ms
      this.logQuery(queryLog);
      
      return send(response);
      
    } catch (error) {
      logger.error(`Error processing DNS request: ${error.message}`);
      
      // Log error in query log
      const queryLog = {
        timestamp: new Date(),
        domain: name.toLowerCase(),
        clientIp,
        queryType: Packet.TYPE[type] || 'UNKNOWN',
        responseTime: process.hrtime(startTime)[1] / 1000000,
        error: error.message
      };
      this.logQuery(queryLog);
      
      return send({ answers: [] });
    }
  }
  
  async checkIfBlocked(domain) {
    try {
      domain = domain.toLowerCase();
      
      // Check exact domain match
      let blockRule = await BlockRule.findOne({ 
        domain: domain,
        isActive: true,
        isRegex: false 
      });
      
      if (blockRule) {
        return { 
          blocked: true, 
          reason: blockRule.category || 'custom', 
          redirectIp: blockRule.redirectTo
        };
      }
      
      // Check for wildcard/regex rules
      const regexRules = await BlockRule.find({ 
        isActive: true,
        isRegex: true 
      });
      
      for (const rule of regexRules) {
        try {
          const regex = new RegExp(rule.domain, 'i');
          if (regex.test(domain)) {
            return { 
              blocked: true, 
              reason: rule.category || 'custom',
              redirectIp: rule.redirectTo
            };
          }
        } catch (e) {
          logger.error(`Invalid regex pattern in block rule: ${rule.domain}`);
        }
      }
      
      return { blocked: false };
    } catch (error) {
      logger.error(`Error checking if domain is blocked: ${error.message}`);
      return { blocked: false };
    }
  }
  
  async getCustomRecord(domain, type) {
    try {
      domain = domain.toLowerCase();
      
      const record = await DnsRecord.findOne({ 
        domain, 
        type: Packet.TYPE[type] || 'A'
      });
      
      if (!record) {
        return null;
      }
      
      return {
        name: domain,
        type,
        class: Packet.CLASS.IN,
        ttl: record.ttl || 60,
        address: record.value
      };
    } catch (error) {
      logger.error(`Error fetching custom DNS record: ${error.message}`);
      return null;
    }
  }
  
  async forwardRequest(request) {
    if (!config.dns.forwarder.enabled) {
      return { answers: [] };
    }
    
    const { questions } = request;
    if (!questions || questions.length === 0) {
      return { answers: [] };
    }
    
    try {
      // Create upstream resolver
      const resolver = new dns2({
        nameServers: [config.dns.upstream.primary, config.dns.upstream.secondary],
        timeout: config.dns.forwarder.timeout
      });
      
      // Forward the request
      return await resolver.resolve(request);
    } catch (error) {
      logger.error(`Error forwarding DNS request: ${error.message}`);
      return { answers: [] };
    }
  }
  
  async logQuery(queryLog) {
    if (!config.dns.logging.queryLogging) {
      return;
    }
    
    try {
      await DnsQueryLog.create(queryLog);
    } catch (error) {
      logger.error(`Error logging DNS query: ${error.message}`);
    }
  }
  
  cleanCache() {
    const now = Date.now();
    const entries = [...this.cache.entries()];
    
    // Remove expired entries
    for (const [key, value] of entries) {
      if (value.expiry <= now) {
        this.cache.delete(key);
      }
    }
    
    // If still too large, remove oldest entries
    if (this.cache.size > config.dns.cache.maxSize) {
      // Sort by expiry (ascending)
      entries.sort((a, b) => a[1].expiry - b[1].expiry);
      
      // Remove oldest entries until cache size is acceptable
      const entriesToRemove = Math.floor(config.dns.cache.maxSize * 0.2); // Remove 20% of max size
      for (let i = 0; i < entriesToRemove && i < entries.length; i++) {
        this.cache.delete(entries[i][0]);
      }
    }
    
    logger.debug(`Cache cleaned: ${this.cache.size} entries remaining`);
  }
  
  handleError(error) {
    logger.error(`DNS server error: ${error.message}`);
  }
  
  handleListening() {
    let port = config.dns.port;
    if (this.server && this.server.socket) {
      try {
        port = this.server.socket.address().port;
      } catch (err) {
        logger.warn(`Could not get socket address: ${err.message}`);
      }
    }
    logger.info(`DNS server listening on port ${port}`);
    this.isRunning = true;
  }
  
  handleClose() {
    logger.info('DNS server closed');
    this.isRunning = false;
  }
  
  async start() {
    try {
      const port = config.dns.port;
      await this.server.listen({ port });
      logger.info(`DNS server started on port ${port}`);
      return true;
    } catch (error) {
      logger.error(`Failed to start DNS server: ${error.message}`);
      return false;
    }
  }
  
  async stop() {
    if (!this.isRunning) {
      return true;
    }
    
    try {
      await this.server.close();
      logger.info('DNS server stopped');
      return true;
    } catch (error) {
      logger.error(`Failed to stop DNS server: ${error.message}`);
      return false;
    }
  }
  
  async restart() {
    await this.stop();
    return await this.start();
  }
  
  getStatus() {
    let port = config.dns.port;
    if (this.isRunning && this.server && this.server.socket) {
      try {
        port = this.server.socket.address().port;
      } catch (err) {
        logger.warn(`Could not get socket address in getStatus: ${err.message}`);
      }
    }
    
    return {
      running: this.isRunning,
      port: port,
      cacheSize: this.cache.size,
      cacheEnabled: config.dns.cache.enabled,
      upstreamServers: [
        config.dns.upstream.primary,
        config.dns.upstream.secondary
      ]
    };
  }
}

module.exports = new DnsServer();