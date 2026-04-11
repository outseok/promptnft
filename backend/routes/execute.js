// routes/execute.js
// 역할: 핵심 실행 API — OpenAI GPT 연동
// 담당: 최유리

const router = require("express").Router();
const { verifyOwnership } = require("../utils/blockchain");
const { decrypt } = require("../utils/crypto");
const db = require("../utils/db");
const { queries } = require("../utils/db");
const logger = require("../utils/logger");
const OpenAI = require("openai");

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
        error: "창작자는 자신이 만든 NFT를 실행할 수 없습니다."
      });
    }

    // ── STEP 2: 사용량 확인 (토큰 단위 — 재판매 시 잔여 사용량 유지) ──
    const nftUsage = queries.getNFTByTokenId(Number(tokenId));
    const maxExec = nftUsage?.max_executions || 50;
    const curExec = nftUsage?.execution_count || 0;

    if (curExec >= maxExec) {
      logger.warn(`사용량 초과 — tokenId=${tokenId} (${curExec}/${maxExec})`);
      return res.status(429).json({
        error: `사용량 한도 초과 (${curExec}/${maxExec}회)`
      });
    }

    // ── STEP 3: 프롬프트 복호화 ──
    let row = db
      .prepare("SELECT encrypted_content FROM prompts WHERE token_id = ?")
      .get(String(tokenId));

    // fallback: nfts 테이블에서 복구
    if (!row) {
      const nft = db.prepare("SELECT prompt_encrypted FROM nfts WHERE token_id = ?").get(String(tokenId));
      if (nft && nft.prompt_encrypted) {
        db.prepare("INSERT INTO prompts (token_id, encrypted_content) VALUES (?, ?)")
          .run(String(tokenId), nft.prompt_encrypted);
        row = { encrypted_content: nft.prompt_encrypted };
      }
    }

    if (!row) {
      return res.status(404).json({ error: "프롬프트 데이터가 없습니다" });
    }

    let systemPrompt;
    try {
      systemPrompt = decrypt(row.encrypted_content);
    } catch {
      logger.error(`프롬프트 복호화 실패 — tokenId=${tokenId}`);
      return res.status(500).json({ error: "프롬프트 처리 중 오류가 발생했습니다" });
    }

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
      logger.info(`AI 응답 완료 — tokenId=${tokenId}, tokens=${completion.usage?.total_tokens}`);
    } else {
      // API 키 없으면 데모 응답
      result =
        `[데모 실행 결과]\n\n` +
        `입력: "${userMessage}"\n\n` +
        `AI 모델이 연동되지 않아 데모 응답을 반환합니다.\n` +
        `관리자에게 문의하세요.`;
    }

    // 메모리에서 평문 즉시 제거
    systemPrompt = null;

    // ── STEP 5: 사용량 업데이트 (토큰 단위) ──
    queries.incrementExecution(Number(tokenId));
    queries.insertExecutionLog(Number(tokenId), wallet.toLowerCase());

    const newCount = curExec + 1;
    const usageLeft = maxExec - newCount;
    logger.info(`실행 완료 — tokenId=${tokenId} 사용횟수=${newCount}/${maxExec}`);

    // ── STEP 5.5: 사용량 소진 시 DB에서 burn 처리 ──
    let burned = false;
    if (usageLeft <= 0) {
      try {
        queries.burnNFT(Number(tokenId));
        // 프롬프트 데이터도 삭제
        db.prepare("DELETE FROM prompts WHERE token_id = ?").run(String(tokenId));
        logger.info(`NFT burn 처리 완료 — tokenId=${tokenId} (사용량 소진)`);
        burned = true;
      } catch (burnErr) {
        logger.error(`NFT burn 처리 실패 — tokenId=${tokenId}`);
      }
    }

    // ── STEP 6: 결과 반환 ──
    res.json({
      success: true,
      result,
      usageCount: newCount,
      usageLeft: Math.max(usageLeft, 0),
      usageLimit: maxExec,
      burned,
      aiEnabled: !!openai,
      executionInfo: req.executionInfo || null,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
