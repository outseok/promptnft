import { useEffect, useState, useRef } from "react";
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

  // account 변경 → provider/signer 세팅
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
        const s = await bp.getSigner(account);
        if (!cancelled) {
          setProvider(bp);
          setSigner(s);
          setChainId(Number(network.chainId));
        }
      } catch (e) {
        console.warn("[useWallet] signer setup failed:", e.message);
        // provider만이라도 세팅
        try {
          const bp = new ethers.BrowserProvider(window.ethereum);
          const network = await bp.getNetwork();
          if (!cancelled) {
            setProvider(bp);
            setChainId(Number(network.chainId));
          }
        } catch {}
      }
    })();
    return () => { cancelled = true; };
  }, [account]);

  // 연결
  async function connect() {
    if (!window.ethereum) {
      setError("MetaMask가 설치되어 있지 않습니다.");
      return "";
    }
    setLoading(true);
    setError(null);

    // 이미 연결된 계정이 있으면 바로 사용
    try {
      const existing = await window.ethereum.request({ method: "eth_accounts" });
      if (existing.length > 0) {
        const addr = existing[0].toLowerCase();
        setAccount(addr);
        setLoading(false);
        return addr;
      }
    } catch {}

    // 연결 요청 (10초 타임아웃)
    try {
      const result = await Promise.race([
        requestConnection(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("TIMEOUT")), 10000)
        ),
      ]);
      if (result) {
        setAccount(result);
        return result;
      }
      setError("계정을 가져올 수 없습니다");
      return "";
    } catch (err) {
      if (err.message === "TIMEOUT") {
        setError("MetaMask 응답 시간 초과 — MetaMask 팝업을 확인하거나, 확장 프로그램을 직접 열어서 연결을 승인해주세요.");
      } else if (err.code === 4001) {
        setError("사용자가 연결을 거부했습니다");
      } else {
        setError("지갑 연결 실패: " + (err.message || ""));
      }
      return "";
    } finally {
      setLoading(false);
    }
  }

  // 실제 연결 요청 — 여러 방법 시도
  async function requestConnection() {
    // 방법 1: wallet_requestPermissions (최신 MetaMask)
    try {
      await window.ethereum.request({
        method: "wallet_requestPermissions",
        params: [{ eth_accounts: {} }],
      });
      const accounts = await window.ethereum.request({ method: "eth_accounts" });
      if (accounts.length > 0) return accounts[0].toLowerCase();
    } catch (e) {
      // 사용자 거부면 바로 throw
      if (e.code === 4001) throw e;
      console.warn("[useWallet] wallet_requestPermissions failed, trying fallback");
    }

    // 방법 2: eth_requestAccounts (기존 방식)
    try {
      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      });
      if (accounts.length > 0) return accounts[0].toLowerCase();
    } catch (e) {
      throw e;
    }

    return "";
  }

  function disconnect() {
    setAccount("");
  }

  async function signMessage() {
    if (!window.ethereum || !account) {
      throw new Error("지갑이 연결되지 않았습니다");
    }
    const { nonce, message } = await getNonce(account);
    const bp = new ethers.BrowserProvider(window.ethereum);
    const s = await bp.getSigner(account);
    const signature = await s.signMessage(message);
    return { nonce, signature };
  }

  // 초기 로드
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

    function handleAccountsChanged(accounts) {
      if (!mountedRef.current) return;
      setAccount(accounts.length > 0 ? accounts[0].toLowerCase() : "");
    }
    function handleChainChanged() {
      window.location.reload();
    }

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