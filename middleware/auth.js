const jwt = require('jsonwebtoken');
const User = require('../models/User');

const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      console.warn(`[${new Date().toISOString()}] AUTH ERROR: ${req.method} ${req.path} - No token provided`);
      return res.status(401).json({
        success: false,
        message: 'Access token required'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user) {
      console.warn(`[${new Date().toISOString()}] AUTH ERROR: ${req.method} ${req.path} - User not found for token`);
      return res.status(401).json({
        success: false,
        message: 'Invalid token'
      });
    }

    req.user = user;
    console.log(`[${new Date().toISOString()}] AUTH SUCCESS: ${req.method} ${req.path} - User: ${user.email}`);
    next();
  } catch (error) {
    console.error(`[${new Date().toISOString()}] AUTH ERROR: ${req.method} ${req.path}`, {
      message: error.message,
      name: error.name
    });

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token'
      });
    }

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired'
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Authentication error'
    });
  }
};

const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return next();
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');
    
    if (user) {
      req.user = user;
      console.log(`[${new Date().toISOString()}] OPTIONAL AUTH SUCCESS: ${req.method} ${req.path} - User: ${user.email}`);
    }

    next();
  } catch (error) {
    console.warn(`[${new Date().toISOString()}] OPTIONAL AUTH WARNING: ${req.method} ${req.path} - Invalid token, proceeding without auth`);
    next();
  }
};

module.exports = {
  authenticateToken,
  optionalAuth
};