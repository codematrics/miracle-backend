const rateLimit = require("express-rate-limit");
const helmet = require("helmet");
const mongoSanitize = require("express-mongo-sanitize");
const xss = require("xss");

const createRateLimiter = (
  windowMs = 15 * 60 * 1000,
  max = 100,
  message = "Too many requests"
) => {
  return rateLimit({
    windowMs,
    max,
    message: {
      success: false,
      message,
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      console.warn(
        `[${new Date().toISOString()}] RATE LIMIT EXCEEDED: ${req.ip} - ${
          req.method
        } ${req.path}`
      );
      res.status(429).json({
        success: false,
        message,
      });
    },
  });
};

const authLimiter = createRateLimiter(
  15 * 60 * 1000, // 15 minutes
  100, // 5 attempts per 15 minutes
  "Too many authentication attempts, please try again later"
);

const generalLimiter = createRateLimiter(
  15 * 60 * 1000, // 15 minutes
  100, // 100 requests per 15 minutes
  "Too many requests from this IP, please try again later"
);

const apiLimiter = createRateLimiter(
  15 * 60 * 1000, // 15 minutes
  200, // 200 API calls per 15 minutes
  "API rate limit exceeded, please try again later"
);

const securityMiddleware = [
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
    crossOriginEmbedderPolicy: false,
  }),

  (req, res, next) => {
    // Custom MongoDB injection sanitization
    const sanitize = (obj) => {
      if (obj && typeof obj === "object") {
        for (const key in obj) {
          if (key.startsWith("$") || key.includes(".")) {
            console.warn(
              `[${new Date().toISOString()}] SANITIZED: ${req.method} ${
                req.path
              } - Key: ${key}`
            );
            delete obj[key];
          } else if (typeof obj[key] === "object" && obj[key] !== null) {
            sanitize(obj[key]);
          }
        }
      }
    };

    if (req.body) sanitize(req.body);
    if (req.query) sanitize(req.query);
    if (req.params) sanitize(req.params);

    next();
  },

  (req, res, next) => {
    if (req.body && typeof req.body === "object") {
      const sanitizeObject = (obj) => {
        for (const key in obj) {
          if (typeof obj[key] === "string") {
            obj[key] = xss(obj[key]);
          } else if (typeof obj[key] === "object" && obj[key] !== null) {
            sanitizeObject(obj[key]);
          }
        }
      };
      sanitizeObject(req.body);
    }
    next();
  },
];

module.exports = {
  securityMiddleware,
  authLimiter,
  generalLimiter,
  apiLimiter,
};
