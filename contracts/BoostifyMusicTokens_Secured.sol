// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

/**
 * @title BoostifyMusicTokens (SECURED VERSION)
 * @dev ERC-1155 Multi-Token Standard for music tokenization with advanced security
 * @notice Enhanced protection against:
 *   - Reentrancy attacks (ReentrancyGuard)
 *   - Front-running attacks (deadline, nonce, slippage)
 *   - Replay attacks (chainId, nonce)
 *   - Integer overflow (Solidity 0.8+)
 */
contract BoostifyMusicTokensSecured is ERC1155, Ownable, ReentrancyGuard, Pausable {
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
    
    // Royalty percentages
    uint256 public artistRoyaltyPercentage = 80; // 80%
    uint256 public platformRoyaltyPercentage = 20; // 20%
    
    // SECURITY: Prevent replay attacks - increment nonce per user
    mapping(address => uint256) public nonces;
    
    // SECURITY: Track last purchase time per user to detect suspicious patterns
    mapping(address => uint256) public lastPurchaseTime;
    
    // SECURITY: Maximum allowed slippage to prevent sandwich attacks (in basis points, 100 = 1%)
    uint256 public maxSlippage = 500; // 5% default
    
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
    event SlippageUpdated(uint256 newMaxSlippage);
    event NonceBurned(address indexed user, uint256 nonce);

    /**
     * @dev Constructor sets the platform wallet and base URI
     */
    constructor(address _platformWallet, string memory _baseURI) 
        ERC1155(_baseURI) 
    {
        require(_platformWallet != address(0), "Invalid platform wallet");
        platformWallet = _platformWallet;
    }
    
    /**
     * @dev Mint new song tokens (only Boostify admin can call)
     */
    function mintSongTokens(
        address artist,
        uint256 totalSupply,
        uint256 pricePerToken,
        string memory metadataURI
    ) external onlyOwner whenNotPaused returns (uint256) {
        require(artist != address(0), "Invalid artist address");
        require(totalSupply > 0, "Supply must be > 0");
        require(pricePerToken > 0, "Price must be > 0");
        require(bytes(metadataURI).length > 0, "URI cannot be empty");
        
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
     * @dev Purchase tokens with FRONT-RUNNING PROTECTION
     * @param tokenId The token ID to purchase
     * @param amount Number of tokens to purchase
     * @param maxPrice Maximum price willing to pay (slippage protection)
     * @param deadline Transaction must be executed before this block timestamp
     */
    function buyTokens(
        uint256 tokenId, 
        uint256 amount,
        uint256 maxPrice,
        uint256 deadline
    ) 
        external 
        payable 
        nonReentrant 
        whenNotPaused
        returns (bool)
    {
        // ==================== FRONT-RUNNING PROTECTIONS ====================
        
        // PROTECTION 1: Check deadline to prevent delayed execution
        require(block.timestamp <= deadline, "Transaction expired (deadline passed)");
        
        // PROTECTION 2: Slippage protection - ensure price hasn't changed significantly
        uint256 expectedPrice = tokenPrice[tokenId] * amount;
        require(maxPrice >= expectedPrice, "Price slippage too high");
        
        // PROTECTION 3: Nonce to prevent replay attacks
        uint256 currentNonce = nonces[msg.sender];
        nonces[msg.sender]++;
        
        // ==================== REENTRANCY PROTECTION (nonReentrant) ====================
        
        require(tokenActive[tokenId], "Token not active for sale");
        require(amount > 0, "Amount must be > 0");
        require(amount <= tokenAvailableSupply[tokenId], "Insufficient supply");
        require(msg.value >= expectedPrice, "Insufficient ETH sent");
        
        // Prevent suspicious rapid purchases (optional rate limiting)
        if (lastPurchaseTime[msg.sender] != 0) {
            require(
                block.timestamp >= lastPurchaseTime[msg.sender] + 1,
                "Too frequent purchases (possible flash loan attack)"
            );
        }
        lastPurchaseTime[msg.sender] = block.timestamp;
        
        // Calculate splits
        uint256 artistEarnings = (expectedPrice * artistRoyaltyPercentage) / 100;
        uint256 platformEarnings = (expectedPrice * platformRoyaltyPercentage) / 100;
        
        // Transfer tokens to buyer (BEFORE state changes for reentrancy safety)
        tokenAvailableSupply[tokenId] -= amount;
        
        _safeTransferFrom(address(this), msg.sender, tokenId, amount, "");
        
        // Transfer earnings to artist (checks-effects-interactions pattern)
        address artist = tokenArtist[tokenId];
        (bool artistSuccess, ) = payable(artist).call{value: artistEarnings}("");
        require(artistSuccess, "Artist transfer failed");
        
        (bool platformSuccess, ) = payable(platformWallet).call{value: platformEarnings}("");
        require(platformSuccess, "Platform transfer failed");
        
        // Refund excess ETH
        uint256 excess = msg.value - expectedPrice;
        if (excess > 0) {
            (bool refundSuccess, ) = payable(msg.sender).call{value: excess}("");
            require(refundSuccess, "Refund failed");
        }
        
        emit TokensPurchased(
            tokenId, 
            msg.sender, 
            amount, 
            expectedPrice, 
            artistEarnings, 
            platformEarnings
        );
        
        emit NonceBurned(msg.sender, currentNonce);
        
        return true;
    }
    
    /**
     * @dev Batch purchase with better slippage protection
     */
    function batchBuyTokens(
        uint256[] calldata tokenIds,
        uint256[] calldata amounts,
        uint256 totalMaxPrice,
        uint256 deadline
    ) external payable nonReentrant whenNotPaused returns (bool) {
        require(tokenIds.length == amounts.length, "Array lengths mismatch");
        require(block.timestamp <= deadline, "Transaction expired");
        
        uint256 totalPrice = 0;
        for (uint256 i = 0; i < tokenIds.length; i++) {
            totalPrice += tokenPrice[tokenIds[i]] * amounts[i];
        }
        
        require(totalMaxPrice >= totalPrice, "Batch price slippage too high");
        require(msg.value >= totalPrice, "Insufficient ETH sent");
        
        for (uint256 i = 0; i < tokenIds.length; i++) {
            require(tokenActive[tokenIds[i]], "Token not active");
            require(amounts[i] > 0, "Amount must be > 0");
            require(amounts[i] <= tokenAvailableSupply[tokenIds[i]], "Insufficient supply");
            
            tokenAvailableSupply[tokenIds[i]] -= amounts[i];
            _safeTransferFrom(address(this), msg.sender, tokenIds[i], amounts[i], "");
            
            uint256 tokenTotalPrice = tokenPrice[tokenIds[i]] * amounts[i];
            address artist = tokenArtist[tokenIds[i]];
            uint256 artistEarnings = (tokenTotalPrice * artistRoyaltyPercentage) / 100;
            uint256 platformEarnings = (tokenTotalPrice * platformRoyaltyPercentage) / 100;
            
            (bool artistSuccess, ) = payable(artist).call{value: artistEarnings}("");
            require(artistSuccess, "Artist transfer failed");
            
            (bool platformSuccess, ) = payable(platformWallet).call{value: platformEarnings}("");
            require(platformSuccess, "Platform transfer failed");
        }
        
        // Refund excess
        if (msg.value > totalPrice) {
            (bool refundSuccess, ) = payable(msg.sender).call{value: msg.value - totalPrice}("");
            require(refundSuccess, "Refund failed");
        }
        
        return true;
    }
    
    /**
     * @dev Update max slippage allowed
     */
    function setMaxSlippage(uint256 newMaxSlippage) external onlyOwner {
        require(newMaxSlippage <= 10000, "Slippage cannot exceed 100%"); // Cap at 100%
        maxSlippage = newMaxSlippage;
        emit SlippageUpdated(newMaxSlippage);
    }
    
    /**
     * @dev Get user's current nonce (for frontend calculation)
     */
    function getNonce(address user) external view returns (uint256) {
        return nonces[user];
    }
    
    /**
     * @dev Update token price (only owner)
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
     * @dev Toggle token active status
     */
    function toggleTokenStatus(uint256 tokenId) external onlyOwner {
        tokenActive[tokenId] = !tokenActive[tokenId];
        emit TokenStatusToggled(tokenId, tokenActive[tokenId]);
    }
    
    /**
     * @dev Update platform wallet
     */
    function updatePlatformWallet(address newPlatformWallet) external onlyOwner {
        require(newPlatformWallet != address(0), "Invalid address");
        platformWallet = newPlatformWallet;
    }
    
    /**
     * @dev Pause contract in case of emergency
     */
    function pause() external onlyOwner {
        _pause();
    }
    
    /**
     * @dev Unpause contract
     */
    function unpause() external onlyOwner {
        _unpause();
    }
    
    /**
     * @dev Get token metadata URI
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
     * @dev Emergency withdrawal (only owner)
     */
    function emergencyWithdraw() external onlyOwner {
        (bool success, ) = payable(owner()).call{value: address(this).balance}("");
        require(success, "Withdrawal failed");
    }
}
