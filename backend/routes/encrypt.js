// routes/encrypt.js
// 역할: 민팅 후 프롬프트 원문 암호화 저장
// 담당: 최유리

const router = require("express").Router();
const { ethers } = require("ethers");
const { encrypt } = require("../utils/crypto");
const db = require("../utils/db");
const logger = require("../utils/logger");

router.post("/", async (req, res, next) => {
  try {
    const { tokenId, promptContent, walletAddress } = req.body;

    if (!tokenId && tokenId !== 0) {
      return res.status(400).json({
        error: "tokenId, promptContent, walletAddress 모두 필요"
      });
    }
    if (!promptContent || !walletAddress) {
      return res.status(400).json({
        error: "tokenId, promptContent, walletAddress 모두 필요"
      });
    }

    // 온체인 소유자 확인 (데모 모드에서는 스킵)
    if (process.env.DEMO_MODE !== "true") {
      const ABI = require("../abi/PromptNFT.json");
      const provider = new ethers.JsonRpcProvider(process.env.ALCHEMY_SEPOLIA_URL);
      const contract = new ethers.Contract(process.env.CONTRACT_ADDRESS, ABI, provider);
      const owner = await contract.ownerOf(tokenId).catch(() => null);

      if (!owner || owner.toLowerCase() !== walletAddress.toLowerCase()) {
        logger.warn(`민팅 사칭 시도 — tokenId=${tokenId} wallet=${walletAddress.slice(0,8)}...`);
        return res.status(403).json({ error: "해당 NFT의 소유자가 아닙니다" });
      }
    }

    const encrypted = encrypt(promptContent);
    db.prepare(
      "INSERT OR REPLACE INTO prompts (token_id, encrypted_content) VALUES (?, ?)"
    ).run(String(tokenId), encrypted);

    logger.info(`프롬프트 암호화 저장 완료 — tokenId=${tokenId}`);
    res.json({ success: true, tokenId });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
