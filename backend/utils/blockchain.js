// utils/blockchain.js
// 역할: NFT 소유권 확인 + Transfer 이벤트 감지
// 개선: 캐시 적용 + 이벤트 기반 캐시 무효화
// 담당: 최유리

const { ethers } = require("ethers");
const logger = require("./logger");
const { getCachedOwnership, setCachedOwnership, invalidateToken } = require("./cache");

let _provider = null;
let _contract = null;

function getContract() {
  if (!_contract) {
    const ABI = require("../abi/PromptNFT.json");
    _provider = new ethers.JsonRpcProvider(process.env.ALCHEMY_SEPOLIA_URL);
    _contract = new ethers.Contract(
      process.env.CONTRACT_ADDRESS,
      ABI,
      _provider
    );
  }
  return _contract;
}

/**
 * NFT 소유권 확인 (캐시 우선)
 * 1. 캐시 확인 → 있으면 바로 반환
 * 2. 없으면 블록체인 직접 조회 → 캐시 저장
 */
async function verifyOwnership(wallet, tokenId) {
  // 1. 캐시 확인
  const cached = getCachedOwnership(wallet, tokenId);
  if (cached !== null) return cached;

  // 2. 블록체인 직접 조회
  try {
    const contract = getContract();

    const owner = await contract.ownerOf(tokenId);
    const hasAccess = owner.toLowerCase() === wallet.toLowerCase();

    logger.info(`블록체인 조회 — wallet=${wallet.slice(0,8)}... tokenId=${tokenId} result=${hasAccess}`);

    // 3. 캐시 저장 (30초)
    setCachedOwnership(wallet, tokenId, hasAccess);
    return hasAccess;

  } catch (err) {
    logger.error(`소유권 확인 실패 — tokenId=${tokenId} err=${err.message}`);
    return false;
  }
}

/**
 * Transfer 이벤트 리스너
 * NFT가 팔리는 순간 캐시 즉시 무효화
 * → 전 소유자가 30초 동안 실행하는 문제 방지
 */
function startTransferListener() {
  try {
    const contract = getContract();

    contract.on("Transfer", (from, to, tokenId) => {
      logger.info(`Transfer 이벤트 감지 — tokenId=${tokenId} from=${from.slice(0,8)}... to=${to.slice(0,8)}...`);
      invalidateToken(tokenId.toString());
    });

    logger.info("Transfer 이벤트 리스너 시작됨");
  } catch (err) {
    logger.error(`이벤트 리스너 시작 실패: ${err.message}`);
  }
}

module.exports = { verifyOwnership, startTransferListener };
