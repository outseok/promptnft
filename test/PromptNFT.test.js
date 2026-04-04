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

  it("누구나 mint 가능 + 사용량 설정", async function () {
    const { contract, seller, buyer } = await deployFixture();

    await expect(contract.connect(seller).mint("ipfs://token-1", 50)).to.not.be.reverted;
    await expect(contract.connect(buyer).mint("ipfs://token-2", 100)).to.not.be.reverted;

    expect(await contract.ownerOf(0)).to.equal(seller.address);
    expect(await contract.ownerOf(1)).to.equal(buyer.address);
    expect(await contract.usageLimit(0)).to.equal(50);
    expect(await contract.usageLimit(1)).to.equal(100);
  });

  it("판매 등록 후 buy 시 10% 로열티 + 소유권 이전", async function () {
    const { contract, seller, buyer, royaltyReceiver } = await deployFixture();

    await contract.connect(seller).mint("ipfs://token-1", 50);

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

  it("사용 기록 on-chain + 잔여 사용량 확인", async function () {
    const { contract, seller, buyer } = await deployFixture();

    await contract.connect(seller).mint("ipfs://token-1", 3);

    // 소유자만 사용 기록 가능
    await expect(contract.connect(buyer).recordUsage(0)).to.be.revertedWith("Not token owner");

    // 사용 기록
    await contract.connect(seller).recordUsage(0);
    let usage = await contract.getRemainingUsage(0);
    expect(usage.remaining).to.equal(2);
    expect(usage.used).to.equal(1);
    expect(usage.limit).to.equal(3);

    // 2번 더 사용
    await contract.connect(seller).recordUsage(0);
    await contract.connect(seller).recordUsage(0);

    // 사용량 초과
    await expect(contract.connect(seller).recordUsage(0)).to.be.revertedWith("Usage limit reached");

    usage = await contract.getRemainingUsage(0);
    expect(usage.remaining).to.equal(0);
  });

  it("재판매 시 잔여 사용량 유지 + 로열티 9:1", async function () {
    const { contract, seller, buyer, royaltyReceiver } = await deployFixture();

    // seller가 민팅 (5회 사용 가능)
    await contract.connect(seller).mint("ipfs://token-1", 5);

    // 2회 사용
    await contract.connect(seller).recordUsage(0);
    await contract.connect(seller).recordUsage(0);

    // buyer에게 판매
    const price = ethers.parseEther("0.5");
    await contract.connect(seller).listForSale(0, price);
    await contract.connect(buyer).buy(0, { value: price });

    // buyer가 소유
    expect(await contract.ownerOf(0)).to.equal(buyer.address);

    // 잔여 사용량 유지 (5 - 2 = 3)
    const usage = await contract.getRemainingUsage(0);
    expect(usage.remaining).to.equal(3);
    expect(usage.used).to.equal(2);

    // buyer가 사용
    await contract.connect(buyer).recordUsage(0);
    const usage2 = await contract.getRemainingUsage(0);
    expect(usage2.remaining).to.equal(2);
  });

  it("거래 시 민팅 (lazyMintAndBuy)", async function () {
    const { contract, seller, buyer, royaltyReceiver } = await deployFixture();

    const price = ethers.parseEther("1.0");
    const royaltyAmount = ethers.parseEther("0.1");

    const sellerBalBefore = await ethers.provider.getBalance(seller.address);
    const royaltyBalBefore = await ethers.provider.getBalance(royaltyReceiver.address);

    // buyer가 lazy mint + buy 한 번에 실행
    const tx = await contract.connect(buyer).lazyMintAndBuy("ipfs://lazy-1", seller.address, 30, { value: price });
    await tx.wait();

    // buyer가 소유
    expect(await contract.ownerOf(0)).to.equal(buyer.address);

    // 사용량 설정됨
    expect(await contract.usageLimit(0)).to.equal(30);

    // 로열티 분배 (9:1)
    const sellerBalAfter = await ethers.provider.getBalance(seller.address);
    const royaltyBalAfter = await ethers.provider.getBalance(royaltyReceiver.address);

    expect(sellerBalAfter - sellerBalBefore).to.equal(price - royaltyAmount);
    expect(royaltyBalAfter - royaltyBalBefore).to.equal(royaltyAmount);

    // 자기 자신에게는 불가
    await expect(
      contract.connect(buyer).lazyMintAndBuy("ipfs://lazy-2", buyer.address, 10, { value: price })
    ).to.be.revertedWith("Cannot buy own NFT");
  });

  it("hasAccess는 NFT 보유 시 true", async function () {
    const { contract, seller, buyer } = await deployFixture();

    expect(await contract.hasAccess(seller.address)).to.equal(false);

    await contract.connect(seller).mint("ipfs://token-1", 50);
    expect(await contract.hasAccess(seller.address)).to.equal(true);

    await contract.connect(seller).transferFrom(seller.address, buyer.address, 0);
    expect(await contract.hasAccess(seller.address)).to.equal(false);
    expect(await contract.hasAccess(buyer.address)).to.equal(true);
  });
});
