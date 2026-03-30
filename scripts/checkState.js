const hre = require("hardhat");

async function main() {
  const contractAddress = process.env.CONTRACT_ADDRESS;
  const checkAddress = process.env.CHECK_ADDRESS;

  if (!contractAddress) {
    throw new Error("CONTRACT_ADDRESS is required");
  }

  const contract = await hre.ethers.getContractAt("PromptNFT", contractAddress);

  const nextTokenId = await contract.nextTokenId();
  console.log("Contract:", contractAddress);
  console.log("nextTokenId:", nextTokenId.toString());

  if (nextTokenId > 0n) {
    const owner0 = await contract.ownerOf(0);
    console.log("ownerOf(0):", owner0);
  } else {
    console.log("No token minted yet");
  }

  if (checkAddress) {
    const access = await contract.hasAccess(checkAddress);
    console.log("hasAccess(checkAddress):", access);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
