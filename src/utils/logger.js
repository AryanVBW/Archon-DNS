const winston = require('winston');
const path = require('path');
const fs = require('fs');
const config = require('../../config/config');

// Create logs directory if it doesn't exist
const logDir = path.resolve(process.cwd(), config.server.logDir);
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Define log formats
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message }) => {
    return `${timestamp} ${level}: ${message}`;
  })
);

const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message }) => {
    return `${timestamp} ${level}: ${message}`;
  })
);

// Create the logger
const logger = winston.createLogger({
  level: config.server.logLevel,
  levels: winston.config.npm.levels,
  defaultMeta: { service: 'archon-dns' },
  transports: [
    // Console transport
    new winston.transports.Console({
      format: consoleFormat
    }),
    // Error log file transport
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
      format: fileFormat,
      maxsize: 10485760, // 10MB
      maxFiles: 5
    }),
    // Combined log file transport
    new winston.transports.File({
      filename: path.join(logDir, 'combined.log'),
      format: fileFormat,
      maxsize: 10485760, // 10MB
      maxFiles: 5
    }),
    // HTTP log file transport (only for http level)
    new winston.transports.File({
      filename: path.join(logDir, 'http.log'),
      level: 'http',
      format: fileFormat,
      maxsize: 10485760, // 10MB
      maxFiles: 5
    })
  ]
});

// Add a separate DNS query log transport in development mode for debugging
if (config.server.env === 'development') {
  logger.add(
    new winston.transports.File({
      filename: path.join(logDir, 'dns-queries.log'),
      level: 'debug',
      format: fileFormat,
      maxsize: 10485760, // 10MB
      maxFiles: 3
    })
  );
}

// Export a simplified logger interface
module.exports = {
  error: (message) => logger.error(message),
  warn: (message) => logger.warn(message),
  info: (message) => logger.info(message),
  http: (message) => logger.http(message),
  verbose: (message) => logger.verbose(message),
  debug: (message) => logger.debug(message),
  silly: (message) => logger.silly(message)
};