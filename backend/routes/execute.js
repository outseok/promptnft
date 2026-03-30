// routes/execute.js
// 역할: 핵심 실행 API
// 담당: 최유리

const router = require("express").Router();
const { verifyOwnership } = require("../utils/blockchain");
const { decrypt } = require("../utils/crypto");
const db = require("../utils/db");
const logger = require("../utils/logger");

const USAGE_LIMIT = 50;

router.post("/", async (req, res, next) => {
  try {
    const { tokenId, userMessage } = req.body;
    const wallet = req.wallet || req.headers["x-wallet-address"];

    if ((tokenId === undefined || tokenId === null) || !userMessage) {
      return res.status(400).json({ error: "tokenId, userMessage 필요" });
    }
    if (!wallet) {
      return res.status(401).json({ error: "지갑 주소가 필요합니다" });
    }

    // ── STEP 1: NFT 소유권 확인 ──
    let hasAccess = false;
    if (process.env.DEMO_MODE === "true") {
      hasAccess = true; // 데모 모드: 소유권 검증 스킵
    } else {
      hasAccess = await verifyOwnership(wallet, tokenId);
    }

    if (!hasAccess) {
      logger.warn(`접근 차단 — NFT 미보유 wallet=${wallet.slice(0,8)}... tokenId=${tokenId}`);
      return res.status(403).json({
        error: "NFT를 보유하지 않았습니다. 실행 권한이 없습니다."
      });
    }

    // ── STEP 2: 사용량 확인 ──
    const usage = db
      .prepare("SELECT count FROM usage WHERE wallet = ? AND token_id = ?")
      .get(wallet.toLowerCase(), String(tokenId));

    if (usage && usage.count >= USAGE_LIMIT) {
      logger.warn(`사용량 초과 — wallet=${wallet.slice(0,8)}... tokenId=${tokenId}`);
      return res.status(429).json({
        error: `사용량 한도 초과 (최대 ${USAGE_LIMIT}회)`
      });
    }

    // ── STEP 3: 프롬프트 복호화 ──
    const row = db
      .prepare("SELECT encrypted_content FROM prompts WHERE token_id = ?")
      .get(String(tokenId));

    if (!row) {
      return res.status(404).json({ error: "프롬프트 데이터가 없습니다" });
    }

    const systemPrompt = decrypt(row.encrypted_content);

    // ── STEP 4: 실행 (하드코딩 — AI 제외 버전) ──
    const result =
      `[데모 실행 결과]\n\n` +
      `입력: "${userMessage}"\n\n` +
      `NFT #${tokenId} 소유자만 실행 가능한 프롬프트입니다.\n` +
      `실제 서비스에서는 AI가 응답합니다.`;

    // ── STEP 5: 사용량 업데이트 ──
    db.prepare(`
      INSERT INTO usage (wallet, token_id, count) VALUES (?, ?, 1)
      ON CONFLICT(wallet, token_id) DO UPDATE SET count = count + 1
    `).run(wallet.toLowerCase(), String(tokenId));

    const newCount = (usage?.count ?? 0) + 1;
    logger.info(`실행 완료 — tokenId=${tokenId} 사용횟수=${newCount}/${USAGE_LIMIT}`);

    // ── STEP 6: 결과 반환 ──
    res.json({
      success: true,
      result,
      usageCount: newCount,
      usageLeft: USAGE_LIMIT - newCount,
      executionInfo: req.executionInfo || null,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
