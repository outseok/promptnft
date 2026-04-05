// pages/Market.jsx — 마켓플레이스 (백엔드 API 연동, lazy mint 지원)
import { useState, useEffect, useMemo } from 'react';
import { NFTCard } from '../components/NFTCard';
import { useWallet } from '../context/WalletContext';
import { getNFTs, buyNFT } from '../api';
import { onChainBuy, onChainLazyMintAndBuy } from '../contract';
import { Input } from '../components/ui/input';
import { Search, Sparkles, ShoppingBag, Zap } from 'lucide-react';
import { toast } from 'sonner';

export function Market() {
  const [nfts, setNfts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const { isConnected, address, signer } = useWallet();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await getNFTs(true);
        if (!cancelled) setNfts(res.data || []);
      } catch {
        if (!cancelled) setNfts([]);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const filteredNFTs = useMemo(() => {
    if (searchQuery.trim() === '') return nfts;
    const q = searchQuery.toLowerCase();
    return nfts.filter(nft =>
      nft.title.toLowerCase().includes(q) ||
      (nft.description || '').toLowerCase().includes(q) ||
      (nft.category || '').toLowerCase().includes(q)
    );
  }, [searchQuery, nfts]);

  function refreshNFTs() {
    getNFTs(true)
      .then(res => setNfts(res.data || []))
      .catch(() => setNfts([]));
  }

  async function handleBuy(nft) {
    if (!isConnected) {
      toast.error('지갑을 먼저 연결해주세요');
      return;
    }
    try {
      const isLazy = nft.mint_mode === 'lazy' && !nft.is_minted;
      if (isLazy) {
        // Lazy mint: 구매 시 온체인 민팅 + 구매 동시 처리
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
        toast.success(`NFT #${newTokenId || nft.token_id} 구매 성공! (Lazy Mint)`);
      } else {
        // 일반 구매
        toast.info('MetaMask에서 구매 트랜잭션을 승인해주세요...');
        const txHash = await onChainBuy(signer, nft.token_id, String(nft.price));
        await buyNFT({
          token_id: nft.token_id,
          buyer_address: address,
          price: nft.price,
          tx_hash: txHash,
        });
        toast.success(`NFT #${nft.token_id} 구매 성공!`);
      }
      refreshNFTs();
    } catch (err) {
      const msg = err.reason || err.response?.data?.error || err.message;
      toast.error('구매 실패: ' + msg);
    }
  }

  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-orange-500 via-amber-400 to-orange-300 p-8 sm:p-10">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmZmZmYiIGZpbGwtb3BhY2l0eT0iMC4wOCI+PGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMiIvPjwvZz48L2c+PC9zdmc+')] opacity-60" />
        <div className="relative z-10 max-w-2xl">
          <div className="flex items-center gap-2 mb-3">
            <div className="flex items-center gap-1.5 px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full text-white text-xs font-semibold">
              <Zap className="w-3.5 h-3.5" />
              Sepolia Testnet
            </div>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-3 leading-tight">
            AI 프롬프트<br className="sm:hidden" /> 마켓플레이스
          </h1>
          <p className="text-white/85 text-base sm:text-lg leading-relaxed">
            검증된 AI 프롬프트를 NFT로 소유하고, 실행 권한을 블록체인으로 안전하게 거래하세요.
          </p>
          <div className="flex items-center gap-4 mt-5">
            <div className="flex items-center gap-1.5 text-white/70 text-sm">
              <ShoppingBag className="w-4 h-4" />
              <span>{nfts.length}개 프롬프트</span>
            </div>
          </div>
        </div>
        <Sparkles className="absolute top-6 right-8 w-16 h-16 text-white/15 hidden sm:block" />
        <Sparkles className="absolute bottom-8 right-24 w-8 h-8 text-white/10 hidden sm:block" />
      </div>

      {/* Search Bar */}
      <div className="relative max-w-2xl">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="프롬프트 검색..."
          className="pl-12 py-6 text-base bg-white border-orange-100 focus:border-orange-300 focus:ring-orange-200 rounded-2xl shadow-sm"
        />
      </div>

      {!isConnected && (
        <div className="bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200/60 rounded-2xl p-5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-5 h-5 text-orange-500" />
          </div>
          <p className="text-orange-800 text-sm font-medium">
            NFT를 구매하려면 MetaMask 지갑을 연결해주세요
          </p>
        </div>
      )}

      {/* NFT Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredNFTs.map((nft) => (
          <NFTCard
            key={nft.token_id}
            nft={nft}
            showBuyButton={isConnected && nft.owner_address !== address?.toLowerCase()}
            onBuy={() => handleBuy(nft)}
          />
        ))}
      </div>

      {filteredNFTs.length === 0 && (
        <div className="text-center py-20">
          <div className="w-16 h-16 mx-auto mb-4 bg-orange-50 rounded-2xl flex items-center justify-center">
            <Search className="w-8 h-8 text-orange-300" />
          </div>
          <p className="text-gray-500 font-medium">
            {searchQuery ? '검색 결과가 없습니다' : '현재 마켓에 등록된 NFT가 없습니다'}
          </p>
          <p className="text-gray-400 text-sm mt-1">
            {searchQuery ? '다른 키워드로 검색해보세요' : '첫 번째 프롬프트를 등록해보세요!'}
          </p>
        </div>
      )}
    </div>
  );
}
