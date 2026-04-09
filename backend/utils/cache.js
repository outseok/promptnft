// utils/cache.js
// 역할: NFT 소유권 조회 결과를 메모리에 캐싱
// 담당: 최유리

const NodeCache = require("node-cache");
const logger = require("./logger");

const cache = new NodeCache({ stdTTL: 30, checkperiod: 10 });
const CACHE_PREFIX = "ownership:";

function getCachedOwnership(wallet, tokenId) {
  const key = `${CACHE_PREFIX}${wallet.toLowerCase()}:${tokenId}`;
  const cached = cache.get(key);
  if (cached !== undefined) {
    logger.info(`캐시 히트 — wallet=${wallet.slice(0,8)}... tokenId=${tokenId}`);
    return cached;
  }
  return null;
}

function setCachedOwnership(wallet, tokenId, hasAccess) {
  const key = `${CACHE_PREFIX}${wallet.toLowerCase()}:${tokenId}`;
  cache.set(key, hasAccess);
}

function invalidateToken(tokenId) {
  const keys = cache.keys().filter(k => k.includes(`:${tokenId}`));
  keys.forEach(k => cache.del(k));
  logger.info(`캐시 무효화 — tokenId=${tokenId} (${keys.length}개 삭제)`);
}

module.exports = { getCachedOwnership, setCachedOwnership, invalidateToken };
