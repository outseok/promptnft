const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const royaltyReceiver = process.env.ROYALTY_RECEIVER || deployer.address;

  console.log("Deploying with:", deployer.address);
  console.log("Royalty receiver:", royaltyReceiver);

  const PromptNFT = await hre.ethers.getContractFactory("PromptNFT");
  const contract = await PromptNFT.deploy(deployer.address, royaltyReceiver);

  await contract.waitForDeployment();
  const address = await contract.getAddress();

  console.log("PromptNFT deployed to:", address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
