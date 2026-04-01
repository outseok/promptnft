import { useState } from "react";
import { ethers } from "ethers";
import useWallet from "../hooks/useWallet";
import useContract from "../hooks/useContract";
import { encryptPrompt, mintPrompt } from "../utils/api";

function getMintedTokenIdFromReceipt(receipt, contract) {
  if (!receipt?.logs) return null;

  for (const log of receipt.logs) {
    try {
      const parsed = contract.interface.parseLog(log);
      if (parsed && parsed.name === "Minted") {
        return Number(parsed.args.tokenId);
      }
    } catch {
      // ignore parse error
    }
  }

  return null;
}

export default function MintPage() {
  const { account, connectWallet } = useWallet();
  const { getContract } = useContract();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);

  const handleMint = async () => {
    try {
      let wallet = account;
      if (!wallet) {
        wallet = await connectWallet();
      }
      if (!wallet) return;

      if (!title.trim()) {
        alert("제목을 입력하세요.");
        return;
      }

      if (!prompt.trim()) {
        alert("프롬프트 원문을 입력하세요.");
        return;
      }

      if (!price.trim()) {
        alert("가격을 입력하세요.");
        return;
      }

      setLoading(true);

      // 1) 컨트랙트 mint
      const contract = await getContract();
      const tokenURI = `promptnft://${title.trim()}`;

      const mintTx = await contract.mint(wallet, tokenURI);
      const mintReceipt = await mintTx.wait();

      const tokenId = getMintedTokenIdFromReceipt(mintReceipt, contract);

      if (tokenId === null || tokenId === undefined) {
        throw new Error("mint 후 tokenId 추출 실패");
      }

      // 2) 판매 등록
      const priceWei = ethers.parseEther(price);
      const listTx = await contract.listForSale(tokenId, priceWei);
      await listTx.wait();

      // 3) 백엔드 암호화
      const encryptedResult = await encryptPrompt({
        tokenId,
        promptContent: prompt,
        walletAddress: wallet,
      });

      const promptEncrypted =
        encryptedResult.prompt_encrypted ||
        encryptedResult.data?.prompt_encrypted ||
        encryptedResult.encrypted ||
        encryptedResult.data?.encrypted ||
        encryptedResult.encryptedPrompt ||
        encryptedResult.data?.encryptedPrompt;

      if (!promptEncrypted) {
        throw new Error("prompt_encrypted 생성 실패");
      }

      // 4) DB 저장
      const result = await mintPrompt({
        token_id: tokenId,
        title: title.trim(),
        description: description.trim(),
        prompt_encrypted: promptEncrypted,
        creator_address: wallet,
        price: price.trim(),
      });

      console.log("민팅 저장 결과:", result);
      alert(`민팅 완료 (token_id: ${tokenId})`);

      setTitle("");
      setDescription("");
      setPrice("");
      setPrompt("");
    } catch (error) {
      console.error(error);
      alert(error.message || "민팅 실패");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2>프롬프트 등록</h2>

      <div className="wallet-box">
        <button onClick={connectWallet}>
          {account ? `지갑 연결됨: ${account.slice(0, 6)}...${account.slice(-4)}` : "지갑 연결"}
        </button>
      </div>

      <div className="form-box">
        <input
          type="text"
          placeholder="제목"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />

        <input
          type="text"
          placeholder="설명"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        <input
          type="text"
          placeholder="가격(ETH)"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
        />

        <textarea
          rows={8}
          placeholder="프롬프트 원문"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
        />

        <button onClick={handleMint} disabled={loading}>
          {loading ? "민팅 중..." : "민팅 + 등록"}
        </button>
      </div>
    </div>
  );
}