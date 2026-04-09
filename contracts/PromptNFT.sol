// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/token/common/ERC2981.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract PromptNFT is ERC721URIStorage, ERC2981, Ownable {
    uint96 public constant ROYALTY_BPS = 1000; // 10%

    struct Listing {
        address seller;
        uint256 price;
        bool active;
    }

    uint256 public nextTokenId;
    mapping(uint256 => Listing) public listings;

    // ── 사용권 관리 (on-chain, Etherscan에서 조회 가능) ──
    mapping(uint256 => uint256) public usageLimit;   // 최대 사용 횟수
    mapping(uint256 => uint256) public usageCount;   // 현재 사용 횟수

    event Minted(uint256 indexed tokenId, address indexed to, string tokenURI);
    event Listed(uint256 indexed tokenId, address indexed seller, uint256 price);
    event Purchase(
        uint256 indexed tokenId,
        address indexed buyer,
        address indexed seller,
        uint256 price,
        uint256 royaltyPaid
    );
    event ListingCanceled(uint256 indexed tokenId);
    event UsageRecorded(uint256 indexed tokenId, address indexed user, uint256 remaining);
    event LazyMinted(uint256 indexed tokenId, address indexed creator, address indexed buyer, string tokenURI);
    event Burned(uint256 indexed tokenId, address indexed lastOwner, string reason);

    constructor(address royaltyReceiver)
        ERC721("PromptNFT", "PRMPT")
        Ownable()
    {
        require(royaltyReceiver != address(0), "Invalid royalty receiver");
        _transferOwnership(msg.sender);
        _setDefaultRoyalty(royaltyReceiver, ROYALTY_BPS);
    }

    /// @notice 직접 민팅 — 누구나 가능 (msg.sender에게 발행) + 사용 횟수 설정
    function mint(string calldata _tokenURI, uint256 _usageLimit) external returns (uint256) {
        uint256 tokenId = nextTokenId;
        nextTokenId += 1;

        _safeMint(msg.sender, tokenId);
        _setTokenURI(tokenId, _tokenURI);
        usageLimit[tokenId] = _usageLimit;

        emit Minted(tokenId, msg.sender, _tokenURI);
        return tokenId;
    }

    /// @notice 거래 시 민팅 (Lazy Mint + Buy) — 구매자가 호출, creator에게 ETH 지급
    function lazyMintAndBuy(
        string calldata _tokenURI,
        address creator,
        uint256 _usageLimit
    ) external payable returns (uint256) {
        require(msg.value > 0, "Must send ETH");
        require(creator != address(0), "Invalid creator");
        require(creator != msg.sender, "Cannot buy own NFT");

        uint256 tokenId = nextTokenId;
        nextTokenId += 1;

        _safeMint(msg.sender, tokenId);
        _setTokenURI(tokenId, _tokenURI);
        usageLimit[tokenId] = _usageLimit;

        (address royaltyReceiver, uint256 royaltyAmount) = royaltyInfo(tokenId, msg.value);
        uint256 creatorAmount = msg.value - royaltyAmount;

        if (royaltyAmount > 0) {
            (bool royaltyPaid, ) = payable(royaltyReceiver).call{value: royaltyAmount}("");
            require(royaltyPaid, "Royalty transfer failed");
        }

        (bool creatorPaid, ) = payable(creator).call{value: creatorAmount}("");
        require(creatorPaid, "Creator payment failed");

        emit LazyMinted(tokenId, creator, msg.sender, _tokenURI);
        emit Purchase(tokenId, msg.sender, creator, msg.value, royaltyAmount);

        return tokenId;
    }

    /// @notice 사용 기록 (on-chain) — NFT 소유자만 호출, 사용량 소진 시 자동 burn
    function recordUsage(uint256 tokenId) external {
        require(ownerOf(tokenId) == msg.sender, "Not token owner");
        require(usageCount[tokenId] < usageLimit[tokenId], "Usage limit reached");

        usageCount[tokenId] += 1;
        uint256 remaining = usageLimit[tokenId] - usageCount[tokenId];

        emit UsageRecorded(tokenId, msg.sender, remaining);

        // 사용량 소진 시 자동 burn
        if (remaining == 0) {
            _burnExhausted(tokenId, msg.sender);
        }
    }

    /// @notice 사용량 소진된 NFT를 burn (내부 함수)
    function _burnExhausted(uint256 tokenId, address lastOwner) internal {
        // listing이 있으면 제거
        if (listings[tokenId].active) {
            delete listings[tokenId];
            emit ListingCanceled(tokenId);
        }
        _burn(tokenId);
        emit Burned(tokenId, lastOwner, "Usage exhausted");
    }

    /// @notice 소유자가 직접 burn 가능
    function burn(uint256 tokenId) external {
        require(ownerOf(tokenId) == msg.sender, "Not token owner");
        if (listings[tokenId].active) {
            delete listings[tokenId];
            emit ListingCanceled(tokenId);
        }
        _burn(tokenId);
        emit Burned(tokenId, msg.sender, "Owner burned");
    }

    /// @notice 잔여 사용량 조회 (누구나 호출 가능 — 구매 전 확인용)
    function getRemainingUsage(uint256 tokenId) external view returns (uint256 remaining, uint256 limit, uint256 used) {
        limit = usageLimit[tokenId];
        used = usageCount[tokenId];
        remaining = (limit > used) ? limit - used : 0;
    }

    function listForSale(uint256 tokenId, uint256 price) external {
        require(ownerOf(tokenId) == msg.sender, "Not token owner");
        require(price > 0, "Price must be > 0");

        listings[tokenId] = Listing({seller: msg.sender, price: price, active: true});

        emit Listed(tokenId, msg.sender, price);
    }

    function cancelListing(uint256 tokenId) external {
        Listing memory listing = listings[tokenId];
        require(listing.active, "Not listed");
        require(listing.seller == msg.sender, "Not seller");

        delete listings[tokenId];
        emit ListingCanceled(tokenId);
    }

    function buy(uint256 tokenId) external payable {
        Listing memory listing = listings[tokenId];
        require(listing.active, "Not listed");
        require(msg.value == listing.price, "Wrong ETH amount");
        require(ownerOf(tokenId) == listing.seller, "Seller no longer owner");

        delete listings[tokenId];

        (address royaltyReceiver, uint256 royaltyAmount) = royaltyInfo(tokenId, msg.value);
        uint256 sellerAmount = msg.value - royaltyAmount;

        if (royaltyAmount > 0) {
            (bool royaltyPaid, ) = payable(royaltyReceiver).call{value: royaltyAmount}("");
            require(royaltyPaid, "Royalty transfer failed");
        }

        (bool sellerPaid, ) = payable(listing.seller).call{value: sellerAmount}("");
        require(sellerPaid, "Seller transfer failed");

        _safeTransfer(listing.seller, msg.sender, tokenId, "");

        emit Purchase(tokenId, msg.sender, listing.seller, msg.value, royaltyAmount);
    }

    function hasAccess(address user) external view returns (bool) {
        return balanceOf(user) > 0;
    }

    function setDefaultRoyalty(address receiver, uint96 feeNumerator) external onlyOwner {
        _setDefaultRoyalty(receiver, feeNumerator);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721URIStorage, ERC2981)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}