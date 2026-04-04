import { useState } from "react";
import { changeSaleStatus, getMyNfts } from "../utils/api";
import useWallet from "../hooks/useWallet";
import { Link } from "react-router-dom";

function normalizeList(result) {
  if (Array.isArray(result)) return result;
  if (Array.isArray(result.data)) return result.data;
  if (Array.isArray(result.nfts)) return result.nfts;
  return [];
}

export default function MyPage() {
  const { account, connectWallet } = useWallet();
  const [nfts, setNfts] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleLoad = async () => {
    try {
      let wallet = account;
      if (!wallet) {
        wallet = await connectWallet();
      }
      if (!wallet) return;

      setLoading(true);
      const result = await getMyNfts(wallet);
      setNfts(normalizeList(result));
    } catch (error) {
      console.error(error);
      alert(error.message || "내 NFT 조회 실패");
    } finally {
      setLoading(false);
    }
  };



  return (
    <div>
      <div className="wallet-box">
        <button onClick={handleLoad}>
          {loading ? "불러오는 중..." : "내 NFT 불러오기"}
        </button>
      </div>

      <h2>내 NFT</h2>

      {nfts.length === 0 ? (
        <p>보유한 NFT가 없거나 아직 조회하지 않았습니다.</p>
      ) : (
        <div className="card-grid">
          {nfts.map((nft) => (
            <div className="card" key={nft.token_id}>
              <h3>{nft.title}</h3>
              <p>{nft.description}</p>
              <p>가격: {nft.price} ETH</p>

              <div className="button-row">
                
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