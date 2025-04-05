require('dotenv').config();

const config = {
  server: {
    port: process.env.PORT || 3000,
    env: process.env.NODE_ENV || 'development',
    logLevel: process.env.LOG_LEVEL || 'info',
    logDir: process.env.LOG_DIR || 'logs'
  },
  
  dns: {
    port: process.env.DNS_PORT || 53,
    upstream: {
      primary: process.env.DNS_UPSTREAM_PRIMARY || '8.8.8.8',
      secondary: process.env.DNS_UPSTREAM_SECONDARY || '1.1.1.1'
    },
    forwarder: {
      enabled: process.env.DNS_FORWARDER_ENABLED === 'true' || true,
      timeout: parseInt(process.env.DNS_FORWARDER_TIMEOUT) || 5000
    },
    cache: {
      enabled: process.env.DNS_CACHE_ENABLED === 'true' || true,
      maxSize: parseInt(process.env.DNS_CACHE_MAX_SIZE) || 10000,
      ttl: parseInt(process.env.DNS_CACHE_TTL) || 300 // 5 minutes
    },
    logging: {
      queryLogging: process.env.DNS_QUERY_LOGGING === 'true' || true,
      expiryDays: parseInt(process.env.DNS_LOG_EXPIRY_DAYS) || 30
    }
  },
  
  database: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/archon_dns',
    options: {
      useNewUrlParser: true,
      useUnifiedTopology: true
    }
  },
  
  jwt: {
    secret: process.env.JWT_SECRET || 'archon-dns-secret-key-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '1d'
  },
  
  admin: {
    defaultEmail: process.env.ADMIN_EMAIL || 'admin@archon.dns',
    defaultPassword: process.env.ADMIN_PASSWORD || 'adminPassword123!'
  },
  
  security: {
    cors: {
      enabled: process.env.CORS_ENABLED === 'true' || false,
      origin: process.env.CORS_ORIGIN || '*'
    },
    rateLimit: {
      enabled: process.env.RATE_LIMIT_ENABLED === 'true' || true,
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
      max: parseInt(process.env.RATE_LIMIT_MAX) || 100 // limit each IP to 100 requests per windowMs
    }
  },
  
  features: {
    blockMalware: process.env.BLOCK_MALWARE === 'true' || true,
    blockAds: process.env.BLOCK_ADS === 'true' || false,
    blockTracking: process.env.BLOCK_TRACKING === 'true' || false,
    blockAdult: process.env.BLOCK_ADULT === 'true' || false
  }
};

module.exports = config;