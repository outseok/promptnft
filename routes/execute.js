// routes/execute.js
// 역할: 핵심 실행 API
// 개선: 캐시 적용 + 로그 보안 강화
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
    //const wallet = req.wallet; // verifySignature 미들웨어 통과 후 설정됨
    const { walletAddress } = req.body;
    const wallet = walletAddress;

    if (!tokenId || !userMessage) {
      return res.status(400).json({ error: "tokenId, userMessage 필요" });
    }

    // ── STEP 1: NFT 소유권 확인 (캐시 우선, 없으면 블록체인) ──
    const hasAccess = await verifyOwnership(wallet, tokenId);
    if (!hasAccess) {
      logger.warn(`접근 차단 — NFT 미보유 wallet=${wallet.slice(0,8)}... tokenId=${tokenId}`);
      return res.status(403).json({
        error: "NFT를 보유하지 않았습니다. 실행 권한이 없습니다."
      });
    }

    // ── STEP 2: 사용량 확인 ────────────────────────────────────
    const usage = db
      .prepare("SELECT count FROM usage WHERE wallet = ? AND token_id = ?")
      .get(wallet, tokenId);

    if (usage && usage.count >= USAGE_LIMIT) {
      logger.warn(`사용량 초과 — wallet=${wallet.slice(0,8)}... tokenId=${tokenId}`);
      return res.status(429).json({
        error: `사용량 한도 초과 (최대 ${USAGE_LIMIT}회)`
      });
    }

    // ── STEP 3: 프롬프트 복호화 ───────────────────────────────
    const row = db
      .prepare("SELECT encrypted_content FROM prompts WHERE token_id = ?")
      .get(tokenId);

    if (!row) {
      return res.status(404).json({ error: "프롬프트 데이터가 없습니다" });
    }

    const systemPrompt = decrypt(row.encrypted_content);
    // 절대 systemPrompt를 로그에 찍거나 응답에 포함하지 말 것

    // ── STEP 4: 실행 (하드코딩 — 나중에 OpenAI 교체) ─────────
    // TODO: 아래 주석 해제하면 OpenAI 연동
    //
    // const { OpenAI } = require("openai");
    // const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    // const completion = await openai.chat.completions.create({
    //   model: "gpt-4o-mini",
    //   messages: [
    //     { role: "system", content: systemPrompt },
    //     { role: "user",   content: userMessage },
    //   ],
    // });
    // const result = completion.choices[0].message.content;

    const result =
      `[데모 실행 결과]\n\n` +
      `입력: "${userMessage}"\n\n` +
      `NFT #${tokenId} 소유자만 실행 가능한 프롬프트입니다.\n` +
      `실제 서비스에서는 AI가 응답합니다.`;

    // ── STEP 5: 사용량 업데이트 ───────────────────────────────
    db.prepare(`
      INSERT INTO usage (wallet, token_id, count) VALUES (?, ?, 1)
      ON CONFLICT(wallet, token_id) DO UPDATE SET count = count + 1
    `).run(wallet, tokenId);

    const newCount = (usage?.count ?? 0) + 1;
    logger.info(`실행 완료 — tokenId=${tokenId} 사용횟수=${newCount}/${USAGE_LIMIT}`);

    // ── STEP 6: 결과 반환 (원문 절대 포함 안 함) ─────────────
    res.json({
      result,
      usageCount: newCount,
      usageLeft: USAGE_LIMIT - newCount,
    });

  } catch (err) {
    next(err);
  }
});

module.exports = router;
