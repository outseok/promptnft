import { useEffect, useState, useCallback, useRef } from "react";
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
  const mountedRef = useRef(true);

  const isConnected = Boolean(account);

  // provider/signer 세팅 — getSigner 사용하지 않고 직접 생성
  const setupProviderSigner = useCallback(async (addr) => {
    if (!window.ethereum || !addr) {
      setProvider(null);
      setSigner(null);
      return;
    }
    try {
      const bp = new ethers.BrowserProvider(window.ethereum);
      const network = await bp.getNetwork();
      const s = new ethers.JsonRpcSigner(bp, addr);
      if (mountedRef.current) {
        setProvider(bp);
        setSigner(s);
        setChainId(Number(network.chainId));
      }
    } catch (e) {
      console.error("setupProviderSigner failed:", e);
      if (mountedRef.current) {
        setProvider(null);
        setSigner(null);
      }
    }
  }, []);

  // 연결
  const connect = useCallback(async () => {
    if (!window.ethereum) {
      setError("MetaMask가 설치되어 있지 않습니다.");
      return "";
    }
    try {
      setLoading(true);
      setError(null);
      console.log("[useWallet] eth_requestAccounts 요청...");
      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      });
      console.log("[useWallet] 계정 수신:", accounts);
      const addr = accounts[0] || "";
      if (!addr) {
        setError("계정을 가져올 수 없습니다");
        setLoading(false);
        return "";
      }
      setAccount(addr);
      await setupProviderSigner(addr);
      console.log("[useWallet] 연결 완료:", addr);
      return addr;
    } catch (err) {
      console.error("[useWallet] 연결 실패:", err);
      if (err.code === 4001) {
        setError("사용자가 연결을 거부했습니다");
      } else {
        setError("지갑 연결 실패: " + (err.shortMessage || err.message || ""));
      }
      return "";
    } finally {
      setLoading(false);
    }
  }, [setupProviderSigner]);

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
    const s = new ethers.JsonRpcSigner(bp, account);
    const signature = await s.signMessage(message);
    return { nonce, signature };
  }, [account]);

  // 초기 로드 + 이벤트 리스너
  useEffect(() => {
    mountedRef.current = true;

    if (!window.ethereum) return;

    // 이미 연결된 계정 체크 (팝업 없이)
    window.ethereum
      .request({ method: "eth_accounts" })
      .then(async (accounts) => {
        if (accounts.length > 0 && mountedRef.current) {
          console.log("[useWallet] 기존 연결 감지:", accounts[0]);
          setAccount(accounts[0]);
          await setupProviderSigner(accounts[0]);
        }
      })
      .catch((e) => console.error("[useWallet] eth_accounts 실패:", e));

    const handleAccountsChanged = (accounts) => {
      if (!mountedRef.current) return;
      const addr = accounts.length > 0 ? accounts[0] : "";
      console.log("[useWallet] 계정 변경:", addr);
      setAccount(addr);
      if (addr) {
        setupProviderSigner(addr);
      } else {
        setProvider(null);
        setSigner(null);
        setChainId(null);
      }
    };

    const handleChainChanged = () => {
      window.location.reload();
    };

    window.ethereum.on("accountsChanged", handleAccountsChanged);
    window.ethereum.on("chainChanged", handleChainChanged);

    return () => {
      mountedRef.current = false;
      if (window.ethereum.removeListener) {
        window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
        window.ethereum.removeListener("chainChanged", handleChainChanged);
      }
    };
  }, [setupProviderSigner]);

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