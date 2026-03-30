// src/api.js - 백엔드 API 클라이언트
// 담당: 홍재창 (프론트엔드)

import axios from "axios";

const API_BASE = "/api";

const api = axios.create({
  baseURL: API_BASE,
  timeout: 15000,
});

// 지갑 주소 헤더 자동 추가
export function setWalletHeader(address) {
  if (address) {
    api.defaults.headers.common["x-wallet-address"] = address;
  } else {
    delete api.defaults.headers.common["x-wallet-address"];
  }
}

// ── NFT 목록 ──
export const getNFTs = (saleOnly = false) =>
  api.get(`/nfts${saleOnly ? "?sale=1" : ""}`).then((r) => r.data);

export const getNFTDetail = (tokenId) =>
  api.get(`/nfts/${tokenId}`).then((r) => r.data);

export const getMyNFTs = () =>
  api.get("/my-nfts").then((r) => r.data);

// ── 민팅 ──
export const mintNFT = (data) =>
  api.post("/mint", data).then((r) => r.data);

// ── 구매 ──
export const buyNFT = (data) =>
  api.post("/buy", data).then((r) => r.data);

// ── 판매 상태 변경 ──
export const updateSaleStatus = (tokenId, data) =>
  api.patch(`/nfts/${tokenId}/sale`, data).then((r) => r.data);

// ── Nonce 발급 ──
export const getNonce = (wallet) =>
  api.get(`/nonce?wallet=${wallet}`).then((r) => r.data);

// ── 프롬프트 암호화 저장 ──
export const encryptPrompt = (data) =>
  api.post("/encrypt", data).then((r) => r.data);

// ── 프롬프트 실행 (서명 필요) ──
export const executePrompt = (data, headers = {}) =>
  api.post("/execute", data, { headers }).then((r) => r.data);

// ── 실행 기록 조회 ──
export const getExecutions = (tokenId) =>
  api.get(`/nfts/${tokenId}/executions`).then((r) => r.data);

export default api;
