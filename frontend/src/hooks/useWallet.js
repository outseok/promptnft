import { useEffect, useState, useCallback, useRef } from "react";
import { ethers } from "ethers";
import { getNonce } from "../api";

export function useWallet() {
  const [account, setAccount] = useState("");
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const mountedRef = useRef(true);

  const isConnected = Boolean(account);

  // account가 바뀌면 provider/signer를 별도로 세팅 (connect와 분리!)
  useEffect(() => {
    if (!account || !window.ethereum) {
      setProvider(null);
      setSigner(null);
      setChainId(null);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const bp = new ethers.BrowserProvider(window.ethereum);
        const network = await bp.getNetwork();
        // getSigner를 쓰지 않고 직접 생성
        const s = new ethers.JsonRpcSigner(bp, account);
        if (!cancelled) {
          setProvider(bp);
          setSigner(s);
          setChainId(Number(network.chainId));
        }
      } catch (e) {
        console.error("[useWallet] provider/signer 세팅 실패:", e);
        // provider/signer 실패해도 account는 유지 (연결은 된 상태)
      }
    })();

    return () => { cancelled = true; };
  }, [account]);

  // 연결 — eth_requestAccounts만 하고 끝. signer는 위 useEffect가 처리
  const connect = useCallback(async () => {
    if (!window.ethereum) {
      setError("MetaMask가 설치되어 있지 않습니다.");
      return "";
    }
    setLoading(true);
    setError(null);
    try {
      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      });
      const addr = (accounts[0] || "").toLowerCase();
      if (!addr) {
        setError("계정을 가져올 수 없습니다");
        return "";
      }
      setAccount(addr);
      return addr;
    } catch (err) {
      if (err.code === 4001) {
        setError("사용자가 연결을 거부했습니다");
      } else {
        setError("지갑 연결 실패");
      }
      console.error("[useWallet] connect error:", err);
      return "";
    } finally {
      setLoading(false);
    }
  }, []);

  // 연결 해제
  const disconnect = useCallback(() => {
    setAccount("");
  }, []);

  // 서명
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

  // 초기 로드 — 이미 연결된 계정 확인 + 이벤트 리스너
  useEffect(() => {
    mountedRef.current = true;
    if (!window.ethereum) return;

    window.ethereum
      .request({ method: "eth_accounts" })
      .then((accounts) => {
        if (accounts.length > 0 && mountedRef.current) {
          setAccount(accounts[0].toLowerCase());
        }
      })
      .catch(() => {});

    const handleAccountsChanged = (accounts) => {
      if (!mountedRef.current) return;
      if (accounts.length > 0) {
        setAccount(accounts[0].toLowerCase());
      } else {
        setAccount("");
      }
    };

    const handleChainChanged = () => window.location.reload();

    window.ethereum.on("accountsChanged", handleAccountsChanged);
    window.ethereum.on("chainChanged", handleChainChanged);

    return () => {
      mountedRef.current = false;
      window.ethereum.removeListener?.("accountsChanged", handleAccountsChanged);
      window.ethereum.removeListener?.("chainChanged", handleChainChanged);
    };
  }, []);

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

export default useWallet;