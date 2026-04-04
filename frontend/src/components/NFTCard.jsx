import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { useWallet } from '../context/WalletContext';
import { HelpCircle } from 'lucide-react';
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

  return (
    <div
      className="bg-white rounded-3xl overflow-hidden shadow-sm hover:shadow-xl transition-all cursor-pointer border border-orange-100"
      onClick={handleCardClick}
    >
      {/* Thumbnail */}
      <div className="aspect-video w-full overflow-hidden bg-gradient-to-br from-orange-100 to-amber-50">
        {nft.image_url ? (
          <img
            src={nft.image_url}
            alt={nft.title}
            className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
            onError={(e) => { e.target.style.display = 'none'; }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-center">
              <div className="text-4xl mb-2">🤖</div>
              <span className="text-sm text-gray-400">#{nft.token_id}</span>
            </div>
          </div>
        )}
      </div>

      <div className="p-6 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-gray-800 font-bold text-lg line-clamp-1">
            {nft.title}
          </h3>
          {nft.is_for_sale ? (
            <Badge className="bg-green-50 text-green-700 border-green-200">
              판매중
            </Badge>
          ) : (
            <Badge className="bg-gray-100 text-gray-600 border-gray-200">
              보유중
            </Badge>
          )}
        </div>
        <p className="text-gray-600 text-sm line-clamp-2">
          {nft.description || '설명 없음'}
        </p>
        <div className="flex items-center justify-between pt-2">
          <div>
            <div className="text-xs text-gray-500 mb-1">가격</div>
            <span className="text-orange-500 font-bold text-lg">
              {nft.price} ETH
            </span>
          </div>
          <div className="text-right">
            <div className="text-xs text-gray-500 mb-1">남은 실행</div>
            <div className="flex items-center gap-1 text-gray-800 font-semibold">
              <span>{remaining} / {nft.max_executions || 100}</span>
              <HelpCircle className="w-4 h-4 text-gray-400" />
            </div>
          </div>
        </div>
        {showBuyButton && isConnected && (
          <Button
            onClick={(e) => {
              e.stopPropagation();
              handleBuy();
            }}
            className="w-full bg-gradient-to-r from-orange-400 to-orange-300 hover:from-orange-500 hover:to-orange-400 text-white mt-2 shadow-sm"
          >
            구매하기
          </Button>
        )}
      </div>
    </div>
  );
}
