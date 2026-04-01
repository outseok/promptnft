// src/contract.js - 스마트 컨트랙트 연동
import { Contract, parseEther } from "ethers";
import ABI from "./abi.json";

const CONTRACT_ADDRESS = "0x4187Cf6910659B75D9e90072304A5721A3Ef0E5b";

// 읽기 전용 컨트랙트 (provider)
export function getReadContract(provider) {
  return new Contract(CONTRACT_ADDRESS, ABI, provider);
}

// 쓰기 가능 컨트랙트 (signer)
export function getWriteContract(signer) {
  return new Contract(CONTRACT_ADDRESS, ABI, signer);
}

// 온체인 소유자 확인
export async function checkOwnership(provider, tokenId, wallet) {
  try {
    const contract = getReadContract(provider);
    const owner = await contract.ownerOf(tokenId);
    return owner.toLowerCase() === wallet.toLowerCase();
  } catch {
    return false;
  }
}

// 온체인 민팅 (컨트랙트 owner만 가능)
export async function onChainMint(signer, toAddress, tokenURI) {
  const contract = getWriteContract(signer);
  const tx = await contract.mint(toAddress, tokenURI);
  const receipt = await tx.wait();

  // Minted 이벤트에서 tokenId 추출
  const mintedEvent = receipt.logs.find((log) => {
    try {
      const parsed = contract.interface.parseLog(log);
      return parsed?.name === "Minted";
    } catch {
      return false;
    }
  });

  if (mintedEvent) {
    const parsed = contract.interface.parseLog(mintedEvent);
    return { tokenId: Number(parsed.args.tokenId), txHash: receipt.hash };
  }

  return { tokenId: null, txHash: receipt.hash };
}

// 판매 등록 (온체인)
export async function onChainListForSale(signer, tokenId, priceEth) {
  const contract = getWriteContract(signer);
  const tx = await contract.listForSale(tokenId, parseEther(priceEth));
  const receipt = await tx.wait();
  return receipt.hash;
}

// 판매 취소 (온체인)
export async function onChainCancelListing(signer, tokenId) {
  const contract = getWriteContract(signer);
  const tx = await contract.cancelListing(tokenId);
  const receipt = await tx.wait();
  return receipt.hash;
}

// 구매 (온체인 — ETH 전송)
export async function onChainBuy(signer, tokenId, priceEth) {
  const contract = getWriteContract(signer);
  const tx = await contract.buy(tokenId, { value: parseEther(priceEth) });
  const receipt = await tx.wait();
  return receipt.hash;
}

// 다음 tokenId 조회
export async function getNextTokenId(provider) {
  const contract = getReadContract(provider);
  const nextId = await contract.nextTokenId();
  return Number(nextId);
}

export { CONTRACT_ADDRESS };
