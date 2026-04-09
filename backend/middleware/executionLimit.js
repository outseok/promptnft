// middleware/executionLimit.js
// 역할: 실행 횟수 제한 미들웨어 (NFT당 100회)
// 담당: 장우혁

const { queries } = require("../utils/db");

function executionLimit(req, res, next) {
  try {
    const rawTokenId = req.body.token_id ?? req.body.tokenId ?? req.params.tokenId;
    const tokenId = Number(rawTokenId);
    const executorAddress = req.headers["x-wallet-address"] || req.wallet;

    if (rawTokenId === undefined || rawTokenId === null || isNaN(tokenId)) {
      return res.status(400).json({ success: false, error: "token_id 필수" });
    }
    if (!executorAddress) {
      return res.status(401).json({ success: false, error: "지갑 주소가 필요합니다" });
    }

    const nft = queries.getNFTByTokenId(tokenId);
    if (!nft) {
      return res.status(404).json({ success: false, error: "NFT를 찾을 수 없음" });
    }

    if (nft.execution_count >= nft.max_executions) {
      return res.status(403).json({
        success: false,
        error: "실행 횟수 초과",
        detail: `최대 ${nft.max_executions}회 실행 가능 (현재 ${nft.execution_count}회 사용됨)`,
      });
    }

    queries.incrementExecution(tokenId);
    queries.insertExecutionLog(tokenId, executorAddress.toLowerCase());

    req.executionInfo = {
      token_id: tokenId,
      execution_count: nft.execution_count + 1,
      max_executions: nft.max_executions,
      remaining: nft.max_executions - nft.execution_count - 1,
    };

    console.log(
      `[실행] tokenId=${tokenId}, 사용=${nft.execution_count + 1}/${nft.max_executions}`
    );

    next();
  } catch (err) {
    console.error("[executionLimit] 오류:", err.message);
    res.status(500).json({ success: false, error: "실행 횟수 확인 실패" });
  }
}

module.exports = executionLimit;
