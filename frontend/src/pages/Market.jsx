// pages/Market.jsx — 마켓플레이스 (백엔드 API 연동, lazy mint 지원)
import { useState, useEffect, useMemo } from 'react';
import { NFTCard } from '../components/NFTCard';
import { useWallet } from '../context/WalletContext';
import { getNFTs, buyNFT } from '../api';
import { onChainBuy, onChainLazyMintAndBuy } from '../contract';
import { Input } from '../components/ui/input';
import { Search } from 'lucide-react';
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
      <div className="space-y-4">
        <h1 className="text-4xl font-bold text-gray-800">
          AI 프롬프트 마켓플레이스
        </h1>
        <p className="text-lg text-gray-600">
          손쉬운 AI 실행 권한을 NFT로 거래하세요. 프롬프트 엔지니어들이 공개합니다.
        </p>
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
        <div className="bg-orange-50 border border-orange-200 rounded-2xl p-6 text-center">
          <p className="text-orange-900 font-medium">
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
        <div className="text-center py-16 text-gray-500">
          {searchQuery ? '검색 결과가 없습니다' : '현재 마켓에 등록된 NFT가 없습니다'}
        </div>
      )}
    </div>
  );
}
