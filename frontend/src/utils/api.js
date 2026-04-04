const BASE_URL = "http://localhost:3001";

async function parseResponse(res) {
  const text = await res.text();
  let data = {};

  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }

  if (!res.ok) {
    throw new Error(data.error || data.message || "요청 실패");
  }

  return data;
}

// 판매중 NFT 목록
export async function getNfts(onlySale = false) {
  const url = onlySale ? `${BASE_URL}/nfts?sale=1` : `${BASE_URL}/nfts`;
  const res = await fetch(url);
  return parseResponse(res);
}

// 내 NFT 조회
export async function getMyNfts(address) {
  const res = await fetch(`${BASE_URL}/my-nfts`, {
    headers: {
      "x-wallet-address": address,
    },
  });
  return parseResponse(res);
}

// 프롬프트 암호화
export async function encryptPrompt({ tokenId, promptContent, walletAddress }) {
  const res = await fetch(`${BASE_URL}/api/encrypt`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-wallet-address": walletAddress || "",
    },
    body: JSON.stringify({
      tokenId,
      promptContent,
      walletAddress,
    }),
  });

  return parseResponse(res);
}

// 민팅 데이터 DB 저장
export async function mintPrompt(payload) {
  const res = await fetch(`${BASE_URL}/mint`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-wallet-address": payload.creator_address || "",
    },
    body: JSON.stringify(payload),
  });

  return parseResponse(res);
}

// 구매 완료 후 DB 동기화
export async function buyNft(payload) {
  const res = await fetch(`${BASE_URL}/buy`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-wallet-address": payload.buyer_address || "",
    },
    body: JSON.stringify(payload),
  });

  return parseResponse(res);
}

// 판매 상태 변경
export async function changeSaleStatus(tokenId, isForSale, price, address) {
  const res = await fetch(`${BASE_URL}/nfts/${tokenId}/sale`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "x-wallet-address": address || "",
    },
    body: JSON.stringify({
      is_for_sale: isForSale,
      price,
    }),
  });

  return parseResponse(res);
}

// nonce 조회
export async function getNonce(address) {
  const res = await fetch(`${BASE_URL}/api/nonce?wallet=${encodeURIComponent(address)}`);
  return parseResponse(res);
}

// 실행 API
export async function executePrompt({ tokenId, address, signature, nonce, userInput }) {
  const res = await fetch(`${BASE_URL}/api/execute`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-wallet-address": address,
      "x-signature": signature,
      "x-nonce": nonce,
    },
    body: JSON.stringify({
      tokenId: Number(tokenId),
      input: userInput || "",
    }),
  });

  return parseResponse(res);
}

// 실행 횟수 조회
export async function getExecutionStats(tokenId) {
  const res = await fetch(`${BASE_URL}/nfts/${tokenId}/executions`);
  return parseResponse(res);
}