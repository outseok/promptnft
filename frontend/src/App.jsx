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
import "./App.css";

function App() {
  const wallet = useWallet();
  const [tab, setTab] = useState("market");
  const [nfts, setNfts] = useState([]);
  const [myNfts, setMyNfts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  // ── 민팅 폼 ──
  const [mintForm, setMintForm] = useState({
    token_id: "",
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

  // ── 민팅 ──
  async function handleMint(e) {
    e.preventDefault();
    if (!wallet.isConnected) {
      setMessage("지갑을 먼저 연결하세요!");
      return;
    }
    setLoading(true);
    setMessage("");

    try {
      // 1. 프롬프트 암호화 저장
      await encryptPrompt({
        tokenId: Number(mintForm.token_id),
        promptContent: mintForm.prompt,
        walletAddress: wallet.account,
      });

      // 2. NFT 데이터 저장
      await mintNFT({
        token_id: Number(mintForm.token_id),
        title: mintForm.title,
        description: mintForm.description,
        prompt_encrypted: "[encrypted]",
        creator_address: wallet.account,
        price: mintForm.price,
        category: mintForm.category,
      });

      setMessage(`NFT #${mintForm.token_id} 민팅 성공!`);
      setMintForm({ token_id: "", title: "", description: "", prompt: "", price: "0.01", category: "general" });
      loadNFTs();
      loadMyNFTs();
    } catch (err) {
      setMessage("민팅 실패: " + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  }

  // ── 구매 ──
  async function handleBuy(tokenId, price) {
    if (!wallet.isConnected) {
      setMessage("지갑을 먼저 연결하세요!");
      return;
    }
    setLoading(true);
    setMessage("");

    try {
      await buyNFT({
        token_id: tokenId,
        buyer_address: wallet.account,
        price: price,
      });
      setMessage(`NFT #${tokenId} 구매 성공!`);
      loadNFTs();
      loadMyNFTs();
    } catch (err) {
      setMessage("구매 실패: " + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  }

  // ── 프롬프트 실행 ──
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
      // 서명 생성
      const { nonce, signature } = await wallet.signMessage();

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
      setMessage("실행 실패: " + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  }

  // ── 판매 상태 토글 ──
  async function handleToggleSale(tokenId, currentSale, price) {
    try {
      await updateSaleStatus(tokenId, {
        is_for_sale: !currentSale,
        price: price,
      });
      setMessage(currentSale ? `NFT #${tokenId} 판매 중지` : `NFT #${tokenId} 판매 시작`);
      loadNFTs();
      loadMyNFTs();
    } catch (err) {
      setMessage("판매 상태 변경 실패: " + (err.response?.data?.error || err.message));
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
                <label>Token ID</label>
                <input
                  type="number"
                  value={mintForm.token_id}
                  onChange={(e) => setMintForm({ ...mintForm, token_id: e.target.value })}
                  placeholder="예: 0, 1, 2..."
                  required
                />
              </div>
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

      {/* ── 푸터 ── */}
      <footer className="footer">
        <p>PromptNFT - AI 프롬프트 NFT 마켓플레이스</p>
        <p className="team">홍인석(컨트랙트) · 최유리(보안) · 장우혁(API) · 홍재창(프론트)</p>
      </footer>
    </div>
  );
}

export default App;
