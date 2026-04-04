import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import useWallet from "../hooks/useWallet";
import useContract from "../hooks/useContract";
import { buyNft, getNfts } from "../utils/api";

function normalizeList(result) {
  if (Array.isArray(result)) return result;
  if (Array.isArray(result.data)) return result.data;
  if (Array.isArray(result.nfts)) return result.nfts;
  return [];
}

export default function MarketPage() {
  const [nfts, setNfts] = useState([]);
  const [loading, setLoading] = useState(true);
  const { account, connectWallet } = useWallet();
  const { getContract } = useContract();

  const fetchList = async () => {
    try {
      setLoading(true);
      const result = await getNfts(true);
      setNfts(normalizeList(result));
    } catch (error) {
      console.error(error);
      alert(error.message || "목록 조회 실패");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchList();
  }, []);

  const handleBuy = async (nft) => {
    try {
      let wallet = account;
      if (!wallet) {
        wallet = await connectWallet();
      }
      if (!wallet) return;

      const contract = await getContract();
      const tokenId = nft.token_id;

      const listing = await contract.listings(tokenId);
      const buyTx = await contract.buy(tokenId, {
        value: listing.price,
      });
      const buyReceipt = await buyTx.wait();

      await buyNft({
        token_id: tokenId,
        buyer_address: wallet,
        price: nft.price,
        tx_hash: buyReceipt.hash,
      });

      alert("구매 완료");
      fetchList();
    } catch (error) {
      console.error(error);
      alert(error.message || "구매 실패");
    }
  };

  return (
    <div>
      <div className="wallet-box">
        <button onClick={connectWallet}>
          {account ? `지갑 연결됨: ${account.slice(0, 6)}...${account.slice(-4)}` : "지갑 연결"}
        </button>
      </div>

      <h2>마켓플레이스</h2>

      {loading ? (
        <p>불러오는 중...</p>
      ) : nfts.length === 0 ? (
        <p>판매 중인 NFT가 없습니다.</p>
      ) : (
        <div className="card-grid">
          {nfts.map((nft) => (
            <div className="card" key={nft.token_id}>
              <h3>{nft.title}</h3>
              <p>{nft.description}</p>
              <p>가격: {nft.price} ETH</p>

              <div className="button-row">
                <button onClick={() => handleBuy(nft)}>구매</button>
                <Link to={`/execute/${nft.token_id}`}>
                  <button>실행</button>
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}