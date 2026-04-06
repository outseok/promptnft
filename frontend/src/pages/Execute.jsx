// pages/Execute.jsx — AI 프롬프트 실행 페이지 (백엔드 API 연동)
import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useWallet } from '../context/WalletContext';
import { executePrompt } from '../api';
import { getContractAddress } from '../contract';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';
import { Play, Loader2, CheckCircle2 } from 'lucide-react';

export function Execute() {
  const { isConnected, address, signMessage } = useWallet();
  const [searchParams] = useSearchParams();
  const [nftToken, setNftToken] = useState('');
  const [inputText, setInputText] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);
  const [result, setResult] = useState(null);

  // URL 파라미터에서 tokenId 가져오기 (마이페이지에서 이동 시)
  useEffect(() => {
    const tokenId = searchParams.get('tokenId');
    if (tokenId) setNftToken(tokenId);
  }, [searchParams]);

  const handleExecute = async () => {
    if (!isConnected) {
      toast.error('지갑을 먼저 연결해주세요');
      return;
    }
    if (!nftToken || !inputText) {
      toast.error('NFT 토큰 ID와 입력 텍스트를 모두 입력해주세요');
      return;
    }

    setIsExecuting(true);
    setResult(null);

    try {
      // 1. 서명 생성 (소유권은 백엔드에서 온체인 검증)
      toast.info('MetaMask에서 서명을 승인해주세요...');
      const { nonce, signature } = await signMessage();

      // 2. 실행 요청
      const res = await executePrompt(
        {
          tokenId: Number(nftToken),
          userMessage: inputText,
        },
        {
          'x-wallet-address': address,
          'x-signature': signature,
          'x-nonce': nonce,
          'x-contract-address': getContractAddress(),
        }
      );

      setResult(res);
      toast.success('AI 실행이 완료되었습니다');
    } catch (err) {
      const msg = err.reason || err.response?.data?.error || err.message;
      toast.error('실행 실패: ' + msg);
    } finally {
      setIsExecuting(false);
    }
  };

  if (!isConnected) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4 max-w-md">
          <div className="w-20 h-20 bg-th-accent-bg rounded-3xl flex items-center justify-center mx-auto border border-th-accent-border">
            <Play className="w-10 h-10 text-th-accent" />
          </div>
          <h2 className="text-2xl font-bold text-th-heading">지갑을 연결해주세요</h2>
          <p className="text-th-text">AI를 실행하려면 MetaMask 지갑을 연결해야 합니다</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-th-heading mb-2">실행 페이지</h1>
        <p className="text-th-text">구매한 NFT의 AI 기능을 실행하세요</p>
      </div>

      <div className="glass-strong rounded-3xl p-8 space-y-6 border border-th-border">
        <div className="space-y-2">
          <Label htmlFor="nftToken" className="text-th-sub font-medium">NFT 토큰 ID *</Label>
          <Input
            id="nftToken"
            value={nftToken}
            onChange={(e) => setNftToken(e.target.value)}
            placeholder="실행할 NFT의 토큰 ID를 입력하세요"
            className="bg-th-surface border-th-border focus:border-th-focus focus:ring-th-ring rounded-xl text-th-sub placeholder:text-th-muted"
          />
          <p className="text-th-text-secondary text-sm">
            마이페이지의 보유 NFT 목록에서 토큰 ID를 확인할 수 있습니다
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="inputText" className="text-th-sub font-medium">입력 텍스트 *</Label>
          <Textarea
            id="inputText"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="AI에게 전달할 텍스트를 입력하세요..."
            rows={8}
            className="bg-th-surface border-th-border focus:border-th-focus focus:ring-th-ring rounded-xl text-th-sub placeholder:text-th-muted"
          />
        </div>

        <Button
          onClick={handleExecute}
          disabled={isExecuting}
          className="w-full accent-gradient text-white py-6 text-base font-medium shadow-md shadow-th-accent-glow hover:shadow-lg hover:shadow-th-accent-glow-strong transition-all border-0"
        >
          {isExecuting ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              실행 중... (MetaMask 서명 필요)
            </>
          ) : (
            <>
              <Play className="w-5 h-5 mr-2" />
              실행
            </>
          )}
        </Button>

        {result && (
          <div className="mt-6 glass-strong rounded-2xl p-6 border border-th-border">
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle2 className="w-5 h-5 text-th-success" />
              <h3 className="text-th-heading font-semibold text-lg">실행 결과</h3>
            </div>
            <pre className="text-th-strong text-sm whitespace-pre-wrap leading-relaxed bg-th-surface rounded-xl p-4 mb-4 border border-th-border">
              {result.result}
            </pre>
            <div className="flex gap-6 text-sm text-th-text">
              <span>사용 횟수: {result.usageCount}</span>
              <span>남은 횟수: {result.usageLeft}</span>
              {result.aiEnabled !== undefined && (
                <span>AI: {result.aiEnabled ? '활성' : '데모'}</span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
