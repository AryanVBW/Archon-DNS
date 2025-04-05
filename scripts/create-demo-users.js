/**
 * Script to create demo users for Archon DNS
 * Run with: node scripts/create-demo-users.js
 */

const mongoose = require('mongoose');
const User = require('../src/db/models/User');
require('dotenv').config();

// Demo users to create
const demoUsers = [
  {
    name: 'Regular User',
    email: 'user@example.com',
    password: 'password123',
    role: 'user'
  },
  {
    name: 'Support Staff',
    email: 'support@example.com',
    password: 'support123',
    role: 'user'
  },
  {
    name: 'System Admin',
    email: 'sysadmin@example.com',
    password: 'admin123',
    role: 'admin'
  }
];

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(async () => {
  console.log('MongoDB Connected');
  
  try {
    // Clear existing demo users to avoid duplicates
    for (const user of demoUsers) {
      await User.findOneAndDelete({ email: user.email });
    }
    
    // Create new demo users
    const createdUsers = [];
    for (const user of demoUsers) {
      const newUser = await User.create(user);
      createdUsers.push({
        name: newUser.name,
        email: newUser.email,
        password: user.password, // Store the plain password for display
        role: newUser.role
      });
      console.log(`Created user: ${newUser.name} (${newUser.email})`);
    }
    
    // Display user credentials
    console.log('\n=== DEMO USER CREDENTIALS ===');
    createdUsers.forEach((user, index) => {
      console.log(`\nUser ${index + 1}:`);
      console.log(`Name: ${user.name}`);
      console.log(`Email: ${user.email}`);
      console.log(`Password: ${user.password}`);
      console.log(`Role: ${user.role}`);
    });
    console.log('\n=== END OF CREDENTIALS ===');
    
  } catch (err) {
    console.error('Error creating demo users:', err);
  } finally {
    mongoose.disconnect();
    console.log('MongoDB Disconnected');
  }
})
.catch(err => {
  console.error('MongoDB Connection Error:', err);
});
