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

  // account 변경 시 provider/signer 백그라운드 세팅
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
        // getSigner(addr)를 5초 타임아웃으로 감싸기
        const signerPromise = bp.getSigner(account);
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error("getSigner timeout")), 5000)
        );
        const s = await Promise.race([signerPromise, timeoutPromise]);
        const network = await bp.getNetwork();
        if (!cancelled) {
          setProvider(bp);
          setSigner(s);
          setChainId(Number(network.chainId));
        }
      } catch (e) {
        console.warn("[useWallet] signer 세팅 실패 (무시):", e.message);
        // signer 실패해도 account(연결 상태)는 유지
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

  // 연결 — eth_requestAccounts만 호출, signer는 위 useEffect가 처리
  async function connect() {
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
      return "";
    } finally {
      setLoading(false);
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

  // 초기 로드 + 이벤트
  useEffect(() => {
    mountedRef.current = true;
    if (!window.ethereum) return;

    // 이미 연결된 계정 확인 (팝업 없는 passive 호출)
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