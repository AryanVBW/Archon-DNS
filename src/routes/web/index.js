const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const config = require('../../../config/config');
const User = require('../../db/models/User');
const logger = require('../../utils/logger');

// Middleware to check if user is authenticated
const isAuthenticated = async (req, res, next) => {
  try {
    // Check if token is in cookie
    const token = req.cookies?.token || req.session?.token;
    
    if (!token) {
      return next();
    }
    
    // Verify token
    const decoded = jwt.verify(token, config.jwt.secret);
    
    // Get user from database
    const user = await User.findById(decoded.id);
    
    if (!user) {
      return next();
    }
    
    // Add user to request
    req.user = user;
    res.locals.user = {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role
    };
    res.locals.isAuthenticated = true;
    
    next();
  } catch (err) {
    logger.error(`Auth middleware error: ${err.message}`);
    next();
  }
};

// Apply authentication middleware to all routes
router.use(isAuthenticated);

// Home page route
router.get('/', (req, res) => {
  if (res.locals.isAuthenticated) {
    return res.redirect('/dashboard');
  }
  res.render('index', { 
    title: 'Archon DNS - Advanced DNS Management',
    layout: 'layouts/auth'
  });
});

// Login page
router.get('/login', (req, res) => {
  if (res.locals.isAuthenticated) {
    return res.redirect('/dashboard');
  }
  res.render('auth/login', { 
    title: 'Login - Archon DNS',
    layout: 'layouts/auth'
  });
});

// Register page
router.get('/register', (req, res) => {
  if (res.locals.isAuthenticated) {
    return res.redirect('/dashboard');
  }
  res.render('auth/register', { 
    title: 'Register - Archon DNS',
    layout: 'layouts/auth'
  });
});

// Logout route
router.get('/logout', (req, res) => {
  res.clearCookie('token');
  req.session.destroy();
  res.redirect('/login');
});

module.exports = router;
module.exports.isAuthenticated = isAuthenticated;