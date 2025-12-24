const { RateLimiterMemory } = require('rate-limiter-flexible');

const rateLimiter = new RateLimiterMemory({
  keyGenerator: (req) => req.ip,
  points: parseInt(process.env.RATE_LIMIT_POINTS) || 100,
  duration: parseInt(process.env.RATE_LIMIT_DURATION) || 60,
});

module.exports = rateLimiter;
