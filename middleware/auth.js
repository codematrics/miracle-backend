const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { ROLES } = require("../constants/enums");
const Doctor = require("../models/Doctor");

/**
 * Normal authentication (token required)
 */
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
      console.warn(
        `[${new Date().toISOString()}] AUTH ERROR: ${req.method} ${
          req.path
        } - No token provided`
      );
      return res
        .status(401)
        .json({ success: false, message: "Access token required" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select("-password");

    if (!user) {
      console.warn(
        `[${new Date().toISOString()}] AUTH ERROR: ${req.method} ${
          req.path
        } - User not found for token`
      );
      return res.status(401).json({ success: false, message: "Invalid token" });
    }

    req.user = user;
    if (user.role === ROLES.DOCTOR) {
      req.doctor = await Doctor.findOne({ userId: user._id });
    }
    console.log(
      `[${new Date().toISOString()}] AUTH SUCCESS: ${req.method} ${
        req.path
      } - User: ${user.email}`
    );
    next();
  } catch (error) {
    console.error(
      `[${new Date().toISOString()}] AUTH ERROR: ${req.method} ${req.path}`,
      {
        message: error.message,
        name: error.name,
      }
    );

    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({ success: false, message: "Invalid token" });
    }
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ success: false, message: "Token expired" });
    }
    return res
      .status(500)
      .json({ success: false, message: "Authentication error" });
  }
};

/**
 * Optional authentication (token optional)
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
      return next();
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select("-password");

    if (user) {
      req.user = user;
      console.log(
        `[${new Date().toISOString()}] OPTIONAL AUTH SUCCESS: ${req.method} ${
          req.path
        } - User: ${user.email}`
      );
    }
    next();
  } catch (error) {
    console.warn(
      `[${new Date().toISOString()}] OPTIONAL AUTH WARNING: ${req.method} ${
        req.path
      } - Invalid token, proceeding without auth`
    );
    next();
  }
};

/**
 * Role based guard
 * Pass one or multiple allowed roles
 * Usage: router.get('/admin', authenticateToken, authorizeRoles('admin'), handler)
 */
const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res
        .status(401)
        .json({ success: false, message: "Not authenticated" });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res
        .status(403)
        .json({ success: false, message: "Forbidden: insufficient role" });
    }

    next();
  };
};

/**
 * Combined helper:
 * Directly use auth + role in one go:
 * router.get('/admin', requireAuth({ roles: ['admin'] }), handler)
 */
const requireAuth = ({ roles = [], optional = false } = {}) => {
  return async (req, res, next) => {
    const baseAuth = optional ? optionalAuth : authenticateToken;
    await baseAuth(req, res, async () => {
      if (roles.length) {
        // no user but roles required:
        if (!req.user) {
          return res
            .status(401)
            .json({ success: false, message: "Not authenticated" });
        }
        if (!roles.includes(req.user.role)) {
          return res
            .status(403)
            .json({ success: false, message: "Forbidden: insufficient role" });
        }
      }
      next();
    });
  };
};

module.exports = {
  authenticateToken,
  optionalAuth,
  authorizeRoles,
  requireAuth,
};
