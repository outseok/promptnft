const hre = require("hardhat");

async function main() {
  const [seller] = await hre.ethers.getSigners();
  const contractAddress = process.env.CONTRACT_ADDRESS;

  if (!contractAddress) {
    throw new Error("CONTRACT_ADDRESS is required in environment");
  }

  const provider = hre.ethers.provider;
  const sellerContract = await hre.ethers.getContractAt("PromptNFT", contractAddress, seller);

  const buyer = hre.ethers.Wallet.createRandom().connect(provider);
  const fundAmount = hre.ethers.parseEther(process.env.E2E_FUND_ETH || "0.03");
  const price = hre.ethers.parseEther(process.env.E2E_PRICE_ETH || "0.01");

  console.log("Contract:", contractAddress);
  console.log("Seller:", seller.address);
  console.log("Buyer:", buyer.address);
  console.log("Funding buyer with:", hre.ethers.formatEther(fundAmount), "ETH");

  const fundTx = await seller.sendTransaction({ to: buyer.address, value: fundAmount });
  await fundTx.wait();

  const tokenId = Number(await sellerContract.nextTokenId());
  const tokenURI = process.env.TOKEN_URI || `ipfs://promptnft-e2e-${Date.now()}`;

  console.log("Mint tokenId:", tokenId);
  const mintTx = await sellerContract.mint(seller.address, tokenURI);
  await mintTx.wait();

  const listTx = await sellerContract.listForSale(tokenId, price);
  await listTx.wait();
  console.log("Listed token", tokenId, "for", hre.ethers.formatEther(price), "ETH");

  const buyerContract = await hre.ethers.getContractAt("PromptNFT", contractAddress, buyer);
  const buyTx = await buyerContract.buy(tokenId, { value: price });
  const buyRcpt = await buyTx.wait();
  console.log("Buy tx hash:", buyRcpt.hash);

  const finalOwner = await sellerContract.ownerOf(tokenId);
  const buyerAccess = await sellerContract.hasAccess(buyer.address);
  const sellerAccess = await sellerContract.hasAccess(seller.address);
  const listing = await sellerContract.listings(tokenId);

  console.log("ownerOf(tokenId):", finalOwner);
  console.log("hasAccess(buyer):", buyerAccess);
  console.log("hasAccess(seller):", sellerAccess);
  console.log("listing.active:", listing.active);

  if (finalOwner.toLowerCase() !== buyer.address.toLowerCase()) {
    throw new Error("E2E failed: owner is not buyer");
  }
  if (!buyerAccess) {
    throw new Error("E2E failed: buyer access should be true");
  }
  if (listing.active) {
    throw new Error("E2E failed: listing should be inactive");
  }

  console.log("E2E on hoodi passed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
