// pages/ResaleNFT.jsx — NFT 재판매 등록 폼
import { useState, useEffect } from 'react';
import { useWallet } from '../context/WalletContext';
import { useParams, useNavigate } from 'react-router-dom';
import { getNFTDetail, updateSaleStatus } from '../api';
import { onChainListForSale } from '../contract';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';
import { Zap } from 'lucide-react';

export function ResaleNFT() {
  const { isConnected, signer } = useWallet();
  const navigate = useNavigate();
  const { id } = useParams();
  const [nft, setNft] = useState(null);
  const [price, setPrice] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function fetchNFT() {
      try {
        const res = await getNFTDetail(id);
        const data = res.data || res;
        setNft(data);
        setPrice(data.price || '0.01');
      } catch {
        toast.error('NFT 정보를 불러올 수 없습니다');
      }
    }
    fetchNFT();
  }, [id]);

  if (!nft) {
    return <div className="max-w-xl mx-auto p-10 text-center text-th-text-secondary">NFT 정보를 불러오는 중...</div>;
  }

  const remaining = (nft.max_executions || 50) - (nft.execution_count || 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isConnected) { toast.error('지갑을 먼저 연결해주세요'); return; }
    if (remaining <= 0) { toast.error('남은 실행 횟수가 없습니다'); return; }
    if (!price || isNaN(Number(price)) || Number(price) <= 0) {
      toast.error('가격을 올바르게 입력해주세요');
      return;
    }

    setLoading(true);
    try {
      // 온체인 판매 등록 (이미 민팅된 NFT)
      toast.info('MetaMask에서 판매 등록 트랜잭션을 승인해주세요...');
      await onChainListForSale(signer, Number(id), String(price));

      // DB 업데이트
      await updateSaleStatus(Number(id), { is_for_sale: true, price });

      toast.success('재판매 등록 완료!', { duration: 3000 });
      setTimeout(() => navigate('/my-nfts'), 1500);
    } catch (err) {
      console.error('재판매 실패:', err);
      const msg = err.reason || err.data?.message || err.message || '재판매 등록 실패';
      toast.error('재판매 실패: ' + msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <form onSubmit={handleSubmit} className="glass-strong rounded-3xl p-10 space-y-8 border border-th-border">
        <h2 className="text-2xl font-bold text-th-heading mb-6">NFT 재판매 등록</h2>

        <div className="glass rounded-2xl p-4 border border-th-border space-y-2">
          <h3 className="text-lg font-bold text-th-heading">{nft.title}</h3>
          <p className="text-sm text-th-text-secondary">{nft.description || '설명 없음'}</p>
        </div>

        <div className="space-y-4">
          <div>
            <Label>남은 실행 횟수</Label>
            <Input value={remaining} readOnly className="bg-th-surface" />
          </div>
          <div>
            <Label>재판매 가격 (ETH)</Label>
            <Input
              type="number"
              min="0"
              step="0.0001"
              value={price}
              onChange={e => setPrice(e.target.value)}
              required
              className="bg-th-surface"
              placeholder="예: 0.01"
            />
          </div>
        </div>

        <div className="glass rounded-xl p-3 border border-th-border">
          <div className="flex items-center gap-2 text-sm">
            <Zap className="w-4 h-4 text-th-accent" />
            <span className="text-th-text-secondary">온체인 판매 등록 — MetaMask 트랜잭션 1회 필요</span>
          </div>
        </div>

        <Button type="submit" disabled={loading || remaining <= 0} className="w-full accent-gradient text-white shadow-md">
          {loading ? '등록 중...' : 'NFT 재판매 등록'}
        </Button>
      </form>
    </div>
  );
}
