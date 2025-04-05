/**
 * Script to create the default admin user for Archon DNS
 * Run with: node scripts/create-admin.js
 */

const mongoose = require('mongoose');
const User = require('../src/db/models/User');
require('dotenv').config();

async function createDefaultAdmin() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('MongoDB Connected');
    
    // Check if admin already exists
    const adminEmail = process.env.DEFAULT_ADMIN_EMAIL;
    let adminPassword = process.env.DEFAULT_ADMIN_PASSWORD;
    
    if (!adminEmail || !adminPassword) {
      console.error('Default admin credentials not found in .env file');
      return;
    }
    
    // Ensure password meets minimum length requirement (6 characters)
    if (adminPassword.length < 6) {
      console.log(`Warning: Password "${adminPassword}" is too short (minimum 6 characters)`);
      adminPassword = adminPassword + '123456';
      console.log(`Using modified password: ${adminPassword}`);
    }
    
    // Check if user already exists
    let admin = await User.findOne({ email: adminEmail });
    
    if (admin) {
      console.log(`Admin user ${adminEmail} already exists, updating password...`);
      admin.password = adminPassword;
      await admin.save();
      console.log('Admin password updated successfully');
    } else {
      // Create admin user
      admin = await User.create({
        name: 'Administrator',
        email: adminEmail,
        password: adminPassword,
        role: 'admin'
      });
      console.log(`Admin user created: ${admin.email}`);
    }
    
    console.log('\n=== ADMIN CREDENTIALS ===');
    console.log(`Email: ${adminEmail}`);
    console.log(`Password: ${adminPassword}`);
    console.log('===========================');
    
  } catch (err) {
    console.error('Error creating admin user:', err);
  } finally {
    await mongoose.disconnect();
    console.log('MongoDB Disconnected');
  }
}

createDefaultAdmin();
