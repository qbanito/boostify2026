// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title BoostifyMusicTokens
 * @dev ERC-1155 Multi-Token Standard for music tokenization
 * @notice This contract manages all tokenized songs for Boostify platform
 * 
 * Architecture:
 * - ONE contract for ALL songs (gas efficient)
 * - Each song gets a unique Token ID
 * - Fungible tokens within each song ID
 * - Automatic royalty split: 80% artist, 20% platform
 * - Deployed on Polygon for low gas fees (~$0.01 per tx)
 */
contract BoostifyMusicTokens is ERC1155, Ownable, ReentrancyGuard {
    using Counters for Counters.Counter;
    
    // State variables
    Counters.Counter private _tokenIdCounter;
    
    // Platform wallet for 20% commission
    address public platformWallet;
    
    // Token ID => Artist wallet address
    mapping(uint256 => address) public tokenArtist;
    
    // Token ID => Price per token in wei
    mapping(uint256 => uint256) public tokenPrice;
    
    // Token ID => Total supply minted
    mapping(uint256 => uint256) public tokenSupply;
    
    // Token ID => Available supply for sale
    mapping(uint256 => uint256) public tokenAvailableSupply;
    
    // Token ID => Metadata URI
    mapping(uint256 => string) public tokenURI;
    
    // Token ID => Is active for purchase
    mapping(uint256 => bool) public tokenActive;
    
    // Royalty percentages (can be adjusted per token if needed)
    uint256 public artistRoyaltyPercentage = 80; // 80%
    uint256 public platformRoyaltyPercentage = 20; // 20%
    
    // Events
    event SongTokenized(
        uint256 indexed tokenId,
        address indexed artist,
        uint256 totalSupply,
        uint256 pricePerToken,
        string uri
    );
    
    event TokensPurchased(
        uint256 indexed tokenId,
        address indexed buyer,
        uint256 amount,
        uint256 totalPrice,
        uint256 artistEarnings,
        uint256 platformEarnings
    );
    
    event TokenPriceUpdated(uint256 indexed tokenId, uint256 newPrice);
    event TokenStatusToggled(uint256 indexed tokenId, bool isActive);
    
    /**
     * @dev Constructor sets the platform wallet and base URI
     * @param _platformWallet Address that receives platform fees (20%)
     * @param _baseURI IPFS or server base URI for token metadata
     */
    constructor(address _platformWallet, string memory _baseURI) 
        ERC1155(_baseURI) 
    {
        require(_platformWallet != address(0), "Invalid platform wallet");
        platformWallet = _platformWallet;
    }
    
    /**
     * @dev Mint new song tokens (only Boostify admin can call)
     * @param artist Address of the artist who owns this song
     * @param totalSupply Total number of tokens to mint
     * @param pricePerToken Price in wei per token
     * @param metadataURI IPFS or server URI for token metadata
     */
    function mintSongTokens(
        address artist,
        uint256 totalSupply,
        uint256 pricePerToken,
        string memory metadataURI
    ) external onlyOwner returns (uint256) {
        require(artist != address(0), "Invalid artist address");
        require(totalSupply > 0, "Supply must be > 0");
        require(pricePerToken > 0, "Price must be > 0");
        
        _tokenIdCounter.increment();
        uint256 newTokenId = _tokenIdCounter.current();
        
        // Store token metadata
        tokenArtist[newTokenId] = artist;
        tokenPrice[newTokenId] = pricePerToken;
        tokenSupply[newTokenId] = totalSupply;
        tokenAvailableSupply[newTokenId] = totalSupply;
        tokenURI[newTokenId] = metadataURI;
        tokenActive[newTokenId] = true;
        
        // Mint all tokens to contract (held in custody)
        _mint(address(this), newTokenId, totalSupply, "");
        
        emit SongTokenized(newTokenId, artist, totalSupply, pricePerToken, metadataURI);
        
        return newTokenId;
    }
    
    /**
     * @dev Purchase tokens from a song
     * @param tokenId The token ID to purchase
     * @param amount Number of tokens to purchase
     */
    function buyTokens(uint256 tokenId, uint256 amount) 
        external 
        payable 
        nonReentrant 
    {
        require(tokenActive[tokenId], "Token not active for sale");
        require(amount > 0, "Amount must be > 0");
        require(tokenAvailableSupply[tokenId] >= amount, "Insufficient supply");
        
        uint256 totalPrice = tokenPrice[tokenId] * amount;
        require(msg.value >= totalPrice, "Insufficient ETH sent");
        
        // Calculate splits
        uint256 artistEarnings = (totalPrice * artistRoyaltyPercentage) / 100;
        uint256 platformEarnings = (totalPrice * platformRoyaltyPercentage) / 100;
        
        // Transfer tokens to buyer
        _safeTransferFrom(address(this), msg.sender, tokenId, amount, "");
        
        // Update available supply
        tokenAvailableSupply[tokenId] -= amount;
        
        // Transfer earnings
        address artist = tokenArtist[tokenId];
        (bool artistSuccess, ) = payable(artist).call{value: artistEarnings}("");
        require(artistSuccess, "Artist transfer failed");
        
        (bool platformSuccess, ) = payable(platformWallet).call{value: platformEarnings}("");
        require(platformSuccess, "Platform transfer failed");
        
        // Refund excess ETH
        if (msg.value > totalPrice) {
            (bool refundSuccess, ) = payable(msg.sender).call{value: msg.value - totalPrice}("");
            require(refundSuccess, "Refund failed");
        }
        
        emit TokensPurchased(
            tokenId, 
            msg.sender, 
            amount, 
            totalPrice, 
            artistEarnings, 
            platformEarnings
        );
    }
    
    /**
     * @dev Update token price (only owner)
     * @param tokenId The token ID
     * @param newPrice New price in wei
     */
    function updateTokenPrice(uint256 tokenId, uint256 newPrice) 
        external 
        onlyOwner 
    {
        require(newPrice > 0, "Price must be > 0");
        tokenPrice[tokenId] = newPrice;
        emit TokenPriceUpdated(tokenId, newPrice);
    }
    
    /**
     * @dev Toggle token active status (only owner)
     * @param tokenId The token ID
     */
    function toggleTokenStatus(uint256 tokenId) external onlyOwner {
        tokenActive[tokenId] = !tokenActive[tokenId];
        emit TokenStatusToggled(tokenId, tokenActive[tokenId]);
    }
    
    /**
     * @dev Update platform wallet (only owner)
     * @param newPlatformWallet New platform wallet address
     */
    function updatePlatformWallet(address newPlatformWallet) external onlyOwner {
        require(newPlatformWallet != address(0), "Invalid address");
        platformWallet = newPlatformWallet;
    }
    
    /**
     * @dev Get token metadata URI
     * @param tokenId The token ID
     */
    function uri(uint256 tokenId) public view override returns (string memory) {
        return tokenURI[tokenId];
    }
    
    /**
     * @dev Get current token ID counter
     */
    function getCurrentTokenId() external view returns (uint256) {
        return _tokenIdCounter.current();
    }
    
    /**
     * @dev Check how many tokens a user owns
     * @param account User address
     * @param tokenId Token ID
     */
    function balanceOf(address account, uint256 tokenId) 
        public 
        view 
        override 
        returns (uint256) 
    {
        return super.balanceOf(account, tokenId);
    }
    
    /**
     * @dev Emergency withdrawal (only owner)
     * Should never be needed, but safety first
     */
    function emergencyWithdraw() external onlyOwner {
        (bool success, ) = payable(owner()).call{value: address(this).balance}("");
        require(success, "Withdrawal failed");
    }
}
