// pages/RegisterNFT.jsx — NFT 등록 페이지 (민팅 시점 선택 + 승인 요청 흐름)
import { useState } from 'react';
import { useWallet } from '../context/WalletContext';
import { encryptPrompt, mintNFT } from '../api';
import { onChainMint, onChainListForSale, getNextTokenId } from '../contract';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';
import { Upload, CheckCircle2, Clock, Zap, ShoppingCart, Info } from 'lucide-react';

export function RegisterNFT() {
  const { isConnected, address, signer, provider } = useWallet();
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    prompt: '',
    price: '0.01',
    category: 'general',
    mintTiming: 'on_approve', // 'on_approve' | 'on_purchase'
    maxExecutions: '50',
  });
  const [thumbnail, setThumbnail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

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
      const tokenURI = JSON.stringify({
        title: formData.title,
        description: formData.description,
        category: formData.category,
      });
      const usageLimit = parseInt(formData.maxExecutions) || 50;
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
        finalTokenId = mintRes.token_id;

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
      setSubmitted(true);
      setFormData({ title: '', description: '', prompt: '', price: '0.01', category: 'general', mintTiming: 'on_approve', maxExecutions: '50' });
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
          <div className="w-20 h-20 bg-orange-100 rounded-3xl flex items-center justify-center mx-auto">
            <Upload className="w-10 h-10 text-orange-500" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800">{'\uc9c0\uac11\uc744 \uc5f0\uacb0\ud574\uc8fc\uc138\uc694'}</h2>
          <p className="text-gray-600">NFT\ub97c \ub4f1\ub85d\ud558\ub824\uba74 MetaMask \uc9c0\uac11\uc744 \uc5f0\uacb0\ud574\uc57c \ud569\ub2c8\ub2e4</p>
        </div>
      </div>
    );
  }

  // \ub4f1\ub85d \uc644\ub8cc \ud654\uba74
  if (submitted) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-3xl p-10 text-center space-y-6 border border-orange-100 shadow-sm">
          <div className="w-20 h-20 bg-green-100 rounded-3xl flex items-center justify-center mx-auto">
            <Clock className="w-10 h-10 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800">{'\uc2b9\uc778 \uc694\uccad\uc774 \uc804\uc1a1\ub418\uc5c8\uc2b5\ub2c8\ub2e4'}</h2>
          <p className="text-gray-600">
            {'\uad00\ub9ac\uc790\uac00 \ub4f1\ub85d \uc694\uccad\uc744 \uac80\ud1a0 \uc911\uc785\ub2c8\ub2e4.'}<br />
            {'\uc2b9\uc778\ub418\uba74 \ub9c8\uc774\ud398\uc774\uc9c0\uc5d0\uc11c \ud655\uc778\ud560 \uc218 \uc788\uc2b5\ub2c8\ub2e4.'}
          </p>
          <div className="bg-orange-50 rounded-2xl p-4 text-left space-y-2 border border-orange-100">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Info className="w-4 h-4 text-orange-400" />
              <span>{'\uc2b9\uc778 \uc808\ucc28 \uc548\ub0b4'}</span>
            </div>
            <ul className="text-sm text-gray-500 space-y-1 ml-6 list-disc">
              <li>{'\uad00\ub9ac\uc790\uac00 \ub4f1\ub85d \ub0b4\uc6a9\uc744 \uac80\ud1a0\ud569\ub2c8\ub2e4'}</li>
              <li>{'\uc2b9\uc778 \uc2dc NFT\uac00 \ubc1c\ud589\ub418\uace0 \ub9c8\ucf13\uc5d0 \ub4f1\ub85d\ub429\ub2c8\ub2e4'}</li>
              <li>{'\ubc18\ub824 \uc2dc \uc0ac\uc720\uc640 \ud568\uaed8 \uc54c\ub9bc\uc744 \ubc1b\uc2b5\ub2c8\ub2e4'}</li>
            </ul>
          </div>
          <Button
            onClick={() => setSubmitted(false)}
            className="bg-gradient-to-r from-orange-500 to-amber-400 hover:from-orange-600 hover:to-amber-500 text-white shadow-md shadow-orange-200/40"
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
        <h1 className="text-3xl font-bold text-gray-800 mb-2">NFT {'\ub4f1\ub85d'}</h1>
        <p className="text-gray-600">AI {'\ud504\ub86c\ud504\ud2b8\ub97c'} NFT{'\ub85c \ub4f1\ub85d\ud558\uace0 \uad00\ub9ac\uc790 \uc2b9\uc778\uc744 \ubc1b\uc73c\uc138\uc694'}</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-3xl p-8 space-y-6 border border-orange-100 shadow-sm">
        {/* \uc81c\ubaa9 */}
        <div className="space-y-2">
          <Label htmlFor="title" className="text-gray-800 font-medium">{'\uc81c\ubaa9 *'}</Label>
          <Input
            id="title"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            placeholder="\uc608: GPT-4 Content Writer"
            required
            className="bg-orange-50/50 border-orange-100 focus:border-orange-300 focus:ring-orange-200 rounded-xl"
          />
        </div>

        {/* \uce74\ud14c\uace0\ub9ac */}
        <div className="space-y-2">
          <Label htmlFor="category" className="text-gray-800 font-medium">{'\uce74\ud14c\uace0\ub9ac'}</Label>
          <select
            id="category"
            value={formData.category}
            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
            className="w-full h-9 rounded-xl border border-orange-100 bg-orange-50/50 px-3 text-sm focus:border-orange-300 focus:ring-orange-200 outline-none"
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
          <Label htmlFor="description" className="text-gray-800 font-medium">{'\uc124\uba85'}</Label>
          <Textarea
            id="description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder={'\uc774 AI \ub3c4\uad6c\uac00 \ubb34\uc5c7\uc744 \ud558\ub294\uc9c0 \uc790\uc138\ud788 \uc124\uba85\ud574\uc8fc\uc138\uc694'}
            rows={4}
            className="bg-orange-50/50 border-orange-100 focus:border-orange-300 focus:ring-orange-200 rounded-xl"
          />
        </div>

        {/* \uc378\ub124\uc77c */}
        <div className="space-y-2">
          <Label htmlFor="thumbnail" className="text-gray-800 font-medium">{'\uc378\ub124\uc77c \uc774\ubbf8\uc9c0'}</Label>
          <div className="flex items-start gap-6">
            <div className="flex-shrink-0">
              {thumbnail ? (
                <img src={thumbnail} alt="\uc378\ub124\uc77c" className="w-48 h-32 object-cover rounded-2xl border-2 border-orange-200" />
              ) : (
                <div className="w-48 h-32 bg-orange-50 rounded-2xl flex flex-col items-center justify-center border-2 border-dashed border-orange-200">
                  <Upload className="w-8 h-8 text-orange-400 mb-2" />
                  <span className="text-sm text-gray-500">{'\uc774\ubbf8\uc9c0 \uc5c5\ub85c\ub4dc'}</span>
                </div>
              )}
            </div>
            <div className="flex-1 space-y-2">
              <Input id="thumbnail" type="file" accept="image/*" onChange={handleImageUpload} className="bg-orange-50/50 border-orange-100 rounded-xl" />
              <p className="text-gray-500 text-sm">{'\ub9c8\ucf13\uc5d0 \ud45c\uc2dc\ub420 \uc378\ub124\uc77c \uc774\ubbf8\uc9c0 (\uad8c\uc7a5: 16:9)'}</p>
            </div>
          </div>
        </div>

        {/* \ud504\ub86c\ud504\ud2b8 */}
        <div className="space-y-2">
          <Label htmlFor="prompt" className="text-gray-800 font-medium">{'\ud504\ub86c\ud504\ud2b8 (\ube44\uacf5\uac1c) *'}</Label>
          <Textarea
            id="prompt"
            value={formData.prompt}
            onChange={(e) => setFormData({ ...formData, prompt: e.target.value })}
            placeholder={'\uc2dc\uc2a4\ud15c \ud504\ub86c\ud504\ud2b8\ub97c \uc785\ub825\ud558\uc138\uc694'}
            required
            rows={5}
            className="bg-orange-50/50 border-orange-100 focus:border-orange-300 focus:ring-orange-200 font-mono text-sm rounded-xl"
          />
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex gap-2">
            <span className="text-amber-600 text-sm">{'\u26a0\ufe0f'}</span>
            <p className="text-amber-800 text-sm">{'\uc774 \ud504\ub86c\ud504\ud2b8\ub294 \uad6c\ub9e4\uc790\uc5d0\uac8c \uacf5\uac1c\ub418\uc9c0 \uc54a\uc73c\uba70, AI \uc2e4\ud589 \uc2dc\uc5d0\ub9cc \uc0ac\uc6a9\ub429\ub2c8\ub2e4.'}</p>
          </div>
        </div>

        {/* \uac00\uaca9 */}
        <div className="space-y-2">
          <Label htmlFor="price" className="text-gray-800 font-medium">{'\uac00\uaca9 (ETH) *'}</Label>
          <Input
            id="price"
            type="text"
            value={formData.price}
            onChange={(e) => setFormData({ ...formData, price: e.target.value })}
            placeholder="0.01"
            required
            className="bg-orange-50/50 border-orange-100 focus:border-orange-300 focus:ring-orange-200 rounded-xl"
          />
        </div>

        {/* 최대 실행 횟수 */}
        <div className="space-y-2">
          <Label htmlFor="maxExecutions" className="text-gray-800 font-medium">최대 실행 횟수</Label>
          <Input
            id="maxExecutions"
            type="number"
            min="1"
            max="10000"
            value={formData.maxExecutions}
            onChange={(e) => setFormData({ ...formData, maxExecutions: e.target.value })}
            placeholder="50"
            className="bg-orange-50/50 border-orange-100 focus:border-orange-300 focus:ring-orange-200 rounded-xl"
          />
          <p className="text-gray-500 text-sm">구매자가 AI를 실행할 수 있는 최대 횟수 (온체인 기록)</p>
        </div>

        {/* \ubbfc\ud305 \uc2dc\uc810 \uc120\ud0dd */}
        <div className="space-y-3">
          <Label className="text-gray-800 font-medium">{'\ubbfc\ud305 \uc2dc\uc810 \uc120\ud0dd *'}</Label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label
              className={`relative flex cursor-pointer rounded-2xl border-2 p-5 transition-all ${
                formData.mintTiming === 'on_approve'
                  ? 'border-orange-400 bg-orange-50 shadow-sm'
                  : 'border-orange-100 bg-white hover:border-orange-200'
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
                  <Zap className={`w-5 h-5 ${formData.mintTiming === 'on_approve' ? 'text-orange-500' : 'text-gray-400'}`} />
                  <span className="font-semibold text-gray-800">{'\uc2b9\uc778 \uc2dc \uc989\uc2dc \ubbfc\ud305'}</span>
                </div>
                <p className="text-sm text-gray-500">{'\uad00\ub9ac\uc790 \uc2b9\uc778 \uc989\uc2dc NFT \ubc1c\ud589 + \ub9c8\ucf13 \ub4f1\ub85d'}</p>
              </div>
              {formData.mintTiming === 'on_approve' && (
                <CheckCircle2 className="absolute top-3 right-3 w-5 h-5 text-orange-500" />
              )}
            </label>

            <label
              className={`relative flex cursor-pointer rounded-2xl border-2 p-5 transition-all ${
                formData.mintTiming === 'on_purchase'
                  ? 'border-orange-400 bg-orange-50 shadow-sm'
                  : 'border-orange-100 bg-white hover:border-orange-200'
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
                  <ShoppingCart className={`w-5 h-5 ${formData.mintTiming === 'on_purchase' ? 'text-orange-500' : 'text-gray-400'}`} />
                  <span className="font-semibold text-gray-800">{'\ud310\ub9e4(\uad6c\ub9e4) \uc2dc \ubbfc\ud305'}</span>
                </div>
                <p className="text-sm text-gray-500">{'\ub9c8\ucf13 \ub4f1\ub85d\ub9cc \ud558\uace0 \uad6c\ub9e4 \uc2dc \ubbfc\ud305 \uc9c4\ud589'}</p>
              </div>
              {formData.mintTiming === 'on_purchase' && (
                <CheckCircle2 className="absolute top-3 right-3 w-5 h-5 text-orange-500" />
              )}
            </label>
          </div>
        </div>

        {/* \uc81c\ucd9c */}
        <div className="pt-4">
          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-orange-500 to-amber-400 hover:from-orange-600 hover:to-amber-500 text-white py-6 text-base font-medium shadow-md shadow-orange-200/40 hover:shadow-lg hover:shadow-orange-300/40 transition-all"
          >
            {loading ? '\ub4f1\ub85d \uc911...' : (
              <>
                <CheckCircle2 className="w-5 h-5 mr-2" />
                {'\ub4f1\ub85d (\uad00\ub9ac\uc790 \uc2b9\uc778 \uc694\uccad)'}
              </>
            )}
          </Button>
          <p className="text-gray-500 text-sm text-center mt-4">
            {'\ub4f1\ub85d \ud6c4 \uad00\ub9ac\uc790\uc758 \uc2b9\uc778\uc744 \ubc1b\uc544\uc57c \ub9c8\ucf13\uc5d0 \uacf5\uac1c\ub429\ub2c8\ub2e4.'}
          </p>
        </div>
      </form>
    </div>
  );
}
