// routes/admin.js - 관리자 전용 API
// 담당: 최유리 (보안)

const express = require("express");
const router = express.Router();
const { requireAdmin } = require("../middleware/admin");
const { queries } = require("../utils/db");
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
    const allowed = ['nfts', 'prompts', 'usage', 'nonces', 'execution_logs', 'transactions'];
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

module.exports = router;
