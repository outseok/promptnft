// pages/NFTDetail.jsx — NFT 상세 페이지 (백엔드 API 연동, lazy mint 지원)
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getNFTDetail, buyNFT } from '../api';
import { onChainBuy, onChainLazyMintAndBuy } from '../contract';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { useWallet } from '../context/WalletContext';
import { ArrowLeft, CheckCircle2, Store } from 'lucide-react';
import { toast } from 'sonner';

export function NFTDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isConnected, address, signer } = useWallet();
  const [nft, setNft] = useState(null);
  const [loading, setLoading] = useState(true);

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
      // 새로고침
      getNFTDetail(Number(id)).then(res => setNft(res.data)).catch(() => {});
    } catch (err) {
      const msg = err.reason || err.response?.data?.error || err.message;
      toast.error('구매 실패: ' + msg);
    }
  }

  if (loading) {
    return (
      <div className="text-center py-16 text-gray-500">
        로딩 중...
      </div>
    );
  }

  if (!nft) {
    return (
      <div className="text-center py-16 text-gray-500">
        NFT를 찾을 수 없습니다
      </div>
    );
  }

  const isOwner = address && nft.owner_address === address.toLowerCase();
  const remaining = (nft.max_executions || 100) - (nft.execution_count || 0);

  return (
    <div className="space-y-6">
      <Button
        onClick={() => navigate(-1)}
        variant="ghost"
        className="text-gray-600 hover:text-gray-900 hover:bg-orange-50"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        돌아가기
      </Button>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Image */}
        <div className="space-y-4">
          <div className="aspect-video w-full overflow-hidden rounded-3xl bg-gradient-to-br from-orange-100 to-amber-50 border border-orange-100">
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
                  <span className="text-gray-400">#{nft.token_id}</span>
                </div>
              </div>
            )}
          </div>

          {/* Transaction History */}
          {nft.transaction_history && nft.transaction_history.length > 0 && (
            <div className="bg-white rounded-2xl p-6 border border-orange-100">
              <h3 className="text-gray-800 font-semibold mb-4">거래 내역</h3>
              <div className="space-y-3">
                {nft.transaction_history.map((tx, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <div className="text-gray-600">
                      {tx.from_address?.slice(0, 6)}... → {tx.to_address?.slice(0, 6)}...
                    </div>
                    <div className="text-orange-500 font-medium">{tx.price} ETH</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Details */}
        <div className="space-y-6">
          <div>
            <div className="flex items-center gap-2 mb-3">
              {nft.is_for_sale ? (
                <Badge className="bg-green-50 text-green-700 border-green-200">
                  <Store className="w-3 h-3 mr-1" />
                  판매중
                </Badge>
              ) : (
                <Badge className="bg-gray-100 text-gray-600 border-gray-200">
                  보유중
                </Badge>
              )}
              {nft.category && (
                <Badge className="bg-blue-50 text-blue-700 border-blue-200">
                  {nft.category}
                </Badge>
              )}
            </div>
            <h1 className="text-3xl font-bold text-gray-800 mb-2">
              {nft.title}
            </h1>
            <p className="text-gray-600">
              {nft.description || '설명 없음'}
            </p>
          </div>

          <div className="border-t border-b border-orange-100 py-4 space-y-4">
            <div>
              <div className="text-sm text-gray-500 mb-1">카테고리</div>
              <div className="text-gray-800 font-medium">{nft.category || '일반'}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500 mb-1">소유자</div>
              <div className="text-gray-800 font-mono text-sm">{nft.owner_address}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500 mb-1">생성자</div>
              <div className="text-gray-800 font-mono text-sm">{nft.creator_address}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500 mb-1">남은 실행 횟수</div>
              <div className="text-gray-800 font-semibold">
                {remaining} / {nft.max_executions || 100}회
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-2xl p-6 space-y-4 border border-orange-100">
            <div>
              <div className="text-sm text-gray-600 mb-2">가격</div>
              <div className="text-4xl font-bold text-orange-500">
                {nft.price} ETH
              </div>
            </div>

            {nft.is_for_sale && !isOwner ? (
              <Button
                onClick={handleBuy}
                disabled={!isConnected}
                className="w-full bg-gradient-to-r from-orange-400 to-orange-300 hover:from-orange-500 hover:to-orange-400 text-white py-6 text-lg shadow-sm"
              >
                {isConnected ? '구매하기' : '지갑을 먼저 연결하세요'}
              </Button>
            ) : isOwner ? (
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
                <CheckCircle2 className="w-6 h-6 text-green-600 mx-auto mb-2" />
                <p className="text-green-800 font-medium">내 NFT</p>
                <p className="text-green-600 text-sm mt-1">실행 페이지에서 사용할 수 있습니다</p>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
