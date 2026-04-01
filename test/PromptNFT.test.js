const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("PromptNFT", function () {
  async function deployFixture() {
    const [owner, seller, buyer, royaltyReceiver] = await ethers.getSigners();
    const PromptNFT = await ethers.getContractFactory("PromptNFT");
    const contract = await PromptNFT.deploy(royaltyReceiver.address);
    await contract.waitForDeployment();
    return { contract, owner, seller, buyer, royaltyReceiver };
  }

  it("누구나 mint 가능", async function () {
    const { contract, seller, buyer } = await deployFixture();

    await expect(contract.connect(seller).mint("ipfs://token-1")).to.not.be.reverted;
    await expect(contract.connect(buyer).mint("ipfs://token-2")).to.not.be.reverted;

    expect(await contract.ownerOf(0)).to.equal(seller.address);
    expect(await contract.ownerOf(1)).to.equal(buyer.address);
  });

  it("판매 등록 후 buy 시 10% 로열티 + 소유권 이전", async function () {
    const { contract, seller, buyer, royaltyReceiver } = await deployFixture();

    await contract.connect(seller).mint("ipfs://token-1");

    const tokenId = 0;
    const price = ethers.parseEther("1.0");
    const royaltyAmount = ethers.parseEther("0.1");
    const sellerAmount = ethers.parseEther("0.9");

    await contract.connect(seller).listForSale(tokenId, price);

    const sellerBalanceBefore = await ethers.provider.getBalance(seller.address);
    const royaltyBalanceBefore = await ethers.provider.getBalance(royaltyReceiver.address);

    const tx = await contract.connect(buyer).buy(tokenId, { value: price });
    await tx.wait();

    const sellerBalanceAfter = await ethers.provider.getBalance(seller.address);
    const royaltyBalanceAfter = await ethers.provider.getBalance(royaltyReceiver.address);

    expect(await contract.ownerOf(tokenId)).to.equal(buyer.address);
    expect(sellerBalanceAfter - sellerBalanceBefore).to.equal(sellerAmount);
    expect(royaltyBalanceAfter - royaltyBalanceBefore).to.equal(royaltyAmount);

    const listing = await contract.listings(tokenId);
    expect(listing.active).to.equal(false);
  });

  it("hasAccess는 NFT 보유 시 true", async function () {
    const { contract, seller, buyer } = await deployFixture();

    expect(await contract.hasAccess(seller.address)).to.equal(false);

    await contract.connect(seller).mint("ipfs://token-1");
    expect(await contract.hasAccess(seller.address)).to.equal(true);

    await contract.connect(seller).transferFrom(seller.address, buyer.address, 0);
    expect(await contract.hasAccess(seller.address)).to.equal(false);
    expect(await contract.hasAccess(buyer.address)).to.equal(true);
  });
});
