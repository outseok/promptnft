// routes/execute.js
// 역할: 핵심 실행 API — OpenAI GPT 연동
// 담당: 최유리

const router = require("express").Router();
const { verifyOwnership } = require("../utils/blockchain");
const { decrypt } = require("../utils/crypto");
const db = require("../utils/db");
const logger = require("../utils/logger");
const OpenAI = require("openai");

const USAGE_LIMIT = 50;

// OpenAI 클라이언트 (API 키가 없으면 데모 모드)
let openai = null;
if (process.env.OPENAI_API_KEY) {
  openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  logger.info("OpenAI API 연동 활성화");
} else {
  logger.warn("OPENAI_API_KEY 미설정 — AI 실행은 데모 응답 반환");
}

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

    // ── STEP 1: NFT 소유권 확인 (항상 온체인 검증) ──
    let contractAddress = req.headers["x-contract-address"] || process.env.CONTRACT_ADDRESS;
    if (contractAddress && !/^0x[0-9a-fA-F]{40}$/.test(contractAddress)) {
      contractAddress = process.env.CONTRACT_ADDRESS;
    }
    let hasAccess = false;
    try {
      hasAccess = await verifyOwnership(wallet, tokenId, contractAddress);
    } catch (err) {
      logger.error(`소유권 확인 실패: ${err.message}`);
      // 블록체인 연결 실패 시 DB 소유권으로 폴백
      const nftRow = db.prepare("SELECT owner_address FROM nfts WHERE token_id = ?").get(String(tokenId));
      if (nftRow && nftRow.owner_address === wallet.toLowerCase()) {
        hasAccess = true;
        logger.info(`DB 폴백 소유권 확인 — wallet=${wallet.slice(0,8)}... tokenId=${tokenId}`);
      }
    }

    if (!hasAccess) {
      logger.warn(`접근 차단 — NFT 미보유 wallet=${wallet.slice(0,8)}... tokenId=${tokenId}`);
      return res.status(403).json({
        error: "NFT를 보유하지 않았습니다. 실행 권한이 없습니다."
      });
    }

    // ── STEP 1.5: 창작자 실행 차단 (본인이 만든 NFT는 실행 불가) ──
    const nftMeta = db.prepare("SELECT creator_address FROM nfts WHERE token_id = ?").get(String(tokenId));
    if (nftMeta && nftMeta.creator_address === wallet.toLowerCase()) {
      logger.warn(`창작자 실행 차단 — wallet=${wallet.slice(0,8)}... tokenId=${tokenId}`);
      return res.status(403).json({
        error: "창작자는 자신이 만든 NFT를 실행할 수 없습니다. 프롬프트 원문을 이미 알고 있기 때문입니다."
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

    // ── STEP 4: AI 실행 ──
    let result;

    if (openai) {
      // 실제 OpenAI GPT 호출
      const model = process.env.OPENAI_MODEL || "gpt-3.5-turbo";
      const completion = await openai.chat.completions.create({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        max_completion_tokens: 1024,
        temperature: 0.7,
      });

      result = completion.choices[0].message.content;
      logger.info(`OpenAI 응답 완료 — tokenId=${tokenId}, tokens=${completion.usage?.total_tokens}`);
    } else {
      // API 키 없으면 데모 응답
      result =
        `[데모 실행 결과]\n\n` +
        `입력: "${userMessage}"\n\n` +
        `시스템 프롬프트가 복호화되어 AI에 전달됩니다.\n` +
        `실제 연동을 위해 .env에 OPENAI_API_KEY를 설정하세요.`;
    }

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
      aiEnabled: !!openai,
      executionInfo: req.executionInfo || null,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
