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
      mint_mode, max_executions,
    } = req.body;

    // lazy mint는 token_id 없이도 가능
    const isLazy = mint_mode === "lazy";

    if (!isLazy && !token_id && token_id !== 0) {
      return res.status(400).json({ success: false, error: "token_id 필수 (직접 민팅)" });
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

    let finalTokenId;
    if (isLazy) {
      // 거래 시 민팅: 임시 음수 token_id 부여
      finalTokenId = queries.getNextLazyTokenId();
    } else {
      finalTokenId = Number(token_id);
      const existing = queries.getNFTByTokenId(finalTokenId);
      if (existing) {
        return res.status(409).json({ success: false, error: "이미 등록된 token_id" });
      }
    }

    const result = queries.insertNFT({
      token_id: finalTokenId,
      title: title.trim(),
      description: description || "",
      prompt_encrypted,
      creator_address: creator_address.toLowerCase(),
      owner_address: creator_address.toLowerCase(),
      price: price || "0",
      category: category || null,
      image_url: image_url || null,
      max_executions: max_executions || 50,
      mint_mode: isLazy ? "lazy" : "direct",
      is_minted: isLazy ? 0 : 1,
    });

    console.log(`[민팅 저장] tokenId=${finalTokenId}, mode=${isLazy ? "lazy" : "direct"}, creator=${creator_address}`);

    res.status(201).json({
      success: true,
      message: isLazy ? "거래 시 민팅 등록 완료 (구매 시 온체인 민팅)" : "NFT 민팅 데이터 저장 완료",
      data: { id: result.lastInsertRowid, token_id: finalTokenId, mint_mode: isLazy ? "lazy" : "direct" },
    });
  } catch (err) {
    console.error("[POST /mint] 오류:", err.message);
    res.status(500).json({ success: false, error: "민팅 데이터 저장 실패" });
  }
});

router.post("/buy", (req, res) => {
  try {
    const { token_id, buyer_address, price, tx_hash, new_token_id } = req.body;

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

    // lazy mint 구매: token_id 업데이트
    if (nft.mint_mode === "lazy" && !nft.is_minted && new_token_id !== undefined) {
      queries.updateTokenIdAfterLazyMint(
        Number(token_id),
        Number(new_token_id),
        buyer_address.toLowerCase()
      );

      queries.insertTransaction({
        token_id: Number(new_token_id),
        from_address: nft.creator_address,
        to_address: buyer_address.toLowerCase(),
        price: price || nft.price,
        tx_hash: tx_hash || null,
      });

      console.log(`[Lazy 구매] oldId=${token_id} → newId=${new_token_id}, buyer=${buyer_address}`);

      return res.json({
        success: true,
        message: "Lazy Mint + 구매 처리 완료",
        data: { token_id: Number(new_token_id), new_owner: buyer_address.toLowerCase(), mint_mode: "lazy" },
      });
    }

    // 일반 구매 (직접 민팅 or 재판매)
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
