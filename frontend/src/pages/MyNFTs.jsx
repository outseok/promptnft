// pages/MyNFTs.jsx — 나의 NFT (백엔드 API 연동)
import { useState, useEffect } from 'react';
import { useWallet } from '../context/WalletContext';
import { getMyNFTs, updateSaleStatus } from '../api';
import { onChainListForSale, onChainCancelListing } from '../contract';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Store, Play, Clock, CheckCircle2, XCircle, AlertTriangle, DollarSign } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Input } from '../components/ui/input';

export function MyNFTs() {
  const { address, isConnected, signer } = useWallet();
  const navigate = useNavigate();
  const [myNfts, setMyNfts] = useState([]);

  useEffect(() => {
    if (!isConnected) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await getMyNFTs();
        if (!cancelled) setMyNfts(res.data || []);
      } catch {
        if (!cancelled) setMyNfts([]);
      }
    })();
    return () => { cancelled = true; };
  }, [isConnected, address]);

  function refreshMyNFTs() {
    getMyNFTs()
      .then(res => setMyNfts(res.data || []))
      .catch(() => setMyNfts([]));
  }

  async function handleToggleSale(nft, newPrice) {
    const isLazyUnminted = nft.mint_mode === 'lazy' && (!nft.is_minted || nft.token_id < 0);
    try {
      if (nft.is_for_sale) {
        // ── 판매 중지 ──
        if (isLazyUnminted) {
          // Lazy unminted: DB만 변경
          await updateSaleStatus(nft.token_id, { is_for_sale: false, price: nft.price });
          toast.success('마켓에서 내림 처리되었습니다.');
        } else {
          // 온체인 민팅된 NFT: 온체인 + DB
          toast.info('MetaMask에서 판매 취소 트랜잭션을 승인해주세요...');
          await onChainCancelListing(signer, nft.token_id);
          await updateSaleStatus(nft.token_id, { is_for_sale: false, price: nft.price });
          toast.success('판매 중지됨');
        }
      } else {
        // ── 판매 등록 ──
        if (nft.creator_address !== address?.toLowerCase()) {
          // 구매한 NFT → 재판매 페이지로 이동
          navigate(`/resale/${nft.token_id}`);
          return;
        }
        const price = newPrice || nft.price;
        if (isLazyUnminted) {
          // Lazy unminted: DB만 변경
          await updateSaleStatus(nft.token_id, { is_for_sale: true, price });
          toast.success('마켓에 등록되었습니다.');
        } else {
          // 온체인 민팅된 NFT: 온체인 + DB
          toast.info('MetaMask에서 판매 등록 트랜잭션을 승인해주세요...');
          await onChainListForSale(signer, nft.token_id, String(price));
          await updateSaleStatus(nft.token_id, { is_for_sale: true, price });
          toast.success(`${price} ETH로 판매 등록됨`);
        }
      }
      refreshMyNFTs();
    } catch (err) {
      const msg = err.reason || err.response?.data?.error || err.message;
      toast.error('판매 상태 변경 실패: ' + msg);
    }
  }

  if (!isConnected) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4 max-w-md">
          <div className="w-20 h-20 bg-th-accent-bg rounded-3xl flex items-center justify-center mx-auto border border-th-accent-border">
            <Store className="w-10 h-10 text-th-accent" />
          </div>
          <h2 className="text-2xl font-bold text-th-heading">
            지갑을 연결해주세요
          </h2>
          <p className="text-th-text">
            나의 NFT를 확인하려면 MetaMask 지갑을 연결해야 합니다
          </p>
        </div>
      </div>
    );
  }

  const createdNfts = myNfts.filter(nft => nft.creator_address === address?.toLowerCase());
  const purchasedNfts = myNfts.filter(nft => nft.creator_address !== address?.toLowerCase());

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-th-heading mb-2">마이페이지</h1>
        <p className="text-th-text">등록하고 구매한 NFT를 관리하세요</p>
      </div>

      <Tabs defaultValue="all" className="w-full">
        <TabsList className="bg-th-surface border border-th-border rounded-2xl">
          <TabsTrigger
            value="all"
            className="data-[state=active]:bg-th-accent-bg-strong data-[state=active]:text-th-accent-text text-th-text-secondary rounded-xl"
          >
            전체 보유 ({myNfts.length})
          </TabsTrigger>
          <TabsTrigger
            value="purchased"
            className="data-[state=active]:bg-th-accent-bg-strong data-[state=active]:text-th-accent-text text-th-text-secondary rounded-xl"
          >
            구매한 NFT ({purchasedNfts.length})
          </TabsTrigger>
          <TabsTrigger
            value="created"
            className="data-[state=active]:bg-th-accent-bg-strong data-[state=active]:text-th-accent-text text-th-text-secondary rounded-xl"
          >
            등록한 NFT ({createdNfts.length})
          </TabsTrigger>
        </TabsList>

        {/* 전체 보유 NFT */}
        <TabsContent value="all" className="mt-6">
          {myNfts.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {myNfts.map((nft) => (
                <NFTOwnedCard
                  key={nft.token_id}
                  nft={nft}
                  onNavigate={() => navigate(`/nft/${nft.token_id}`)}
                  onExecute={() => navigate(`/execute?tokenId=${nft.token_id}`)}
                  onToggleSale={(price) => handleToggleSale(nft, price)}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* 구매한 NFT */}
        <TabsContent value="purchased" className="mt-6">
          {purchasedNfts.length === 0 ? (
            <EmptyState text="구매한 NFT가 없습니다" sub="마켓플레이스에서 AI NFT를 구매해보세요" />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {purchasedNfts.map((nft) => (
                <NFTOwnedCard
                  key={nft.token_id}
                  nft={nft}
                  onNavigate={() => navigate(`/nft/${nft.token_id}`)}
                  onExecute={() => navigate(`/execute?tokenId=${nft.token_id}`)}
                  onToggleSale={(price) => handleToggleSale(nft, price)}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* 등록한 NFT — 승인 상태 포함 */}
        <TabsContent value="created" className="mt-6">
          {createdNfts.length === 0 ? (
            <EmptyState text="등록한 NFT가 없습니다" sub="새로운 AI 프롬프트를 등록해보세요" />
          ) : (
            <div className="space-y-4">
              {createdNfts.map((nft) => {
                // 승인 상태: 백엔드에 approval_status 필드가 있으면 사용, 없으면 기본값
                const approvalStatus = nft.approval_status || 'approved';
                return (
                  <div
                    key={nft.token_id}
                    className="glass rounded-3xl p-6 flex gap-6 hover:bg-th-surface-hover transition-all cursor-pointer border border-th-border"
                    onClick={() => navigate(`/nft/${nft.token_id}`)}
                  >
                    <div className="w-40 h-40 rounded-2xl image-gradient flex-shrink-0 overflow-hidden">
                      {nft.image_url ? (
                        <img src={nft.image_url} alt={nft.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-4xl">🤖</div>
                      )}
                    </div>
                    <div className="flex-1 space-y-3">
                      <div>
                        <h3 className="text-th-heading font-bold text-xl mb-2">{nft.title}</h3>
                        <p className="text-th-text text-sm line-clamp-2">{nft.description || '설명 없음'}</p>
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        {/* 승인 상태 뱃지 */}
                        {approvalStatus === 'pending' && (
                          <Badge className="bg-th-warning-bg text-th-warning border-th-warning-border">
                            <Clock className="w-3 h-3 mr-1" />
                            승인 대기
                          </Badge>
                        )}
                        {approvalStatus === 'approved' && (
                          <Badge className="bg-th-success-bg text-th-success border-th-success-border">
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            승인 완료
                          </Badge>
                        )}
                        {approvalStatus === 'rejected' && (
                          <Badge className="bg-th-error-bg text-th-error border-th-error-border">
                            <XCircle className="w-3 h-3 mr-1" />
                            반려됨
                          </Badge>
                        )}
                        {/* 판매 상태 뱃지 */}
                        {approvalStatus === 'approved' && (
                          nft.is_for_sale ? (
                            <Badge className="bg-th-success-bg text-th-success border-th-success-border">
                              <Store className="w-3 h-3 mr-1" />
                              판매중
                            </Badge>
                          ) : (
                            <Badge className="bg-th-surface-hover text-th-text-secondary border-th-border">
                              판매 미등록
                            </Badge>
                          )
                        )}
                      </div>
                      {/* 반려 사유 */}
                      {approvalStatus === 'rejected' && nft.rejection_reason && (
                        <div className="bg-th-error-bg border border-th-error-border rounded-xl p-3 flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 text-th-error mt-0.5 flex-shrink-0" />
                          <p className="text-sm text-th-error-light">{nft.rejection_reason}</p>
                        </div>
                      )}
                      <div className="flex items-center gap-4">
                        <div>
                          <span className="text-xs text-th-text-secondary">가격</span>
                          <div className="text-th-accent font-bold">{nft.price} ETH</div>
                        </div>
                        <div>
                          <span className="text-xs text-th-text-secondary">실행</span>
                          <div className="text-th-sub text-sm">
                            {nft.execution_count || 0}/{nft.max_executions || 50}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function EmptyState({ text = '보유한 NFT가 없습니다', sub = '마켓플레이스에서 NFT를 구매하거나 새로 등록해보세요' }) {
  return (
    <div className="text-center py-20 glass rounded-2xl border border-th-border">
      <div className="w-16 h-16 bg-th-surface-hover rounded-2xl flex items-center justify-center mx-auto mb-4 border border-th-border">
        <Store className="w-8 h-8 text-th-text-secondary" />
      </div>
      <p className="text-th-strong font-medium mb-1">{text}</p>
      <p className="text-th-text-secondary text-sm">{sub}</p>
    </div>
  );
}

function NFTOwnedCard({ nft, onNavigate, onExecute, onToggleSale }) {
  const remaining = (nft.max_executions || 50) - (nft.execution_count || 0);
  const [showPriceInput, setShowPriceInput] = useState(false);
  const [resalePrice, setResalePrice] = useState(nft.price || '0.01');

  function handleSaleClick(e) {
    e.stopPropagation();
    if (nft.is_for_sale) {
      // 판매 중지 — 바로 실행
      onToggleSale();
    } else {
      // 판매 등록 — 가격 입력 토글
      setShowPriceInput(!showPriceInput);
    }
  }

  function handleConfirmList(e) {
    e.stopPropagation();
    if (!resalePrice || Number(resalePrice) <= 0) {
      toast.error('가격을 입력해주세요');
      return;
    }
    setShowPriceInput(false);
    onToggleSale(resalePrice);
  }

  return (
    <div
      className="glass rounded-3xl overflow-hidden hover:bg-th-surface-hover transition-all border border-th-border"
    >
      <div
        className="aspect-video w-full overflow-hidden image-gradient cursor-pointer"
        onClick={onNavigate}
      >
        {nft.image_url ? (
          <img src={nft.image_url} alt={nft.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-center">
              <div className="text-4xl mb-2">🤖</div>
              <span className="text-sm text-th-muted">#{nft.token_id}</span>
            </div>
          </div>
        )}
      </div>
      <div className="p-5 space-y-3">
        <h3 className="text-th-heading font-bold text-lg line-clamp-1">{nft.title}</h3>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-th-text-secondary">남은 실행</div>
            <div className="text-th-accent font-bold text-lg">{remaining}회</div>
          </div>
          <div>
            <div className="text-xs text-th-text-secondary">가격</div>
            <div className="text-th-sub font-bold">{nft.price} ETH</div>
          </div>
          <Badge className={nft.is_for_sale ? "bg-th-success-bg text-th-success border-th-success-border" : "bg-th-surface-hover text-th-text-secondary border-th-border"}>
            {nft.is_for_sale ? '판매중' : '보유중'}
          </Badge>
        </div>

        {/* 재판매 가격 입력 */}
        {showPriceInput && (
          <div className="flex gap-2 items-center" onClick={e => e.stopPropagation()}>
            <Input
              type="number"
              step="0.001"
              min="0.001"
              value={resalePrice}
              onChange={(e) => setResalePrice(e.target.value)}
              placeholder="판매 가격 (ETH)"
              className="flex-1 bg-th-surface border-th-border text-th-sub text-sm rounded-lg h-9"
            />
            <Button
              onClick={handleConfirmList}
              size="sm"
              className="accent-gradient text-white border-0 h-9 px-4"
            >
              확인
            </Button>
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <Button
            onClick={handleSaleClick}
            variant="outline"
            size="sm"
            className="flex-1 border-th-border-strong text-th-strong hover:bg-th-surface-hover"
          >
            {nft.is_for_sale ? '판매 중지' : '판매 등록'}
          </Button>
          <Button
            onClick={(e) => { e.stopPropagation(); onExecute(); }}
            size="sm"
            className="flex-1 accent-gradient text-white shadow-sm border-0"
          >
            <Play className="w-3 h-3 mr-1" />
            실행
          </Button>
        </div>
      </div>
    </div>
  );
}
