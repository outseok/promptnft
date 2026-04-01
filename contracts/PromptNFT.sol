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

    constructor(address royaltyReceiver)
        ERC721("PromptNFT", "PRMPT")
        Ownable()
    {
        require(royaltyReceiver != address(0), "Invalid royalty receiver");
        _transferOwnership(msg.sender);
        _setDefaultRoyalty(royaltyReceiver, ROYALTY_BPS);
    }

    /// @notice 누구나 NFT 민팅 가능 (msg.sender에게 발행)
    function mint(string calldata tokenURI) external returns (uint256) {
        uint256 tokenId = nextTokenId;
        nextTokenId += 1;

        _safeMint(msg.sender, tokenId);
        _setTokenURI(tokenId, tokenURI);

        emit Minted(tokenId, msg.sender, tokenURI);
        return tokenId;
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
