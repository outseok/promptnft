// src/App.jsx - PromptNFT 메인 UI
// 담당: 홍재창 (프론트엔드)

import { useState, useEffect } from "react";
import { useWallet } from "./hooks/useWallet";
import {
  getNFTs,
  getMyNFTs,
  mintNFT,
  buyNFT,
  encryptPrompt,
  executePrompt,
  updateSaleStatus,
} from "./api";
import {
  onChainMint,
  onChainBuy,
  onChainListForSale,
  onChainCancelListing,
  getNextTokenId,
  deployContract,
  getContractAddress,
} from "./contract";
import "./App.css";

function App() {
  const wallet = useWallet();
  const [tab, setTab] = useState("market");
  const [nfts, setNfts] = useState([]);
  const [myNfts, setMyNfts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [contractAddr, setContractAddr] = useState(getContractAddress());

  // ── 민팅 폼 ──
  const [mintForm, setMintForm] = useState({
    title: "",
    description: "",
    prompt: "",
    price: "0.01",
    category: "general",
  });

  // ── 실행 폼 ──
  const [execTokenId, setExecTokenId] = useState("");
  const [execInput, setExecInput] = useState("");
  const [execResult, setExecResult] = useState(null);

  // NFT 목록 로드
  useEffect(() => {
    loadNFTs();
  }, []);

  useEffect(() => {
    if (wallet.account) loadMyNFTs();
  }, [wallet.account]);

  async function loadNFTs() {
    try {
      const res = await getNFTs();
      setNfts(res.data || []);
    } catch {
      setNfts([]);
    }
  }

  async function loadMyNFTs() {
    try {
      const res = await getMyNFTs();
      setMyNfts(res.data || []);
    } catch {
      setMyNfts([]);
    }
  }

  // ── 민팅 (온체인 + 백엔드) ──
  async function handleMint(e) {
    e.preventDefault();
    if (!wallet.isConnected) {
      setMessage("지갑을 먼저 연결하세요!");
      return;
    }
    setLoading(true);
    setMessage("");

    try {
      // 1. 온체인 민팅 (MetaMask 트랜잭션)
      setMessage("MetaMask에서 민팅 트랜잭션을 승인해주세요...");
      const tokenURI = JSON.stringify({
        title: mintForm.title,
        description: mintForm.description,
        category: mintForm.category,
      });

      const { tokenId, txHash } = await onChainMint(wallet.signer, tokenURI);

      const finalTokenId = tokenId ?? (await getNextTokenId(wallet.provider) - 1);

      setMessage(`온체인 민팅 완료 (tx: ${txHash.slice(0, 10)}...) 백엔드 저장 중...`);

      // 2. 프롬프트 암호화 저장 (백엔드)
      await encryptPrompt({
        tokenId: finalTokenId,
        promptContent: mintForm.prompt,
        walletAddress: wallet.account,
      });

      // 3. NFT 메타데이터 백엔드 저장
      await mintNFT({
        token_id: finalTokenId,
        title: mintForm.title,
        description: mintForm.description,
        prompt_encrypted: "[encrypted]",
        creator_address: wallet.account,
        price: mintForm.price,
        category: mintForm.category,
      });

      // 4. 온체인 판매 등록 (민팅 후 자동으로 마켓에 올림)
      if (Number(mintForm.price) > 0) {
        setMessage(`NFT #${finalTokenId} 민팅 완료! 판매 등록 중...`);
        await onChainListForSale(wallet.signer, finalTokenId, String(mintForm.price));
      }

      setMessage(`NFT #${finalTokenId} 민팅 + 판매 등록 성공! (tx: ${txHash.slice(0, 10)}...)`);
      setMintForm({ title: "", description: "", prompt: "", price: "0.01", category: "general" });
      loadNFTs();
      loadMyNFTs();
    } catch (err) {
      const msg = err.reason || err.response?.data?.error || err.message;
      setMessage("민팅 실패: " + msg);
    } finally {
      setLoading(false);
    }
  }

  // ── 구매 (온체인 ETH 전송 + 백엔드 동기화) ──
  async function handleBuy(tokenId, price) {
    if (!wallet.isConnected) {
      setMessage("지갑을 먼저 연결하세요!");
      return;
    }
    setLoading(true);
    setMessage("");

    try {
      // 1. 온체인 구매 (MetaMask에서 ETH 전송 승인)
      setMessage("MetaMask에서 구매 트랜잭션을 승인해주세요...");
      const txHash = await onChainBuy(wallet.signer, tokenId, String(price));

      setMessage(`온체인 구매 완료 (tx: ${txHash.slice(0, 10)}...) 백엔드 동기화 중...`);

      // 2. 백엔드 DB 소유자 업데이트
      await buyNFT({
        token_id: tokenId,
        buyer_address: wallet.account,
        price: price,
        tx_hash: txHash,
      });

      setMessage(`NFT #${tokenId} 구매 성공! (tx: ${txHash.slice(0, 10)}...)`);
      loadNFTs();
      loadMyNFTs();
    } catch (err) {
      const msg = err.reason || err.response?.data?.error || err.message;
      if (msg === "Not listed") {
        setMessage("구매 실패: 이 NFT는 온체인에 판매 등록되지 않았습니다. 소유자가 판매 상태를 다시 토글해야 합니다.");
      } else {
        setMessage("구매 실패: " + msg);
      }
    } finally {
      setLoading(false);
    }
  }

  // ── 프롬프트 실행 (소유권 확인 후) ──
  async function handleExecute(e) {
    e.preventDefault();
    if (!wallet.isConnected) {
      setMessage("지갑을 먼저 연결하세요!");
      return;
    }
    setLoading(true);
    setMessage("");
    setExecResult(null);

    try {
      // 1. 서명 생성 (소유권은 백엔드에서 온체인 검증)
      const { nonce, signature } = await wallet.signMessage();

      // 2. 실행 요청
      const res = await executePrompt(
        {
          tokenId: Number(execTokenId),
          userMessage: execInput,
        },
        {
          "x-wallet-address": wallet.account,
          "x-signature": signature,
          "x-nonce": nonce,
        }
      );

      setExecResult(res);
      setMessage("실행 성공!");
    } catch (err) {
      const msg = err.reason || err.response?.data?.error || err.message;
      setMessage("실행 실패: " + msg);
    } finally {
      setLoading(false);
    }
  }

  // ── 판매 상태 토글 (온체인) ──
  async function handleToggleSale(tokenId, currentSale, price) {
    if (!wallet.isConnected) {
      setMessage("지갑을 먼저 연결하세요!");
      return;
    }
    setLoading(true);
    setMessage("");

    try {
      if (currentSale) {
        // 판매 취소 (온체인)
        setMessage("MetaMask에서 판매 취소 트랜잭션을 승인해주세요...");
        await onChainCancelListing(wallet.signer, tokenId);
      } else {
        // 판매 등록 (온체인)
        setMessage("MetaMask에서 판매 등록 트랜잭션을 승인해주세요...");
        await onChainListForSale(wallet.signer, tokenId, String(price));
      }

      // 백엔드 DB 동기화
      await updateSaleStatus(tokenId, {
        is_for_sale: !currentSale,
        price: price,
      });

      setMessage(currentSale ? `NFT #${tokenId} 판매 중지` : `NFT #${tokenId} 판매 시작`);
      loadNFTs();
      loadMyNFTs();
    } catch (err) {
      const msg = err.reason || err.response?.data?.error || err.message;
      setMessage("판매 상태 변경 실패: " + msg);
    } finally {
      setLoading(false);
    }
  }

  // ── 컨트랙트 배포 (MetaMask로 — 프라이빗 키 불필요) ──
  async function handleDeploy() {
    if (!wallet.isConnected) {
      setMessage("지갑을 먼저 연결하세요!");
      return;
    }
    if (wallet.chainId !== 11155111) {
      setMessage("Sepolia 네트워크로 전환해주세요! (현재: " + wallet.chainId + ")");
      return;
    }
    setLoading(true);
    setMessage("MetaMask에서 컨트랙트 배포 트랜잭션을 승인해주세요... (가스비 필요)");

    try {
      const address = await deployContract(wallet.signer);
      setContractAddr(address);
      setMessage(`컨트랙트 배포 완료! 주소: ${address}`);
    } catch (err) {
      const msg = err.reason || err.message;
      setMessage("배포 실패: " + msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app">
      {/* ── 헤더 ── */}
      <header className="header">
        <h1>PromptNFT</h1>
        <p className="subtitle">AI 프롬프트 NFT 마켓플레이스</p>
        <div className="wallet-section">
          {wallet.isConnected ? (
            <div className="wallet-info">
              <span className="wallet-address">
                {wallet.account.slice(0, 6)}...{wallet.account.slice(-4)}
              </span>
              <button onClick={wallet.disconnect} className="btn btn-outline">
                연결 해제
              </button>
            </div>
          ) : (
            <button onClick={wallet.connect} className="btn btn-primary" disabled={wallet.loading}>
              {wallet.loading ? "연결 중..." : "MetaMask 연결"}
            </button>
          )}
        </div>
        {wallet.error && <p className="error">{wallet.error}</p>}
      </header>

      {/* ── 메시지 ── */}
      {message && (
        <div className={`message ${message.includes("실패") ? "error" : "success"}`}>
          {message}
          <button onClick={() => setMessage("")} className="close-btn">×</button>
        </div>
      )}

      {/* ── 탭 네비게이션 ── */}
      <nav className="tabs">
        <button className={tab === "market" ? "active" : ""} onClick={() => setTab("market")}>
          마켓플레이스
        </button>
        <button className={tab === "my" ? "active" : ""} onClick={() => setTab("my")}>
          내 NFT
        </button>
        <button className={tab === "mint" ? "active" : ""} onClick={() => setTab("mint")}>
          민팅
        </button>
        <button className={tab === "execute" ? "active" : ""} onClick={() => setTab("execute")}>
          실행
        </button>
        <button className={tab === "settings" ? "active" : ""} onClick={() => setTab("settings")}>
          설정
        </button>
      </nav>

      {/* ── 마켓플레이스 ── */}
      {tab === "market" && (
        <section className="section">
          <h2>마켓플레이스</h2>
          <button onClick={loadNFTs} className="btn btn-outline refresh-btn">새로고침</button>
          {nfts.length === 0 ? (
            <p className="empty">등록된 NFT가 없습니다. 첫 번째 NFT를 민팅해보세요!</p>
          ) : (
            <div className="nft-grid">
              {nfts.map((nft) => (
                <div key={nft.token_id} className="nft-card">
                  <div className="nft-card-header">
                    <span className="token-id">#{nft.token_id}</span>
                    {nft.is_for_sale ? (
                      <span className="badge sale">판매중</span>
                    ) : (
                      <span className="badge">보유중</span>
                    )}
                  </div>
                  <h3>{nft.title}</h3>
                  <p className="description">{nft.description || "설명 없음"}</p>
                  <div className="nft-meta">
                    <span>가격: {nft.price} ETH</span>
                    <span>카테고리: {nft.category || "-"}</span>
                    <span>실행: {nft.execution_count}/{nft.max_executions}</span>
                  </div>
                  <p className="owner">소유자: {nft.owner_address?.slice(0, 8)}...</p>
                  {nft.is_for_sale && wallet.isConnected && nft.owner_address !== wallet.account?.toLowerCase() && (
                    <button
                      onClick={() => handleBuy(nft.token_id, nft.price)}
                      className="btn btn-primary"
                      disabled={loading}
                    >
                      구매하기
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ── 내 NFT ── */}
      {tab === "my" && (
        <section className="section">
          <h2>내 NFT</h2>
          {!wallet.isConnected ? (
            <p className="empty">지갑을 연결하면 내 NFT를 볼 수 있습니다.</p>
          ) : myNfts.length === 0 ? (
            <p className="empty">보유한 NFT가 없습니다.</p>
          ) : (
            <div className="nft-grid">
              {myNfts.map((nft) => (
                <div key={nft.token_id} className="nft-card owned">
                  <div className="nft-card-header">
                    <span className="token-id">#{nft.token_id}</span>
                    <span className={`badge ${nft.is_for_sale ? "sale" : ""}`}>
                      {nft.is_for_sale ? "판매중" : "보유중"}
                    </span>
                  </div>
                  <h3>{nft.title}</h3>
                  <p className="description">{nft.description || "설명 없음"}</p>
                  <div className="nft-meta">
                    <span>실행: {nft.execution_count}/{nft.max_executions}</span>
                  </div>
                  <div className="nft-actions">
                    <button
                      onClick={() => handleToggleSale(nft.token_id, nft.is_for_sale, nft.price)}
                      className="btn btn-outline"
                    >
                      {nft.is_for_sale ? "판매 중지" : "판매 등록"}
                    </button>
                    <button
                      onClick={() => { setTab("execute"); setExecTokenId(String(nft.token_id)); }}
                      className="btn btn-primary"
                    >
                      실행하기
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ── 민팅 ── */}
      {tab === "mint" && (
        <section className="section">
          <h2>NFT 민팅</h2>
          {!wallet.isConnected ? (
            <p className="empty">지갑을 연결해야 민팅할 수 있습니다.</p>
          ) : (
            <form onSubmit={handleMint} className="form">
              <div className="form-group">
                <label>제목</label>
                <input
                  type="text"
                  value={mintForm.title}
                  onChange={(e) => setMintForm({ ...mintForm, title: e.target.value })}
                  placeholder="NFT 프롬프트 제목"
                  required
                />
              </div>
              <div className="form-group">
                <label>설명</label>
                <input
                  type="text"
                  value={mintForm.description}
                  onChange={(e) => setMintForm({ ...mintForm, description: e.target.value })}
                  placeholder="프롬프트에 대한 설명"
                />
              </div>
              <div className="form-group">
                <label>프롬프트 원문 (암호화됨)</label>
                <textarea
                  value={mintForm.prompt}
                  onChange={(e) => setMintForm({ ...mintForm, prompt: e.target.value })}
                  placeholder="AI에게 전달될 시스템 프롬프트를 입력하세요"
                  rows={4}
                  required
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>가격 (ETH)</label>
                  <input
                    type="text"
                    value={mintForm.price}
                    onChange={(e) => setMintForm({ ...mintForm, price: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>카테고리</label>
                  <select
                    value={mintForm.category}
                    onChange={(e) => setMintForm({ ...mintForm, category: e.target.value })}
                  >
                    <option value="general">일반</option>
                    <option value="writing">글쓰기</option>
                    <option value="coding">코딩</option>
                    <option value="art">아트</option>
                    <option value="business">비즈니스</option>
                  </select>
                </div>
              </div>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? "민팅 중..." : "민팅하기"}
              </button>
            </form>
          )}
        </section>
      )}

      {/* ── 실행 ── */}
      {tab === "execute" && (
        <section className="section">
          <h2>프롬프트 실행</h2>
          {!wallet.isConnected ? (
            <p className="empty">지갑을 연결해야 실행할 수 있습니다.</p>
          ) : (
            <>
              <form onSubmit={handleExecute} className="form">
                <div className="form-group">
                  <label>Token ID</label>
                  <input
                    type="number"
                    value={execTokenId}
                    onChange={(e) => setExecTokenId(e.target.value)}
                    placeholder="실행할 NFT의 Token ID"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>입력 메시지</label>
                  <textarea
                    value={execInput}
                    onChange={(e) => setExecInput(e.target.value)}
                    placeholder="AI에게 보낼 메시지를 입력하세요"
                    rows={3}
                    required
                  />
                </div>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? "실행 중... (MetaMask 서명 필요)" : "실행하기"}
                </button>
              </form>

              {execResult && (
                <div className="exec-result">
                  <h3>실행 결과</h3>
                  <pre>{execResult.result}</pre>
                  <div className="exec-meta">
                    <span>사용 횟수: {execResult.usageCount}</span>
                    <span>남은 횟수: {execResult.usageLeft}</span>
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      )}

      {/* ── 설정 ── */}
      {tab === "settings" && (
        <section className="section">
          <h2>컨트랙트 설정</h2>
          <div className="settings-info">
            <p><strong>현재 컨트랙트:</strong> <code>{contractAddr}</code></p>
            <p><strong>네트워크:</strong> {wallet.chainId === 11155111 ? "Sepolia ✅" : wallet.chainId ? `Chain ${wallet.chainId} (Sepolia로 전환 필요)` : "미연결"}</p>
          </div>
          {wallet.isConnected && (
            <div className="deploy-section">
              <p>새 컨트랙트를 배포하면 민팅/구매/판매가 이 컨트랙트에서 이루어집니다.</p>
              <p>MetaMask에서 트랜잭션을 승인하면 자동으로 배포됩니다. (Sepolia ETH 필요)</p>
              <button
                onClick={handleDeploy}
                className="btn btn-primary"
                disabled={loading}
              >
                {loading ? "배포 중..." : "새 컨트랙트 배포 (MetaMask)"}
              </button>
            </div>
          )}
        </section>
      )}

      {/* ── 푸터 ── */}
      <footer className="footer">
        <p>PromptNFT - AI 프롬프트 NFT 마켓플레이스</p>
        <p className="team">홍인석(컨트랙트) · 최유리(보안) · 장우혁(API) · 홍재창(프론트)</p>
      </footer>
    </div>
  );
}

export default App;
