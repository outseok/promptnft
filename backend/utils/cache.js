// utils/cache.js
// 역할: NFT 소유권 조회 결과를 메모리에 캐싱
// 매번 블록체인 직접 호출하면 느리고 비용 나가니까
// 담당: 최유리

const NodeCache = require("node-cache");
const logger = require("./logger");

// TTL: 30초 — 30초 동안 같은 결과 재사용
// NFT 팔리면 최대 30초 후에 반영됨
const cache = new NodeCache({ stdTTL: 30, checkperiod: 10 });

const CACHE_PREFIX = "ownership:";

/**
 * 캐시에서 소유권 결과 조회
 * @returns {boolean|null} 캐시 있으면 true/false, 없으면 null
 */
function getCachedOwnership(wallet, tokenId) {
  const key = `${CACHE_PREFIX}${wallet.toLowerCase()}:${tokenId}`;
  const cached = cache.get(key);
  if (cached !== undefined) {
    logger.info(`캐시 히트 — wallet=${wallet.slice(0,8)}... tokenId=${tokenId}`);
    return cached;
  }
  return null;
}

/**
 * 소유권 결과를 캐시에 저장
 */
function setCachedOwnership(wallet, tokenId, hasAccess) {
  const key = `${CACHE_PREFIX}${wallet.toLowerCase()}:${tokenId}`;
  cache.set(key, hasAccess);
}

/**
 * NFT 전송(Transfer) 이벤트 발생 시 해당 토큰 캐시 전체 무효화
 * blockchain.js의 이벤트 리스너에서 호출됨
 */
function invalidateToken(tokenId) {
  const keys = cache.keys().filter(k => k.includes(`:${tokenId}`));
  keys.forEach(k => cache.del(k));
  logger.info(`캐시 무효화 — tokenId=${tokenId} (${keys.length}개 삭제)`);
}

module.exports = { getCachedOwnership, setCachedOwnership, invalidateToken };
