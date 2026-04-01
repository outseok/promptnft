import { ethers } from "ethers";
import abi from "../abi/PromptNFT.json";

// 반드시 네가 Remix에서 배포한 실제 주소로 바꿔야 함
const CONTRACT_ADDRESS = "0xd1722525Be71EbEdecaf65E493c11323EabA77bD";

export default function useContract() {
  const getProvider = async () => {
    if (!window.ethereum) {
      throw new Error("MetaMask가 필요합니다.");
    }

    return new ethers.BrowserProvider(window.ethereum);
  };

  const getSigner = async () => {
    const provider = await getProvider();
    return await provider.getSigner();
  };

  const getContract = async () => {
    const signer = await getSigner();
    return new ethers.Contract(CONTRACT_ADDRESS, abi, signer);
  };

  return { getProvider, getSigner, getContract, CONTRACT_ADDRESS };
}