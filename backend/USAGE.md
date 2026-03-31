# PromptNFT - 백엔드 데이터 + API (장우혁 담당)

## 개요

NFT 기반 프롬프트 마켓플레이스의 **데이터베이스 설계 및 API** 담당 파트입니다.

```
[프론트 (홍재창)] → [백엔드 API (장우혁)] → [DB (SQLite)]
                  → [보안/실행 (최유리)]  → [블록체인 (홍인석)]
```

---

## 파일 구조

```
├── db.js                         # SQLite 초기화 + 테이블 생성 + 쿼리 함수
├── server.js                     # Express 서버 (라우트 통합)
├── package.json                  # 의존성 관리
├── routes/
│   ├── nfts.js                   # NFT 조회 API (목록/상세/내 NFT)
│   └── mint.js                   # 민팅 저장 / 구매 / 판매 상태 변경
├── middleware/
│   └── executionLimit.js         # 실행 횟수 100회 제한 미들웨어
└── promptnft.db                  # SQLite DB 파일 (자동 생성)
```

---

## 설치 및 실행

```bash
# 1. 의존성 설치
npm install

# 2. 서버 실행
node server.js
# → http://localhost:3000

# DB 파일(promptnft.db)은 첫 실행 시 자동 생성됩니다.
```

---

## DB 스키마

### nfts (NFT 메타데이터)

| 컬럼 | 타입 | 설명 |
|---|---|---|
| token_id | INTEGER (UNIQUE) | 블록체인 토큰 ID |
| title | TEXT | NFT 제목 |
| description | TEXT | 설명 |
| prompt_encrypted | TEXT | AES-256 암호화된 프롬프트 |
| creator_address | TEXT | 생성자 지갑 주소 |
| owner_address | TEXT | 현재 소유자 지갑 주소 |
| price | TEXT | 가격 (ETH) |
| royalty_percent | INTEGER | 로열티 (기본 10%) |
| category | TEXT | 카테고리 |
| execution_count | INTEGER | 현재 실행 횟수 |
| max_executions | INTEGER | 최대 실행 횟수 (기본 100) |
| is_for_sale | INTEGER | 판매 상태 (0/1) |

### execution_logs (실행 기록)

| 컬럼 | 타입 | 설명 |
|---|---|---|
| token_id | INTEGER | NFT 토큰 ID |
| executor_address | TEXT | 실행자 지갑 주소 |
| executed_at | DATETIME | 실행 시각 |

### transactions (거래 내역)

| 컬럼 | 타입 | 설명 |
|---|---|---|
| token_id | INTEGER | NFT 토큰 ID |
| from_address | TEXT | 판매자 주소 |
| to_address | TEXT | 구매자 주소 |
| price | TEXT | 거래 가격 |
| tx_hash | TEXT | 블록체인 트랜잭션 해시 |

---

## API 엔드포인트

### 1. NFT 전체 목록 조회

```
GET /nfts
GET /nfts?sale=1    ← 판매 중인 것만
```

**응답 예시:**
```json
{
  "success": true,
  "count": 2,
  "data": [
    {
      "token_id": 1,
      "title": "GPT 마케팅 프롬프트",
      "price": "0.05",
      "is_for_sale": 1,
      "execution_count": 3,
      "max_executions": 100
    }
  ]
}
```

### 2. NFT 상세 조회

```
GET /nfts/:tokenId
```

> 암호화된 프롬프트(prompt_encrypted)는 이 API에서 **제외**됩니다.

### 3. 내 NFT 조회

```
GET /my-nfts
Header: x-wallet-address: 0x...
```

### 4. 민팅 데이터 저장

```
POST /mint
Content-Type: application/json
```

**요청 Body:**
```json
{
  "token_id": 1,
  "title": "마케팅 프롬프트",
  "description": "카피 생성용",
  "prompt_encrypted": "aes256_암호화된_데이터",
  "creator_address": "0x1234...5678",
  "price": "0.05",
  "category": "마케팅"
}
```

### 5. NFT 구매 처리

```
POST /buy
Content-Type: application/json
```

**요청 Body:**
```json
{
  "token_id": 1,
  "buyer_address": "0xabcd...ef01",
  "price": "0.05",
  "tx_hash": "0x..."
}
```

### 6. 판매 상태 변경

```
PATCH /nfts/:tokenId/sale
Header: x-wallet-address: 0x... (소유자만 가능)
```

**요청 Body:**
```json
{
  "is_for_sale": true,
  "price": "0.1"
}
```

### 7. 실행 기록 조회

```
GET /nfts/:tokenId/executions
```

---

## 다른 팀원 연결 가이드

### 최유리 (보안/실행) → executionLimit 미들웨어 사용법

```js
// routes/execute.js 에서
const executionLimit = require("../middleware/executionLimit");

// server.js에서 연결 (주석 해제)
app.post("/execute", executionLimit, executeHandler);

// executionLimit이 통과되면 req.executionInfo 에 남은 횟수 정보가 담김
// req.executionInfo.remaining → 남은 실행 횟수
```

### 홍재창 (프론트) → API 호출 예시

```js
// NFT 목록
const res = await fetch("/nfts");

// 내 NFT
const res = await fetch("/my-nfts", {
  headers: { "x-wallet-address": walletAddress }
});

// 민팅 저장 (블록체인 민팅 성공 후)
const res = await fetch("/mint", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ token_id, title, prompt_encrypted, creator_address, price })
});

// 구매 (블록체인 transfer 성공 후)
const res = await fetch("/buy", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ token_id, buyer_address, price, tx_hash })
});
```

### 홍인석 (컨트랙트) → 흐름

1. 블록체인에서 `mint()` 성공 → tokenId 발급
2. 프론트가 `POST /mint`로 서버에 메타데이터 저장
3. 블록체인에서 `buy/transfer` 성공 → `POST /buy`로 소유자 변경
