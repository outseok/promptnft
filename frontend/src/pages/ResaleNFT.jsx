// pages/ResaleNFT.jsx — NFT 재판매 등록 폼
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '../context/WalletContext';
import { useParams } from 'react-router-dom';
import { getNFTDetail, screenPrompt } from '../api';
import { onChainListForResale, onChainBurn, onChainMint } from '../contract';
import { mintNFT } from '../api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';
import { Zap, ShoppingCart } from 'lucide-react';

export function ResaleNFT() {
  const { isConnected, signer, address } = useWallet();
  const { id } = useParams();
  const navigate = useNavigate();
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
      // 1. LLM 프롬프트 검증
      const screenRes = await screenPrompt({
        prompt: nft.prompt || nft.title || '',
        walletAddress: nft.owner || nft.creator_address || '',
        title: nft.title,
        description: nft.description,
        price: formData.price,
        category: nft.category,
        image_url: nft.image_url,
        mint_mode: 'resale',
      });
      if (screenRes.result !== 'PASS') {
        toast.error(`AI 검증 실패: ${screenRes.reason || '등록 불가한 프롬프트입니다.'}`);
        setLoading(false);
        return;
      }
      // 2. 기존 NFT 소각
      toast.info('MetaMask에서 기존 NFT 소각 트랜잭션을 승인해주세요...');
      await onChainBurn(signer, id);
      // 기존 NFT를 DB에서도 삭제
      await fetch(`/api/nfts/${id}`, {
        method: 'DELETE',
        headers: {
          'x-wallet-address': address,
        },
      });

      // 3. 재판매 방식 분기
      if (formData.resaleMode === 'immediate') {
        // 즉시 민팅 재판매: 새 민팅 + 마켓 등록
        toast.info('MetaMask에서 새 NFT 민팅 트랜잭션을 승인해주세요...');
        const tokenURI = JSON.stringify({
          title: nft.title,
          description: nft.description,
          category: nft.category,
        });
        const usageLimit = nft.max_executions || 50;
        const { tokenId } = await onChainMint(signer, tokenURI, usageLimit);
        toast.info('MetaMask에서 마켓 등록 트랜잭션을 승인해주세요...');
        await onChainListForResale(signer, tokenId, formData.price);

        // 1. 민팅 성공 후 DB에 NFT 추가
        await mintNFT({
          token_id: tokenId,
          title: nft.title,
          description: nft.description,
          prompt_encrypted: nft.prompt || nft.title || '',
          creator_address: nft.creator_address,
          owner_address: address, // 소유자 명시적으로 지정
          price: formData.price,
          category: nft.category,
          image_url: nft.image_url,
          mint_mode: 'direct',
          max_executions: nft.max_executions || 50,
        });

        // 2. PATCH 전에 owner_address가 내 address와 일치하는지 확인 (최대 5회, 500ms 간격)
        let tries = 0;
        let ownerOk = false;
        while (tries < 5) {
          const detail = await (await fetch(`/api/nfts/${tokenId}`)).json();
          if (detail?.data?.owner_address?.toLowerCase() === address?.toLowerCase()) {
            ownerOk = true;
            break;
          }
          await new Promise(res => setTimeout(res, 500));
          tries++;
        }
        if (!ownerOk) {
          toast.error('민팅 후 소유자 정보 동기화에 실패했습니다. 잠시 후 다시 시도해 주세요.');
          setLoading(false);
          return;
        }
        await fetch(`/api/nfts/${tokenId}/sale`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'x-wallet-address': address,
          },
          body: JSON.stringify({ is_for_sale: 1, price: formData.price }),
        });
        toast.success('즉시 민팅 + 재판매 등록 완료!', { duration: 2000 });
        navigate('/');
      } else {
        // 판매 시 민팅 재판매: 마켓 등록만
        toast.info('마켓에 재판매 등록만 진행합니다. (판매 시 민팅)');
        await onChainListForResale(signer, id, formData.price); // 기존 id는 소각되어 있으므로, 백엔드/DB에만 등록 필요
        toast.success('판매 시 민팅 재판매 등록 완료!', { duration: 5000 });
      }
    } catch (err) {
      // 상세 에러 콘솔 출력 및 토스트에 더 많은 정보 표시
      console.error('재판매 실패 상세:', err);
      const msg = err.reason || err.data?.message || err.message || JSON.stringify(err);
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
