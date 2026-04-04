import { useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { WalletProvider, useWallet } from '../context/WalletContext';
import { Toaster } from './ui/sonner';
import { Button } from './ui/button';
import { Wallet, ShieldCheck, Menu, X } from 'lucide-react';

export function Layout() {
  return (
    <WalletProvider>
      <LayoutInner />
      <Toaster />
    </WalletProvider>
  );
}

function LayoutInner() {
  const { address, isConnected, isAdmin, connectWallet, disconnectWallet, loading, error } = useWallet();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { path: '/', label: '마켓플레이스' },
    { path: '/register', label: 'NFT 등록' },
    { path: '/my-nfts', label: '마이페이지' },
    { path: '/execute', label: '실행페이지' },
    { path: '/transactions', label: '거래 내역' },
  ];

  if (isAdmin) {
    navItems.push({ path: '/admin', label: '관리자' });
  }

  return (
    <div className="min-h-screen bg-[#FFF8F3]">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-orange-100 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link to="/" className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-orange-400 to-orange-300 rounded-2xl shadow-sm" />
              <span className="text-xl font-bold text-gray-800">PromptNFT</span>
            </Link>
            <nav className="hidden md:flex items-center gap-6">
              {navItems.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`text-sm font-medium transition-colors ${
                      isActive
                        ? 'text-orange-500'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            {/* Mobile menu button */}
            <button
              className="md:hidden p-2 text-gray-600"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>

            {isConnected ? (
              <>
                {isAdmin && (
                  <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-orange-100 text-orange-700 rounded-lg text-sm font-medium">
                    <ShieldCheck className="w-4 h-4" />
                    관리자
                  </div>
                )}
                <div className="hidden md:block px-4 py-2 bg-orange-50 rounded-lg border border-orange-100">
                  <span className="text-sm font-mono text-gray-700">
                    {address?.slice(0, 6)}...{address?.slice(-4)}
                  </span>
                </div>
                <Button
                  onClick={disconnectWallet}
                  variant="outline"
                  size="sm"
                  className="hidden md:flex border-orange-200 text-gray-700 hover:bg-orange-50"
                >
                  연결 해제
                </Button>
              </>
            ) : (
              <Button
                onClick={connectWallet}
                disabled={loading}
                className="bg-gradient-to-r from-orange-400 to-orange-300 hover:from-orange-500 hover:to-orange-400 text-white shadow-sm"
              >
                <Wallet className="w-4 h-4 mr-2" />
                {loading ? '연결 중...' : 'MetaMask 연결'}
              </Button>
            )}
          </div>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <nav className="md:hidden border-t border-orange-100 bg-white px-6 py-4 space-y-2">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`block py-2 text-sm font-medium ${
                    isActive ? 'text-orange-500' : 'text-gray-600'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
            {isConnected && (
              <div className="pt-2 border-t border-orange-100 space-y-2">
                <div className="text-sm font-mono text-gray-600">
                  {address?.slice(0, 6)}...{address?.slice(-4)}
                </div>
                <Button
                  onClick={disconnectWallet}
                  variant="outline"
                  size="sm"
                  className="border-orange-200 text-gray-700"
                >
                  연결 해제
                </Button>
              </div>
            )}
          </nav>
        )}

        {/* Wallet error */}
        {error && (
          <div className="max-w-7xl mx-auto px-6 py-2">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}
      </header>

      {/* Page Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}
