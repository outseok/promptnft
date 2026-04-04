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
  checkAdmin,
  adminDeleteNFT,
  adminForceDelist,
  setWalletHeader,
  getDBTables,
  getDBTableData,
} from "./api";
import {
  onChainMint,
  onChainBuy,
  onChainListForSale,
  onChainCancelListing,
  onChainLazyMintAndBuy,
  onChainRecordUsage,
  getOnChainUsage,
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
  const [isAdminUser, setIsAdminUser] = useState(false);

  // ── 민팅 폼 ──
  const [mintForm, setMintForm] = useState({
    title: "",
    description: "",
    prompt: "",
    price: "0.01",
    category: "general",
    mintMode: "direct",     // 'direct' = 직접 민팅, 'lazy' = 거래 시 민팅
    maxExecutions: "50",    // 최대 사용 횟수
  });

  // ── 실행 폼 ──
  const [execTokenId, setExecTokenId] = useState("");
  const [execInput, setExecInput] = useState("");
  const [execResult, setExecResult] = useState(null);

  // ── DB 뷰어 (관리자) ──
  const [dbTables, setDbTables] = useState([]);
  const [dbSelectedTable, setDbSelectedTable] = useState("");
  const [dbTableData, setDbTableData] = useState([]);

  // NFT 목록 로드
  useEffect(() => {
    loadNFTs();
  }, []);

  useEffect(() => {
    if (wallet.account) {
      setWalletHeader(wallet.account);
      loadMyNFTs();
      checkAdmin().then((r) => setIsAdminUser(r.isAdmin)).catch(() => setIsAdminUser(false));
    } else {
      setWalletHeader(null);
      setIsAdminUser(false);
      setExecResult(null);
      setExecTokenId("");
      setExecInput("");
    }
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

  // ── 민팅 (직접 민팅 or 거래 시 민팅) ──
  async function handleMint(e) {
    e.preventDefault();
    if (!wallet.isConnected) {
      setMessage("지갑을 먼저 연결하세요!");
      return;
    }
    setLoading(true);
    setMessage("");

    const isLazy = mintForm.mintMode === "lazy";
    const usageLimit = Number(mintForm.maxExecutions) || 50;

    try {
      const tokenURI = JSON.stringify({
        title: mintForm.title,
        description: mintForm.description,
        category: mintForm.category,
      });

      let finalTokenId;
      let txHash = null;

      if (isLazy) {
        // ── 거래 시 민팅: 백엔드에만 등록 (온체인 민팅 없음) ──
        setMessage("거래 시 민팅 등록 중... (온체인 민팅은 구매 시 발생)");

        // 프롬프트 암호화 먼저
        await encryptPrompt({
          tokenId: "__lazy_pending__",
          promptContent: mintForm.prompt,
          walletAddress: wallet.account,
        });

        // 백엔드에 lazy 등록
        const mintRes = await mintNFT({
          title: mintForm.title,
          description: mintForm.description,
          prompt_encrypted: "[encrypted]",
          creator_address: wallet.account,
          price: mintForm.price,
          category: mintForm.category,
          mint_mode: "lazy",
          max_executions: usageLimit,
        });

        finalTokenId = mintRes.data.token_id;

        // 프롬프트 암호화 업데이트 (실제 tokenId로)
        await encryptPrompt({
          tokenId: finalTokenId,
          promptContent: mintForm.prompt,
          walletAddress: wallet.account,
        });

        setMessage(`거래 시 민팅 등록 완료! (ID: ${finalTokenId}) — 구매자가 나타나면 자동 민팅됩니다.`);
      } else {
        // ── 직접 민팅: 온체인 + 백엔드 ──
        setMessage("MetaMask에서 민팅 트랜잭션을 승인해주세요...");
        const result = await onChainMint(wallet.signer, tokenURI, usageLimit);
        txHash = result.txHash;
        finalTokenId = result.tokenId ?? (await getNextTokenId(wallet.provider) - 1);

        setMessage(`온체인 민팅 완료 (tx: ${txHash.slice(0, 10)}...) 백엔드 저장 중...`);

        // 프롬프트 암호화 저장
        await encryptPrompt({
          tokenId: finalTokenId,
          promptContent: mintForm.prompt,
          walletAddress: wallet.account,
        });

        // NFT 메타데이터 백엔드 저장
        await mintNFT({
          token_id: finalTokenId,
          title: mintForm.title,
          description: mintForm.description,
          prompt_encrypted: "[encrypted]",
          creator_address: wallet.account,
          price: mintForm.price,
          category: mintForm.category,
          mint_mode: "direct",
          max_executions: usageLimit,
        });

        // 온체인 판매 등록
        if (Number(mintForm.price) > 0) {
          setMessage(`NFT #${finalTokenId} 민팅 완료! 판매 등록 중...`);
          await onChainListForSale(wallet.signer, finalTokenId, String(mintForm.price));
        }

        setMessage(`NFT #${finalTokenId} 민팅 + 판매 등록 성공! (tx: ${txHash.slice(0, 10)}...)`);
      }

      setMintForm({ title: "", description: "", prompt: "", price: "0.01", category: "general", mintMode: mintForm.mintMode, maxExecutions: "50" });
      loadNFTs();
      loadMyNFTs();
    } catch (err) {
      const msg = err.reason || err.response?.data?.error || err.message;
      setMessage("민팅 실패: " + msg);
    } finally {
      setLoading(false);
    }
  }

  // ── 구매 (직접 민팅 NFT or 거래 시 민팅 NFT) ──
  async function handleBuy(nft) {
    if (!wallet.isConnected) {
      setMessage("지갑을 먼저 연결하세요!");
      return;
    }
    setLoading(true);
    setMessage("");

    try {
      const isLazy = nft.mint_mode === "lazy" && !nft.is_minted;

      if (isLazy) {
        // ── 거래 시 민팅: lazyMintAndBuy 호출 ──
        setMessage("MetaMask에서 Lazy Mint + 구매 트랜잭션을 승인해주세요...");
        const tokenURI = JSON.stringify({
          title: nft.title,
          description: nft.description,
          category: nft.category,
        });

        const { tokenId: newTokenId, txHash } = await onChainLazyMintAndBuy(
          wallet.signer,
          tokenURI,
          nft.creator_address,
          nft.max_executions || 50,
          String(nft.price)
        );

        setMessage(`온체인 민팅+구매 완료 (tx: ${txHash.slice(0, 10)}...) 백엔드 동기화 중...`);

        // 백엔드 DB 업데이트 (lazy → 실제 tokenId)
        await buyNFT({
          token_id: nft.token_id,
          buyer_address: wallet.account,
          price: nft.price,
          tx_hash: txHash,
          new_token_id: newTokenId,
        });

        setMessage(`NFT #${newTokenId} Lazy Mint + 구매 성공! Etherscan: https://sepolia.etherscan.io/tx/${txHash}`);
      } else {
        // ── 일반 구매 (이미 온체인에 존재하는 NFT) ──
        setMessage("MetaMask에서 구매 트랜잭션을 승인해주세요...");
        const txHash = await onChainBuy(wallet.signer, nft.token_id, String(nft.price));

        setMessage(`온체인 구매 완료 (tx: ${txHash.slice(0, 10)}...) 백엔드 동기화 중...`);

        await buyNFT({
          token_id: nft.token_id,
          buyer_address: wallet.account,
          price: nft.price,
          tx_hash: txHash,
        });

        setMessage(`NFT #${nft.token_id} 구매 성공! Etherscan: https://sepolia.etherscan.io/tx/${txHash}`);
      }

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

  // ── 프롬프트 실행 (on-chain 사용 기록 + AI 호출) ──
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
      // 1. on-chain 사용 기록 (Etherscan에 영구 기록)
      setMessage("MetaMask에서 사용 기록 트랜잭션을 승인해주세요... (Etherscan에 기록됩니다)");
      try {
        await onChainRecordUsage(wallet.signer, Number(execTokenId));
      } catch (chainErr) {
        const reason = chainErr.reason || chainErr.message || "";
        if (reason.includes("Usage limit reached")) {
          setMessage("실행 실패: 사용 횟수가 모두 소진되었습니다 (on-chain).");
          setLoading(false);
          return;
        }
        // 온체인 기록 실패 시 (네트워크 문제 등) 백엔드만으로 진행
        console.warn("온체인 사용 기록 실패 (DB 폴백):", reason);
      }

      // 2. 서명 + 실행 요청
      setMessage("AI 실행 중...");
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
          "x-contract-address": getContractAddress(),
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

  // ── 관리자: NFT 삭제 ──
  async function handleAdminDelete(tokenId) {
    if (!confirm(`NFT #${tokenId}을(를) 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`)) return;
    setLoading(true);
    try {
      await adminDeleteNFT(tokenId);
      setMessage(`[관리자] NFT #${tokenId} 삭제 완료`);
      loadNFTs();
      loadMyNFTs();
    } catch (err) {
      setMessage("삭제 실패: " + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  }

  // ── 관리자: 판매 강제 중지 ──
  async function handleAdminDelist(tokenId) {
    setLoading(true);
    try {
      await adminForceDelist(tokenId);
      setMessage(`[관리자] NFT #${tokenId} 판매 강제 중지`);
      loadNFTs();
    } catch (err) {
      setMessage("판매 중지 실패: " + (err.response?.data?.error || err.message));
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
              {isAdminUser && <span className="badge admin">관리자</span>}
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
        {isAdminUser && (
          <button className={tab === "settings" ? "active" : ""} onClick={() => setTab("settings")}>
            설정
          </button>
        )}
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
                    <span className="token-id">#{nft.token_id >= 0 ? nft.token_id : `L${Math.abs(nft.token_id)}`}</span>
                    {nft.mint_mode === "lazy" && !nft.is_minted ? (
                      <span className="badge lazy">거래 시 민팅</span>
                    ) : nft.is_for_sale ? (
                      <span className="badge sale">판매중</span>
                    ) : (
                      <span className="badge">보유중</span>
                    )}
                    {nft.execution_count > 0 && nft.creator_address !== nft.owner_address && (
                      <span className="badge resale">재판매</span>
                    )}
                  </div>
                  <h3>{nft.title}</h3>
                  <p className="description">{nft.description || "설명 없음"}</p>
                  <div className="nft-meta">
                    <span>가격: {nft.price} ETH</span>
                    <span>카테고리: {nft.category || "-"}</span>
                    <span>사용: {nft.execution_count}/{nft.max_executions}회</span>
                  </div>
                  <p className="owner">
                    {nft.mint_mode === "lazy" && !nft.is_minted
                      ? `창작자: ${nft.creator_address?.slice(0, 8)}...`
                      : `소유자: ${nft.owner_address?.slice(0, 8)}...`}
                  </p>
                  {nft.is_for_sale && wallet.isConnected && nft.owner_address !== wallet.account?.toLowerCase() && (
                    <button
                      onClick={() => handleBuy(nft)}
                      className="btn btn-primary"
                      disabled={loading}
                    >
                      {nft.mint_mode === "lazy" && !nft.is_minted ? "민팅 + 구매" : "구매하기"}
                    </button>
                  )}
                  {isAdminUser && (
                    <div className="admin-actions">
                      {nft.is_for_sale && (
                        <button onClick={() => handleAdminDelist(nft.token_id)} className="btn btn-outline btn-sm" disabled={loading}>
                          판매 중지
                        </button>
                      )}
                      <button onClick={() => handleAdminDelete(nft.token_id)} className="btn btn-danger btn-sm" disabled={loading}>
                        삭제
                      </button>
                    </div>
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
                    {nft.creator_address !== nft.owner_address && (
                      <span className="badge resale">구매함</span>
                    )}
                  </div>
                  <h3>{nft.title}</h3>
                  <p className="description">{nft.description || "설명 없음"}</p>
                  <div className="nft-meta">
                    <span>사용: {nft.execution_count}/{nft.max_executions}회</span>
                    <span>잔여: {(nft.max_executions || 50) - (nft.execution_count || 0)}회</span>
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
                <label>민팅 방식</label>
                <div className="mint-mode-toggle">
                  <label className={`toggle-option ${mintForm.mintMode === "direct" ? "active" : ""}`}>
                    <input
                      type="radio"
                      name="mintMode"
                      value="direct"
                      checked={mintForm.mintMode === "direct"}
                      onChange={(e) => setMintForm({ ...mintForm, mintMode: e.target.value })}
                    />
                    직접 민팅 (즉시 온체인)
                  </label>
                  <label className={`toggle-option ${mintForm.mintMode === "lazy" ? "active" : ""}`}>
                    <input
                      type="radio"
                      name="mintMode"
                      value="lazy"
                      checked={mintForm.mintMode === "lazy"}
                      onChange={(e) => setMintForm({ ...mintForm, mintMode: e.target.value })}
                    />
                    거래 시 민팅 (구매 시 온체인)
                  </label>
                </div>
                <p className="hint">
                  {mintForm.mintMode === "direct"
                    ? "즉시 온체인에 NFT를 생성합니다. MetaMask 승인 2회 (민팅 + 판매등록)"
                    : "데이터만 등록하고 구매자가 나타나면 자동으로 온체인 민팅됩니다. MetaMask 승인 불필요."}
                </p>
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
                  <label>최대 사용 횟수</label>
                  <input
                    type="number"
                    min="1"
                    max="10000"
                    value={mintForm.maxExecutions}
                    onChange={(e) => setMintForm({ ...mintForm, maxExecutions: e.target.value })}
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
                {loading ? "민팅 중..." : mintForm.mintMode === "lazy" ? "등록하기 (온체인 민팅 없음)" : "민팅하기"}
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
                    <span>사용 횟수: {execResult.usageCount}/{execResult.usageLimit || "?"}</span>
                    <span>남은 횟수: {execResult.usageLeft}</span>
                    <span>📋 Etherscan에서 사용 기록 확인 가능</span>
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

          {/* ── DB 뷰어 (관리자 전용) ── */}
          <h2 style={{marginTop: "2rem"}}>DB 조회</h2>
          <div className="db-viewer">
            <button
              onClick={async () => {
                try {
                  const res = await getDBTables();
                  setDbTables(res.tables || []);
                  setDbSelectedTable("");
                  setDbTableData([]);
                } catch (err) {
                  setMessage("DB 조회 실패: " + (err.response?.data?.error || err.message));
                }
              }}
              className="btn btn-outline"
              disabled={loading}
            >
              테이블 목록 로드
            </button>

            {dbTables.length > 0 && (
              <div className="db-tables">
                <h3>테이블 목록</h3>
                <div className="table-list">
                  {dbTables.map((t) => (
                    <button
                      key={t.name}
                      onClick={async () => {
                        try {
                          const res = await getDBTableData(t.name);
                          setDbSelectedTable(t.name);
                          setDbTableData(res.data || []);
                        } catch (err) {
                          setMessage("테이블 데이터 조회 실패: " + (err.response?.data?.error || err.message));
                        }
                      }}
                      className={`btn btn-sm ${dbSelectedTable === t.name ? "btn-primary" : "btn-outline"}`}
                    >
                      {t.name} ({t.count})
                    </button>
                  ))}
                </div>
              </div>
            )}

            {dbSelectedTable && dbTableData.length > 0 && (
              <div className="db-data">
                <h3>{dbSelectedTable} (최근 100건)</h3>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        {Object.keys(dbTableData[0]).map((col) => (
                          <th key={col}>{col}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {dbTableData.map((row, i) => (
                        <tr key={i}>
                          {Object.values(row).map((val, j) => (
                            <td key={j}>{String(val ?? "").slice(0, 80)}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {dbSelectedTable && dbTableData.length === 0 && (
              <p className="empty">테이블에 데이터가 없습니다.</p>
            )}
          </div>
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
