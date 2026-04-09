// middleware/rateLimit.js
// 역할: 과도한 요청 차단 (서버 보호)
// 담당: 최유리

const rateLimit = require("express-rate-limit");
const logger = require("../utils/logger");

const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: { error: "요청이 너무 많습니다. 1분 후 다시 시도하세요." },
  handler: (req, res, next, options) => {
    logger.warn(`Rate limit 초과 — IP=${req.ip}`);
    res.status(429).json(options.message);
  },
});

const executeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: "실행 요청이 너무 많습니다. 1분 후 다시 시도하세요." },
  handler: (req, res, next, options) => {
    logger.warn(`Execute rate limit 초과 — IP=${req.ip}`);
    res.status(429).json(options.message);
  },
});

const nonceLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: "nonce 요청이 너무 많습니다." },
});

module.exports = { generalLimiter, executeLimiter, nonceLimiter };
