import { useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { WalletProvider, useWallet } from '../context/WalletContext';
import { ThemeProvider, useTheme } from '../context/ThemeContext';
import { Toaster } from './ui/sonner';
import { Button } from './ui/button';
import { Wallet, ShieldCheck, Menu, X, Zap, Sun, Moon } from 'lucide-react';

export function Layout() {
  return (
    <ThemeProvider>
      <WalletProvider>
        <LayoutInner />
        <Toaster />
      </WalletProvider>
    </ThemeProvider>
  );
}

function LayoutInner() {
  const { address, isConnected, isAdmin, connectWallet, disconnectWallet, loading, error, chainId } = useWallet();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { path: '/', label: '마켓' },
    { path: '/register', label: '등록' },
    { path: '/my-nfts', label: '마이페이지' },
    { path: '/execute', label: '실행' },
    { path: '/transactions', label: '거래내역' },
  ];

  if (isAdmin) {
    navItems.push({ path: '/admin', label: '관리자' });
  }

  const networkName = chainId === 17000 ? 'Holesky' : chainId === 11155111 ? 'Sepolia' : chainId ? `Chain ${chainId}` : null;

  return (
    <div className="min-h-screen bg-th-bg mesh-gradient flex flex-col">
      {/* Header — Glassmorphism */}
      <header className="glass sticky top-0 z-50 border-b border-th-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-6 lg:gap-8">
            <Link to="/" className="flex items-center gap-2.5 group">
              <div className="w-9 h-9 accent-gradient rounded-xl shadow-lg shadow-th-accent-glow flex items-center justify-center group-hover:shadow-th-accent-glow-strong transition-all duration-300 group-hover:scale-105">
                <Zap className="w-5 h-5 text-white" />
              </div>
              <span className="text-lg font-bold text-th-heading tracking-tight">PromptSquare</span>
            </Link>
            <nav className="hidden md:flex items-center gap-1">
              {navItems.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                      isActive
                        ? 'text-th-accent-text bg-th-accent-bg shadow-sm'
                        : 'text-th-text hover:text-th-sub hover:bg-th-surface-hover'
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-2">
            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg text-th-text-secondary hover:text-th-heading hover:bg-th-surface-hover transition-colors"
              title={theme === 'dark' ? '라이트 모드' : '다크 모드'}
            >
              {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>

            {/* Mobile menu */}
            <button
              className="md:hidden p-2 text-th-text hover:text-th-heading rounded-lg hover:bg-th-surface-hover transition-colors"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>

            {isConnected ? (
              <>
                {isAdmin && (
                  <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 bg-th-accent-bg-strong text-th-accent-text rounded-lg text-xs font-semibold border border-th-accent-border">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    관리자
                  </div>
                )}
                {networkName && (
                  <div className="hidden lg:block px-2.5 py-1 bg-th-success-bg text-th-success rounded-lg text-xs font-medium border border-th-success-border">
                    {networkName}
                  </div>
                )}
                <div className="hidden md:block px-3 py-1.5 bg-th-surface rounded-lg border border-th-border">
                  <span className="text-xs font-mono text-th-text">
                    {address?.slice(0, 6)}...{address?.slice(-4)}
                  </span>
                </div>
                <Button
                  onClick={disconnectWallet}
                  variant="outline"
                  size="sm"
                  className="hidden md:flex border-th-border bg-transparent text-th-text hover:text-th-error hover:border-th-error-border hover:bg-th-error-bg text-xs h-8 transition-all"
                >
                  해제
                </Button>
              </>
            ) : (
              <Button
                onClick={connectWallet}
                disabled={loading}
                className="accent-gradient text-white shadow-lg shadow-th-accent-glow hover:shadow-th-accent-glow-strong transition-all duration-300 h-9 text-sm border-0"
              >
                <Wallet className="w-4 h-4 mr-1.5" />
                {loading ? '연결 중...' : '지갑 연결'}
              </Button>
            )}
          </div>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <nav className="md:hidden border-t border-th-border bg-th-bg/95 backdrop-blur-xl px-4 py-3 space-y-1 animate-fade-in">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`block px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    isActive ? 'text-th-accent-text bg-th-accent-bg' : 'text-th-text hover:bg-th-surface-hover'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
            {isConnected && (
              <div className="pt-2 mt-2 border-t border-th-border space-y-2">
                <div className="flex items-center justify-between px-3">
                  <span className="text-xs font-mono text-th-text-secondary">
                    {address?.slice(0, 6)}...{address?.slice(-4)}
                  </span>
                  {networkName && (
                    <span className="text-xs text-th-success font-medium">{networkName}</span>
                  )}
                </div>
                <Button
                  onClick={disconnectWallet}
                  variant="outline"
                  size="sm"
                  className="w-full border-th-border bg-transparent text-th-text hover:text-th-error text-xs"
                >
                  연결 해제
                </Button>
              </div>
            )}
          </nav>
        )}

        {/* Wallet error */}
        {error && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 bg-th-error-bg border-t border-th-error-border">
            <p className="text-sm text-th-error font-medium">{error}</p>
          </div>
        )}
      </header>

      {/* Page Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="border-t border-th-border bg-th-bg/80 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          {/* Main footer content */}
          <div className="py-12 grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 accent-gradient rounded-xl flex items-center justify-center">
                  <Zap className="w-4 h-4 text-white" />
                </div>
                <span className="text-base font-bold text-th-heading">PromptNFT</span>
              </div>
              <p className="text-th-text-secondary text-sm leading-relaxed">
                AI 프롬프트를 NFT로 거래하는<br />
                블록체인 마켓플레이스
              </p>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-th-heading mb-4">서비스</h4>
              <ul className="space-y-2.5">
                <li><Link to="/" className="text-sm text-th-text-secondary hover:text-th-accent transition-colors">마켓플레이스</Link></li>
                <li><Link to="/register" className="text-sm text-th-text-secondary hover:text-th-accent transition-colors">NFT 등록</Link></li>
                <li><Link to="/execute" className="text-sm text-th-text-secondary hover:text-th-accent transition-colors">AI 실행</Link></li>
                <li><Link to="/my-nfts" className="text-sm text-th-text-secondary hover:text-th-accent transition-colors">마이페이지</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-th-heading mb-4">법적 고지</h4>
              <ul className="space-y-2.5">
                <li><span className="text-sm text-th-text-secondary cursor-default">이용약관</span></li>
                <li><span className="text-sm text-th-text-secondary cursor-default">개인정보처리방침</span></li>
                <li><span className="text-sm text-th-text-secondary cursor-default">쿠키 정책</span></li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-th-heading mb-4">기술 스택</h4>
              <ul className="space-y-2.5">
                <li><span className="text-sm text-th-text-secondary">Ethereum (Sepolia)</span></li>
                <li><span className="text-sm text-th-text-secondary">Solidity / Hardhat</span></li>
                <li><span className="text-sm text-th-text-secondary">React / Vite</span></li>
                <li><span className="text-sm text-th-text-secondary">ethers.js v6</span></li>
              </ul>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="border-t border-th-border py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-th-muted">
              © 2024-2025 PromptNFT. All rights reserved.
            </p>
            <div className="flex items-center gap-4">
              <span className="text-xs text-th-muted">Built on Ethereum Sepolia Testnet</span>
              <span className="text-xs text-th-dim">v1.0.0</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
