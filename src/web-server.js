const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const ejsLayouts = require('express-ejs-layouts');
const rateLimit = require('express-rate-limit');
const config = require('../config/config');
const logger = require('./utils/logger');

// API Routes
const authRoutes = require('./routes/api/auth');
const dnsRecordsRoutes = require('./routes/api/dns-records');
const blockRulesRoutes = require('./routes/api/block-rules');
const queryLogsRoutes = require('./routes/api/query-logs');
const statsRoutes = require('./routes/api/stats');

// Web Routes
const indexRoutes = require('./routes/web/index');
const dashboardRoutes = require('./routes/web/dashboard');
const dnsWebRoutes = require('./routes/web/dns');
const blockingWebRoutes = require('./routes/web/blocking');
const logsWebRoutes = require('./routes/web/logs');

class WebServer {
  constructor() {
    this.app = express();
    this.server = null;
    this.isRunning = false;
    this.configureMiddleware();
    this.configureRoutes();
    this.configureErrorHandlers();
  }
  
  configureMiddleware() {
    // Basic middleware
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
    this.app.use(cookieParser());
    
    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'", "cdn.jsdelivr.net"],
          styleSrc: ["'self'", "'unsafe-inline'", "cdn.jsdelivr.net"],
          imgSrc: ["'self'", "data:"],
          connectSrc: ["'self'"],
          fontSrc: ["'self'", "cdn.jsdelivr.net"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"]
        }
      }
    }));
    
    // CORS setup
    if (config.security.cors.enabled) {
      this.app.use(cors({
        origin: config.security.cors.origin,
        credentials: true
      }));
    }
    
    // Rate limiting
    if (config.security.rateLimit.enabled) {
      const limiter = rateLimit({
        windowMs: config.security.rateLimit.windowMs,
        max: config.security.rateLimit.max,
        standardHeaders: true,
        legacyHeaders: false,
        handler: (req, res) => {
          logger.warn(`Rate limit exceeded for IP: ${req.ip}`);
          res.status(429).json({
            success: false,
            error: 'Too many requests. Please try again later.'
          });
        }
      });
      this.app.use('/api', limiter);
    }
    
    // Logging middleware
    if (config.server.env === 'production') {
      this.app.use(morgan('combined', {
        stream: {
          write: message => logger.http(message.trim())
        }
      }));
    } else {
      this.app.use(morgan('dev', {
        stream: {
          write: message => logger.http(message.trim())
        }
      }));
    }
    
    // Session middleware
    this.app.use(session({
      secret: config.jwt.secret,
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: config.server.env === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 1 day
      }
    }));
    
    // View engine setup
    this.app.set('view engine', 'ejs');
    this.app.set('views', path.join(__dirname, 'views'));
    this.app.use(ejsLayouts);
    this.app.set('layout', 'layouts/main');
    
    // Static files
    this.app.use(express.static(path.join(__dirname, '..', 'public')));
  }
  
  configureRoutes() {
    // API routes
    this.app.use('/api/auth', authRoutes);
    this.app.use('/api/dns-records', dnsRecordsRoutes);
    this.app.use('/api/block-rules', blockRulesRoutes);
    this.app.use('/api/query-logs', queryLogsRoutes);
    this.app.use('/api/stats', statsRoutes);
    
    // Web routes
    this.app.use('/', indexRoutes);
    this.app.use('/dashboard', dashboardRoutes);
    this.app.use('/dns', dnsWebRoutes);
    this.app.use('/blocking', blockingWebRoutes);
    this.app.use('/logs', logsWebRoutes);
    
    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.status(200).json({ status: 'ok' });
    });
  }
  
  configureErrorHandlers() {
    // 404 handler
    this.app.use((req, res, next) => {
      res.status(404);
      
      // Respond with HTML page for web routes
      if (req.accepts('html') && !req.path.startsWith('/api')) {
        res.render('error', {
          title: 'Not Found - Archon DNS',
          message: 'Page not found'
        });
      } 
      // Respond with JSON for API routes or when JSON is specifically requested
      else {
        res.json({
          success: false,
          error: 'Endpoint not found'
        });
      }
    });
    
    // 500 handler
    this.app.use((err, req, res, next) => {
      logger.error(`Server error: ${err.message}`);
      logger.error(err.stack);
      
      res.status(err.status || 500);
      
      // Respond with HTML page for web routes
      if (req.accepts('html') && !req.path.startsWith('/api')) {
        res.render('error', {
          title: 'Server Error - Archon DNS',
          message: config.server.env === 'production' 
            ? 'Internal server error' 
            : err.message
        });
      } 
      // Respond with JSON for API routes or when JSON is specifically requested
      else {
        res.json({
          success: false,
          error: config.server.env === 'production' 
            ? 'Internal server error' 
            : err.message
        });
      }
    });
  }
  
  async start() {
    try {
      const port = config.server.port;
      
      return new Promise((resolve, reject) => {
        this.server = this.app.listen(port, () => {
          logger.info(`Web server listening on port ${port}`);
          this.isRunning = true;
          resolve(true);
        });
        
        this.server.on('error', (err) => {
          logger.error(`Failed to start web server: ${err.message}`);
          reject(err);
        });
      });
    } catch (error) {
      logger.error(`Failed to start web server: ${error.message}`);
      return false;
    }
  }
  
  async stop() {
    if (!this.isRunning || !this.server) {
      return true;
    }
    
    try {
      return new Promise((resolve, reject) => {
        this.server.close((err) => {
          if (err) {
            logger.error(`Error stopping web server: ${err.message}`);
            reject(err);
          } else {
            logger.info('Web server stopped');
            this.isRunning = false;
            resolve(true);
          }
        });
      });
    } catch (error) {
      logger.error(`Failed to stop web server: ${error.message}`);
      return false;
    }
  }
  
  async restart() {
    await this.stop();
    return await this.start();
  }
  
  getStatus() {
    return {
      running: this.isRunning,
      port: this.isRunning && this.server ? this.server.address().port : config.server.port,
      environment: config.server.env
    };
  }
}

module.exports = new WebServer();