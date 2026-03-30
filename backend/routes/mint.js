// routes/mint.js - 민팅/구매/판매 API
// 담당: 장우혁

const express = require("express");
const router = express.Router();
const { queries } = require("../utils/db");

router.post("/mint", (req, res) => {
  try {
    const {
      token_id, title, description, prompt_encrypted,
      creator_address, price, category, image_url,
    } = req.body;

    if (!token_id && token_id !== 0) {
      return res.status(400).json({ success: false, error: "token_id 필수" });
    }
    if (!title || typeof title !== "string" || title.trim().length === 0) {
      return res.status(400).json({ success: false, error: "title 필수" });
    }
    if (!prompt_encrypted) {
      return res.status(400).json({ success: false, error: "prompt_encrypted 필수" });
    }
    if (!creator_address || !/^0x[0-9a-fA-F]{40}$/.test(creator_address)) {
      return res.status(400).json({ success: false, error: "유효한 creator_address 필수" });
    }

    const existing = queries.getNFTByTokenId(Number(token_id));
    if (existing) {
      return res.status(409).json({ success: false, error: "이미 등록된 token_id" });
    }

    const result = queries.insertNFT({
      token_id: Number(token_id),
      title: title.trim(),
      description: description || "",
      prompt_encrypted,
      creator_address: creator_address.toLowerCase(),
      owner_address: creator_address.toLowerCase(),
      price: price || "0",
      category: category || null,
      image_url: image_url || null,
    });

    console.log(`[민팅 저장] tokenId=${token_id}, creator=${creator_address}`);

    res.status(201).json({
      success: true,
      message: "NFT 민팅 데이터 저장 완료",
      data: { id: result.lastInsertRowid, token_id: Number(token_id) },
    });
  } catch (err) {
    console.error("[POST /mint] 오류:", err.message);
    res.status(500).json({ success: false, error: "민팅 데이터 저장 실패" });
  }
});

router.post("/buy", (req, res) => {
  try {
    const { token_id, buyer_address, price, tx_hash } = req.body;

    if (!token_id && token_id !== 0) {
      return res.status(400).json({ success: false, error: "token_id 필수" });
    }
    if (!buyer_address || !/^0x[0-9a-fA-F]{40}$/.test(buyer_address)) {
      return res.status(400).json({ success: false, error: "유효한 buyer_address 필수" });
    }

    const nft = queries.getNFTByTokenId(Number(token_id));
    if (!nft) {
      return res.status(404).json({ success: false, error: "NFT를 찾을 수 없음" });
    }
    if (!nft.is_for_sale) {
      return res.status(400).json({ success: false, error: "판매 중이 아닌 NFT" });
    }

    queries.updateOwner({
      new_owner: buyer_address.toLowerCase(),
      price: price || nft.price,
      token_id: Number(token_id),
    });

    queries.insertTransaction({
      token_id: Number(token_id),
      from_address: nft.owner_address,
      to_address: buyer_address.toLowerCase(),
      price: price || nft.price,
      tx_hash: tx_hash || null,
    });

    console.log(`[구매 처리] tokenId=${token_id}, buyer=${buyer_address}`);

    res.json({
      success: true,
      message: "NFT 구매 처리 완료",
      data: { token_id: Number(token_id), new_owner: buyer_address.toLowerCase() },
    });
  } catch (err) {
    console.error("[POST /buy] 오류:", err.message);
    res.status(500).json({ success: false, error: "구매 처리 실패" });
  }
});

router.patch("/nfts/:tokenId/sale", (req, res) => {
  try {
    const tokenId = Number(req.params.tokenId);
    const { is_for_sale, price } = req.body;
    const walletAddress = req.headers["x-wallet-address"];

    if (!walletAddress) {
      return res.status(401).json({ success: false, error: "지갑 주소가 필요합니다" });
    }

    const nft = queries.getNFTByTokenId(tokenId);
    if (!nft) {
      return res.status(404).json({ success: false, error: "NFT를 찾을 수 없음" });
    }

    if (nft.owner_address !== walletAddress.toLowerCase()) {
      return res.status(403).json({ success: false, error: "소유자만 변경 가능" });
    }

    queries.updateSaleStatus({
      is_for_sale: is_for_sale ? 1 : 0,
      price: price || nft.price,
      token_id: tokenId,
    });

    res.json({ success: true, message: "판매 상태 변경 완료" });
  } catch (err) {
    console.error("[PATCH /nfts/:tokenId/sale] 오류:", err.message);
    res.status(500).json({ success: false, error: "판매 상태 변경 실패" });
  }
});

module.exports = router;
