// ============================================
// routes/nfts.js - NFT 목록 조회 API
// 담당: 장우혁 (백엔드 데이터 + API)
// ============================================
// GET /nfts          → 전체 NFT 목록 (마켓플레이스)
// GET /nfts?sale=1   → 판매 중인 NFT만
// GET /nfts/:tokenId → 특정 NFT 상세
// GET /my-nfts       → 내 NFT 목록 (지갑 주소 기준)
// ============================================

const express = require("express");
const router = express.Router();
const { queries } = require("../db");

// ============================================
// GET /nfts - 전체 NFT 목록 조회
// query: ?sale=1 → 판매 중인 것만
// ============================================
router.get("/nfts", (req, res) => {
  try {
    const saleOnly = req.query.sale === "1";
    const nfts = saleOnly
      ? queries.getForSaleNFTs()
      : queries.getAllNFTs();

    res.json({
      success: true,
      count: nfts.length,
      data: nfts,
    });
  } catch (err) {
    console.error("[GET /nfts] 오류:", err.message);
    res.status(500).json({ success: false, error: "NFT 목록 조회 실패" });
  }
});

// ============================================
// GET /nfts/:tokenId - 특정 NFT 상세 조회
// ============================================
router.get("/nfts/:tokenId", (req, res) => {
  try {
    const tokenId = Number(req.params.tokenId);
    if (!Number.isInteger(tokenId) || tokenId < 0) {
      return res.status(400).json({ success: false, error: "유효하지 않은 tokenId" });
    }

    const nft = queries.getNFTByTokenId(tokenId);
    if (!nft) {
      return res.status(404).json({ success: false, error: "NFT를 찾을 수 없음" });
    }

    // 암호화된 프롬프트는 조회 API에서 제외
    const { prompt_encrypted, ...safeNft } = nft;

    const history = queries.getTransactionsByToken(tokenId);

    res.json({
      success: true,
      data: { ...safeNft, transaction_history: history },
    });
  } catch (err) {
    console.error("[GET /nfts/:tokenId] 오류:", err.message);
    res.status(500).json({ success: false, error: "NFT 상세 조회 실패" });
  }
});

// ============================================
// GET /my-nfts - 내 NFT 목록 조회
// 헤더: x-wallet-address (인증 미들웨어에서 설정)
// ============================================
router.get("/my-nfts", (req, res) => {
  try {
    const walletAddress = req.headers["x-wallet-address"];
    if (!walletAddress) {
      return res.status(401).json({ success: false, error: "지갑 주소가 필요합니다" });
    }

    // 지갑 주소 형식 검증 (0x + 40자 hex)
    if (!/^0x[0-9a-fA-F]{40}$/.test(walletAddress)) {
      return res.status(400).json({ success: false, error: "유효하지 않은 지갑 주소 형식" });
    }

    const myNfts = queries.getMyNFTs(walletAddress.toLowerCase());

    res.json({
      success: true,
      count: myNfts.length,
      data: myNfts,
    });
  } catch (err) {
    console.error("[GET /my-nfts] 오류:", err.message);
    res.status(500).json({ success: false, error: "내 NFT 조회 실패" });
  }
});

module.exports = router;
