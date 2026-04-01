import { useParams } from "react-router-dom";
import { useState } from "react";
import useWallet from "../hooks/useWallet";
import { executePrompt, getExecutionStats, getNonce } from "../utils/api";

export default function ExecutePage() {
  const { tokenId } = useParams();
  const { account, connectWallet } = useWallet();

  const [userInput, setUserInput] = useState("");
  const [result, setResult] = useState("");
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);

  const loadStats = async () => {
    try {
      const res = await getExecutionStats(tokenId);
      setStats(res.data || res);
    } catch (error) {
      console.error(error);
    }
  };

  const handleExecute = async () => {
    try {
      let wallet = account;
      if (!wallet) {
        wallet = await connectWallet();
      }
      if (!wallet) return;

      setLoading(true);

      const nonceResult = await getNonce(wallet);
      const nonce =
        nonceResult.nonce ||
        nonceResult.data?.nonce ||
        nonceResult.data ||
        nonceResult.message;

      if (!nonce) {
        throw new Error("nonce 조회 실패");
      }

      const signature = await window.ethereum.request({
        method: "personal_sign",
        params: [String(nonce), wallet],
      });

      const res = await executePrompt({
        tokenId,
        address: wallet,
        signature,
        nonce: String(nonce),
        userInput,
      });

      setResult(
        res.result ||
          res.data?.result ||
          res.output ||
          res.data?.output ||
          "실행 결과가 없습니다."
      );

      loadStats();
    } catch (error) {
      console.error(error);
      alert(error.message || "실행 실패");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2>실행 페이지</h2>
      <p>Token ID: {tokenId}</p>

      <div className="form-box">
        <textarea
          rows={6}
          placeholder="추가 입력값"
          value={userInput}
          onChange={(e) => setUserInput(e.target.value)}
        />

        <div className="button-row">
          <button onClick={connectWallet}>지갑 연결</button>
          <button onClick={handleExecute} disabled={loading}>
            {loading ? "실행 중..." : "실행하기"}
          </button>
        </div>
      </div>

      {stats && (
        <div className="result-box">
          <h3>실행 횟수</h3>
          <p>총 실행: {stats.execution_count}</p>
          <p>최대 실행: {stats.max_executions}</p>
          <p>남은 횟수: {stats.remaining}</p>
        </div>
      )}

      {result && (
        <div className="result-box">
          <h3>실행 결과</h3>
          <pre>{result}</pre>
        </div>
      )}
    </div>
  );
}