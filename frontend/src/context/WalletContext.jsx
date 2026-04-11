// context/WalletContext.jsx — MetaMask 실제 지갑 연결 컨텍스트
// 기존 useWallet 훅(MetaMask)을 래핑하여 UI 전역에서 사용

import { createContext, useContext, useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet as useMetaMaskWallet } from '../hooks/useWallet';
import { checkAdmin, setWalletHeader } from '../api';

const WalletContext = createContext(undefined);

// Custom hook — 별도 파일처럼 취급되도록 컴포넌트 밖에서 re-export
// eslint-disable-next-line react-refresh/only-export-components
export function useWallet() {
  const context = useContext(WalletContext);
  if (context === undefined) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
}

export function WalletProvider({ children }) {
  const wallet = useMetaMaskWallet();
  const [isAdmin, setIsAdmin] = useState(false);
  const prevAccount = useRef(wallet.account);
  const navigate = useNavigate();

  useEffect(() => {
    // 이전 account와 같으면 skip — 불필요한 cascading render 방지
    if (prevAccount.current === wallet.account) return;
    prevAccount.current = wallet.account;

    if (wallet.account) {
      setWalletHeader(wallet.account);
      let cancelled = false;
      checkAdmin()
        .then((r) => { if (!cancelled) setIsAdmin(r.isAdmin); })
        .catch(() => { if (!cancelled) setIsAdmin(false); });
      // 계정이 바뀌면 무조건 마켓(메인) 페이지로 이동
      navigate('/');
      return () => { cancelled = true; };
    } else {
      setWalletHeader(null);
      // 비동기로 처리하여 cascading render 경고 방지
      Promise.resolve().then(() => setIsAdmin(false));
    }
  }, [wallet.account, navigate]);

  const value = {
    // UI Design 인터페이스
    address: wallet.account,
    isConnected: wallet.isConnected,
    isAdmin,
    connectWallet: wallet.connect,
    disconnectWallet: wallet.disconnect,
    // 블록체인 작업용 확장 속성
    provider: wallet.provider,
    signer: wallet.signer,
    chainId: wallet.chainId,
    loading: wallet.loading,
    error: wallet.error,
    signMessage: wallet.signMessage,
  };

  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  );
}
