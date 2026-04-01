// src/hooks/useWallet.js - MetaMask 지갑 연결 훅
// 담당: 홍재창 (프론트엔드)

import { useState, useCallback, useEffect } from "react";
import { BrowserProvider } from "ethers";
import { setWalletHeader, getNonce } from "../api";

// MetaMask provider를 직접 찾는 함수 (다른 지갑 확장 프록시 우회)
function getMetaMaskProvider() {
  // 1) providers 배열이 있으면 MetaMask를 직접 찾기
  if (window.ethereum?.providers?.length) {
    const mm = window.ethereum.providers.find((p) => p.isMetaMask);
    if (mm) {
      console.log("[useWallet] providers 배열에서 MetaMask 발견");
      return mm;
    }
  }
  // 2) window.ethereum 자체가 MetaMask인 경우
  if (window.ethereum?.isMetaMask) {
    console.log("[useWallet] window.ethereum이 MetaMask");
    return window.ethereum;
  }
  // 3) providerMap이 있는 경우 (일부 프록시 구조)
  if (window.ethereum?.providerMap) {
    const mm = window.ethereum.providerMap.get("MetaMask");
    if (mm) {
      console.log("[useWallet] providerMap에서 MetaMask 발견");
      return mm;
    }
  }
  return null;
}

export function useWallet() {
  const [account, setAccount] = useState(null);
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // MetaMask 연결
  const connect = useCallback(async () => {
    console.log("[useWallet] connect 호출됨");

    const ethereum = getMetaMaskProvider();

    if (!ethereum) {
      const msg = "MetaMask가 설치되어 있지 않습니다. 크롬 확장 프로그램에서 MetaMask를 설치해주세요.";
      setError(msg);
      alert(msg);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log("[useWallet] eth_requestAccounts 요청 중...");
      const accounts = await ethereum.request({
        method: "eth_requestAccounts",
      });
      console.log("[useWallet] 계정:", accounts);

      const prov = new BrowserProvider(ethereum);
      const s = await prov.getSigner();
      const network = await prov.getNetwork();

      setProvider(prov);
      setSigner(s);
      setAccount(accounts[0]);
      setChainId(Number(network.chainId));
      setWalletHeader(accounts[0]);
      console.log("[useWallet] 연결 성공:", accounts[0]);
    } catch (err) {
      console.error("[useWallet] 연결 실패:", err);
      setError("지갑 연결 실패: " + err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // 연결 해제 — MetaMask 권한도 해제하여 다음 connect 시 계정 선택 팝업 표시
  const disconnect = useCallback(async () => {
    try {
      const ethereum = getMetaMaskProvider();
      if (ethereum) {
        // wallet_revokePermissions로 MetaMask 연결 자체를 해제
        await ethereum.request({
          method: "wallet_revokePermissions",
          params: [{ eth_accounts: {} }],
        });
        console.log("[useWallet] MetaMask 권한 해제 완료");
      }
    } catch (err) {
      console.log("[useWallet] 권한 해제 실패 (무시):", err.message);
    }

    setAccount(null);
    setProvider(null);
    setSigner(null);
    setChainId(null);
    setWalletHeader(null);
  }, []);

  // 서명 생성 (nonce 기반)
  const signMessage = useCallback(async () => {
    if (!signer || !account) {
      throw new Error("지갑이 연결되지 않았습니다");
    }

    // 1. 서버에서 nonce 받기
    const { nonce, message } = await getNonce(account);

    // 2. MetaMask로 서명
    const signature = await signer.signMessage(message);

    return { nonce, signature, wallet: account };
  }, [signer, account]);

  // 계정 변경 감지
  useEffect(() => {
    const ethereum = getMetaMaskProvider();
    if (!ethereum) return;

    const handleAccountsChanged = (accounts) => {
      if (accounts.length === 0) {
        disconnect();
      } else {
        setAccount(accounts[0]);
        setWalletHeader(accounts[0]);
      }
    };

    const handleChainChanged = () => {
      window.location.reload();
    };

    ethereum.on("accountsChanged", handleAccountsChanged);
    ethereum.on("chainChanged", handleChainChanged);

    return () => {
      ethereum.removeListener("accountsChanged", handleAccountsChanged);
      ethereum.removeListener("chainChanged", handleChainChanged);
    };
  }, [disconnect]);

  return {
    account,
    provider,
    signer,
    chainId,
    loading,
    error,
    connect,
    disconnect,
    signMessage,
    isConnected: !!account,
  };
}
