// routes/verify.js - 암호화 검증 + 트랜잭션 확인 API
// 담당: 최유리 (보안)

const router = require("express").Router();
const { encrypt, decrypt } = require("../utils/crypto");
const db = require("../utils/db");
const { queries } = require("../utils/db");
const logger = require("../utils/logger");

// ── AES-256 암호화 검증 ──
router.get("/encryption", (req, res) => {
  try {
    // 1. 테스트 문자열로 암호화/복호화 라운드트립
    const testPlain = "AES-256-CBC 암호화 검증 테스트 문자열 " + Date.now();
    const encrypted = encrypt(testPlain);
    const decrypted = decrypt(encrypted);
    const roundTripOk = testPlain === decrypted;

    // 2. 저장된 프롬프트 암호화 상태 확인 (내용은 비공개)
    const prompts = db.prepare(
      "SELECT token_id, encrypted_content, created_at FROM prompts"
    ).all();

    const promptStatus = prompts.map((p) => {
      const isValidFormat = /^[0-9a-f]{32}:[0-9a-f]+$/.test(p.encrypted_content);
      const [ivHex] = p.encrypted_content.split(":");
      let canDecrypt = false;
      try {
        const result = decrypt(p.encrypted_content);
        canDecrypt = result && result.length > 0;
      } catch {
        canDecrypt = false;
      }

      return {
        token_id: p.token_id,
        created_at: p.created_at,
        encrypted_length: p.encrypted_content.length,
        iv_hex: ivHex,
        format_valid: isValidFormat,
        decryptable: canDecrypt,
        // 원문은 절대 노출하지 않음
      };
    });

    res.json({
      success: true,
      encryption: {
        algorithm: "AES-256-CBC",
        key_size: "256-bit (32 bytes)",
        iv_size: "128-bit (16 bytes, random per encryption)",
        format: "<iv_hex>:<ciphertext_hex>",
        round_trip_test: {
          plaintext_length: testPlain.length,
          encrypted_sample: encrypted.slice(0, 40) + "...",
          decrypted_matches: roundTripOk,
        },
      },
      stored_prompts: promptStatus,
      total_encrypted: promptStatus.length,
      all_valid: promptStatus.every((p) => p.format_valid && p.decryptable),
    });
  } catch (err) {
    logger.error(`암호화 검증 실패: ${err.message}`);
    res.status(500).json({ success: false, error: "암호화 검증 실패: " + err.message });
  }
});

// ── 트랜잭션 기록 확인 ──
router.get("/transactions/:tokenId", (req, res) => {
  try {
    const tokenId = Number(req.params.tokenId);
    const transactions = queries.getTransactionsByToken(tokenId);
    const nft = queries.getNFTByTokenId(tokenId);

    if (!nft) {
      return res.status(404).json({ success: false, error: "NFT를 찾을 수 없음" });
    }

    res.json({
      success: true,
      nft: {
        token_id: nft.token_id,
        title: nft.title,
        price: nft.price,
        creator_address: nft.creator_address,
        owner_address: nft.owner_address,
        is_for_sale: nft.is_for_sale,
      },
      transactions: transactions.map((t) => ({
        ...t,
        etherscan_url: t.tx_hash
          ? `https://sepolia.etherscan.io/tx/${t.tx_hash}`
          : null,
      })),
      note: "판매 대금은 스마트 컨트랙트의 Internal Transaction으로 전송됩니다. MetaMask Activity에는 표시되지 않지만, Etherscan에서 확인 가능합니다.",
    });
  } catch (err) {
    res.status(500).json({ success: false, error: "트랜잭션 조회 실패" });
  }
});

module.exports = router;
