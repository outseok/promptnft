// ============================================
// server.js - PromptNFT Express 백엔드 서버
// ============================================
// 담당별 구성:
//   장우혁: DB(db.js) + API 라우트(routes/) + 실행제한(middleware/)
//   최유리: 인증(middleware/auth.js) + 암호화(crypto.js) + /execute
//   홍재창: 프론트엔드 정적 파일(public/)
// ============================================
// 사용법: node server.js

const express = require("express");
const path = require("path");

const app = express();
const PORT = 3000;

// ── 미들웨어 ──────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS 허용 (개발 환경)
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Content-Type, x-wallet-address, x-signature, x-message");
  res.header("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

// 정적 파일 서빙
app.use(express.static(path.join(__dirname, "public")));

// ── 라우트 (장우혁 담당) ─────────────────
const nftsRouter = require("./routes/nfts");
const mintRouter = require("./routes/mint");

app.use("/", nftsRouter);   // GET /nfts, GET /nfts/:tokenId, GET /my-nfts
app.use("/", mintRouter);   // POST /mint, POST /buy, PATCH /nfts/:tokenId/sale

// ── 실행 API (최유리 담당 — 장우혁의 executionLimit 미들웨어 적용) ──
// 최유리가 routes/execute.js 만들면 아래 주석 해제
// const executeRouter = require("./routes/execute");
// const executionLimit = require("./middleware/executionLimit");
// app.use("/execute", executionLimit, executeRouter);

// ── 실행 횟수 조회 API (장우혁) ──────────
const { queries } = require("./db");

app.get("/nfts/:tokenId/executions", (req, res) => {
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
    console.error("[GET /nfts/:tokenId/executions] 오류:", err.message);
    res.status(500).json({ success: false, error: "실행 기록 조회 실패" });
  }
});

// ── 서버 시작 (DB 초기화 후) ──────────────
const { initDB } = require("./db");

initDB().then(() => {
  app.listen(PORT, function() {
    console.log("============================================");
    console.log("PromptNFT 백엔드 서버 실행 중");
    console.log("============================================");
    console.log("URL: http://localhost:" + PORT);
    console.log("");
    console.log("API 엔드포인트:");
    console.log("  GET  /nfts              → 전체 NFT 목록");
    console.log("  GET  /nfts?sale=1       → 판매 중 NFT만");
    console.log("  GET  /nfts/:tokenId     → NFT 상세");
    console.log("  GET  /my-nfts           → 내 NFT (x-wallet-address 헤더)");
    console.log("  POST /mint              → 민팅 데이터 저장");
    console.log("  POST /buy               → 구매 처리");
    console.log("  PATCH /nfts/:tokenId/sale → 판매 상태 변경");
    console.log("  GET  /nfts/:tokenId/executions → 실행 기록");
    console.log("============================================");
  });
}).catch((err) => {
  console.error("DB 초기화 실패:", err);
  process.exit(1);
});
