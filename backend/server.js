// ============================================
// server.js - PromptNFT 통합 백엔드 서버
// ============================================
// 통합 구성:
//   홍인석: 스마트컨트랙트 (../contracts/)
//   최유리: 인증(middleware/auth) + 암호화(utils/crypto) + 실행(/api/execute)
//   장우혁: DB(utils/db) + API 라우트(routes/) + 실행제한(middleware/executionLimit)
//   홍재창: 프론트엔드 (../frontend/)
// ============================================

require("dotenv").config({ path: require("path").join(__dirname, ".env") });
const express = require("express");
const cors    = require("cors");
const path    = require("path");
const logger  = require("./utils/logger");
const { startTransferListener } = require("./utils/blockchain");
const { generalLimiter, executeLimiter, nonceLimiter } = require("./middleware/rateLimit");
const { verifySignature } = require("./middleware/auth");
const executionLimit = require("./middleware/executionLimit");

const app = express();
const PORT = process.env.PORT || 3001;

// ── 기본 미들웨어 ──
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:5173",
  methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "x-wallet-address", "x-signature", "x-nonce", "x-message", "x-contract-address"],
}));
app.use(express.json());
app.use(generalLimiter);

// ── 장우혁 담당: 데이터 API ──
const nftsRouter = require("./routes/nfts");
const mintRouter = require("./routes/mint");

app.use("/api", nftsRouter);   // GET /api/nfts, GET /api/nfts/:tokenId, GET /api/my-nfts
app.use("/api", mintRouter);   // POST /api/mint, POST /api/buy, PATCH /api/nfts/:tokenId/sale

// ── 최유리 담당: 보안 + 실행 API ──
app.use("/api/nonce",   nonceLimiter,   require("./routes/nonce"));
app.use("/api/encrypt",                 require("./routes/encrypt"));
app.use("/api/execute", executeLimiter,  executionLimit, require("./routes/execute"));

// ── 관리자 API ──
app.use("/api/admin", require("./routes/admin"));

// ── 실행 횟수 조회 API (장우혁) ──
const { queries } = require("./utils/db");

app.get("/api/nfts/:tokenId/executions", (req, res) => {
  try {
    const tokenId = Number(req.params.tokenId);
    const nft = queries.getNFTByTokenId(tokenId);
    if (!nft) {
      return res.status(404).json({ success: false, error: "NFT를 찾을 수 없음" });
    }
    const logs = queries.getExecutionLogs(tokenId);
    res.json({
      success: true,
      data: {
        token_id: tokenId,
        execution_count: nft.execution_count,
        max_executions: nft.max_executions,
        remaining: nft.max_executions - nft.execution_count,
        logs,
      },
    });
  } catch (err) {
    console.error("[GET /api/nfts/:tokenId/executions] 오류:", err.message);
    res.status(500).json({ success: false, error: "실행 기록 조회 실패" });
  }
});

// ── 헬스체크 ──
app.get("/health", (_, res) => res.json({
  status: "ok",
  version: "1.0.0-integrated",
  demo_mode: process.env.DEMO_MODE === "true",
}));

// ── 에러 핸들러 ──
app.use((err, req, res, next) => {
  logger.error(`서버 오류: ${err.message}`);
  res.status(500).json({ error: "서버 오류가 발생했습니다" });
});

// ── 서버 시작 (DB 초기화 후) ──
const { initDB } = require("./utils/db");

initDB().then(() => {
  // DB 초기화 후 라우트 등록을 위해 다시 require
  app.listen(PORT, () => {
    logger.info("============================================");
    logger.info("PromptNFT 통합 백엔드 서버 실행 중");
    logger.info(`URL: http://localhost:${PORT}`);
    logger.info(`DEMO_MODE: ${process.env.DEMO_MODE === "true" ? "ON" : "OFF"}`);
    logger.info("");
    logger.info("API 엔드포인트:");
    logger.info("  GET  /api/nfts              → 전체 NFT 목록");
    logger.info("  GET  /api/nfts?sale=1       → 판매 중 NFT만");
    logger.info("  GET  /api/nfts/:tokenId     → NFT 상세");
    logger.info("  GET  /api/my-nfts           → 내 NFT");
    logger.info("  POST /api/mint              → 민팅 데이터 저장");
    logger.info("  POST /api/buy               → 구매 처리");
    logger.info("  PATCH /api/nfts/:tokenId/sale → 판매 상태 변경");
    logger.info("  GET  /api/nonce?wallet=     → nonce 발급");
    logger.info("  POST /api/encrypt           → 프롬프트 암호화 저장");
    logger.info("  POST /api/execute           → 프롬프트 실행");
    logger.info("  GET  /api/nfts/:tokenId/executions → 실행 기록");
    logger.info("============================================");

    if (process.env.DEMO_MODE !== "true") {
      startTransferListener();
    }
  });
}).catch((err) => {
  logger.error(`DB 초기화 실패: ${err.message}`);
  process.exit(1);
});
