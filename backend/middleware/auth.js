// middleware/auth.js
// 역할: nonce 기반 서명 검증 (재사용 공격 방지)
// 개선: 고정 메시지 → 서버 발급 nonce 사용
// 담당: 최유리

const { ethers } = require("ethers");
const db = require("../utils/db");
const logger = require("../utils/logger");

/**
 * verifySignature
 *
 * 동작 순서:
 * 1. 프론트가 GET /api/nonce?wallet=0x... 로 nonce 요청
 * 2. 서버가 랜덤 nonce 발급 + DB 저장 (5분 유효)
 * 3. 프론트가 MetaMask로 nonce 서명
 * 4. 이 미들웨어에서 서명 검증 + nonce 소비(삭제)
 *    → 같은 nonce 재사용 불가
 */
function verifySignature(req, res, next) {
  const wallet    = req.headers["x-wallet-address"];
  const signature = req.headers["x-signature"];
  const nonce     = req.headers["x-nonce"];

  if (!wallet || !signature || !nonce) {
    return res.status(401).json({
      error: "헤더 누락: x-wallet-address, x-signature, x-nonce 필요"
    });
  }

  // DB에서 nonce 조회
  const row = db.prepare(
    "SELECT nonce, expires_at FROM nonces WHERE wallet = ?"
  ).get(wallet.toLowerCase());

  if (!row) {
    return res.status(401).json({ error: "nonce 없음. /api/nonce 먼저 호출하세요." });
  }

  // 만료 확인 (5분)
  if (Date.now() > row.expires_at) {
    db.prepare("DELETE FROM nonces WHERE wallet = ?").run(wallet.toLowerCase());
    return res.status(401).json({ error: "nonce 만료됨. 다시 요청하세요." });
  }

  // nonce 일치 확인
  if (row.nonce !== nonce) {
    return res.status(401).json({ error: "nonce 불일치" });
  }

  try {
    // 서명 검증
    const message = `PromptNFT 인증\nnonce: ${nonce}`;
    const recovered = ethers.verifyMessage(message, signature);

    if (recovered.toLowerCase() !== wallet.toLowerCase()) {
      logger.warn(`서명 검증 실패 — wallet=${wallet.slice(0,8)}...`);
      return res.status(403).json({ error: "서명 검증 실패" });
    }

    // nonce 소비 — 한 번 쓰면 삭제 (재사용 불가)
    db.prepare("DELETE FROM nonces WHERE wallet = ?").run(wallet.toLowerCase());

    logger.info(`인증 성공 — wallet=${wallet.slice(0,8)}...`);
    req.wallet = wallet;
    next();

  } catch (err) {
    logger.error(`서명 처리 오류: ${err.message}`);
    return res.status(403).json({ error: "유효하지 않은 서명" });
  }
}

module.exports = { verifySignature };
