// utils/blockchain.js
// 역할: NFT 소유권 확인 + Transfer 이벤트 감지
// 담당: 최유리

const { ethers } = require("ethers");
const logger = require("./logger");
const { getCachedOwnership, setCachedOwnership, invalidateToken } = require("./cache");

let _provider = null;
let _contracts = {};

function getProvider() {
  if (!_provider) {
    _provider = new ethers.JsonRpcProvider(process.env.ALCHEMY_SEPOLIA_URL);
  }
  return _provider;
}

function getContract(contractAddress) {
  const addr = contractAddress || process.env.CONTRACT_ADDRESS;
  if (!addr) throw new Error("CONTRACT_ADDRESS 미설정");
  
  if (!_contracts[addr]) {
    const ABI = require("../abi/PromptNFT.json");
    _contracts[addr] = new ethers.Contract(addr, ABI, getProvider());
  }
  return _contracts[addr];
}

async function verifyOwnership(wallet, tokenId, contractAddress) {
  const cached = getCachedOwnership(wallet, tokenId);
  if (cached !== null) return cached;

  try {
    const contract = getContract(contractAddress);
    const owner = await contract.ownerOf(tokenId);
    const hasAccess = owner.toLowerCase() === wallet.toLowerCase();

    logger.info(`블록체인 조회 — wallet=${wallet.slice(0,8)}... tokenId=${tokenId} result=${hasAccess}`);
    setCachedOwnership(wallet, tokenId, hasAccess);
    return hasAccess;
  } catch (err) {
    logger.error(`소유권 확인 실패 — tokenId=${tokenId} err=${err.message}`);
    return false;
  }
}

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

module.exports = { verifyOwnership, startTransferListener, getContract };
