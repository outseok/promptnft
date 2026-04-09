// api.js — 백엔드 API 래퍼 (새 UI 시스템용)

let _walletAddress = '';

export function setWalletHeader(addr) {
  _walletAddress = (addr || '').toLowerCase();
}

function getWallet() {
  return _walletAddress;
}

async function parseResponse(res) {
  const text = await res.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    throw new Error(data.error || data.message || '요청 실패');
  }
  return data;
}

// ── NFT 목록 ──────────────────────────────
export async function getNFTs(onlySale = false) {
  const url = onlySale ? '/api/nfts?sale=1' : '/api/nfts';
  return parseResponse(await fetch(url));
}

// ── NFT 상세 ──────────────────────────────
export async function getNFTDetail(tokenId) {
  return parseResponse(await fetch(`/api/nfts/${tokenId}`));
}

// ── 내 NFT ────────────────────────────────
export async function getMyNFTs() {
  return parseResponse(
    await fetch('/api/my-nfts', {
      headers: { 'x-wallet-address': getWallet() },
    })
  );
}

// ── 구매 ──────────────────────────────────
export async function buyNFT(payload) {
  return parseResponse(
    await fetch('/api/buy', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-wallet-address': payload.buyer_address || getWallet(),
      },
      body: JSON.stringify(payload),
    })
  );
}

// ── 프롬프트 암호화 ──────────────────────
export async function encryptPrompt(payload) {
  return parseResponse(
    await fetch('/api/encrypt', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-wallet-address': payload.walletAddress || getWallet(),
      },
      body: JSON.stringify(payload),
    })
  );
}

// ── 프롬프트 악성 콘텐츠 검사 ────────────
export async function screenPrompt(payload) {
  return parseResponse(
    await fetch('/api/screen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  );
}

// ── 민팅 DB 저장 ─────────────────────────
export async function mintNFT(payload) {
  return parseResponse(
    await fetch('/api/mint', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-wallet-address': payload.creator_address || getWallet(),
      },
      body: JSON.stringify(payload),
    })
  );
}

// ── 판매 상태 변경 ───────────────────────
export async function updateSaleStatus(tokenId, payload) {
  return parseResponse(
    await fetch(`/api/nfts/${tokenId}/sale`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-wallet-address': getWallet(),
      },
      body: JSON.stringify(payload),
    })
  );
}

// ── AI 실행 ──────────────────────────────
export async function executePrompt(body, headers = {}) {
  return parseResponse(
    await fetch('/api/execute', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: JSON.stringify(body),
    })
  );
}

// ── Nonce 발급 ───────────────────────────
export async function getNonce(wallet) {
  return parseResponse(
    await fetch(`/api/nonce?wallet=${encodeURIComponent(wallet)}`)
  );
}

// ── 관리자 확인 ──────────────────────────
export async function checkAdmin() {
  try {
    return await parseResponse(
      await fetch('/api/admin/check', {
        headers: { 'x-wallet-address': getWallet() },
      })
    );
  } catch {
    return { isAdmin: false };
  }
}

// ── 관리자: NFT 삭제 ────────────────────
export async function adminDeleteNFT(tokenId) {
  return parseResponse(
    await fetch(`/api/admin/nfts/${tokenId}`, {
      method: 'DELETE',
      headers: { 'x-wallet-address': getWallet() },
    })
  );
}

// ── 관리자: 판매 강제 중지 ──────────────
export async function adminForceDelist(tokenId) {
  return parseResponse(
    await fetch(`/api/admin/nfts/${tokenId}/force-delist`, {
      method: 'PATCH',
      headers: { 'x-wallet-address': getWallet() },
    })
  );
}

// ── DB 조회 (관리자) ────────────────────
export async function getDBTables() {
  return parseResponse(
    await fetch('/api/admin/db/tables', {
      headers: { 'x-wallet-address': getWallet() },
    })
  );
}

export async function getDBTableData(tableName) {
  return parseResponse(
    await fetch(`/api/admin/db/tables/${encodeURIComponent(tableName)}`, {
      headers: { 'x-wallet-address': getWallet() },
    })
  );
}

// ── 관리자: 프롬프트 심사 로그 ──────────
export async function getScreeningLogs(status) {
  const url = status ? `/api/admin/screening?status=${status}` : '/api/admin/screening';
  return parseResponse(
    await fetch(url, { headers: { 'x-wallet-address': getWallet() } })
  );
}

export async function getScreeningDetail(id) {
  return parseResponse(
    await fetch(`/api/admin/screening/${id}`, {
      headers: { 'x-wallet-address': getWallet() },
    })
  );
}

export async function adminScreeningDecision(id, decision, reason) {
  return parseResponse(
    await fetch(`/api/admin/screening/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-wallet-address': getWallet(),
      },
      body: JSON.stringify({ decision, reason }),
    })
  );
}
