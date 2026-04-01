// src/contract.js - 스마트 컨트랙트 연동 (MetaMask 기반 — 프라이빗 키 불필요)
import { Contract, ContractFactory, parseEther } from "ethers";
import ABI from "./abi.json";
import { bytecode } from "./bytecode.json";

// 컨트랙트 주소 — localStorage에 저장/불러오기
const STORAGE_KEY = "promptnft_contract_address";
const DEFAULT_ADDRESS = "0x4187Cf6910659B75D9e90072304A5721A3Ef0E5b";

export function getContractAddress() {
  return localStorage.getItem(STORAGE_KEY) || DEFAULT_ADDRESS;
}

export function setContractAddress(address) {
  localStorage.setItem(STORAGE_KEY, address);
}

// 읽기 전용 컨트랙트
export function getReadContract(provider) {
  return new Contract(getContractAddress(), ABI, provider);
}

// 쓰기 가능 컨트랙트
export function getWriteContract(signer) {
  return new Contract(getContractAddress(), ABI, signer);
}

// ── MetaMask로 컨트랙트 배포 (프라이빗 키 불필요) ──
export async function deployContract(signer) {
  const factory = new ContractFactory(ABI, bytecode, signer);
  const signerAddress = await signer.getAddress();

  // constructor(address royaltyReceiver) — 배포자가 로열티 수신자
  const contract = await factory.deploy(signerAddress);
  const deployed = await contract.waitForDeployment();
  const address = await deployed.getAddress();

  // 주소 저장
  setContractAddress(address);

  return address;
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

// 온체인 민팅 — 누구나 가능 (msg.sender에게 발행)
export async function onChainMint(signer, tokenURI) {
  const contract = getWriteContract(signer);
  const tx = await contract.mint(tokenURI);
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
