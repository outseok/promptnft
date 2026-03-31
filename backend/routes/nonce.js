// routes/nonce.js
// 역할: 서명용 nonce 발급
// 프론트가 서명하기 전에 반드시 먼저 호출해야 함
// 담당: 최유리

const router = require("express").Router();
const crypto = require("crypto");
const db = require("../utils/db");
const logger = require("../utils/logger");

/**
 * GET /api/nonce?wallet=0x...
 *
 * 동작:
 * 1. 랜덤 nonce 생성
 * 2. DB에 저장 (5분 유효)
 * 3. 프론트에 반환
 *
 * 프론트 사용법:
 * 1. GET /api/nonce?wallet=내지갑주소 → nonce 받기
 * 2. MetaMask로 `PromptNFT 인증\nnonce: ${nonce}` 서명
 * 3. /api/execute 호출 시 x-nonce, x-signature 헤더에 포함
 */
router.get("/", (req, res) => {
  const { wallet } = req.query;

  if (!wallet) {
    return res.status(400).json({ error: "wallet 파라미터 필요" });
  }

  // 랜덤 nonce 생성 (32바이트 HEX)
  const nonce = crypto.randomBytes(32).toString("hex");
  const expiresAt = Date.now() + 5 * 60 * 1000; // 5분

  // DB 저장 (같은 지갑이면 덮어쓰기)
  db.prepare(
    "INSERT OR REPLACE INTO nonces (wallet, nonce, expires_at) VALUES (?, ?, ?)"
  ).run(wallet.toLowerCase(), nonce, expiresAt);

  logger.info(`nonce 발급 — wallet=${wallet.slice(0, 8)}...`);

  // 프론트에서 이 nonce로 서명해야 함
  res.json({
    nonce,
    message: `PromptNFT 인증\nnonce: ${nonce}`,
    expiresIn: "5분",
  });
});

module.exports = router;
