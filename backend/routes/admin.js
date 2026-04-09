// routes/admin.js - 관리자 전용 API
// 담당: 최유리 (보안)

const express = require("express");
const router = express.Router();
const { requireAdmin } = require("../middleware/admin");
const { queries } = require("../utils/db");
const db = require("../utils/db");
const { encrypt } = require("../utils/crypto");
const logger = require("../utils/logger");

// 관리자 확인 API
router.get("/check", (req, res) => {
  const { isAdmin } = require("../middleware/admin");
  const wallet = req.headers["x-wallet-address"];
  res.json({ success: true, isAdmin: isAdmin(wallet) });
});

// NFT 삭제 (목록에서 제거)
router.delete("/nfts/:tokenId", requireAdmin, (req, res) => {
  try {
    const tokenId = Number(req.params.tokenId);
    const nft = queries.getNFTByTokenId(tokenId);
    if (!nft) {
      return res.status(404).json({ success: false, error: "NFT를 찾을 수 없음" });
    }

    queries.deleteNFT(tokenId);
    logger.info(`[관리자] NFT 삭제 — tokenId=${tokenId}, admin=${req.adminWallet}`);

    res.json({ success: true, message: `NFT #${tokenId} 삭제 완료` });
  } catch (err) {
    logger.error(`[관리자] NFT 삭제 실패: ${err.message}`);
    res.status(500).json({ success: false, error: "NFT 삭제 실패" });
  }
});

// 판매 강제 중지
router.patch("/nfts/:tokenId/force-delist", requireAdmin, (req, res) => {
  try {
    const tokenId = Number(req.params.tokenId);
    const nft = queries.getNFTByTokenId(tokenId);
    if (!nft) {
      return res.status(404).json({ success: false, error: "NFT를 찾을 수 없음" });
    }

    queries.updateSaleStatus({ is_for_sale: 0, price: nft.price, token_id: tokenId });
    logger.info(`[관리자] 판매 강제 중지 — tokenId=${tokenId}, admin=${req.adminWallet}`);

    res.json({ success: true, message: `NFT #${tokenId} 판매 강제 중지` });
  } catch (err) {
    logger.error(`[관리자] 판매 중지 실패: ${err.message}`);
    res.status(500).json({ success: false, error: "판매 중지 실패" });
  }
});

// ── DB 조회 (관리자 전용) ──
router.get("/db/tables", requireAdmin, (req, res) => {
  try {
    const tables = queries.getTableList();
    const result = tables.map(t => ({
      name: t.name,
      count: queries.getTableCount(t.name),
    }));
    res.json({ success: true, tables: result });
  } catch (err) {
    logger.error(`[관리자] DB 테이블 조회 실패: ${err.message}`);
    res.status(500).json({ success: false, error: "DB 조회 실패" });
  }
});

router.get("/db/tables/:tableName", requireAdmin, (req, res) => {
  try {
    const { tableName } = req.params;
    const allowed = ['nfts', 'prompts', 'usage', 'nonces', 'execution_logs', 'transactions', 'screening_logs'];
    if (!allowed.includes(tableName)) {
      return res.status(400).json({ success: false, error: "허용되지 않은 테이블" });
    }
    const data = queries.getTableData(tableName);
    const count = queries.getTableCount(tableName);
    res.json({ success: true, table: tableName, count, data });
  } catch (err) {
    logger.error(`[관리자] DB 데이터 조회 실패: ${err.message}`);
    res.status(500).json({ success: false, error: "DB 데이터 조회 실패" });
  }
});

// ── 프롬프트 심사 로그 조회 ──
router.get("/screening", requireAdmin, (req, res) => {
  try {
    const status = req.query.status || null;
    const logs = queries.getScreeningLogs(status);
    res.json({ success: true, count: logs.length, data: logs });
  } catch (err) {
    logger.error(`[관리자] 심사 로그 조회 실패: ${err.message}`);
    res.status(500).json({ success: false, error: "심사 로그 조회 실패" });
  }
});

// 심사 로그 상세 (프롬프트 원문 포함)
router.get("/screening/:id", requireAdmin, (req, res) => {
  try {
    const log = queries.getScreeningLogById(Number(req.params.id));
    if (!log) {
      return res.status(404).json({ success: false, error: "심사 로그를 찾을 수 없음" });
    }
    res.json({ success: true, data: log });
  } catch (err) {
    logger.error(`[관리자] 심사 로그 상세 조회 실패: ${err.message}`);
    res.status(500).json({ success: false, error: "심사 로그 조회 실패" });
  }
});

// 관리자 심사 결정 (승인/거절)
router.patch("/screening/:id", requireAdmin, (req, res) => {
  try {
    const id = Number(req.params.id);
    const { decision, reason } = req.body;

    if (!['approved', 'rejected'].includes(decision)) {
      return res.status(400).json({ success: false, error: "decision은 'approved' 또는 'rejected'" });
    }

    const log = queries.getScreeningLogById(id);
    if (!log) {
      return res.status(404).json({ success: false, error: "심사 로그를 찾을 수 없음" });
    }

    queries.updateScreeningDecision(id, decision, reason);
    logger.info(`[관리자] 심사 결정 — id=${id}, decision=${decision}, admin=${req.adminWallet}`);

    // 승인 시: NFT 등록 + 프롬프트 암호화 저장 (pending → approved)
    if (decision === 'approved' && log.status === 'pending') {
      const isLazy = log.mint_mode === 'lazy' || log.mint_mode === 'on_purchase';

      const finalTokenId = queries.getNextLazyTokenId();

      queries.insertNFT({
        token_id: finalTokenId,
        title: log.title || '제목 없음',
        description: log.description || '',
        prompt_encrypted: '[encrypted]',
        creator_address: log.wallet_address,
        owner_address: log.wallet_address,
        price: log.price || '0.01',
        category: log.category || null,
        image_url: log.image_url || null,
        max_executions: 50,
        mint_mode: isLazy ? 'lazy' : 'direct',
        is_minted: 0,
      });

      // 프롬프트 암호화 저장
      const encrypted = encrypt(log.prompt_text);
      db.prepare(
        "INSERT OR REPLACE INTO prompts (token_id, encrypted_content) VALUES (?, ?)"
      ).run(String(finalTokenId), encrypted);

      logger.info(`[관리자] 승인 등록 완료 — tokenId=${finalTokenId}, title=${log.title}`);

      res.json({
        success: true,
        message: `심사 승인 + NFT 등록 완료 (tokenId: ${finalTokenId})`,
        token_id: finalTokenId,
      });
    } else if (decision === 'rejected' && (log.status === 'auto_approved' || log.status === 'approved')) {
      // AI가 승인했지만 관리자가 거절 → 이미 등록된 NFT 삭제
      const matched = db.prepare(
        "SELECT token_id FROM nfts WHERE creator_address = ? AND title = ? ORDER BY created_at DESC LIMIT 1"
      ).get(log.wallet_address, log.title);
      if (matched) {
        const tokenId = matched.token_id;
        db.prepare("DELETE FROM prompts WHERE token_id = ?").run(String(tokenId));
        db.prepare("DELETE FROM nfts WHERE token_id = ?").run(tokenId);
        logger.info(`[관리자] AI 승인 취소 — NFT 삭제 tokenId=${tokenId}, title=${log.title}`);
        res.json({ success: true, message: `AI 승인 취소 + NFT 삭제 완료 (tokenId: ${tokenId})` });
      } else {
        logger.warn(`[관리자] AI 승인 취소 — 대응 NFT 없음, title=${log.title}`);
        res.json({ success: true, message: "심사 거절 처리 완료 (대응 NFT를 찾을 수 없음)" });
      }
    } else {
      res.json({ success: true, message: "심사 거절 처리 완료" });
    }
  } catch (err) {
    logger.error(`[관리자] 심사 결정 실패: ${err.message}`);
    res.status(500).json({ success: false, error: "심사 결정 처리 실패" });
  }
});

module.exports = router;
