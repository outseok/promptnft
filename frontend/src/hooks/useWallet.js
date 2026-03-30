// src/hooks/useWallet.js - MetaMask 지갑 연결 훅
// 담당: 홍재창 (프론트엔드)

import { useState, useCallback, useEffect } from "react";
import { BrowserProvider } from "ethers";
import { setWalletHeader, getNonce } from "../api";

export function useWallet() {
  const [account, setAccount] = useState(null);
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // MetaMask 연결
  const connect = useCallback(async () => {
    if (!window.ethereum) {
      setError("MetaMask가 설치되어 있지 않습니다.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const prov = new BrowserProvider(window.ethereum);
      const accounts = await prov.send("eth_requestAccounts", []);
      const s = await prov.getSigner();
      const network = await prov.getNetwork();

      setProvider(prov);
      setSigner(s);
      setAccount(accounts[0]);
      setChainId(Number(network.chainId));
      setWalletHeader(accounts[0]);
    } catch (err) {
      setError("지갑 연결 실패: " + err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // 연결 해제
  const disconnect = useCallback(() => {
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
    if (!window.ethereum) return;

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

    window.ethereum.on("accountsChanged", handleAccountsChanged);
    window.ethereum.on("chainChanged", handleChainChanged);

    return () => {
      window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
      window.ethereum.removeListener("chainChanged", handleChainChanged);
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
