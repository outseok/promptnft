const hre = require("hardhat");

async function main() {
  const [signer] = await hre.ethers.getSigners();

  const contractAddress = process.env.CONTRACT_ADDRESS;
  if (!contractAddress) {
    throw new Error("CONTRACT_ADDRESS is required in environment");
  }

  const mintTo = process.env.MINT_TO || signer.address;
  const tokenUri = process.env.TOKEN_URI || `ipfs://promptnft-smoke-${Date.now()}`;

  const contract = await hre.ethers.getContractAt("PromptNFT", contractAddress, signer);

  const tokenId = Number(await contract.nextTokenId());
  console.log("Signer:", signer.address);
  console.log("Contract:", contractAddress);
  console.log("Mint to:", mintTo);
  console.log("Token ID:", tokenId);
  console.log("Token URI:", tokenUri);

  const tx = await contract.mint(mintTo, tokenUri);
  const receipt = await tx.wait();

  const owner = await contract.ownerOf(tokenId);
  const access = await contract.hasAccess(mintTo);

  console.log("Mint tx hash:", receipt.hash);
  console.log("ownerOf(tokenId):", owner);
  console.log("hasAccess(mintTo):", access);

  if (owner.toLowerCase() !== mintTo.toLowerCase()) {
    throw new Error("ownerOf mismatch");
  }
  if (!access) {
    throw new Error("hasAccess should be true after mint");
  }

  console.log("Smoke test passed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
