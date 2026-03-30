const ABI = [
  "function nextTokenId() view returns (uint256)",
  "function mint(address to, string tokenURI) returns (uint256)",
  "function listForSale(uint256 tokenId, uint256 price)",
  "function buy(uint256 tokenId) payable",
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function hasAccess(address user) view returns (bool)"
];

let browserProvider;
let signer;
let contract;
let account;

const el = (id) => document.getElementById(id);
const logEl = el("log");

function log(message) {
  const now = new Date().toLocaleTimeString();
  logEl.textContent += `[${now}] ${message}\n`;
  logEl.scrollTop = logEl.scrollHeight;
}

function setStatus() {
  const status = el("status");
  const c = el("contractAddress").value.trim();
  status.textContent = `account: ${account || "-"} | contract: ${c || "-"}`;
}

async function ensureConnected() {
  if (!window.ethereum) {
    throw new Error("MetaMask가 필요합니다.");
  }

  browserProvider = new ethers.BrowserProvider(window.ethereum);
  const accounts = await browserProvider.send("eth_requestAccounts", []);
  account = accounts?.[0];
  signer = await browserProvider.getSigner();

  const chainHex = el("targetChainHex").value.trim();
  if (chainHex) {
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: chainHex }]
      });
    } catch (error) {
      log(`네트워크 전환 실패: ${error.message}`);
    }
  }

  const contractAddress = el("contractAddress").value.trim();
  if (!ethers.isAddress(contractAddress)) {
    throw new Error("유효한 컨트랙트 주소를 입력하세요.");
  }

  contract = new ethers.Contract(contractAddress, ABI, signer);
  setStatus();
  log(`연결 완료: ${account}`);
}

async function runTx(label, action) {
  try {
    if (!contract) await ensureConnected();
    const tx = await action();
    log(`${label} tx 전송: ${tx.hash}`);
    const rcpt = await tx.wait();
    log(`${label} 완료 (block ${rcpt.blockNumber})`);
    return rcpt;
  } catch (error) {
    log(`${label} 실패: ${error.shortMessage || error.message}`);
    throw error;
  }
}

el("connectBtn").addEventListener("click", async () => {
  try {
    await ensureConnected();
  } catch (error) {
    log(`연결 실패: ${error.message}`);
  }
});

el("refreshBtn").addEventListener("click", async () => {
  try {
    await ensureConnected();
    const network = await browserProvider.getNetwork();
    log(`network chainId: ${network.chainId}`);
  } catch (error) {
    log(`갱신 실패: ${error.message}`);
  }
});

el("mintBtn").addEventListener("click", async () => {
  const to = el("mintTo").value.trim() || account;
  const tokenURI = el("mintUri").value.trim();
  await runTx("mint", () => contract.mint(to, tokenURI));
});

el("listBtn").addEventListener("click", async () => {
  const tokenId = BigInt(el("listTokenId").value);
  const priceWei = ethers.parseEther(el("listPriceEth").value.trim());
  await runTx("listForSale", () => contract.listForSale(tokenId, priceWei));
});

el("buyBtn").addEventListener("click", async () => {
  const tokenId = BigInt(el("buyTokenId").value);
  const priceWei = ethers.parseEther(el("buyPriceEth").value.trim());
  await runTx("buy", () => contract.buy(tokenId, { value: priceWei }));
});

el("ownerBtn").addEventListener("click", async () => {
  try {
    if (!contract) await ensureConnected();
    const tokenId = BigInt(el("ownerTokenId").value);
    const owner = await contract.ownerOf(tokenId);
    log(`ownerOf(${tokenId}) = ${owner}`);
  } catch (error) {
    log(`ownerOf 실패: ${error.shortMessage || error.message}`);
  }
});

el("accessBtn").addEventListener("click", async () => {
  try {
    if (!contract) await ensureConnected();
    const user = el("accessAddress").value.trim() || account;
    const access = await contract.hasAccess(user);
    log(`hasAccess(${user}) = ${access}`);
  } catch (error) {
    log(`hasAccess 실패: ${error.shortMessage || error.message}`);
  }
});

el("nextTokenBtn").addEventListener("click", async () => {
  try {
    if (!contract) await ensureConnected();
    const nextTokenId = await contract.nextTokenId();
    log(`nextTokenId = ${nextTokenId}`);
  } catch (error) {
    log(`nextTokenId 실패: ${error.shortMessage || error.message}`);
  }
});

setStatus();
log("페이지 로드 완료");
