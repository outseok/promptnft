// pages/Admin.jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '../context/WalletContext';
import { getNFTs, adminDeleteNFT, adminForceDelist } from '../api';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Textarea } from '../components/ui/textarea';
import { toast } from 'sonner';
import {
  ShieldCheck, CheckCircle2, Trash2, Store, Clock,
  XCircle, Zap, ShoppingCart, RefreshCw, AlertTriangle,
} from 'lucide-react';

export function Admin() {
  const { isAdmin, isConnected } = useWallet();
  const navigate = useNavigate();
  const [nfts, setNfts] = useState([]);
  const [pendingNfts, setPendingNfts] = useState([]);
  const [rejectModal, setRejectModal] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [approveModal, setApproveModal] = useState(null);

  useEffect(() => {
    if (!isConnected || !isAdmin) {
      navigate('/');
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await getNFTs();
        if (!cancelled) {
          const all = res.data || [];
          setNfts(all);
          setPendingNfts(all.filter(nft => nft.approval_status === 'pending'));
        }
      } catch {
        if (!cancelled) {
          setNfts([]);
          setPendingNfts([]);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [isAdmin, isConnected, navigate]);

  function loadData() {
    getNFTs()
      .then(res => {
        const all = res.data || [];
        setNfts(all);
        setPendingNfts(all.filter(nft => nft.approval_status === 'pending'));
      })
      .catch(() => {
        setNfts([]);
        setPendingNfts([]);
      });
  }

  async function handleDelete(tokenId) {
    if (!confirm('NFT #' + tokenId + '\uc744(\ub97c) \uc0ad\uc81c\ud558\uc2dc\uaca0\uc2b5\ub2c8\uae4c? \uc774 \uc791\uc5c5\uc740 \ub418\ub3cc\ub9b4 \uc218 \uc5c6\uc2b5\ub2c8\ub2e4.')) return;
    try {
      await adminDeleteNFT(tokenId);
      toast.success('NFT #' + tokenId + ' \uc0ad\uc81c \uc644\ub8cc');
      loadData();
    } catch (err) {
      toast.error('\uc0ad\uc81c \uc2e4\ud328: ' + (err.response?.data?.error || err.message));
    }
  }

  async function handleForceDelist(tokenId) {
    try {
      await adminForceDelist(tokenId);
      toast.success('NFT #' + tokenId + ' \ud310\ub9e4 \uac15\uc81c \uc911\uc9c0');
      loadData();
    } catch (err) {
      toast.error('\ud310\ub9e4 \uc911\uc9c0 \uc2e4\ud328: ' + (err.response?.data?.error || err.message));
    }
  }

  // UI \uc804\uc6a9 - \uc2b9\uc778 \ucc98\ub9ac (\ubc31\uc5d4\ub4dc API \ubbf8\uad6c\ud604)
  function handleApprove(nft, mintType) {
    if (mintType === 'immediate') {
      toast.success('NFT #' + nft.token_id + ' \uc2b9\uc778 \uc644\ub8cc - \uc989\uc2dc \ubbfc\ud305 + \ub9c8\ucf13 \ub4f1\ub85d', { duration: 4000 });
    } else {
      toast.success('NFT #' + nft.token_id + ' \uc2b9\uc778 \uc644\ub8cc - \ub9c8\ucf13 \ub4f1\ub85d (\ud310\ub9e4 \uc2dc \ubbfc\ud305)', { duration: 4000 });
    }
    setPendingNfts(prev => prev.filter(p => p.token_id !== nft.token_id));
    setApproveModal(null);
  }

  // UI \uc804\uc6a9 - \ubc18\ub824 \ucc98\ub9ac
  function handleReject(nft) {
    if (!rejectReason.trim()) {
      toast.error('\ubc18\ub824 \uc0ac\uc720\ub97c \uc785\ub825\ud574\uc8fc\uc138\uc694');
      return;
    }
    toast.info('NFT #' + nft.token_id + ' \ubc18\ub824 \uc644\ub8cc:\n' + rejectReason, { duration: 4000 });
    setPendingNfts(prev => prev.filter(p => p.token_id !== nft.token_id));
    setRejectModal(null);
    setRejectReason('');
  }

  if (!isAdmin) return null;

  const forSaleNfts = nfts.filter(nft => nft.is_for_sale);

  return (
    <div className="space-y-6">
      {/* \ud5e4\ub354 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-orange-100 rounded-2xl flex items-center justify-center">
            <ShieldCheck className="w-7 h-7 text-orange-500" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-800">{'\uad00\ub9ac\uc790 \ud398\uc774\uc9c0'}</h1>
            <p className="text-gray-600">NFT {'\uc2b9\uc778 \ubc0f \uad00\ub9ac'}</p>
          </div>
        </div>
        <Button onClick={loadData} variant="outline" className="border-orange-200 text-gray-700 hover:bg-orange-50">
          <RefreshCw className="w-4 h-4 mr-2" />
          {'\uc0c8\ub85c\uace0\uce68'}
        </Button>
      </div>

      {/* \ud1b5\uacc4 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard icon={Clock} color="yellow" label={'\uc2b9\uc778 \ub300\uae30'} value={pendingNfts.length} />
        <StatCard icon={Store} color="green" label={'\ud310\ub9e4 \uc911'} value={forSaleNfts.length} />
        <StatCard icon={ShieldCheck} color="orange" label={'\uc804\uccb4 NFT'} value={nfts.length} />
        <StatCard icon={CheckCircle2} color="blue" label={'\uc2b9\uc778 \uc644\ub8cc'} value={nfts.filter(n => n.approval_status !== 'pending').length} />
      </div>

      {/* \ud0ed */}
      <Tabs defaultValue="pending" className="w-full">
        <TabsList className="bg-white border border-orange-100 rounded-2xl">
          <TabsTrigger
            value="pending"
            className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-100 data-[state=active]:to-amber-100 data-[state=active]:text-orange-700 text-gray-600 rounded-xl"
          >
            {'\uc2b9\uc778 \ub300\uae30'} ({pendingNfts.length})
          </TabsTrigger>
          <TabsTrigger
            value="all"
            className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-100 data-[state=active]:to-amber-100 data-[state=active]:text-orange-700 text-gray-600 rounded-xl"
          >
            {'\uc804\uccb4 \uad00\ub9ac'} ({nfts.length})
          </TabsTrigger>
        </TabsList>

        {/* ===== \uc2b9\uc778 \ub300\uae30 \ud0ed ===== */}
        <TabsContent value="pending" className="mt-6">
          {pendingNfts.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-3xl border border-orange-100">
              <div className="w-16 h-16 bg-green-50 rounded-3xl flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-8 h-8 text-green-400" />
              </div>
              <p className="text-gray-600 text-lg mb-2">{'\uc2b9\uc778 \ub300\uae30 \uc911\uc778 NFT\uac00 \uc5c6\uc2b5\ub2c8\ub2e4'}</p>
              <p className="text-gray-400 text-sm">{'\ubaa8\ub4e0 \ub4f1\ub85d \uc694\uccad\uc774 \ucc98\ub9ac\ub418\uc5c8\uc2b5\ub2c8\ub2e4'}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingNfts.map((nft) => (
                <div key={nft.token_id} className="bg-white rounded-3xl p-6 border border-orange-100 shadow-sm">
                  <div className="flex gap-6">
                    <div className="w-32 h-32 rounded-2xl bg-gradient-to-br from-orange-100 to-amber-50 flex-shrink-0 overflow-hidden">
                      {nft.image_url ? (
                        <img src={nft.image_url} alt={nft.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-3xl">{'\ud83e\udd16'}</div>
                      )}
                    </div>
                    <div className="flex-1 space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="text-gray-800 font-bold text-xl">{nft.title}</h3>
                          <p className="text-gray-500 text-sm mt-1">#{nft.token_id} \u00b7 {nft.category || '\uc77c\ubc18'}</p>
                        </div>
                        <Badge className="bg-yellow-50 text-yellow-700 border-yellow-200">
                          <Clock className="w-3 h-3 mr-1" />
                          {'\uc2b9\uc778 \ub300\uae30'}
                        </Badge>
                      </div>
                      <p className="text-gray-600 text-sm line-clamp-2">{nft.description || '\uc124\uba85 \uc5c6\uc74c'}</p>
                      <div className="flex items-center gap-6 text-sm">
                        <div>
                          <span className="text-gray-500">{'\uac00\uaca9'}</span>
                          <span className="text-orange-500 font-bold ml-2">{nft.price} ETH</span>
                        </div>
                        <div>
                          <span className="text-gray-500">{'\ub4f1\ub85d\uc790'}</span>
                          <span className="text-gray-700 font-mono ml-2">{nft.creator_address?.slice(0, 10)}...</span>
                        </div>
                        <div>
                          <span className="text-gray-500">{'\ubbfc\ud305 \uc2dc\uc810'}</span>
                          <span className="text-gray-700 ml-2">
                            {nft.mint_timing === 'on_purchase' ? '\ud310\ub9e4 \uc2dc' : '\uc2b9\uc778 \uc2dc \uc989\uc2dc'}
                          </span>
                        </div>
                      </div>
                      {/* \uc561\uc158 \ubc84\ud2bc */}
                      <div className="flex gap-3 pt-2">
                        <Button
                          onClick={() => setApproveModal(nft)}
                          className="bg-gradient-to-r from-green-500 to-green-400 hover:from-green-600 hover:to-green-500 text-white"
                        >
                          <CheckCircle2 className="w-4 h-4 mr-2" />
                          {'\uc2b9\uc778'}
                        </Button>
                        <Button
                          onClick={() => { setRejectModal(nft); setRejectReason(''); }}
                          variant="outline"
                          className="border-red-300 text-red-600 hover:bg-red-50"
                        >
                          <XCircle className="w-4 h-4 mr-2" />
                          {'\ubc18\ub824'}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ===== \uc804\uccb4 \uad00\ub9ac \ud0ed ===== */}
        <TabsContent value="all" className="mt-6">
          <div className="bg-white rounded-2xl border border-orange-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-orange-50 border-b border-orange-100">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-800">ID</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-800">{'\uc81c\ubaa9'}</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-800">{'\uce74\ud14c\uace0\ub9ac'}</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-800">{'\uac00\uaca9'}</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-800">{'\uc18c\uc720\uc790'}</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-800">{'\uc2e4\ud589'}</th>
                    <th className="px-6 py-4 text-center text-sm font-semibold text-gray-800">{'\uc0c1\ud0dc'}</th>
                    <th className="px-6 py-4 text-center text-sm font-semibold text-gray-800">{'\uc561\uc158'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-orange-50">
                  {nfts.map((nft) => (
                    <tr key={nft.token_id} className="hover:bg-orange-50/50 transition-colors">
                      <td className="px-6 py-4 text-gray-600 font-mono text-sm">#{nft.token_id}</td>
                      <td className="px-6 py-4 text-gray-800 font-medium text-sm">{nft.title}</td>
                      <td className="px-6 py-4 text-gray-600 text-sm">{nft.category || '-'}</td>
                      <td className="px-6 py-4 text-orange-500 font-semibold text-sm">{nft.price} ETH</td>
                      <td className="px-6 py-4 text-gray-600 font-mono text-xs">{nft.owner_address?.slice(0, 10)}...</td>
                      <td className="px-6 py-4 text-gray-600 text-sm">{nft.execution_count || 0}/{nft.max_executions || 100}</td>
                      <td className="px-6 py-4">
                        <div className="flex justify-center">
                          {nft.is_for_sale ? (
                            <div className="inline-flex items-center gap-1 px-3 py-1 bg-green-50 text-green-700 rounded-full text-sm font-medium">
                              <Store className="w-4 h-4" />
                              {'\ud310\ub9e4\uc911'}
                            </div>
                          ) : (
                            <div className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-sm font-medium">
                              {'\ubcf4\uc720\uc911'}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex justify-center gap-2">
                          {nft.is_for_sale && (
                            <Button onClick={() => handleForceDelist(nft.token_id)} size="sm" variant="outline" className="border-amber-300 text-amber-700 hover:bg-amber-50">
                              {'\ud310\ub9e4 \uc911\uc9c0'}
                            </Button>
                          )}
                          <Button onClick={() => handleDelete(nft.token_id)} size="sm" variant="outline" className="border-red-300 text-red-600 hover:bg-red-50">
                            <Trash2 className="w-3 h-3 mr-1" />
                            {'\uc0ad\uc81c'}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {nfts.length === 0 && (
              <div className="text-center py-12 text-gray-500">{'\ub4f1\ub85d\ub41c NFT\uac00 \uc5c6\uc2b5\ub2c8\ub2e4'}</div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* ===== \uc2b9\uc778 \ubaa8\ub2ec ===== */}
      {approveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setApproveModal(null)}>
          <div className="bg-white rounded-3xl p-8 max-w-md w-full mx-4 space-y-6" onClick={(e) => e.stopPropagation()}>
            <div className="text-center">
              <div className="w-16 h-16 bg-green-50 rounded-3xl flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-8 h-8 text-green-500" />
              </div>
              <h3 className="text-xl font-bold text-gray-800">NFT #{approveModal.token_id} {'\uc2b9\uc778'}</h3>
              <p className="text-gray-500 mt-2">{approveModal.title}</p>
            </div>
            <div className="space-y-3">
              <p className="text-sm font-medium text-gray-700">{'\ubbfc\ud305 \ubc29\uc2dd \uc120\ud0dd'}</p>
              <button
                onClick={() => handleApprove(approveModal, 'immediate')}
                className="w-full flex items-center gap-4 p-4 rounded-2xl border-2 border-orange-100 hover:border-green-400 hover:bg-green-50 transition-all text-left"
              >
                <Zap className="w-6 h-6 text-green-500 flex-shrink-0" />
                <div>
                  <div className="font-semibold text-gray-800">{'\uc2b9\uc778 \uc2dc \ubbfc\ud305'}</div>
                  <div className="text-sm text-gray-500">NFT {'\ubc1c\ud589 + \ub9c8\ucf13 \ub4f1\ub85d'}</div>
                </div>
              </button>
              <button
                onClick={() => handleApprove(approveModal, 'on_purchase')}
                className="w-full flex items-center gap-4 p-4 rounded-2xl border-2 border-orange-100 hover:border-blue-400 hover:bg-blue-50 transition-all text-left"
              >
                <ShoppingCart className="w-6 h-6 text-blue-500 flex-shrink-0" />
                <div>
                  <div className="font-semibold text-gray-800">{'\ud310\ub9e4 \uc2dc \ubbfc\ud305'}</div>
                  <div className="text-sm text-gray-500">{'\ub9c8\ucf13 \ub4f1\ub85d\ub9cc (\ubbfc\ud305 \ubcf4\ub958)'}</div>
                </div>
              </button>
            </div>
            <Button onClick={() => setApproveModal(null)} variant="outline" className="w-full border-gray-200 text-gray-600">
              {'\ucde8\uc18c'}
            </Button>
          </div>
        </div>
      )}

      {/* ===== \ubc18\ub824 \ubaa8\ub2ec ===== */}
      {rejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setRejectModal(null)}>
          <div className="bg-white rounded-3xl p-8 max-w-md w-full mx-4 space-y-6" onClick={(e) => e.stopPropagation()}>
            <div className="text-center">
              <div className="w-16 h-16 bg-red-50 rounded-3xl flex items-center justify-center mx-auto mb-4">
                <XCircle className="w-8 h-8 text-red-500" />
              </div>
              <h3 className="text-xl font-bold text-gray-800">NFT #{rejectModal.token_id} {'\ubc18\ub824'}</h3>
              <p className="text-gray-500 mt-2">{rejectModal.title}</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">{'\ubc18\ub824 \uc0ac\uc720 *'}</label>
              <Textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder={'\ubc18\ub824 \uc0ac\uc720\ub97c \uc785\ub825\ud574\uc8fc\uc138\uc694...'}
                rows={4}
                className="bg-red-50/50 border-red-100 focus:border-red-300 rounded-xl"
              />
            </div>
            <div className="flex gap-3">
              <Button onClick={() => setRejectModal(null)} variant="outline" className="flex-1 border-gray-200 text-gray-600">
                {'\ucde8\uc18c'}
              </Button>
              <Button
                onClick={() => handleReject(rejectModal)}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white"
                disabled={!rejectReason.trim()}
              >
                <AlertTriangle className="w-4 h-4 mr-2" />
                {'\ubc18\ub824 \ud655\uc778'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, color, label, value }) {
  const Icon = icon;
  const colorMap = {
    yellow: { bg: 'bg-yellow-100', text: 'text-yellow-600' },
    green: { bg: 'bg-green-100', text: 'text-green-600' },
    orange: { bg: 'bg-orange-100', text: 'text-orange-500' },
    blue: { bg: 'bg-blue-100', text: 'text-blue-600' },
  };
  const c = colorMap[color] || colorMap.orange;
  return (
    <div className="bg-white rounded-2xl p-6 border border-orange-100">
      <div className="flex items-center gap-3">
        <div className={'w-10 h-10 rounded-xl flex items-center justify-center ' + c.bg}>
          <Icon className={'w-5 h-5 ' + c.text} />
        </div>
        <div>
          <p className="text-sm text-gray-600">{label}</p>
          <p className="text-2xl font-bold text-gray-800">{value}</p>
        </div>
      </div>
    </div>
  );
}
