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

  const remaining = (nft.max_executions || 50) - (nft.execution_count || 0);
  const usagePercent = Math.round((remaining / (nft.max_executions || 50)) * 100);

  return (
    <div
      className="group glass rounded-2xl overflow-hidden hover:bg-th-surface-hover transition-all duration-300 cursor-pointer hover:-translate-y-1 hover:shadow-lg hover:shadow-th-accent-glow"
      onClick={handleCardClick}
    >
      {/* Thumbnail */}
      <div className="aspect-[16/10] w-full overflow-hidden image-gradient relative">
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
              <div className="text-4xl mb-1.5 group-hover:scale-110 transition-transform duration-300">🤖</div>
              <span className="text-xs text-th-muted font-mono">#{nft.token_id}</span>
            </div>
          </div>
        )}
        {/* Category/Status overlay */}
        <div className="absolute top-3 left-3 flex gap-1.5">
          {nft.category && (
            <span className="px-2.5 py-0.5 bg-black/40 backdrop-blur-md rounded-full text-xs font-medium text-th-sub border border-th-border">
              {nft.category}
            </span>
          )}
          {nft.mint_mode === 'lazy' && !nft.is_minted && (
            <span className="px-2.5 py-0.5 bg-th-accent backdrop-blur-md rounded-full text-xs font-medium text-white border border-th-accent-border">
              Lazy Mint
            </span>
          )}
        </div>
      </div>

      <div className="p-5 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-th-heading font-bold text-base line-clamp-1 group-hover:text-th-accent-text transition-colors">
            {nft.title}
          </h3>
          {nft.is_for_sale ? (
            <Badge className="bg-th-success-bg-strong text-th-success border-th-success-border text-[11px] px-2">
              판매중
            </Badge>
          ) : (
            <Badge className="bg-th-surface-hover text-th-text-secondary border-th-border text-[11px] px-2">
              보유중
            </Badge>
          )}
        </div>
        <p className="text-th-text-secondary text-sm line-clamp-2 leading-relaxed">
          {nft.description || '설명 없음'}
        </p>

        {/* Usage bar */}
        <div className="pt-1">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-th-muted flex items-center gap-1">
              <Zap className="w-3 h-3" /> 남은 실행
            </span>
            <span className="font-semibold text-th-text">{remaining}<span className="text-th-muted font-normal">/{nft.max_executions || 50}</span></span>
          </div>
          <div className="w-full h-1.5 bg-th-surface-hover rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${usagePercent > 50 ? 'bg-emerald-500' : usagePercent > 20 ? 'bg-amber-500' : 'bg-red-500'}`}
              style={{ width: `${usagePercent}%` }}
            />
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-th-border">
          <div className="flex items-center gap-1.5">
            <Tag className="w-3.5 h-3.5 text-th-accent" />
            <span className="text-th-accent-text font-bold text-lg">
              {nft.price}
            </span>
            <span className="text-th-muted text-xs font-medium">ETH</span>
          </div>
          <span className="text-[11px] text-th-muted font-mono">
            #{nft.token_id}
          </span>
        </div>

        {showBuyButton && isConnected && (
          <Button
            onClick={(e) => {
              e.stopPropagation();
              handleBuy();
            }}
            className="w-full accent-gradient text-white shadow-lg shadow-th-accent-glow hover:shadow-th-accent-glow transition-all h-10 border-0"
          >
            구매하기
          </Button>
        )}
      </div>
    </div>
  );
}
