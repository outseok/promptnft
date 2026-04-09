// pages/NFTDetail.jsx — NFT 상세 페이지 (다크 글래스모피즘 디자인)
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getNFTDetail, buyNFT } from '../api';
import { onChainBuy, onChainLazyMintAndBuy } from '../contract';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { useWallet } from '../context/WalletContext';
import { getContractAddress } from '../contract';
import { ArrowLeft, CheckCircle2, Store, Zap, Tag, User, Sparkles, ChevronDown, ChevronUp, Copy } from 'lucide-react';
import { toast } from 'sonner';

export function NFTDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isConnected, address, signer } = useWallet();
  const [nft, setNft] = useState(null);
  const [loading, setLoading] = useState(true);
  const [txOpen, setTxOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await getNFTDetail(Number(id));
        if (!cancelled) setNft(res.data);
      } catch {
        if (!cancelled) setNft(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  async function handleBuy() {
    if (!isConnected) {
      toast.error('지갑을 먼저 연결해주세요');
      return;
    }
    try {
      const isLazy = nft.mint_mode === 'lazy' && !nft.is_minted;
      if (isLazy) {
        toast.info('MetaMask에서 Lazy Mint + 구매 트랜잭션을 승인해주세요...');
        const tokenURI = JSON.stringify({ title: nft.title, description: nft.description, category: nft.category });
        const { tokenId: newTokenId, txHash } = await onChainLazyMintAndBuy(
          signer, tokenURI, nft.creator_address, nft.max_executions || 50, String(nft.price)
        );
        await buyNFT({
          token_id: nft.token_id,
          buyer_address: address,
          price: nft.price,
          tx_hash: txHash,
          new_token_id: newTokenId,
        });
        toast.success(`${nft.title} 구매 성공! (Lazy Mint)`);
      } else {
        toast.info('MetaMask에서 구매 트랜잭션을 승인해주세요...');
        const txHash = await onChainBuy(signer, nft.token_id, String(nft.price));
        await buyNFT({
          token_id: nft.token_id,
          buyer_address: address,
          price: nft.price,
          tx_hash: txHash,
        });
        toast.success(`${nft.title} 구매 성공!`);
      }
      getNFTDetail(Number(id)).then(res => setNft(res.data)).catch(() => {});
    } catch (err) {
      const msg = err.reason || err.response?.data?.error || err.message;
      toast.error('구매 실패: ' + msg);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 mx-auto bg-th-accent-bg rounded-2xl flex items-center justify-center animate-pulse border border-th-accent-border">
            <Sparkles className="w-6 h-6 text-th-accent" />
          </div>
          <p className="text-th-text-secondary text-sm">로딩 중...</p>
        </div>
      </div>
    );
  }

  if (!nft) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-3">
          <div className="w-16 h-16 mx-auto bg-th-surface rounded-2xl flex items-center justify-center border border-th-border">
            <span className="text-3xl">🔍</span>
          </div>
          <p className="text-th-text font-medium">NFT를 찾을 수 없습니다</p>
        </div>
      </div>
    );
  }

  const isOwner = address && nft.owner_address === address.toLowerCase();
  const remaining = (nft.max_executions || 50) - (nft.execution_count || 0);
  const usagePercent = Math.round((remaining / (nft.max_executions || 50)) * 100);

  return (
    <div className="space-y-6 animate-fade-in-up">
      <Button
        onClick={() => navigate(-1)}
        variant="ghost"
        className="text-th-text hover:text-th-sub hover:bg-th-surface-hover"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        돌아가기
      </Button>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Image */}
        <div className="space-y-4">
          <div className="aspect-video w-full overflow-hidden rounded-3xl image-gradient border border-th-border">
            {nft.image_url ? (
              <img
                src={nft.image_url}
                alt={nft.title}
                className="w-full h-full object-cover"
                onError={(e) => { e.target.style.display = 'none'; }}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <div className="text-center">
                  <div className="text-6xl mb-2">🤖</div>
                  <span className="text-th-muted">#{nft.token_id}</span>
                </div>
              </div>
            )}
          </div>

          {/* NFT Address / Contract Address */}
          <div className="glass rounded-2xl p-6">
            {nft.is_minted && nft.token_id >= 0 ? (
              <>
                <h3 className="text-th-sub font-semibold mb-3">NFT 주소</h3>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-th-strong font-mono text-sm break-all">
                      {getContractAddress()}#{nft.token_id}
                    </span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(`${getContractAddress()}#${nft.token_id}`);
                        toast.success('주소가 복사되었습니다');
                      }}
                      className="shrink-0 p-1.5 rounded-lg hover:bg-th-surface-hover text-th-text-secondary hover:text-th-sub transition-colors"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                  <a
                    href={`https://sepolia.etherscan.io/nft/${getContractAddress()}/${nft.token_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-th-accent text-xs hover:underline"
                  >
                    Etherscan에서 보기 ↗
                  </a>
                </div>
              </>
            ) : (
              <>
                <h3 className="text-th-sub font-semibold mb-3">컨트랙트 주소</h3>
                <div className="flex items-center gap-2">
                  <span className="text-th-strong font-mono text-sm break-all">{getContractAddress()}</span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(getContractAddress());
                      toast.success('주소가 복사되었습니다');
                    }}
                    className="shrink-0 p-1.5 rounded-lg hover:bg-th-surface-hover text-th-text-secondary hover:text-th-sub transition-colors"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-th-muted text-xs mt-2">구매 시 온체인 민팅이 진행됩니다</p>
              </>
            )}
          </div>

          {/* Transaction History (Expandable) */}
          {nft.transaction_history && nft.transaction_history.length > 0 && (
            <div className="glass rounded-2xl overflow-hidden">
              <button
                onClick={() => setTxOpen(!txOpen)}
                className="w-full flex items-center justify-between p-6 text-left hover:bg-th-surface-hover transition-colors"
              >
                <h3 className="text-th-sub font-semibold">거래 내역 ({nft.transaction_history.length})</h3>
                {txOpen ? <ChevronUp className="w-5 h-5 text-th-text-secondary" /> : <ChevronDown className="w-5 h-5 text-th-text-secondary" />}
              </button>
              {txOpen && (
                <div className="px-6 pb-6 space-y-3 border-t border-th-border pt-4">
                  {nft.transaction_history.map((tx, i) => (
                    <div key={i} className="space-y-1.5 text-sm">
                      <div className="flex items-center justify-between">
                        <div className="text-th-text-secondary">
                          {tx.from_address?.slice(0, 6)}...{tx.from_address?.slice(-4)} → {tx.to_address?.slice(0, 6)}...{tx.to_address?.slice(-4)}
                        </div>
                        <div className="text-th-accent font-medium">{tx.price} ETH</div>
                      </div>
                      {tx.tx_hash && (
                        <div className="text-th-muted text-xs font-mono break-all">TX: {tx.tx_hash}</div>
                      )}
                      {tx.created_at && (
                        <div className="text-th-muted text-xs">{new Date(tx.created_at).toLocaleString()}</div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Details */}
        <div className="space-y-6">
          <div>
            <div className="flex items-center gap-2 mb-3">
              {nft.is_for_sale ? (
                <Badge className="bg-th-success-bg-strong text-th-success border-th-success-border">
                  <Store className="w-3 h-3 mr-1" />
                  판매중
                </Badge>
              ) : (
                <Badge className="bg-th-surface-hover text-th-text-secondary border-th-border">
                  보유중
                </Badge>
              )}
              {nft.category && (
                <Badge className="bg-th-accent-bg-strong text-th-accent-text border-th-accent-border">
                  {nft.category}
                </Badge>
              )}
            </div>
            <h1 className="text-3xl font-bold text-th-heading mb-2 tracking-tight">
              {nft.title}
            </h1>
            <p className="text-th-text">
              {nft.description || '설명 없음'}
            </p>
          </div>

          <div className="border-t border-b border-th-border py-4 space-y-4">
            <div>
              <div className="text-sm text-th-text-secondary mb-1">카테고리</div>
              <div className="text-th-sub font-medium">{nft.category || '일반'}</div>
            </div>
            <div>
              <div className="text-sm text-th-text-secondary mb-1">소유자</div>
              <div className="text-th-strong font-mono text-sm">{nft.owner_address}</div>
            </div>
            <div>
              <div className="text-sm text-th-text-secondary mb-1">생성자</div>
              <div className="text-th-strong font-mono text-sm">{nft.creator_address}</div>
            </div>
            <div>
              <div className="text-sm text-th-text-secondary mb-2">남은 실행 횟수</div>
              <div className="flex items-center justify-between text-sm mb-1.5">
                <span className="text-th-sub font-semibold flex items-center gap-1">
                  <Zap className="w-3.5 h-3.5 text-th-accent" />
                  {remaining} / {nft.max_executions || 50}회
                </span>
                <span className={`text-xs font-medium ${usagePercent > 50 ? 'text-th-success' : usagePercent > 20 ? 'text-th-warning' : 'text-th-error'}`}>
                  {usagePercent}%
                </span>
              </div>
              <div className="w-full h-2 bg-th-surface-hover rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${usagePercent > 50 ? 'bg-emerald-500' : usagePercent > 20 ? 'bg-amber-500' : 'bg-red-500'}`}
                  style={{ width: `${usagePercent}%` }}
                />
              </div>
            </div>
          </div>

          <div className="glass-strong rounded-2xl p-6 space-y-4">
            <div>
              <div className="text-sm text-th-text-secondary mb-2">가격</div>
              <div className="text-4xl font-bold text-accent-gradient">
                {nft.price} ETH
              </div>
            </div>

            {nft.is_for_sale && !isOwner ? (
              <Button
                onClick={handleBuy}
                disabled={!isConnected}
                className="w-full accent-gradient text-white py-6 text-lg shadow-lg shadow-th-accent-glow hover:shadow-th-accent-glow-strong transition-all border-0"
              >
                {isConnected ? '구매하기' : '지갑을 먼저 연결하세요'}
              </Button>
            ) : isOwner ? (
              <div className="bg-th-success-bg border border-th-success-border rounded-xl p-4 text-center">
                <CheckCircle2 className="w-6 h-6 text-th-success mx-auto mb-2" />
                <p className="text-th-success-light font-medium">내 NFT</p>
                <p className="text-th-success text-sm mt-1">실행 페이지에서 사용할 수 있습니다</p>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
