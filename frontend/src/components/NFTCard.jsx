import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { useWallet } from '../context/WalletContext';
import { Zap, Tag } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function NFTCard({ nft, showBuyButton = false, onBuy }) {
  const { isConnected } = useWallet();
  const navigate = useNavigate();

  const handleBuy = () => {
    if (onBuy) onBuy();
  };

  const handleCardClick = () => {
    navigate(`/nft/${nft.token_id}`);
  };

  const remaining = (nft.max_executions || 100) - (nft.execution_count || 0);
  const usagePercent = Math.round((remaining / (nft.max_executions || 100)) * 100);

  return (
    <div
      className="group bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-xl hover:shadow-orange-100/50 transition-all duration-300 cursor-pointer border border-orange-100/60 hover:border-orange-200/80 hover:-translate-y-1"
      onClick={handleCardClick}
    >
      {/* Thumbnail */}
      <div className="aspect-[16/10] w-full overflow-hidden bg-gradient-to-br from-orange-50 via-amber-50 to-orange-100 relative">
        {nft.image_url ? (
          <img
            src={nft.image_url}
            alt={nft.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            onError={(e) => { e.target.style.display = 'none'; }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-center">
              <div className="text-4xl mb-1.5 group-hover:scale-110 transition-transform">🤖</div>
              <span className="text-xs text-gray-400 font-mono">#{nft.token_id}</span>
            </div>
          </div>
        )}
        {/* Category/Status overlay */}
        <div className="absolute top-3 left-3 flex gap-1.5">
          {nft.category && (
            <span className="px-2.5 py-0.5 bg-white/90 backdrop-blur-sm rounded-full text-xs font-medium text-gray-600 shadow-sm">
              {nft.category}
            </span>
          )}
          {nft.mint_mode === 'lazy' && !nft.is_minted && (
            <span className="px-2.5 py-0.5 bg-purple-500/90 backdrop-blur-sm rounded-full text-xs font-medium text-white shadow-sm">
              Lazy Mint
            </span>
          )}
        </div>
      </div>

      <div className="p-5 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-gray-800 font-bold text-base line-clamp-1 group-hover:text-orange-600 transition-colors">
            {nft.title}
          </h3>
          {nft.is_for_sale ? (
            <Badge className="bg-green-50 text-green-600 border-green-200/60 text-[11px] px-2">
              판매중
            </Badge>
          ) : (
            <Badge className="bg-gray-50 text-gray-500 border-gray-200/60 text-[11px] px-2">
              보유중
            </Badge>
          )}
        </div>
        <p className="text-gray-500 text-sm line-clamp-2 leading-relaxed">
          {nft.description || '설명 없음'}
        </p>

        {/* Usage bar */}
        <div className="pt-1">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-gray-400 flex items-center gap-1">
              <Zap className="w-3 h-3" /> 남은 실행
            </span>
            <span className="font-semibold text-gray-600">{remaining}<span className="text-gray-400 font-normal">/{nft.max_executions || 100}</span></span>
          </div>
          <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${usagePercent > 50 ? 'bg-green-400' : usagePercent > 20 ? 'bg-amber-400' : 'bg-red-400'}`}
              style={{ width: `${usagePercent}%` }}
            />
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-gray-50">
          <div className="flex items-center gap-1.5">
            <Tag className="w-3.5 h-3.5 text-orange-400" />
            <span className="text-orange-500 font-bold text-lg">
              {nft.price}
            </span>
            <span className="text-gray-400 text-xs font-medium">ETH</span>
          </div>
          <span className="text-[11px] text-gray-400 font-mono">
            #{nft.token_id}
          </span>
        </div>

        {showBuyButton && isConnected && (
          <Button
            onClick={(e) => {
              e.stopPropagation();
              handleBuy();
            }}
            className="w-full bg-gradient-to-r from-orange-500 to-amber-400 hover:from-orange-600 hover:to-amber-500 text-white shadow-md shadow-orange-200/40 hover:shadow-lg hover:shadow-orange-300/40 transition-all h-10"
          >
            구매하기
          </Button>
        )}
      </div>
    </div>
  );
}
