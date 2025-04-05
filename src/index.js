const config = require('../config/config');
const logger = require('./utils/logger');
const db = require('./db/connection');
const dnsServer = require('./dns-server');
const webServer = require('./web-server');
const User = require('./db/models/User');
const bcrypt = require('bcryptjs');

// Process event handlers for graceful shutdown
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
process.on('uncaughtException', (error) => {
  logger.error(`Uncaught Exception: ${error.message}`);
  logger.error(error.stack);
  shutdown();
});

// Graceful shutdown function
async function shutdown() {
  logger.info('Shutting down Archon DNS...');
  
  try {
    // Stop DNS server
    await dnsServer.stop();
    
    // Stop web server
    await webServer.stop();
    
    // Disconnect from database
    await db.disconnect();
    
    logger.info('Archon DNS shutdown complete');
    process.exit(0);
  } catch (error) {
    logger.error(`Error during shutdown: ${error.message}`);
    process.exit(1);
  }
}

// Create default admin user if it doesn't exist
async function createAdminUser() {
  try {
    const adminExists = await User.findOne({ email: config.admin.defaultEmail });
    
    if (!adminExists) {
      const hashedPassword = await bcrypt.hash(config.admin.defaultPassword, 10);
      
      await User.create({
        name: 'Administrator',
        email: config.admin.defaultEmail,
        password: hashedPassword,
        role: 'admin'
      });
      
      logger.info('Default admin user created successfully');
    }
  } catch (error) {
    logger.error(`Error creating admin user: ${error.message}`);
  }
}

// Initialize and start the application
async function start() {
  logger.info('Starting Archon DNS...');
  
  // Connect to database
  const dbConnected = await db.connect();
  if (!dbConnected) {
    logger.error('Failed to connect to database, exiting...');
    process.exit(1);
  }
  
  // Initialize models
  db.initModels();
  
  // Create admin user
  await createAdminUser();
  
  // Start web server
  const webStarted = await webServer.start();
  if (!webStarted) {
    logger.error('Failed to start web server, exiting...');
    await db.disconnect();
    process.exit(1);
  }
  
  // Start DNS server
  const dnsStarted = await dnsServer.start();
  if (!dnsStarted) {
    logger.error('Failed to start DNS server, continuing with web interface only...');
    logger.warn('Check if another process is using port 53 or if you have permission to use it');
    logger.warn('You may need to run the application with elevated privileges for port 53');
  }
  
  logger.info('Archon DNS started successfully');
  logger.info(`Web interface available at http://localhost:${config.server.port}`);
  
  if (dnsStarted) {
    logger.info(`DNS server listening on port ${config.dns.port}`);
  }
}

// Run the application
start();