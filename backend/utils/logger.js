// utils/logger.js
// 역할: 로그 관리 — 민감 정보 노출 방지
// 담당: 최유리

const winston = require("winston");

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: winston.format.combine(
    winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    winston.format.printf(({ timestamp, level, message }) => {
      return `[${timestamp}] ${level.toUpperCase()}: ${message}`;
    })
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: "logs/error.log", level: "error" }),
    new winston.transports.File({ filename: "logs/combined.log" }),
  ],
});

logger.sanitize = (msg) => {
  return String(msg)
    .replace(/promptContent=.*/gi, "promptContent=[HIDDEN]")
    .replace(/systemPrompt.*/gi, "systemPrompt=[HIDDEN]")
    .replace(/ENCRYPT_KEY.*/gi, "ENCRYPT_KEY=[HIDDEN]");
};

module.exports = logger;
