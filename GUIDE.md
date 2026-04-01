# PromptNFT 실행 가이드

AI 프롬프트를 NFT로 만들어 거래하는 마켓플레이스입니다.

## 사전 준비

| 항목 | 설명 |
|------|------|
| **Node.js** | v18 이상 (v24 권장) |
| **MetaMask** | 브라우저 확장 프로그램 설치 |
| **Sepolia ETH** | 테스트넷 코인 ([faucet](https://sepoliafaucet.com)) |
| **OpenAI API Key** | GPT 실행용 (없으면 데모 모드) |

## 1. 설치

```bash
# 프로젝트 클론
git clone https://github.com/outseok/promptnft.git
cd promptnft
git checkout integrated

# 루트 의존성
npm install

# 백엔드 의존성
cd backend
npm install

# 프론트엔드 의존성
cd ../frontend
npm install
```

## 2. 환경변수 설정

### backend/.env

```env
ALCHEMY_SEPOLIA_URL=https://rpc.sepolia.org
CONTRACT_ADDRESS=0x4187Cf6910659B75D9e90072304A5721A3Ef0E5b
ENCRYPT_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
PORT=3001
FRONTEND_URL=http://localhost:5173
DEMO_MODE=true
LOG_LEVEL=info

# 실제 AI 실행을 원하면 본인 OpenAI API 키 입력
OPENAI_API_KEY=sk-your-key-here
OPENAI_MODEL=gpt-4o-mini
```

> `OPENAI_API_KEY`가 비어있으면 데모 응답이 반환됩니다.

### 루트 .env (스마트 컨트랙트 배포용, 선택사항)

```env
SEPOLIA_RPC_URL=https://rpc.sepolia.org
PRIVATE_KEY=your-private-key
```

## 3. 서버 실행

터미널 2개를 열어서 각각 실행합니다.

**터미널 1 — 백엔드 (포트 3001)**

```bash
cd backend
node server.js
```

**터미널 2 — 프론트엔드 (포트 5173)**

```bash
cd frontend
npx vite --host
```

브라우저에서 **http://localhost:5173** 접속

## 4. 사용 흐름

### 4-1. 지갑 연결

1. 페이지 상단 **지갑 연결** 버튼 클릭
2. MetaMask 팝업에서 **Sepolia 테스트넷** 선택 후 승인
3. 연결된 지갑 주소가 상단에 표시됨

### 4-2. 컨트랙트 배포 (최초 1회)

1. **설정** 탭 이동
2. **새 컨트랙트 배포 (MetaMask)** 버튼 클릭
3. MetaMask에서 트랜잭션 승인 (Sepolia ETH 소모)
4. 배포 완료 후 컨트랙트 주소가 자동 저장됨

> 이미 배포된 컨트랙트가 있으면 이 단계를 건너뛸 수 있습니다.

### 4-3. NFT 민팅

1. **민팅** 탭 이동
2. 제목, 설명, AI 프롬프트, 가격, 카테고리 입력
3. **민팅하기** 클릭
4. MetaMask 승인 **2번** (민팅 + 판매 등록)
5. 마켓플레이스에 자동 등록됨

### 4-4. NFT 구매

1. **마켓플레이스** 탭에서 "판매중" NFT 확인
2. **구매하기** 클릭
3. MetaMask에서 ETH 전송 승인
4. 구매 완료 → **내 NFT** 탭에서 확인

### 4-5. 프롬프트 실행 (NFT 소유자만)

1. **실행** 탭 이동
2. 보유한 NFT의 Token ID 입력
3. 입력 메시지 작성
4. **실행하기** 클릭
5. AI가 NFT에 저장된 프롬프트를 기반으로 응답 생성

> NFT를 소유하지 않으면 실행이 거부됩니다.

### 4-6. 판매 관리

1. **내 NFT** 탭에서 보유 NFT 확인
2. **판매 시작/중지** 버튼으로 온체인 판매 상태 토글
3. MetaMask에서 트랜잭션 승인

### 4-7. 계정 전환

1. **연결 해제** 클릭
2. **지갑 연결** 다시 클릭
3. MetaMask에서 다른 계정 선택

## 5. 스마트 컨트랙트 테스트

```bash
# 루트 디렉토리에서
npx hardhat compile
npx hardhat test
```

3개 테스트 통과:
- ✅ 누구나 mint 가능
- ✅ 로열티 + 소유권 이전
- ✅ hasAccess 확인

## 6. 프로젝트 구조

```
promptnft/
├── backend/               # Express 백엔드 (포트 3001)
│   ├── routes/            # API 라우트 (mint, buy, execute, nfts, encrypt, nonce)
│   ├── utils/             # DB, 블록체인, 암호화, 로거, 캐시
│   ├── abi/               # 스마트 컨트랙트 ABI
│   ├── middleware/        # 인증, 실행 제한, 속도 제한
│   └── server.js          # 메인 서버
├── frontend/              # React + Vite 프론트엔드 (포트 5173)
│   └── src/
│       ├── App.jsx        # 메인 UI (마켓/내NFT/민팅/실행/설정)
│       ├── api.js         # 백엔드 API 클라이언트
│       ├── contract.js    # 스마트 컨트랙트 연동 (MetaMask)
│       ├── hooks/         # useWallet 훅
│       ├── abi.json       # 컨트랙트 ABI
│       └── bytecode.json  # 컨트랙트 바이트코드 (프론트 배포용)
├── contracts/             # Solidity 스마트 컨트랙트
│   └── PromptNFT.sol      # ERC-721 + ERC-2981 (로열티)
├── test/                  # Hardhat 테스트
├── scripts/               # 배포 스크립트
└── hardhat.config.js      # Hardhat 설정
```

## 7. API 엔드포인트

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/api/nfts` | 전체 NFT 목록 |
| GET | `/api/nfts?sale=1` | 판매 중 NFT |
| GET | `/api/nfts/:tokenId` | NFT 상세 |
| GET | `/api/my-nfts` | 내 NFT (x-wallet-address 헤더) |
| POST | `/api/mint` | 민팅 데이터 저장 |
| POST | `/api/buy` | 구매 처리 |
| PATCH | `/api/nfts/:tokenId/sale` | 판매 상태 변경 |
| POST | `/api/encrypt` | 프롬프트 암호화 저장 |
| POST | `/api/execute` | 프롬프트 실행 (AI) |
| GET | `/api/nonce?wallet=` | 서명용 nonce 발급 |

## 8. 기술 스택

- **스마트 컨트랙트**: Solidity 0.8.24, Hardhat, OpenZeppelin (ERC-721 + ERC-2981)
- **백엔드**: Node.js, Express, sql.js (SQLite), ethers.js, OpenAI SDK
- **프론트엔드**: React 19, Vite, ethers.js, axios
- **블록체인**: Ethereum Sepolia 테스트넷
- **지갑**: MetaMask

## 9. 팀 구성

| 이름 | 역할 |
|------|------|
| 홍인석 | 스마트 컨트랙트 |
| 최유리 | 보안 (암호화/소유권 검증) |
| 장우혁 | 백엔드 API |
| 홍재창 | 프론트엔드 |

## 10. 트러블슈팅

| 문제 | 해결 |
|------|------|
| MetaMask 연결 안 됨 | Sepolia 네트워크로 전환 |
| 민팅 시 토큰 중복 에러 | 새로고침 후 재시도 |
| 실행 시 "미보유" 에러 | RPC 불안정 시 DB 폴백 자동 작동 |
| 구매 시 "Not listed" | 소유자가 판매 상태 토글 필요 |
| 타임아웃 | 네트워크 상태에 따라 대기 (타임아웃 제한 없음) |
