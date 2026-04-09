// pages/RegisterNFT.jsx — NFT 등록 페이지 (민팅 시점 선택 + 승인 요청 흐름)
import { useState } from 'react';
import { useWallet } from '../context/WalletContext';
import { encryptPrompt, mintNFT, screenPrompt } from '../api';
import { onChainMint, onChainListForSale, getNextTokenId } from '../contract';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';
import { Upload, CheckCircle2, Clock, Zap, ShoppingCart, Info, ShieldCheck } from 'lucide-react';

export function RegisterNFT() {
  const { isConnected, address, signer, provider } = useWallet();
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    prompt: '',
    price: '0.01',
    category: 'general',
    mintTiming: 'on_approve', // 'on_approve' | 'on_purchase'
  });
  const [thumbnail, setThumbnail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submittedMode, setSubmittedMode] = useState(null);

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setThumbnail(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isConnected) {
      toast.error('\uc9c0\uac11\uc744 \uba3c\uc800 \uc5f0\uacb0\ud574\uc8fc\uc138\uc694');
      return;
    }
    if (!formData.prompt.trim()) {
      toast.error('\ud504\ub86c\ud504\ud2b8\ub97c \uc785\ub825\ud574\uc8fc\uc138\uc694');
      return;
    }

    setLoading(true);
    try {
      // ── 프롬프트 악성 콘텐츠 검사 ──
      toast.info('프롬프트 안전성 검사 중...');
      try {
        const screening = await screenPrompt({
          prompt: formData.prompt,
          walletAddress: address,
          title: formData.title,
          description: formData.description,
          price: formData.price,
          category: formData.category,
          image_url: thumbnail || null,
          mint_mode: formData.mintTiming === 'on_purchase' ? 'lazy' : 'direct',
        });
        if (screening.result !== 'PASS') {
          toast.warning('프롬프트가 AI 심사에서 거절되었습니다. 관리자 검토 후 승인되면 등록됩니다.', { duration: 6000 });
          setSubmittedMode('pending');
          setSubmitted(true);
          setLoading(false);
          return;
        }
        toast.success('프롬프트 검사 통과');
      } catch {
        toast.error('프롬프트 검사 서비스에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.');
        setLoading(false);
        return;
      }

      const tokenURI = JSON.stringify({
        title: formData.title,
        description: formData.description,
        category: formData.category,
      });
      const usageLimit = 50;
      const isLazy = formData.mintTiming === 'on_purchase';

      let finalTokenId;

      if (isLazy) {
        // Lazy mint: DB에만 저장, 온체인 민팅 안 함
        toast.info('백엔드에 등록 중...');
        const mintRes = await mintNFT({
          title: formData.title,
          description: formData.description,
          prompt_encrypted: '[encrypted]',
          creator_address: address,
          price: formData.price,
          category: formData.category,
          image_url: thumbnail || null,
          mint_mode: 'lazy',
          max_executions: usageLimit,
        });
        finalTokenId = mintRes.data?.token_id ?? mintRes.token_id;

        // 프롬프트 암호화
        await encryptPrompt({
          tokenId: finalTokenId,
          promptContent: formData.prompt,
          walletAddress: address,
        });
      } else {
        // Direct mint: 즉시 온체인 민팅
        toast.info('MetaMask에서 민팅 트랜잭션을 승인해주세요...');
        const { tokenId } = await onChainMint(signer, tokenURI, usageLimit);
        finalTokenId = tokenId ?? (await getNextTokenId(provider) - 1);

        toast.info('온체인 민팅 완료! 백엔드 저장 중...');

        // 프롬프트 암호화
        await encryptPrompt({
          tokenId: finalTokenId,
          promptContent: formData.prompt,
          walletAddress: address,
        });

        // 백엔드 저장
        await mintNFT({
          token_id: finalTokenId,
          title: formData.title,
          description: formData.description,
          prompt_encrypted: '[encrypted]',
          creator_address: address,
          price: formData.price,
          category: formData.category,
          image_url: thumbnail || null,
          mint_mode: 'direct',
          max_executions: usageLimit,
        });

        // 판매 등록
        if (Number(formData.price) > 0) {
          toast.info('판매 등록 중...');
          await onChainListForSale(signer, finalTokenId, String(formData.price));
        }
      }

      toast.success('NFT 등록 완료!', { duration: 5000 });
      setSubmittedMode(isLazy ? 'lazy' : 'direct');
      setSubmitted(true);
      setFormData({ title: '', description: '', prompt: '', price: '0.01', category: 'general', mintTiming: 'on_approve' });
      setThumbnail(null);
    } catch (err) {
      const msg = err.reason || err.response?.data?.error || err.message;
      toast.error('\ub4f1\ub85d \uc2e4\ud328: ' + msg);
    } finally {
      setLoading(false);
    }
  };

  if (!isConnected) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4 max-w-md">
          <div className="w-20 h-20 bg-th-accent-bg rounded-3xl flex items-center justify-center mx-auto border border-th-accent-border">
            <Upload className="w-10 h-10 text-th-accent" />
          </div>
          <h2 className="text-2xl font-bold text-th-heading">{'\uc9c0\uac11\uc744 \uc5f0\uacb0\ud574\uc8fc\uc138\uc694'}</h2>
          <p className="text-th-text">NFT\ub97c \ub4f1\ub85d\ud558\ub824\uba74 MetaMask \uc9c0\uac11\uc744 \uc5f0\uacb0\ud574\uc57c \ud569\ub2c8\ub2e4</p>
        </div>
      </div>
    );
  }

  // 등록 완료 화면
  if (submitted) {
    const isDirect = submittedMode === 'direct';
    const isPending = submittedMode === 'pending';
    return (
      <div className="max-w-2xl mx-auto">
        <div className="glass-strong rounded-3xl p-10 text-center space-y-6 border border-th-border">
          <div className={`w-20 h-20 ${isPending ? 'bg-th-warning-bg border-th-warning-border' : 'bg-th-success-bg border-th-success-border'} rounded-3xl flex items-center justify-center mx-auto border`}>
            {isPending ? (
              <ShieldCheck className="w-10 h-10 text-th-warning" />
            ) : isDirect ? (
              <CheckCircle2 className="w-10 h-10 text-th-success" />
            ) : (
              <Clock className="w-10 h-10 text-th-success" />
            )}
          </div>
          <h2 className="text-2xl font-bold text-th-heading">
            {isPending ? '관리자 검토 대기 중' : isDirect ? 'NFT 민팅 및 판매 등록 완료!' : '마켓 등록이 완료되었습니다'}
          </h2>
          <p className="text-th-text">
            {isPending ? (
              <>AI 심사에서 추가 확인이 필요한 프롬프트로 판별되었습니다.<br />관리자가 검토 후 승인하면 마켓에 등록됩니다.</>
            ) : isDirect ? (
              <>온체인 민팅과 마켓 등록이 완료되었습니다.<br />마켓에서 바로 확인할 수 있습니다.</>
            ) : (
              <>마켓에 등록되었습니다.<br />구매자가 구매 시 온체인 민팅이 진행됩니다.</>
            )}
          </p>
          <div className="bg-th-surface rounded-2xl p-4 text-left space-y-2 border border-th-border">
            <div className="flex items-center gap-2 text-sm text-th-text">
              <Info className="w-4 h-4 text-th-accent" />
              <span>{isPending ? '심사 안내' : isDirect ? '등록 완료 안내' : '지연 민팅 안내'}</span>
            </div>
            <ul className="text-sm text-th-text-secondary space-y-1 ml-6 list-disc">
              {isPending ? (
                <>
                  <li>프롬프트가 AI 안전성 검사를 통과하지 못했습니다</li>
                  <li>관리자가 직접 원문을 확인하고 최종 결정합니다</li>
                  <li>승인되면 자동으로 마켓에 등록됩니다</li>
                </>
              ) : isDirect ? (
                <>
                  <li>NFT가 온체인에 발행되었습니다</li>
                  <li>마켓에서 즉시 판매가 시작됩니다</li>
                  <li>마이페이지에서 판매 상태를 관리할 수 있습니다</li>
                </>
              ) : (
                <>
                  <li>NFT 정보가 마켓에 등록되었습니다</li>
                  <li>구매자가 구매할 때 온체인 민팅이 진행됩니다</li>
                  <li>가스비는 구매자가 부담합니다</li>
                </>
              )}
            </ul>
          </div>
          <Button
            onClick={() => { setSubmitted(false); setSubmittedMode(null); }}
            className="accent-gradient text-white shadow-md shadow-th-accent-glow"
          >
            {'\uc0c8 NFT \ub4f1\ub85d\ud558\uae30'}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-th-heading mb-2">NFT {'\ub4f1\ub85d'}</h1>
        <p className="text-th-text">AI {'\ud504\ub86c\ud504\ud2b8\ub97c'} NFT{'\ub85c \ub4f1\ub85d\ud558\uace0 \ub9c8\ucf13\uc5d0 \ud310\ub9e4\ud558\uc138\uc694'}</p>
      </div>

      <form onSubmit={handleSubmit} className="glass-strong rounded-3xl p-8 space-y-6 border border-th-border">
        {/* \uc81c\ubaa9 */}
        <div className="space-y-2">
          <Label htmlFor="title" className="text-th-sub font-medium">{'\uc81c\ubaa9 *'}</Label>
          <Input
            id="title"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            placeholder="\uc608: GPT-4 Content Writer"
            required
            className="bg-th-surface border-th-border focus:border-th-focus focus:ring-th-ring rounded-xl text-th-sub placeholder:text-th-muted"
          />
        </div>

        {/* \uce74\ud14c\uace0\ub9ac */}
        <div className="space-y-2">
          <Label htmlFor="category" className="text-th-sub font-medium">{'\uce74\ud14c\uace0\ub9ac'}</Label>
          <select
            id="category"
            value={formData.category}
            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
            className="w-full h-9 rounded-xl border border-th-border bg-th-surface px-3 text-sm text-th-sub focus:border-th-focus focus:ring-th-ring outline-none"
          >
            <option value="general">{'\uc77c\ubc18'}</option>
            <option value="writing">{'\uae00\uc4f0\uae30'}</option>
            <option value="coding">{'\ucf54\ub529'}</option>
            <option value="art">{'\uc544\ud2b8'}</option>
            <option value="business">{'\ube44\uc988\ub2c8\uc2a4'}</option>
          </select>
        </div>

        {/* \uc124\uba85 */}
        <div className="space-y-2">
          <Label htmlFor="description" className="text-th-sub font-medium">{'\uc124\uba85'}</Label>
          <Textarea
            id="description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder={'\uc774 AI \ub3c4\uad6c\uac00 \ubb34\uc5c7\uc744 \ud558\ub294\uc9c0 \uc790\uc138\ud788 \uc124\uba85\ud574\uc8fc\uc138\uc694'}
            rows={4}
            className="bg-th-surface border-th-border focus:border-th-focus focus:ring-th-ring rounded-xl text-th-sub placeholder:text-th-muted"
          />
        </div>

        {/* \uc378\ub124\uc77c */}
        <div className="space-y-2">
          <Label htmlFor="thumbnail" className="text-th-sub font-medium">{'\uc378\ub124\uc77c \uc774\ubbf8\uc9c0'}</Label>
          <div className="flex items-start gap-6">
            <div className="flex-shrink-0">
              {thumbnail ? (
                <img src={thumbnail} alt="\uc378\ub124\uc77c" className="w-48 h-32 object-cover rounded-2xl border-2 border-th-border-strong" />
              ) : (
                <div className="w-48 h-32 bg-th-surface rounded-2xl flex flex-col items-center justify-center border-2 border-dashed border-th-border-strong">
                  <Upload className="w-8 h-8 text-th-accent mb-2" />
                  <span className="text-sm text-th-text-secondary">{'\uc774\ubbf8\uc9c0 \uc5c5\ub85c\ub4dc'}</span>
                </div>
              )}
            </div>
            <div className="flex-1 space-y-2">
              <Input id="thumbnail" type="file" accept="image/*" onChange={handleImageUpload} className="bg-th-surface border-th-border rounded-xl text-th-sub" />
              <p className="text-th-text-secondary text-sm">{'\ub9c8\ucf13\uc5d0 \ud45c\uc2dc\ub420 \uc378\ub124\uc77c \uc774\ubbf8\uc9c0 (\uad8c\uc7a5: 16:9)'}</p>
            </div>
          </div>
        </div>

        {/* \ud504\ub86c\ud504\ud2b8 */}
        <div className="space-y-2">
          <Label htmlFor="prompt" className="text-th-sub font-medium">{'\ud504\ub86c\ud504\ud2b8 (\ube44\uacf5\uac1c) *'}</Label>
          <Textarea
            id="prompt"
            value={formData.prompt}
            onChange={(e) => setFormData({ ...formData, prompt: e.target.value })}
            placeholder={'\uc2dc\uc2a4\ud15c \ud504\ub86c\ud504\ud2b8\ub97c \uc785\ub825\ud558\uc138\uc694'}
            required
            rows={5}
            className="bg-th-surface border-th-border focus:border-th-focus focus:ring-th-ring font-mono text-sm rounded-xl text-th-sub placeholder:text-th-muted"
          />
          <div className="bg-th-warning-bg border border-th-warning-border rounded-xl p-3 flex gap-2">
            <span className="text-th-warning text-sm">{'\u26a0\ufe0f'}</span>
            <p className="text-th-warning-light text-sm">{'\uc774 \ud504\ub86c\ud504\ud2b8\ub294 \uad6c\ub9e4\uc790\uc5d0\uac8c \uacf5\uac1c\ub418\uc9c0 \uc54a\uc73c\uba70, AI \uc2e4\ud589 \uc2dc\uc5d0\ub9cc \uc0ac\uc6a9\ub429\ub2c8\ub2e4.'}</p>
          </div>
        </div>

        {/* \uac00\uaca9 */}
        <div className="space-y-2">
          <Label htmlFor="price" className="text-th-sub font-medium">{'\uac00\uaca9 (ETH) *'}</Label>
          <Input
            id="price"
            type="text"
            value={formData.price}
            onChange={(e) => setFormData({ ...formData, price: e.target.value })}
            placeholder="0.01"
            required
            className="bg-th-surface border-th-border focus:border-th-focus focus:ring-th-ring rounded-xl text-th-sub placeholder:text-th-muted"
          />
        </div>

        {/* 최대 실행 횟수 — 50회 고정 */}
        <div className="space-y-2">
          <Label className="text-th-sub font-medium">최대 실행 횟수</Label>
          <div className="flex items-center gap-3 bg-th-surface border border-th-border rounded-xl px-4 py-2">
            <Zap className="w-4 h-4 text-th-accent" />
            <span className="text-th-sub font-semibold">50회</span>
            <span className="text-th-text-secondary text-sm">고정 (사용량 소진 시 NFT 자동 소멸)</span>
          </div>
        </div>

        {/* \ubbfc\ud305 \uc2dc\uc810 \uc120\ud0dd */}
        <div className="space-y-3">
          <Label className="text-th-sub font-medium">{'\ubbfc\ud305 \uc2dc\uc810 \uc120\ud0dd *'}</Label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label
              className={`relative flex cursor-pointer rounded-2xl border-2 p-5 transition-all ${
                formData.mintTiming === 'on_approve'
                  ? 'border-th-focus bg-th-accent-bg shadow-sm shadow-th-accent-glow'
                  : 'border-th-border bg-th-surface hover:border-th-border-strong'
              }`}
            >
              <input
                type="radio"
                name="mintTiming"
                value="on_approve"
                checked={formData.mintTiming === 'on_approve'}
                onChange={(e) => setFormData({ ...formData, mintTiming: e.target.value })}
                className="sr-only"
              />
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Zap className={`w-5 h-5 ${formData.mintTiming === 'on_approve' ? 'text-th-accent' : 'text-th-text-secondary'}`} />
                  <span className="font-semibold text-th-sub">즉시 민팅</span>
                </div>
                <p className="text-sm text-th-text-secondary">등록 즉시 온체인 NFT 발행 + 마켓 등록</p>
              </div>
              {formData.mintTiming === 'on_approve' && (
                <CheckCircle2 className="absolute top-3 right-3 w-5 h-5 text-th-accent" />
              )}
            </label>

            <label
              className={`relative flex cursor-pointer rounded-2xl border-2 p-5 transition-all ${
                formData.mintTiming === 'on_purchase'
                  ? 'border-th-focus bg-th-accent-bg shadow-sm shadow-th-accent-glow'
                  : 'border-th-border bg-th-surface hover:border-th-border-strong'
              }`}
            >
              <input
                type="radio"
                name="mintTiming"
                value="on_purchase"
                checked={formData.mintTiming === 'on_purchase'}
                onChange={(e) => setFormData({ ...formData, mintTiming: e.target.value })}
                className="sr-only"
              />
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <ShoppingCart className={`w-5 h-5 ${formData.mintTiming === 'on_purchase' ? 'text-th-accent' : 'text-th-text-secondary'}`} />
                  <span className="font-semibold text-th-sub">{'\ud310\ub9e4(\uad6c\ub9e4) \uc2dc \ubbfc\ud305'}</span>
                </div>
                <p className="text-sm text-th-text-secondary">{'\ub9c8\ucf13 \ub4f1\ub85d\ub9cc \ud558\uace0 \uad6c\ub9e4 \uc2dc \ubbfc\ud305 \uc9c4\ud589'}</p>
              </div>
              {formData.mintTiming === 'on_purchase' && (
                <CheckCircle2 className="absolute top-3 right-3 w-5 h-5 text-th-accent" />
              )}
            </label>
          </div>
        </div>

        {/* \uc81c\ucd9c */}
        <div className="pt-4">
          <Button
            type="submit"
            disabled={loading}
            className="w-full accent-gradient text-white py-6 text-base font-medium shadow-md shadow-th-accent-glow hover:shadow-lg hover:shadow-th-accent-glow-strong transition-all border-0"
          >
            {loading ? '\ub4f1\ub85d \uc911...' : (
              <>
                <CheckCircle2 className="w-5 h-5 mr-2" />
                {formData.mintTiming === 'on_approve' ? 'NFT 즉시 등록' : '마켓 등록'}
              </>
            )}
          </Button>
          <p className="text-th-text-secondary text-sm text-center mt-4">
            {formData.mintTiming === 'on_approve'
              ? '등록 즉시 온체인에 민팅되고 마켓에 공개됩니다.'
              : '마켓에 등록되며, 구매 시 온체인 민팅이 진행됩니다.'}
          </p>
        </div>
      </form>
    </div>
  );
}
