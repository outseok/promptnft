// contract.js — 온체인 컨트랙트 헬퍼 (ethers v6)
import { ethers } from 'ethers';
import ABI from './abi/PromptNFT.json';

const CONTRACT_ADDRESS = '0x7c4BF3bEe89faa3C1310cB846f58fa0c80355eDB';

export function getContractAddress() {
  return CONTRACT_ADDRESS;
}

function getContract(signerOrProvider) {
  return new ethers.Contract(CONTRACT_ADDRESS, ABI, signerOrProvider);
}

// 민팅 — returns { tokenId }
export async function onChainMint(signer, tokenURI) {
  const contract = getContract(signer);
  const addr = await signer.getAddress();
  const tx = await contract.mint(addr, tokenURI);
  const receipt = await tx.wait();

  // Minted 이벤트에서 tokenId 추출
  const mintedEvent = receipt.logs
    .map((log) => {
      try {
        return contract.interface.parseLog(log);
      } catch {
        return null;
      }
    })
    .find((e) => e?.name === 'Minted');

  const tokenId = mintedEvent ? Number(mintedEvent.args.tokenId) : undefined;
  return { tokenId, txHash: receipt.hash };
}

// 구매 — returns txHash
export async function onChainBuy(signer, tokenId, priceEth) {
  const contract = getContract(signer);
  const tx = await contract.buy(tokenId, {
    value: ethers.parseEther(priceEth),
  });
  const receipt = await tx.wait();
  return receipt.hash;
}

// 판매 등록
export async function onChainListForSale(signer, tokenId, priceEth) {
  const contract = getContract(signer);
  const tx = await contract.listForSale(tokenId, ethers.parseEther(priceEth));
  await tx.wait();
}

// 판매 취소
export async function onChainCancelListing(signer, tokenId) {
  const contract = getContract(signer);
  const tx = await contract.cancelListing(tokenId);
  await tx.wait();
}

// 다음 토큰 ID 조회
export async function getNextTokenId(provider) {
  const contract = getContract(provider);
  const id = await contract.nextTokenId();
  return Number(id);
}
