// pages/MyNFTs.jsx — 나의 NFT (백엔드 API 연동)
import { useState, useEffect } from 'react';
import { useWallet } from '../context/WalletContext';
import { getMyNFTs, updateSaleStatus } from '../api';
import { onChainListForSale, onChainCancelListing } from '../contract';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Store, Play, Clock, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

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

  async function handleToggleSale(nft) {
    try {
      if (nft.is_for_sale) {
        toast.info('MetaMask에서 판매 취소 트랜잭션을 승인해주세요...');
        await onChainCancelListing(signer, nft.token_id);
      } else {
        toast.info('MetaMask에서 판매 등록 트랜잭션을 승인해주세요...');
        await onChainListForSale(signer, nft.token_id, String(nft.price));
      }
      await updateSaleStatus(nft.token_id, {
        is_for_sale: !nft.is_for_sale,
        price: nft.price,
      });
      toast.success(nft.is_for_sale ? '판매 중지됨' : '판매 등록됨');
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
          <div className="w-20 h-20 bg-orange-100 rounded-3xl flex items-center justify-center mx-auto">
            <Store className="w-10 h-10 text-orange-500" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800">
            지갑을 연결해주세요
          </h2>
          <p className="text-gray-600">
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
        <h1 className="text-3xl font-bold text-gray-800 mb-2">마이페이지</h1>
        <p className="text-gray-600">등록하고 구매한 NFT를 관리하세요</p>
      </div>

      <Tabs defaultValue="all" className="w-full">
        <TabsList className="bg-white border border-orange-100 rounded-2xl">
          <TabsTrigger
            value="all"
            className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-100 data-[state=active]:to-amber-100 data-[state=active]:text-orange-700 text-gray-600 rounded-xl"
          >
            전체 보유 ({myNfts.length})
          </TabsTrigger>
          <TabsTrigger
            value="purchased"
            className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-100 data-[state=active]:to-amber-100 data-[state=active]:text-orange-700 text-gray-600 rounded-xl"
          >
            구매한 NFT ({purchasedNfts.length})
          </TabsTrigger>
          <TabsTrigger
            value="created"
            className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-100 data-[state=active]:to-amber-100 data-[state=active]:text-orange-700 text-gray-600 rounded-xl"
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
                  onToggleSale={() => handleToggleSale(nft)}
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
                  onToggleSale={() => handleToggleSale(nft)}
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
                    className="bg-white rounded-3xl p-6 flex gap-6 hover:shadow-lg transition-all cursor-pointer border border-orange-100"
                    onClick={() => navigate(`/nft/${nft.token_id}`)}
                  >
                    <div className="w-40 h-40 rounded-2xl bg-gradient-to-br from-orange-100 to-amber-50 flex-shrink-0 overflow-hidden">
                      {nft.image_url ? (
                        <img src={nft.image_url} alt={nft.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-4xl">🤖</div>
                      )}
                    </div>
                    <div className="flex-1 space-y-3">
                      <div>
                        <h3 className="text-gray-800 font-bold text-xl mb-2">{nft.title}</h3>
                        <p className="text-gray-600 text-sm line-clamp-2">{nft.description || '설명 없음'}</p>
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        {/* 승인 상태 뱃지 */}
                        {approvalStatus === 'pending' && (
                          <Badge className="bg-yellow-50 text-yellow-700 border-yellow-200">
                            <Clock className="w-3 h-3 mr-1" />
                            승인 대기
                          </Badge>
                        )}
                        {approvalStatus === 'approved' && (
                          <Badge className="bg-green-50 text-green-700 border-green-200">
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            승인 완료
                          </Badge>
                        )}
                        {approvalStatus === 'rejected' && (
                          <Badge className="bg-red-50 text-red-700 border-red-200">
                            <XCircle className="w-3 h-3 mr-1" />
                            반려됨
                          </Badge>
                        )}
                        {/* 판매 상태 뱃지 */}
                        {approvalStatus === 'approved' && (
                          nft.is_for_sale ? (
                            <Badge className="bg-green-50 text-green-700 border-green-200">
                              <Store className="w-3 h-3 mr-1" />
                              판매중
                            </Badge>
                          ) : (
                            <Badge className="bg-gray-100 text-gray-600 border-gray-200">
                              판매 미등록
                            </Badge>
                          )
                        )}
                      </div>
                      {/* 반려 사유 */}
                      {approvalStatus === 'rejected' && nft.rejection_reason && (
                        <div className="bg-red-50 border border-red-100 rounded-xl p-3 flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                          <p className="text-sm text-red-700">{nft.rejection_reason}</p>
                        </div>
                      )}
                      <div className="flex items-center gap-4">
                        <div>
                          <span className="text-xs text-gray-500">가격</span>
                          <div className="text-orange-500 font-bold">{nft.price} ETH</div>
                        </div>
                        <div>
                          <span className="text-xs text-gray-500">실행</span>
                          <div className="text-gray-800 text-sm">
                            {nft.execution_count || 0}/{nft.max_executions || 100}
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
    <div className="text-center py-20 bg-white rounded-2xl border border-orange-100/60">
      <div className="w-16 h-16 bg-orange-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
        <Store className="w-8 h-8 text-orange-300" />
      </div>
      <p className="text-gray-600 font-medium mb-1">{text}</p>
      <p className="text-gray-400 text-sm">{sub}</p>
    </div>
  );
}

function NFTOwnedCard({ nft, onNavigate, onExecute, onToggleSale }) {
  const remaining = (nft.max_executions || 100) - (nft.execution_count || 0);

  return (
    <div
      className="bg-white rounded-3xl overflow-hidden shadow-sm hover:shadow-lg transition-all border border-orange-100"
    >
      <div
        className="aspect-video w-full overflow-hidden bg-gradient-to-br from-orange-100 to-amber-50 cursor-pointer"
        onClick={onNavigate}
      >
        {nft.image_url ? (
          <img src={nft.image_url} alt={nft.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-center">
              <div className="text-4xl mb-2">🤖</div>
              <span className="text-sm text-gray-400">#{nft.token_id}</span>
            </div>
          </div>
        )}
      </div>
      <div className="p-5 space-y-3">
        <h3 className="text-gray-800 font-bold text-lg line-clamp-1">{nft.title}</h3>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-gray-500">남은 실행</div>
            <div className="text-orange-500 font-bold text-lg">{remaining}회</div>
          </div>
          <Badge className={nft.is_for_sale ? "bg-green-50 text-green-700 border-green-200" : "bg-gray-100 text-gray-600 border-gray-200"}>
            {nft.is_for_sale ? '판매중' : '보유중'}
          </Badge>
        </div>
        <div className="flex gap-2 pt-2">
          <Button
            onClick={(e) => { e.stopPropagation(); onToggleSale(); }}
            variant="outline"
            size="sm"
            className="flex-1 border-orange-200 text-gray-700 hover:bg-orange-50"
          >
            {nft.is_for_sale ? '판매 중지' : '판매 등록'}
          </Button>
          <Button
            onClick={(e) => { e.stopPropagation(); onExecute(); }}
            size="sm"
            className="flex-1 bg-gradient-to-r from-orange-500 to-amber-400 hover:from-orange-600 hover:to-amber-500 text-white shadow-sm"
          >
            <Play className="w-3 h-3 mr-1" />
            실행
          </Button>
        </div>
      </div>
    </div>
  );
}
