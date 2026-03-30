require("dotenv").config();
const express = require("express");
const cors    = require("cors");
const logger  = require("./utils/logger");
const { startTransferListener } = require("./utils/blockchain");
const { generalLimiter, executeLimiter, nonceLimiter } = require("./middleware/rateLimit");
const { verifySignature } = require("./middleware/auth");

const app = express();

// ── 기본 미들웨어 ────────────────────────────────────────────
app.use(cors({ origin: process.env.FRONTEND_URL || "http://localhost:3000" }));
app.use(express.json());
app.use(generalLimiter); // 전체 API Rate Limit

// ── 라우터 ──────────────────────────────────────────────────
app.use("/api/nonce",   nonceLimiter,   require("./routes/nonce"));
app.use("/api/encrypt",                 require("./routes/encrypt"));
app.use("/api/execute", executeLimiter, verifySignature, require("./routes/execute"));

// ── 헬스체크 ────────────────────────────────────────────────
app.get("/health", (_, res) => res.json({ status: "ok", owner: "최유리", version: "2.0" }));

// ── 에러 핸들러 ─────────────────────────────────────────────
app.use((err, req, res, next) => {
  logger.error(`서버 오류: ${err.message}`);
  res.status(500).json({ error: "서버 오류가 발생했습니다" });
  // err.message 그대로 노출 안 함 — 내부 정보 유출 방지
});

// ── 서버 시작 ───────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  logger.info(`서버 실행 중: http://localhost:${PORT}`);
  // 블록체인 Transfer 이벤트 리스너 시작
  startTransferListener();
});
