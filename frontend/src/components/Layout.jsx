import { useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { WalletProvider, useWallet } from '../context/WalletContext';
import { Toaster } from './ui/sonner';
import { Button } from './ui/button';
import { Wallet, ShieldCheck, Menu, X, Sparkles } from 'lucide-react';

export function Layout() {
  return (
    <WalletProvider>
      <LayoutInner />
      <Toaster />
    </WalletProvider>
  );
}

function LayoutInner() {
  const { address, isConnected, isAdmin, connectWallet, disconnectWallet, loading, error, chainId } = useWallet();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { path: '/', label: '마켓플레이스' },
    { path: '/register', label: 'NFT 등록' },
    { path: '/my-nfts', label: '마이페이지' },
    { path: '/execute', label: '실행' },
    { path: '/transactions', label: '거래 내역' },
  ];

  if (isAdmin) {
    navItems.push({ path: '/admin', label: '관리자' });
  }

  const networkName = chainId === 11155111 ? 'Sepolia' : chainId ? `Chain ${chainId}` : null;

  return (
    <div className="min-h-screen bg-[#FFF8F3] flex flex-col">
      {/* Header */}
      <header className="bg-white/90 backdrop-blur-md border-b border-orange-100/80 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-6 lg:gap-8">
            <Link to="/" className="flex items-center gap-2.5 group">
              <div className="w-9 h-9 bg-gradient-to-br from-orange-500 to-amber-400 rounded-xl shadow-md shadow-orange-200/50 flex items-center justify-center group-hover:shadow-lg group-hover:shadow-orange-300/50 transition-shadow">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <span className="text-lg font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">PromptNFT</span>
            </Link>
            <nav className="hidden md:flex items-center gap-1">
              {navItems.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      isActive
                        ? 'text-orange-600 bg-orange-50'
                        : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-2">
            {/* Mobile menu button */}
            <button
              className="md:hidden p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-50"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>

            {isConnected ? (
              <>
                {isAdmin && (
                  <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 bg-orange-100 text-orange-700 rounded-lg text-xs font-semibold">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    관리자
                  </div>
                )}
                {networkName && (
                  <div className="hidden lg:block px-2.5 py-1 bg-green-50 text-green-700 rounded-lg text-xs font-medium border border-green-100">
                    {networkName}
                  </div>
                )}
                <div className="hidden md:block px-3 py-1.5 bg-gray-50 rounded-lg border border-gray-200/80">
                  <span className="text-xs font-mono text-gray-600">
                    {address?.slice(0, 6)}...{address?.slice(-4)}
                  </span>
                </div>
                <Button
                  onClick={disconnectWallet}
                  variant="outline"
                  size="sm"
                  className="hidden md:flex border-gray-200 text-gray-500 hover:text-red-600 hover:border-red-200 hover:bg-red-50 text-xs h-8"
                >
                  해제
                </Button>
              </>
            ) : (
              <Button
                onClick={connectWallet}
                disabled={loading}
                className="bg-gradient-to-r from-orange-500 to-amber-400 hover:from-orange-600 hover:to-amber-500 text-white shadow-md shadow-orange-200/50 hover:shadow-lg hover:shadow-orange-300/50 transition-all h-9 text-sm"
              >
                <Wallet className="w-4 h-4 mr-1.5" />
                {loading ? '연결 중...' : '지갑 연결'}
              </Button>
            )}
          </div>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <nav className="md:hidden border-t border-orange-100/60 bg-white/95 backdrop-blur-md px-4 py-3 space-y-1">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`block px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    isActive ? 'text-orange-600 bg-orange-50' : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
            {isConnected && (
              <div className="pt-2 mt-2 border-t border-gray-100 space-y-2">
                <div className="flex items-center justify-between px-3">
                  <span className="text-xs font-mono text-gray-500">
                    {address?.slice(0, 6)}...{address?.slice(-4)}
                  </span>
                  {networkName && (
                    <span className="text-xs text-green-600 font-medium">{networkName}</span>
                  )}
                </div>
                <Button
                  onClick={disconnectWallet}
                  variant="outline"
                  size="sm"
                  className="w-full border-gray-200 text-gray-500 hover:text-red-600 text-xs"
                >
                  연결 해제
                </Button>
              </div>
            )}
          </nav>
        )}

        {/* Wallet error */}
        {error && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2 bg-red-50 border-t border-red-100">
            <p className="text-xs text-red-600">{error}</p>
          </div>
        )}
      </header>

      {/* Page Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="border-t border-orange-100/60 bg-white/60 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-gradient-to-br from-orange-500 to-amber-400 rounded-lg flex items-center justify-center">
                <Sparkles className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="text-sm font-semibold text-gray-700">PromptNFT</span>
              <span className="text-xs text-gray-400">· Sepolia Testnet</span>
            </div>
            <p className="text-xs text-gray-400">
              AI 프롬프트를 NFT로 거래하는 블록체인 마켓플레이스
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
