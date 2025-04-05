const express = require('express');
const router = express.Router();
const User = require('../../db/models/User');
const jwt = require('jsonwebtoken');
const config = require('../../../config/config');
const logger = require('../../utils/logger');

// Auth middleware
const authMiddleware = async (req, res, next) => {
  try {
    // Get token from header
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ success: false, error: 'No token, authorization denied' });
    }
    
    // Verify token
    const decoded = jwt.verify(token, config.jwt.secret);
    
    // Get user from database
    const user = await User.findById(decoded.id);
    
    if (!user) {
      return res.status(401).json({ success: false, error: 'User not found' });
    }
    
    // Add user to request
    req.user = user;
    next();
  } catch (err) {
    logger.error(`Auth middleware error: ${err.message}`);
    res.status(401).json({ success: false, error: 'Token is not valid' });
  }
};

// @route   POST /api/auth/register
// @desc    Register a user
// @access  Public
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    
    // Check if user already exists
    let user = await User.findOne({ email });
    
    if (user) {
      return res.status(400).json({
        success: false,
        error: 'User already exists'
      });
    }
    
    // Create user
    user = await User.create({
      name,
      email,
      password,
      role: 'user' // Default role
    });
    
    // Create and return JWT token
    const token = user.getSignedJwtToken();
    
    res.status(201).json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (err) {
    logger.error(`Register error: ${err.message}`);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Validate email & password
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Please provide an email and password'
      });
    }
    
    // Check for user
    const user = await User.findOne({ email }).select('+password');
    
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }
    
    // Check if password matches
    const isMatch = await user.matchPassword(password);
    
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }
    
    // Create JWT token
    const token = user.getSignedJwtToken();
    
    // Set token in cookie
    const cookieOptions = {
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      httpOnly: true,
      secure: config.server.env === 'production'
    };
    
    res.cookie('token', token, cookieOptions);
    
    // Return success response with token and user info
    res.status(200).json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (err) {
    logger.error(`Login error: ${err.message}`);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

// @route   GET /api/auth/me
// @desc    Get current logged-in user
// @access  Private
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    
    res.status(200).json({
      success: true,
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt
      }
    });
  } catch (err) {
    logger.error(`Get user error: ${err.message}`);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

// Add the authMiddleware to the router object
router.authMiddleware = authMiddleware;

// Export the router with the attached middleware
module.exports = router;