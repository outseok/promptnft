// ============================================
// middleware/executionLimit.js - 실행 횟수 제한 미들웨어
// 담당: 장우혁 (백엔드 데이터 + API)
// ============================================
// NFT당 최대 실행 횟수: 100회
// /execute API에 적용 → 최유리 담당 라우트에서 사용
// ============================================

const { queries } = require("../db");

/**
 * 실행 횟수 제한 미들웨어
 * req.body.token_id 또는 req.params.tokenId 에서 tokenId를 읽음
 * - 실행 가능하면 → 횟수 증가 + 로그 기록 후 next()
 * - 100회 초과하면 → 403 응답
 */
function executionLimit(req, res, next) {
  try {
    const tokenId = Number(req.body.token_id || req.params.tokenId);
    const executorAddress = req.headers["x-wallet-address"];

    if (!tokenId && tokenId !== 0) {
      return res.status(400).json({ success: false, error: "token_id 필수" });
    }
    if (!executorAddress) {
      return res.status(401).json({ success: false, error: "지갑 주소가 필요합니다" });
    }

    const nft = queries.getNFTByTokenId(tokenId);
    if (!nft) {
      return res.status(404).json({ success: false, error: "NFT를 찾을 수 없음" });
    }

    // 실행 횟수 제한 체크
    if (nft.execution_count >= nft.max_executions) {
      return res.status(403).json({
        success: false,
        error: "실행 횟수 초과",
        detail: `최대 ${nft.max_executions}회 실행 가능 (현재 ${nft.execution_count}회 사용됨)`,
      });
    }

    // 실행 횟수 증가 + 로그 기록
    queries.incrementExecution(tokenId);
    queries.insertExecutionLog(tokenId, executorAddress.toLowerCase());

    // 다음 미들웨어에 남은 횟수 정보 전달
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
