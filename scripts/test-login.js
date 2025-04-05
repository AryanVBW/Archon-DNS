/**
 * Script to test login functionality for Archon DNS
 * Run with: node scripts/test-login.js
 */

const mongoose = require('mongoose');
const User = require('../src/db/models/User');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Test credentials
const testCredentials = [
  { email: 'admin@vivek.com', password: 'admin' },
  { email: 'user@example.com', password: 'password123' },
  { email: 'support@example.com', password: 'support123' },
  { email: 'sysadmin@example.com', password: 'admin123' }
];

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(async () => {
  console.log('MongoDB Connected');
  
  try {
    console.log('\n=== TESTING USER AUTHENTICATION ===');
    
    for (const cred of testCredentials) {
      // Find user
      const user = await User.findOne({ email: cred.email }).select('+password');
      
      if (!user) {
        console.log(`\n❌ User not found: ${cred.email}`);
        continue;
      }
      
      // Check password
      let isMatch = false;
      try {
        isMatch = await bcrypt.compare(cred.password, user.password);
      } catch (err) {
        console.log(`\n❌ Error comparing passwords for ${cred.email}: ${err.message}`);
        continue;
      }
      
      if (isMatch) {
        console.log(`\n✅ Authentication successful for: ${cred.email}`);
        console.log(`   Name: ${user.name}`);
        console.log(`   Role: ${user.role}`);
      } else {
        console.log(`\n❌ Password mismatch for: ${cred.email}`);
        console.log(`   Expected password: ${cred.password}`);
        
        // Debug: Show password hash
        console.log(`   Stored password hash: ${user.password}`);
        
        // Try to fix by updating the password
        console.log(`   Attempting to fix password...`);
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(cred.password, salt);
        
        await User.findByIdAndUpdate(user._id, { password: hashedPassword });
        console.log(`   Password updated for ${cred.email}`);
      }
    }
    
  } catch (err) {
    console.error('Error testing authentication:', err);
  } finally {
    mongoose.disconnect();
    console.log('\nMongoDB Disconnected');
  }
})
.catch(err => {
  console.error('MongoDB Connection Error:', err);
});
