import { useEffect, useState, useCallback, useRef } from "react";
import { ethers } from "ethers";
import { getNonce } from "../api";

// EIP-6963: 최신 MetaMask는 window.ethereum 대신 이벤트로 provider를 알림
function getEthereumProvider() {
  // EIP-6963으로 발견된 MetaMask provider 우선
  if (window._eip6963MetaMask) return window._eip6963MetaMask;
  // fallback: 전통적 window.ethereum
  return window.ethereum;
}

export function useWallet() {
  const [account, setAccount] = useState("");
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const mountedRef = useRef(true);

  const isConnected = Boolean(account);

  const refreshProviderSigner = useCallback(async (addr) => {
    const eth = getEthereumProvider();
    if (!eth || !addr) {
      setProvider(null);
      setSigner(null);
      return;
    }
    try {
      const bp = new ethers.BrowserProvider(eth);
      setProvider(bp);
      const s = await bp.getSigner();
      setSigner(s);
      const network = await bp.getNetwork();
      setChainId(Number(network.chainId));
    } catch (e) {
      console.warn("[useWallet] refreshProviderSigner failed:", e);
      setProvider(null);
      setSigner(null);
    }
  }, []);

  const connect = useCallback(async () => {
    const eth = getEthereumProvider();
    if (!eth) {
      setError("MetaMask가 설치되어 있지 않습니다. 브라우저 확장 프로그램을 확인해주세요.");
      return "";
    }
    try {
      setLoading(true);
      setError(null);

      // wallet_requestPermissions → 항상 MetaMask 계정 선택 팝업 강제 표시
      await eth.request({
        method: "wallet_requestPermissions",
        params: [{ eth_accounts: {} }],
      });
      const accounts = await eth.request({ method: "eth_requestAccounts" });

      const addr = (accounts && accounts[0]) || "";
      if (!addr) {
        setError("연결된 계정이 없습니다. MetaMask에서 계정을 선택해주세요.");
        return "";
      }

      // 연결 성공 → disconnected 플래그 제거
      localStorage.removeItem("promptnft_disconnected");
      setAccount(addr);
      await refreshProviderSigner(addr);
      return addr;
    } catch (err) {
      if (err.code === 4001) {
        setError("사용자가 연결을 거부했습니다");
      } else {
        setError("지갑 연결 실패: " + (err.message || "알 수 없는 오류"));
        console.error("[useWallet] connect error:", err);
      }
      return "";
    } finally {
      setLoading(false);
    }
  }, [refreshProviderSigner]);

  const disconnect = useCallback(async () => {
    // 로컬 상태 초기화
    setAccount("");
    setProvider(null);
    setSigner(null);
    setChainId(null);
    setError(null);
    // 자동 복원 방지 플래그
    localStorage.setItem("promptnft_disconnected", "1");
    // MetaMask 권한 해제 → 재연결 시 팝업 강제
    const eth = getEthereumProvider();
    if (eth) {
      try {
        await eth.request({
          method: "wallet_revokePermissions",
          params: [{ eth_accounts: {} }],
        });
      } catch {
        // 미지원 버전에서는 무시 — localStorage 플래그로 처리
      }
    }
  }, []);

  const signMessage = useCallback(async () => {
    const eth = getEthereumProvider();
    if (!eth || !account) {
      throw new Error("지갑이 연결되지 않았습니다");
    }
    const { nonce, message } = await getNonce(account);
    const bp = new ethers.BrowserProvider(eth);
    const s = await bp.getSigner();
    const signature = await s.signMessage(message);
    return { nonce, signature };
  }, [account]);

  // EIP-6963 provider 감지
  useEffect(() => {
    const handler = (event) => {
      const info = event.detail?.info;
      const prov = event.detail?.provider;
      if (info && prov && (info.rdns === "io.metamask" || info.name?.toLowerCase().includes("metamask"))) {
        window._eip6963MetaMask = prov;
      }
    };
    window.addEventListener("eip6963:announceProvider", handler);
    // 이미 선언된 provider 요청
    window.dispatchEvent(new Event("eip6963:requestProvider"));
    return () => window.removeEventListener("eip6963:announceProvider", handler);
  }, []);

  // 기존 연결 복원 + 이벤트 리스너
  useEffect(() => {
    mountedRef.current = true;
    const eth = getEthereumProvider();
    if (!eth) return;

    const handleAccountsChanged = (accounts) => {
      if (!mountedRef.current) return;
      const addr = accounts.length > 0 ? accounts[0] : "";
      setAccount(addr);
      if (addr) {
        refreshProviderSigner(addr);
      } else {
        setProvider(null);
        setSigner(null);
        setChainId(null);
      }
    };

    const handleChainChanged = () => {
      window.location.reload();
    };

    // 사용자가 명시적으로 해제한 경우 자동 복원하지 않음
    if (localStorage.getItem("promptnft_disconnected") !== "1") {
      eth
        .request({ method: "eth_accounts" })
        .then(async (accounts) => {
          if (!mountedRef.current) return;
          if (accounts.length > 0) {
            setAccount(accounts[0]);
            await refreshProviderSigner(accounts[0]);
          }
        })
        .catch((e) => console.warn("[useWallet] eth_accounts check failed:", e));
    }

    eth.on("accountsChanged", handleAccountsChanged);
    eth.on("chainChanged", handleChainChanged);

    return () => {
      mountedRef.current = false;
      if (eth.removeListener) {
        eth.removeListener("accountsChanged", handleAccountsChanged);
        eth.removeListener("chainChanged", handleChainChanged);
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

export default useWallet;