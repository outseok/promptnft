import { useEffect, useState, useCallback } from "react";
import { ethers } from "ethers";
import { getNonce } from "../api";

// named export — WalletContext에서 { useWallet } 로 import
export function useWallet() {
  const [account, setAccount] = useState("");
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const isConnected = Boolean(account);

  // provider/signer 갱신
  const refreshProviderSigner = useCallback(async (addr) => {
    if (!window.ethereum || !addr) {
      setProvider(null);
      setSigner(null);
      return;
    }
    try {
      const bp = new ethers.BrowserProvider(window.ethereum);
      setProvider(bp);
      // 반드시 addr를 전달 — getSigner() 호출 시 eth_requestAccounts 재호출 방지
      const s = await bp.getSigner(addr);
      setSigner(s);
      const network = await bp.getNetwork();
      setChainId(Number(network.chainId));
    } catch (e) {
      console.error("refreshProviderSigner failed:", e);
      setProvider(null);
      setSigner(null);
    }
  }, []);

  // 연결
  const connect = useCallback(async () => {
    if (!window.ethereum) {
      setError("MetaMask가 필요합니다.");
      return "";
    }
    try {
      setLoading(true);
      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      });
      const addr = accounts[0] || "";
      setAccount(addr);
      await refreshProviderSigner(addr);
      setError(null);
      return addr;
    } catch (err) {
      setError("지갑 연결 실패");
      console.error(err);
      return "";
    } finally {
      setLoading(false);
    }
  }, [refreshProviderSigner]);

  // 연결 해제
  const disconnect = useCallback(() => {
    setAccount("");
    setProvider(null);
    setSigner(null);
    setChainId(null);
  }, []);

  // 서명 (nonce 기반)
  const signMessage = useCallback(async () => {
    if (!window.ethereum || !account) {
      throw new Error("지갑이 연결되지 않았습니다");
    }
    const { nonce, message } = await getNonce(account);
    const bp = new ethers.BrowserProvider(window.ethereum);
    const s = await bp.getSigner(account);
    const signature = await s.signMessage(message);
    return { nonce, signature };
  }, [account]);

  // 초기 로드 + 이벤트 리스너
  useEffect(() => {
    if (!window.ethereum) {
      setLoading(false);
      return;
    }

    const handleAccountsChanged = (accounts) => {
      const addr = accounts.length > 0 ? accounts[0] : "";
      setAccount(addr);
      refreshProviderSigner(addr);
    };

    const handleChainChanged = () => {
      window.location.reload();
    };

    window.ethereum
      .request({ method: "eth_accounts" })
      .then(async (accounts) => {
        if (accounts.length > 0) {
          setAccount(accounts[0]);
          await refreshProviderSigner(accounts[0]);
        }
      })
      .catch(() => {});

    window.ethereum.on("accountsChanged", handleAccountsChanged);
    window.ethereum.on("chainChanged", handleChainChanged);

    return () => {
      if (window.ethereum.removeListener) {
        window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
        window.ethereum.removeListener("chainChanged", handleChainChanged);
      }
    };
  }, [refreshProviderSigner]);

  return {
    account,
    isConnected,
    connect,
    disconnect,
    provider,
    signer,
    chainId,
    loading,
    error,
    signMessage,
  };
}

// default export도 유지 (기존 import 호환)
export default useWallet;