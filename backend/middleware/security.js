const { rateLimit } = require("express-rate-limit");

function standardHeaders(req, res, next) {
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Pragma", "no-cache");
  next();
}

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  skip: (req) => req.path === "/api/health" || req.path === "/api/version",
  message: {
    success: false,
    message: "Too many requests. Please wait a few minutes and try again."
  }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 40,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many sign-in attempts. Please wait a few minutes and try again."
  }
});

const writeLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    success: false,
    message: "You are sending requests too quickly. Please slow down."
  }
});

module.exports = {
  standardHeaders,
  apiLimiter,
  authLimiter,
  writeLimiter
};
