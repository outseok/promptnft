// middleware/auth.js
// 역할: nonce 기반 서명 검증 (재사용 공격 방지)
// 담당: 최유리

const { ethers } = require("ethers");
const db = require("../utils/db");
const logger = require("../utils/logger");

function verifySignature(req, res, next) {
  const wallet    = req.headers["x-wallet-address"];
  const signature = req.headers["x-signature"];
  const nonce     = req.headers["x-nonce"];

  if (!wallet || !signature || !nonce) {
    return res.status(401).json({
      error: "헤더 누락: x-wallet-address, x-signature, x-nonce 필요"
    });
  }

  const row = db.prepare(
    "SELECT nonce, expires_at FROM nonces WHERE wallet = ?"
  ).get(wallet.toLowerCase());

  if (!row) {
    return res.status(401).json({ error: "nonce 없음. /api/nonce 먼저 호출하세요." });
  }

  if (Date.now() > row.expires_at) {
    db.prepare("DELETE FROM nonces WHERE wallet = ?").run(wallet.toLowerCase());
    return res.status(401).json({ error: "nonce 만료됨. 다시 요청하세요." });
  }

  if (row.nonce !== nonce) {
    return res.status(401).json({ error: "nonce 불일치" });
  }

  try {
    const message = `PromptNFT 인증\nnonce: ${nonce}`;
    const recovered = ethers.verifyMessage(message, signature);

    if (recovered.toLowerCase() !== wallet.toLowerCase()) {
      logger.warn(`서명 검증 실패 — wallet=${wallet.slice(0,8)}...`);
      return res.status(403).json({ error: "서명 검증 실패" });
    }

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
