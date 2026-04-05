import { useEffect, useState, useRef } from "react";
import { ethers } from "ethers";
import { getNonce } from "../api";

// 타임아웃 래퍼 — MetaMask 무응답 방지
function ethRequest(method, params, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`MetaMask 무응답 (${method})`));
    }, timeoutMs);
    window.ethereum
      .request({ method, ...(params ? { params } : {}) })
      .then((r) => { clearTimeout(timer); resolve(r); })
      .catch((e) => { clearTimeout(timer); reject(e); });
  });
}

export function useWallet() {
  const [account, setAccount] = useState("");
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const mountedRef = useRef(true);
  const busyRef = useRef(false);

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
    if (busyRef.current) return "";
    busyRef.current = true;
    setLoading(true);
    setError(null);

    try {
      // 1. 이미 연결된 계정 확인
      try {
        const existing = await ethRequest("eth_accounts", null, 3000);
        if (existing.length > 0) {
          const addr = existing[0].toLowerCase();
          setAccount(addr);
          return addr;
        }
      } catch {}

      // 2. wallet_requestPermissions (30초 — 사용자 승인 대기)
      try {
        await ethRequest("wallet_requestPermissions", [{ eth_accounts: {} }], 30000);
        const accts = await ethRequest("eth_accounts", null, 5000);
        if (accts.length > 0) {
          const addr = accts[0].toLowerCase();
          setAccount(addr);
          return addr;
        }
      } catch (e) {
        if (e.code === 4001) {
          setError("사용자가 연결을 거부했습니다");
          return "";
        }
        console.warn("[useWallet] wallet_requestPermissions:", e.message);
      }

      // 3. eth_requestAccounts 폴백 (30초)
      try {
        const accts2 = await ethRequest("eth_requestAccounts", null, 30000);
        if (accts2.length > 0) {
          const addr = accts2[0].toLowerCase();
          setAccount(addr);
          return addr;
        }
      } catch (e) {
        if (e.code === 4001) {
          setError("사용자가 연결을 거부했습니다");
          return "";
        }
      }

      setError("MetaMask가 응답하지 않습니다. Chrome을 완전히 종료(Ctrl+Shift+Q) 후 재시작하거나, MetaMask 설정 → 연결된 사이트에서 수동 연결하세요.");
      return "";
    } finally {
      setLoading(false);
      busyRef.current = false;
    }
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

    ethRequest("eth_accounts", null, 3000)
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