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

module.exports = router;
