// utils/logger.js
// 역할: 로그 관리 — 민감 정보 노출 방지
// 담당: 최유리

const winston = require("winston");

function sanitize(msg) {
  return String(msg)
    .replace(/promptContent[=:].*/gi, "promptContent=[REDACTED]")
    .replace(/systemPrompt[=:].*/gi, "systemPrompt=[REDACTED]")
    .replace(/ENCRYPT_KEY[=:].*/gi, "ENCRYPT_KEY=[REDACTED]")
    .replace(/encrypted_content[=:].*/gi, "encrypted_content=[REDACTED]")
    .replace(/plainText[=:].*/gi, "plainText=[REDACTED]")
    .replace(/decrypted[=:].*/gi, "decrypted=[REDACTED]")
    .replace(/[0-9a-f]{32}:[0-9a-f]{16,}/gi, "[ENCRYPTED_DATA]")
    .replace(/sk-[A-Za-z0-9_-]{20,}/g, "sk-[REDACTED]");
}

const sanitizeFormat = winston.format((info) => {
  info.message = sanitize(info.message);
  return info;
});

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: winston.format.combine(
    sanitizeFormat(),
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

logger.sanitize = sanitize;

module.exports = logger;
