// pages/Admin.jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '../context/WalletContext';
import { getNFTs, adminDeleteNFT, adminForceDelist, getDBTables, getDBTableData } from '../api';
import { deployContract, getContractAddress, setContractAddress } from '../contract';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { toast } from 'sonner';
import {
  ShieldCheck, CheckCircle2, Trash2, Store, Clock,
  XCircle, Zap, ShoppingCart, RefreshCw, AlertTriangle,
  Database, Settings, Rocket, Copy,
} from 'lucide-react';

export function Admin() {
  const { isAdmin, isConnected, signer } = useWallet();
  const navigate = useNavigate();
  const [nfts, setNfts] = useState([]);
  const [pendingNfts, setPendingNfts] = useState([]);
  const [rejectModal, setRejectModal] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [approveModal, setApproveModal] = useState(null);

  // DB Viewer state
  const [dbTables, setDbTables] = useState([]);
  const [selectedTable, setSelectedTable] = useState(null);
  const [tableData, setTableData] = useState(null);
  const [dbLoading, setDbLoading] = useState(false);

  // Contract Deploy state
  const [contractAddr, setContractAddr] = useState(getContractAddress());
  const [newAddr, setNewAddr] = useState('');
  const [deploying, setDeploying] = useState(false);

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

  // ── DB Viewer ──
  async function loadDBTables() {
    setDbLoading(true);
    try {
      const res = await getDBTables();
      setDbTables(res.tables || []);
    } catch (err) {
      toast.error('DB 로드 실패: ' + err.message);
    } finally {
      setDbLoading(false);
    }
  }

  async function loadTableData(tableName) {
    setDbLoading(true);
    setSelectedTable(tableName);
    try {
      const res = await getDBTableData(tableName);
      setTableData(res);
    } catch (err) {
      toast.error('테이블 로드 실패: ' + err.message);
      setTableData(null);
    } finally {
      setDbLoading(false);
    }
  }

  // ── 컨트랙트 배포 ──
  async function handleDeploy() {
    if (!signer) { toast.error('지갑을 먼저 연결해주세요'); return; }
    setDeploying(true);
    try {
      toast.info('MetaMask에서 컨트랙트 배포를 승인해주세요...');
      const addr = await deployContract(signer);
      setContractAddr(addr);
      toast.success('컨트랙트 배포 완료!\n' + addr, { duration: 8000 });
    } catch (err) {
      toast.error('배포 실패: ' + (err.reason || err.message));
    } finally {
      setDeploying(false);
    }
  }

  function handleSetAddress() {
    if (!newAddr.trim() || !newAddr.startsWith('0x')) {
      toast.error('유효한 컨트랙트 주소를 입력해주세요');
      return;
    }
    setContractAddress(newAddr.trim());
    setContractAddr(newAddr.trim());
    setNewAddr('');
    toast.success('컨트랙트 주소 변경 완료');
  }

  if (!isAdmin) return null;

  const forSaleNfts = nfts.filter(nft => nft.is_for_sale);

  return (
    <div className="space-y-6">
      {/* \ud5e4\ub354 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-th-accent-bg rounded-2xl flex items-center justify-center border border-th-accent-border">
            <ShieldCheck className="w-7 h-7 text-th-accent" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-th-heading">{'\uad00\ub9ac\uc790 \ud398\uc774\uc9c0'}</h1>
            <p className="text-th-text">NFT {'\uc2b9\uc778 \ubc0f \uad00\ub9ac'}</p>
          </div>
        </div>
        <Button onClick={loadData} variant="outline" className="border-th-border-strong text-th-strong hover:bg-th-surface-hover">
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
        <TabsList className="bg-th-surface border border-th-border rounded-2xl">
          <TabsTrigger
            value="pending"
            className="data-[state=active]:bg-th-accent-bg-strong data-[state=active]:text-th-accent-text text-th-text-secondary rounded-xl"
          >
            {'\uc2b9\uc778 \ub300\uae30'} ({pendingNfts.length})
          </TabsTrigger>
          <TabsTrigger
            value="all"
            className="data-[state=active]:bg-th-accent-bg-strong data-[state=active]:text-th-accent-text text-th-text-secondary rounded-xl"
          >
            {'\uc804\uccb4 \uad00\ub9ac'} ({nfts.length})
          </TabsTrigger>
          <TabsTrigger
            value="db"
            onClick={() => { if (dbTables.length === 0) loadDBTables(); }}
            className="data-[state=active]:bg-th-accent-bg-strong data-[state=active]:text-th-accent-text text-th-text-secondary rounded-xl"
          >
            <Database className="w-3 h-3 mr-1" />
            DB 뷰어
          </TabsTrigger>
          <TabsTrigger
            value="settings"
            className="data-[state=active]:bg-th-accent-bg-strong data-[state=active]:text-th-accent-text text-th-text-secondary rounded-xl"
          >
            <Settings className="w-3 h-3 mr-1" />
            컨트랙트
          </TabsTrigger>
        </TabsList>

        {/* ===== \uc2b9\uc778 \ub300\uae30 \ud0ed ===== */}
        <TabsContent value="pending" className="mt-6">
          {pendingNfts.length === 0 ? (
            <div className="text-center py-16 glass rounded-3xl border border-th-border">
              <div className="w-16 h-16 bg-th-success-bg rounded-3xl flex items-center justify-center mx-auto mb-4 border border-th-success-border">
                <CheckCircle2 className="w-8 h-8 text-th-success" />
              </div>
              <p className="text-th-strong text-lg mb-2">{'\uc2b9\uc778 \ub300\uae30 \uc911\uc778 NFT\uac00 \uc5c6\uc2b5\ub2c8\ub2e4'}</p>
              <p className="text-th-text-secondary text-sm">{'\ubaa8\ub4e0 \ub4f1\ub85d \uc694\uccad\uc774 \ucc98\ub9ac\ub418\uc5c8\uc2b5\ub2c8\ub2e4'}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingNfts.map((nft) => (
                <div key={nft.token_id} className="glass rounded-3xl p-6 border border-th-border">
                  <div className="flex gap-6">
                    <div className="w-32 h-32 rounded-2xl image-gradient flex-shrink-0 overflow-hidden">
                      {nft.image_url ? (
                        <img src={nft.image_url} alt={nft.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-3xl">{'\ud83e\udd16'}</div>
                      )}
                    </div>
                    <div className="flex-1 space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="text-th-heading font-bold text-xl">{nft.title}</h3>
                          <p className="text-th-text-secondary text-sm mt-1">#{nft.token_id} \u00b7 {nft.category || '\uc77c\ubc18'}</p>
                        </div>
                        <Badge className="bg-th-warning-bg text-th-warning border-th-warning-border">
                          <Clock className="w-3 h-3 mr-1" />
                          {'\uc2b9\uc778 \ub300\uae30'}
                        </Badge>
                      </div>
                      <p className="text-th-text text-sm line-clamp-2">{nft.description || '\uc124\uba85 \uc5c6\uc74c'}</p>
                      <div className="flex items-center gap-6 text-sm">
                        <div>
                          <span className="text-th-text-secondary">{'\uac00\uaca9'}</span>
                          <span className="text-th-accent font-bold ml-2">{nft.price} ETH</span>
                        </div>
                        <div>
                          <span className="text-th-text-secondary">{'\ub4f1\ub85d\uc790'}</span>
                          <span className="text-th-strong font-mono ml-2">{nft.creator_address?.slice(0, 10)}...</span>
                        </div>
                        <div>
                          <span className="text-th-text-secondary">{'\ubbfc\ud305 \uc2dc\uc810'}</span>
                          <span className="text-th-strong ml-2">
                            {nft.mint_timing === 'on_purchase' ? '\ud310\ub9e4 \uc2dc' : '\uc2b9\uc778 \uc2dc \uc989\uc2dc'}
                          </span>
                        </div>
                      </div>
                      {/* \uc561\uc158 \ubc84\ud2bc */}
                      <div className="flex gap-3 pt-2">
                        <Button
                          onClick={() => setApproveModal(nft)}
                          className="bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white border-0"
                        >
                          <CheckCircle2 className="w-4 h-4 mr-2" />
                          {'\uc2b9\uc778'}
                        </Button>
                        <Button
                          onClick={() => { setRejectModal(nft); setRejectReason(''); }}
                          variant="outline"
                          className="border-th-error-border text-th-error hover:bg-th-error-bg"
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
          <div className="glass rounded-2xl border border-th-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-th-surface border-b border-th-border">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-th-strong">ID</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-th-strong">{'\uc81c\ubaa9'}</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-th-strong">{'\uce74\ud14c\uace0\ub9ac'}</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-th-strong">{'\uac00\uaca9'}</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-th-strong">{'\uc18c\uc720\uc790'}</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-th-strong">{'\uc2e4\ud589'}</th>
                    <th className="px-6 py-4 text-center text-sm font-semibold text-th-strong">{'\uc0c1\ud0dc'}</th>
                    <th className="px-6 py-4 text-center text-sm font-semibold text-th-strong">{'\uc561\uc158'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06]">
                  {nfts.map((nft) => (
                    <tr key={nft.token_id} className="hover:bg-th-surface-hover transition-colors">
                      <td className="px-6 py-4 text-th-text font-mono text-sm">#{nft.token_id}</td>
                      <td className="px-6 py-4 text-th-sub font-medium text-sm">{nft.title}</td>
                      <td className="px-6 py-4 text-th-text text-sm">{nft.category || '-'}</td>
                      <td className="px-6 py-4 text-th-accent font-semibold text-sm">{nft.price} ETH</td>
                      <td className="px-6 py-4 text-th-text font-mono text-xs">{nft.owner_address?.slice(0, 10)}...</td>
                      <td className="px-6 py-4 text-th-text text-sm">{nft.execution_count || 0}/{nft.max_executions || 100}</td>
                      <td className="px-6 py-4">
                        <div className="flex justify-center">
                          {nft.is_for_sale ? (
                            <div className="inline-flex items-center gap-1 px-3 py-1 bg-th-success-bg text-th-success rounded-full text-sm font-medium">
                              <Store className="w-4 h-4" />
                              {'\ud310\ub9e4\uc911'}
                            </div>
                          ) : (
                            <div className="inline-flex items-center gap-1 px-3 py-1 bg-th-surface-hover text-th-text-secondary rounded-full text-sm font-medium">
                              {'\ubcf4\uc720\uc911'}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex justify-center gap-2">
                          {nft.is_for_sale && (
                            <Button onClick={() => handleForceDelist(nft.token_id)} size="sm" variant="outline" className="border-th-warning-border text-th-warning hover:bg-th-warning-bg">
                              {'\ud310\ub9e4 \uc911\uc9c0'}
                            </Button>
                          )}
                          <Button onClick={() => handleDelete(nft.token_id)} size="sm" variant="outline" className="border-th-error-border text-th-error hover:bg-th-error-bg">
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
              <div className="text-center py-12 text-th-text-secondary">{'\ub4f1\ub85d\ub41c NFT\uac00 \uc5c6\uc2b5\ub2c8\ub2e4'}</div>
            )}
          </div>
        </TabsContent>

        {/* ===== DB 뷰어 탭 ===== */}
        <TabsContent value="db" className="mt-6">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Button onClick={loadDBTables} variant="outline" size="sm" disabled={dbLoading} className="border-th-border-strong text-th-strong hover:bg-th-surface-hover">
                <RefreshCw className={`w-4 h-4 mr-2 ${dbLoading ? 'animate-spin' : ''}`} />
                테이블 목록 새로고침
              </Button>
            </div>

            {dbTables.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {dbTables.map((t) => (
                  <Button
                    key={t}
                    variant={selectedTable === t ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => loadTableData(t)}
                    className={selectedTable === t
                      ? 'accent-gradient text-white border-0'
                      : 'border-th-border-strong text-th-text hover:bg-th-surface-hover'}
                  >
                    <Database className="w-3 h-3 mr-1" />
                    {t}
                  </Button>
                ))}
              </div>
            )}

            {dbLoading && (
              <div className="text-center py-8 text-th-text-secondary">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-th-accent" />
                로딩 중...
              </div>
            )}

            {selectedTable && tableData && !dbLoading && (
              <div className="glass rounded-2xl border border-th-border overflow-hidden">
                <div className="bg-th-surface px-6 py-3 border-b border-th-border">
                  <h3 className="font-semibold text-th-sub">
                    {selectedTable}
                    <span className="text-sm font-normal text-th-text-secondary ml-2">
                      ({tableData.total || tableData.data?.length || 0}건)
                    </span>
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  {tableData.data && tableData.data.length > 0 ? (
                    <table className="w-full text-sm">
                      <thead className="bg-th-surface border-b border-th-border">
                        <tr>
                          {Object.keys(tableData.data[0]).map((col) => (
                            <th key={col} className="px-4 py-3 text-left font-semibold text-th-strong whitespace-nowrap">{col}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.06]">
                        {tableData.data.map((row, i) => (
                          <tr key={i} className="hover:bg-th-surface-hover">
                            {Object.values(row).map((val, j) => (
                              <td key={j} className="px-4 py-2 text-th-text whitespace-nowrap max-w-[300px] truncate">
                                {val === null ? <span className="text-th-muted italic">NULL</span> : String(val)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="text-center py-8 text-th-text-secondary">데이터가 없습니다</div>
                  )}
                </div>
              </div>
            )}

            {dbTables.length === 0 && !dbLoading && (
              <div className="text-center py-16 glass rounded-3xl border border-th-border">
                <Database className="w-8 h-8 text-th-accent mx-auto mb-4" />
                <p className="text-th-text">"테이블 목록 새로고침" 버튼을 클릭하세요</p>
              </div>
            )}
          </div>
        </TabsContent>

        {/* ===== 컨트랙트 설정 탭 ===== */}
        <TabsContent value="settings" className="mt-6">
          <div className="max-w-2xl space-y-6">
            {/* 현재 주소 */}
            <div className="glass rounded-3xl p-6 border border-th-border space-y-4">
              <h3 className="text-lg font-bold text-th-sub flex items-center gap-2">
                <Settings className="w-5 h-5 text-th-accent" />
                현재 컨트랙트
              </h3>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-th-surface px-4 py-3 rounded-xl text-sm font-mono text-th-strong border border-th-border break-all">
                  {contractAddr}
                </code>
                <Button
                  variant="outline" size="sm"
                  className="border-th-border-strong"
                  onClick={() => { navigator.clipboard.writeText(contractAddr); toast.success('복사됨'); }}
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* 주소 변경 */}
            <div className="glass rounded-3xl p-6 border border-th-border space-y-4">
              <h3 className="text-lg font-bold text-th-sub">주소 변경</h3>
              <div className="flex gap-2">
                <Input
                  value={newAddr}
                  onChange={(e) => setNewAddr(e.target.value)}
                  placeholder="0x..."
                  className="bg-th-surface border-th-border rounded-xl font-mono text-sm text-th-sub placeholder:text-th-muted"
                />
                <Button onClick={handleSetAddress} className="accent-gradient text-white whitespace-nowrap border-0">
                  변경
                </Button>
              </div>
            </div>

            {/* 새 배포 */}
            <div className="glass rounded-3xl p-6 border border-th-border space-y-4">
              <h3 className="text-lg font-bold text-th-sub flex items-center gap-2">
                <Rocket className="w-5 h-5 text-th-accent" />
                새 컨트랙트 배포
              </h3>
              <p className="text-th-text text-sm">
                Sepolia 테스트넷에 새 PromptNFT 컨트랙트를 배포합니다. MetaMask에서 가스비(ETH)가 필요합니다.
              </p>
              <Button
                onClick={handleDeploy}
                disabled={deploying}
                className="w-full accent-gradient text-white py-6 text-base shadow-md shadow-th-accent-glow border-0"
              >
                {deploying ? (
                  <>
                    <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
                    배포 중...
                  </>
                ) : (
                  <>
                    <Rocket className="w-5 h-5 mr-2" />
                    컨트랙트 배포
                  </>
                )}
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* ===== \uc2b9\uc778 \ubaa8\ub2ec ===== */}
      {approveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={() => setApproveModal(null)}>
          <div className="glass-strong rounded-3xl p-8 max-w-md w-full mx-4 space-y-6 border border-th-border-strong" onClick={(e) => e.stopPropagation()}>
            <div className="text-center">
              <div className="w-16 h-16 bg-th-success-bg rounded-3xl flex items-center justify-center mx-auto mb-4 border border-th-success-border">
                <CheckCircle2 className="w-8 h-8 text-th-success" />
              </div>
              <h3 className="text-xl font-bold text-th-heading">NFT #{approveModal.token_id} {'\uc2b9\uc778'}</h3>
              <p className="text-th-text mt-2">{approveModal.title}</p>
            </div>
            <div className="space-y-3">
              <p className="text-sm font-medium text-th-strong">{'\ubbfc\ud305 \ubc29\uc2dd \uc120\ud0dd'}</p>
              <button
                onClick={() => handleApprove(approveModal, 'immediate')}
                className="w-full flex items-center gap-4 p-4 rounded-2xl border-2 border-th-border hover:border-emerald-500/40 hover:bg-th-success-bg transition-all text-left"
              >
                <Zap className="w-6 h-6 text-th-success flex-shrink-0" />
                <div>
                  <div className="font-semibold text-th-sub">{'\uc2b9\uc778 \uc2dc \ubbfc\ud305'}</div>
                  <div className="text-sm text-th-text-secondary">NFT {'\ubc1c\ud589 + \ub9c8\ucf13 \ub4f1\ub85d'}</div>
                </div>
              </button>
              <button
                onClick={() => handleApprove(approveModal, 'on_purchase')}
                className="w-full flex items-center gap-4 p-4 rounded-2xl border-2 border-th-border hover:border-blue-500/40 hover:bg-th-info-bg transition-all text-left"
              >
                <ShoppingCart className="w-6 h-6 text-th-info flex-shrink-0" />
                <div>
                  <div className="font-semibold text-th-sub">{'\ud310\ub9e4 \uc2dc \ubbfc\ud305'}</div>
                  <div className="text-sm text-th-text-secondary">{'\ub9c8\ucf13 \ub4f1\ub85d\ub9cc (\ubbfc\ud305 \ubcf4\ub958)'}</div>
                </div>
              </button>
            </div>
            <Button onClick={() => setApproveModal(null)} variant="outline" className="w-full border-th-border-strong text-th-strong">
              {'\ucde8\uc18c'}
            </Button>
          </div>
        </div>
      )}

      {/* ===== \ubc18\ub824 \ubaa8\ub2ec ===== */}
      {rejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={() => setRejectModal(null)}>
          <div className="glass-strong rounded-3xl p-8 max-w-md w-full mx-4 space-y-6 border border-th-border-strong" onClick={(e) => e.stopPropagation()}>
            <div className="text-center">
              <div className="w-16 h-16 bg-th-error-bg rounded-3xl flex items-center justify-center mx-auto mb-4 border border-th-error-border">
                <XCircle className="w-8 h-8 text-th-error" />
              </div>
              <h3 className="text-xl font-bold text-th-heading">NFT #{rejectModal.token_id} {'\ubc18\ub824'}</h3>
              <p className="text-th-text mt-2">{rejectModal.title}</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-th-strong">{'\ubc18\ub824 \uc0ac\uc720 *'}</label>
              <Textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder={'\ubc18\ub824 \uc0ac\uc720\ub97c \uc785\ub825\ud574\uc8fc\uc138\uc694...'}
                rows={4}
                className="bg-th-surface border-th-border focus:border-th-error rounded-xl text-th-sub placeholder:text-th-muted"
              />
            </div>
            <div className="flex gap-3">
              <Button onClick={() => setRejectModal(null)} variant="outline" className="flex-1 border-th-border-strong text-th-strong">
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
    yellow: { bg: 'bg-th-warning-bg', text: 'text-th-warning', border: 'border-th-warning-border' },
    green: { bg: 'bg-th-success-bg', text: 'text-th-success', border: 'border-th-success-border' },
    orange: { bg: 'bg-th-accent-bg', text: 'text-th-accent', border: 'border-th-accent-border' },
    blue: { bg: 'bg-th-info-bg', text: 'text-th-info', border: 'border-th-info-border' },
  };
  const c = colorMap[color] || colorMap.orange;
  return (
    <div className="glass rounded-2xl p-6 border border-th-border">
      <div className="flex items-center gap-3">
        <div className={'w-10 h-10 rounded-xl flex items-center justify-center ' + c.bg + ' border ' + c.border}>
          <Icon className={'w-5 h-5 ' + c.text} />
        </div>
        <div>
          <p className="text-sm text-th-text">{label}</p>
          <p className="text-2xl font-bold text-th-heading">{value}</p>
        </div>
      </div>
    </div>
  );
}
