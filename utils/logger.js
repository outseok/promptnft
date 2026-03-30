// utils/logger.js
// 역할: 로그 관리 — 민감 정보 노출 방지
// console.log 대신 이걸 써야 함
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
    // 터미널 출력
    new winston.transports.Console(),
    // 파일 저장 (에러만)
    new winston.transports.File({ filename: "logs/error.log", level: "error" }),
    // 파일 저장 (전체)
    new winston.transports.File({ filename: "logs/combined.log" }),
  ],
});

// 절대 로그에 찍으면 안 되는 키워드 필터
// systemPrompt, promptContent, ENCRYPT_KEY 같은 값은 로그에 찍지 말 것
logger.sanitize = (msg) => {
  return String(msg)
    .replace(/promptContent=.*/gi, "promptContent=[HIDDEN]")
    .replace(/systemPrompt.*/gi, "systemPrompt=[HIDDEN]")
    .replace(/ENCRYPT_KEY.*/gi, "ENCRYPT_KEY=[HIDDEN]");
};

module.exports = logger;
