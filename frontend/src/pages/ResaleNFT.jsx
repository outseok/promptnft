// pages/ResaleNFT.jsx — NFT 재판매 등록 폼
import { useState, useEffect } from 'react';
import { useWallet } from '../context/WalletContext';
import { useParams } from 'react-router-dom';
import { getNFTDetail } from '../api';
import { onChainListForResale } from '../contract';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';
import { Zap, ShoppingCart } from 'lucide-react';

export function ResaleNFT() {
  const { isConnected, signer } = useWallet();
  const { id } = useParams();
  const [nft, setNft] = useState(null);
  const [formData, setFormData] = useState({
    price: '',
    resaleMode: 'immediate', // 'immediate' | 'on_sale'
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function fetchNFT() {
      try {
        const res = await getNFTDetail(id);
        setNft(res.data || res);
        setFormData(f => ({ ...f, price: res.data?.price || res.price || '' }));
      } catch {
        toast.error('NFT 정보를 불러올 수 없습니다');
      }
    }
    fetchNFT();
  }, [id]);

  if (!nft) {
    return <div className="max-w-xl mx-auto p-10 text-center">NFT 정보를 불러오는 중...</div>;
  }

  const remaining = (nft.max_executions || 50) - (nft.execution_count || 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isConnected) {
      toast.error('지갑을 먼저 연결해주세요');
      return;
    }
    if (remaining <= 0) {
      toast.error('남은 실행 횟수가 없습니다');
      return;
    }
    if (!formData.price || isNaN(Number(formData.price)) || Number(formData.price) <= 0) {
      toast.error('가격을 올바르게 입력해주세요');
      return;
    }
    setLoading(true);
    try {
      // 즉시 재판매 등록
      if (formData.resaleMode === 'immediate') {
        toast.info('MetaMask에서 재판매 트랜잭션을 승인해주세요...');
        await onChainListForResale(signer, id, formData.price);
        toast.success('재판매 등록 완료!', { duration: 5000 });
      } else {
        toast.info('아직 지원하지 않는 기능입니다');
      }
    } catch (err) {
      const msg = err.reason || err.response?.data?.error || err.message;
      toast.error('재판매 실패: ' + msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <form onSubmit={handleSubmit} className="glass-strong rounded-3xl p-10 space-y-8 border border-th-border">
        <h2 className="text-2xl font-bold text-th-heading mb-6">NFT 재판매 등록</h2>
        <div className="flex gap-6 flex-col md:flex-row">
          <div className="flex-1 space-y-4">
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
                value={formData.price}
                onChange={e => setFormData({ ...formData, price: e.target.value })}
                required
                className="bg-th-surface"
                placeholder="예: 0.01"
              />
            </div>
          </div>
        </div>
        <div className="space-y-2">
          <Label className="text-th-sub font-medium">민팅 시점 선택 *</Label>
          <div className="flex gap-4">
            <button
              type="button"
              className={`flex-1 rounded-2xl border px-6 py-4 flex flex-col items-start gap-1 text-left ${formData.resaleMode === 'immediate' ? 'border-th-accent bg-th-accent-bg-strong shadow-th-accent-glow shadow-md' : 'border-th-border bg-th-surface'}`}
              onClick={() => setFormData({ ...formData, resaleMode: 'immediate' })}
            >
              <span className="flex items-center gap-2 text-base font-bold">
                <Zap className="w-5 h-5 text-th-accent" /> 즉시 민팅
              </span>
              <span className="text-th-text-secondary text-xs">등록 즉시 온체인 NFT 발행 + 마켓 등록</span>
            </button>
            <button
              type="button"
              className={`flex-1 rounded-2xl border px-6 py-4 flex flex-col items-start gap-1 text-left ${formData.resaleMode === 'on_sale' ? 'border-th-accent bg-th-accent-bg-strong shadow-th-accent-glow shadow-md' : 'border-th-border bg-th-surface'}`}
              onClick={() => setFormData({ ...formData, resaleMode: 'on_sale' })}
              disabled
            >
              <span className="flex items-center gap-2 text-base font-bold">
                <ShoppingCart className="w-5 h-5 text-th-accent" /> 판매(구매) 시 민팅
              </span>
              <span className="text-th-text-secondary text-xs">마켓 등록만 하고 구매 시 민팅 진행 (준비중)</span>
            </button>
          </div>
        </div>
        <Button type="submit" disabled={loading || remaining <= 0} className="accent-gradient text-white shadow-md">
          {loading ? '등록 중...' : 'NFT 재판매 등록'}
        </Button>
      </form>
    </div>
  );
}
