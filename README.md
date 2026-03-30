# PromptNFT Smart Contract (ERC-721)

요구사항 기준으로 아래 기능을 포함합니다.

- ERC-721 NFT 발행 (`mint`)
- 판매 등록 (`listForSale`)
- 구매 (`buy`) + 자동 소유권 이전
- 로열티 10% (`ERC2981`, 기본 1000 bps)
- Sepolia 배포 스크립트
- Hoodi 배포 스크립트
- 권한 판단: `hasAccess(address)` → NFT 1개 이상 보유 시 `true`

## 1) 설치

```bash
npm install
```

## 2) 환경변수

`.env.example`를 복사해 `.env` 생성 후 값 입력

```bash
cp .env.example .env
```

Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

필수값:

- `SEPOLIA_RPC_URL`
- `HOODI_RPC_URL`
- `HOODI_CHAIN_ID` (기본값 560048)
- `PRIVATE_KEY`
- `ETHERSCAN_API_KEY` (검증 안 하면 생략 가능)
- `ROYALTY_RECEIVER` (미입력 시 배포자 주소)

## 3) 컴파일

```bash
npm run compile
```

## 4) Sepolia 배포

```bash
npm run deploy:sepolia
```

## 5) Hoodi 배포

```bash
npm run deploy:hoodi
```

## 6) 테스트

```bash
npm run test
```

Windows PowerShell에서 실행 정책 이슈가 있으면:

```powershell
npm.cmd run test
```

## 7) Hoodi E2E(민팅→판매→구매)

```bash
CONTRACT_ADDRESS=배포주소 npm run e2e:hoodi
```

Windows PowerShell:

```powershell
$env:CONTRACT_ADDRESS='배포주소'; npm.cmd run e2e:hoodi
```

위 명령은 아래를 자동 검증합니다.

- 테스트용 buyer 지갑 생성 + ETH 전송
- 민팅
- 판매 등록
- 구매 실행
- `ownerOf`, `hasAccess`, `listing.active` 검증

## 8) 사용 플로우

1. 오너가 `mint(to, tokenURI)` 호출
2. 소유자가 `listForSale(tokenId, price)` 호출
3. 구매자가 `buy(tokenId)` 호출 (`msg.value == price`)
4. 컨트랙트가 자동으로
   - 로열티 10% 지급
   - 판매자 대금 지급
   - NFT 소유권 이전

## 9) 눈으로 확인하는 수동 페이지

로컬에서 수동 확인 페이지 실행:

```bash
npm run viewer
```

Windows PowerShell:

```powershell
npm.cmd run viewer
```

브라우저 접속:

- http://localhost:5174

지원 버튼:

- 지갑 연결 (MetaMask)
- mint
- listForSale
- buy
- ownerOf 조회
- hasAccess 조회
- nextTokenId 조회

## 핵심 포인트

- 이 프로젝트의 권한은 NFT 보유 여부로 판단
- 백엔드/미들웨어에서 `hasAccess(userAddress)` 또는 `balanceOf(userAddress) > 0` 로 인증 가능
