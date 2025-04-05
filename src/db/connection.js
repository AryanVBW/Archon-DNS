const mongoose = require('mongoose');
const config = require('../../config/config');
const logger = require('../utils/logger');

// Connection options
const options = {
  ...config.database.options,
  serverSelectionTimeoutMS: 5000 // Timeout after 5s instead of 30s
};

// Connect to MongoDB
const connect = async () => {
  try {
    await mongoose.connect(config.database.uri, options);
    logger.info('Connected to MongoDB successfully');
    return true;
  } catch (error) {
    logger.error(`MongoDB connection error: ${error.message}`);
    return false;
  }
};

// Disconnect from MongoDB
const disconnect = async () => {
  try {
    await mongoose.disconnect();
    logger.info('Disconnected from MongoDB');
    return true;
  } catch (error) {
    logger.error(`MongoDB disconnect error: ${error.message}`);
    return false;
  }
};

// Set up mongoose event listeners
mongoose.connection.on('error', err => {
  logger.error(`MongoDB connection error: ${err.message}`);
});

mongoose.connection.on('disconnected', () => {
  logger.warn('MongoDB disconnected');
});

mongoose.connection.on('reconnected', () => {
  logger.info('MongoDB reconnected');
});

// Initialize models to ensure they are registered
const initModels = () => {
  // Require all models to register them with mongoose
  require('./models/User');
  require('./models/DnsRecord');
  require('./models/BlockRule');
  require('./models/DnsQueryLog');
  
  logger.debug('MongoDB models initialized');
};

module.exports = {
  connect,
  disconnect,
  initModels,
  mongoose
};