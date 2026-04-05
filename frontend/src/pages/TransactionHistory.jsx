// pages/TransactionHistory.jsx — 거래 내역 페이지 (블록체인 조회 UI)
import { useState, useEffect } from 'react';
import { useWallet } from '../context/WalletContext';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import {
  ArrowUpRight,
  ArrowDownLeft,
  ExternalLink,
  Search,
  ReceiptText,
  RefreshCw,
  Filter,
} from 'lucide-react';
import { ethers } from 'ethers';
import { toast } from 'sonner';
import contractABI from '../abi/PromptNFT.json';
import { getContractAddress } from '../contract';

export function TransactionHistory() {
  const { address, isConnected, provider } = useWallet();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filterType, setFilterType] = useState('all'); // all | sent | received
  const [searchTokenId, setSearchTokenId] = useState('');

  useEffect(() => {
    if (!isConnected || !provider || !address) return;
    let cancelled = false;
    (async () => {
    setLoading(true);
    try {
      const contract = new ethers.Contract(getContractAddress(), contractABI, provider);

      // Transfer 이벤트 조회 (from 또는 to가 현재 주소)
      const filterFrom = contract.filters.Transfer(address, null, null);
      const filterTo = contract.filters.Transfer(null, address, null);

      const [sentEvents, receivedEvents] = await Promise.all([
        contract.queryFilter(filterFrom, -10000).catch(() => []),
        contract.queryFilter(filterTo, -10000).catch(() => []),
      ]);

      const allEvents = [];

      for (const ev of sentEvents) {
        allEvents.push({
          type: 'sent',
          from: ev.args[0],
          to: ev.args[1],
          tokenId: ev.args[2].toString(),
          txHash: ev.transactionHash,
          blockNumber: ev.blockNumber,
        });
      }

      for (const ev of receivedEvents) {
        // 중복 제거 (자기 자신에게 전송한 경우)
        const isDuplicate = allEvents.some(
          (t) => t.txHash === ev.transactionHash && t.tokenId === ev.args[2].toString()
        );
        if (!isDuplicate) {
          allEvents.push({
            type: 'received',
            from: ev.args[0],
            to: ev.args[1],
            tokenId: ev.args[2].toString(),
            txHash: ev.transactionHash,
            blockNumber: ev.blockNumber,
          });
        }
      }

      // 민팅(from = 0x0) 구분
      allEvents.forEach((tx) => {
        if (tx.from === ethers.ZeroAddress) {
          tx.type = 'mint';
        }
      });

      // 블록 번호 역순 정렬
      allEvents.sort((a, b) => b.blockNumber - a.blockNumber);

      if (!cancelled) setTransactions(allEvents);
    } catch (err) {
      console.error('거래 내역 로드 실패:', err);
      if (!cancelled) toast.error('거래 내역을 불러오는데 실패했습니다');
    } finally {
      if (!cancelled) setLoading(false);
    }
    })();
    return () => { cancelled = true; };
  }, [isConnected, provider, address]);

  function refreshTransactions() {
    if (!provider || !address) return;
    setLoading(true);
    const contract = new ethers.Contract(getContractAddress(), contractABI, provider);
    const filterFrom = contract.filters.Transfer(address, null, null);
    const filterTo = contract.filters.Transfer(null, address, null);
    Promise.all([
      contract.queryFilter(filterFrom, -10000).catch(() => []),
      contract.queryFilter(filterTo, -10000).catch(() => []),
    ]).then(([sentEvents, receivedEvents]) => {
      const allEvents = [];
      for (const ev of sentEvents) {
        allEvents.push({ type: 'sent', from: ev.args[0], to: ev.args[1], tokenId: ev.args[2].toString(), txHash: ev.transactionHash, blockNumber: ev.blockNumber });
      }
      for (const ev of receivedEvents) {
        const isDuplicate = allEvents.some(t => t.txHash === ev.transactionHash && t.tokenId === ev.args[2].toString());
        if (!isDuplicate) {
          allEvents.push({ type: 'received', from: ev.args[0], to: ev.args[1], tokenId: ev.args[2].toString(), txHash: ev.transactionHash, blockNumber: ev.blockNumber });
        }
      }
      allEvents.forEach(tx => { if (tx.from === ethers.ZeroAddress) tx.type = 'mint'; });
      allEvents.sort((a, b) => b.blockNumber - a.blockNumber);
      setTransactions(allEvents);
    }).catch(() => {
      toast.error('거래 내역을 불러오는데 실패했습니다');
    }).finally(() => setLoading(false));
  }

  const filteredTransactions = transactions.filter((tx) => {
    if (filterType !== 'all' && tx.type !== filterType) return false;
    if (searchTokenId && !tx.tokenId.includes(searchTokenId)) return false;
    return true;
  });

  function shortenAddress(addr) {
    if (!addr) return '';
    return addr.slice(0, 6) + '...' + addr.slice(-4);
  }

  function getTypeInfo(type) {
    switch (type) {
      case 'sent':
        return { label: '전송', icon: ArrowUpRight, color: 'bg-red-50 text-red-700 border-red-200' };
      case 'received':
        return { label: '수신', icon: ArrowDownLeft, color: 'bg-green-50 text-green-700 border-green-200' };
      case 'mint':
        return { label: '민팅', icon: ReceiptText, color: 'bg-blue-50 text-blue-700 border-blue-200' };
      default:
        return { label: '기타', icon: ReceiptText, color: 'bg-gray-50 text-gray-700 border-gray-200' };
    }
  }

  if (!isConnected) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4 max-w-md">
          <div className="w-20 h-20 bg-orange-100 rounded-3xl flex items-center justify-center mx-auto">
            <ReceiptText className="w-10 h-10 text-orange-500" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800">지갑을 연결해주세요</h2>
          <p className="text-gray-600">거래 내역을 확인하려면 MetaMask 지갑을 연결해야 합니다</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">거래 내역</h1>
          <p className="text-gray-600">블록체인에서 조회한 NFT 거래 기록</p>
        </div>
        <Button
          onClick={refreshTransactions}
          variant="outline"
          size="sm"
          disabled={loading}
          className="border-orange-200 text-gray-700 hover:bg-orange-50"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          새로고침
        </Button>
      </div>

      {/* 필터 & 검색 */}
      <div className="bg-white rounded-3xl p-5 border border-orange-100 shadow-sm">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex gap-2">
            {[
              { key: 'all', label: '전체' },
              { key: 'sent', label: '전송' },
              { key: 'received', label: '수신' },
              { key: 'mint', label: '민팅' },
            ].map(({ key, label }) => (
              <Button
                key={key}
                variant={filterType === key ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterType(key)}
                className={
                  filterType === key
                    ? 'bg-gradient-to-r from-orange-400 to-orange-300 text-white'
                    : 'border-orange-200 text-gray-600 hover:bg-orange-50'
                }
              >
                <Filter className="w-3 h-3 mr-1" />
                {label}
              </Button>
            ))}
          </div>
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="토큰 ID로 검색..."
              value={searchTokenId}
              onChange={(e) => setSearchTokenId(e.target.value)}
              className="pl-10 bg-orange-50/50 border-orange-100 focus:border-orange-300 rounded-xl"
            />
          </div>
        </div>
      </div>

      {/* 거래 목록 */}
      {loading ? (
        <div className="text-center py-16 bg-white rounded-3xl border border-orange-100">
          <RefreshCw className="w-8 h-8 text-orange-400 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">블록체인에서 거래 내역을 조회 중...</p>
        </div>
      ) : filteredTransactions.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-3xl border border-orange-100">
          <div className="w-16 h-16 bg-orange-50 rounded-3xl flex items-center justify-center mx-auto mb-4">
            <ReceiptText className="w-8 h-8 text-orange-400" />
          </div>
          <p className="text-gray-600 text-lg mb-2">거래 내역이 없습니다</p>
          <p className="text-gray-400 text-sm">NFT를 구매하거나 등록하면 거래가 기록됩니다</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredTransactions.map((tx, i) => {
            const info = getTypeInfo(tx.type);
            const Icon = info.icon;
            return (
              <div
                key={`${tx.txHash}-${tx.tokenId}-${i}`}
                className="bg-white rounded-2xl p-5 flex items-center gap-4 border border-orange-100 shadow-sm hover:shadow-md transition-all"
              >
                {/* 아이콘 */}
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                  tx.type === 'sent' ? 'bg-red-50' : tx.type === 'received' ? 'bg-green-50' : 'bg-blue-50'
                }`}>
                  <Icon className={`w-5 h-5 ${
                    tx.type === 'sent' ? 'text-red-500' : tx.type === 'received' ? 'text-green-500' : 'text-blue-500'
                  }`} />
                </div>

                {/* 내용 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge className={info.color}>{info.label}</Badge>
                    <span className="text-gray-800 font-semibold">Token #{tx.tokenId}</span>
                  </div>
                  <div className="text-sm text-gray-500 truncate">
                    {tx.type === 'mint' ? (
                      <>민팅 → {shortenAddress(tx.to)}</>
                    ) : tx.type === 'sent' ? (
                      <>{shortenAddress(tx.from)} → {shortenAddress(tx.to)}</>
                    ) : (
                      <>{shortenAddress(tx.from)} → {shortenAddress(tx.to)}</>
                    )}
                  </div>
                </div>

                {/* 블록 정보 */}
                <div className="text-right flex-shrink-0">
                  <div className="text-sm text-gray-500">Block #{tx.blockNumber}</div>
                </div>

                {/* Etherscan 링크 */}
                <a
                  href={`https://sepolia.etherscan.io/tx/${tx.txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="flex-shrink-0 w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center hover:bg-orange-100 transition-colors"
                >
                  <ExternalLink className="w-4 h-4 text-orange-500" />
                </a>
              </div>
            );
          })}
        </div>
      )}

      {/* 총 건수 */}
      {!loading && filteredTransactions.length > 0 && (
        <div className="text-center text-sm text-gray-400">
          총 {filteredTransactions.length}건의 거래 기록
        </div>
      )}
    </div>
  );
}
