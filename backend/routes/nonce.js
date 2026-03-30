// routes/nonce.js
// 역할: 서명용 nonce 발급
// 담당: 최유리

const router = require("express").Router();
const crypto = require("crypto");
const db = require("../utils/db");
const logger = require("../utils/logger");

router.get("/", (req, res) => {
  const { wallet } = req.query;

  if (!wallet) {
    return res.status(400).json({ error: "wallet 파라미터 필요" });
  }

  const nonce = crypto.randomBytes(32).toString("hex");
  const expiresAt = Date.now() + 5 * 60 * 1000;

  db.prepare(
    "INSERT OR REPLACE INTO nonces (wallet, nonce, expires_at) VALUES (?, ?, ?)"
  ).run(wallet.toLowerCase(), nonce, expiresAt);

  logger.info(`nonce 발급 — wallet=${wallet.slice(0, 8)}...`);

  res.json({
    nonce,
    message: `PromptNFT 인증\nnonce: ${nonce}`,
    expiresIn: "5분",
  });
});

module.exports = router;
