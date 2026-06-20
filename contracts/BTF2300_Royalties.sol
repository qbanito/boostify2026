// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

interface IBTF2300ArtistToken {
    function songs(uint256 tokenId) external view returns (
        uint256 _tokenId,
        uint256 artistId,
        string memory title,
        string memory metadataURI,
        uint256 totalSupply,
        uint256 availableSupply,
        uint256 pricePerToken,
        bool isActive,
        uint256 totalEarnings,
        uint256 createdAt
    );
    
    function artists(uint256 artistId) external view returns (
        uint256 _artistId,
        address walletAddress,
        string memory artistName,
        string memory profileURI,
        uint256 totalEarnings,
        uint256 totalSongs,
        bool isVerified,
        bool isActive,
        uint256 registeredAt
    );
    
    function balanceOf(address account, uint256 id) external view returns (uint256);
}

/**
 * @title BTF-2300 Royalty Distributor
 * @author Boostify Music
 * @notice Automated royalty distribution for streaming and sales
 * @dev Features:
 *   - Streaming royalty calculation and distribution
 *   - Holder-proportional earnings
 *   - Batch distribution support
 *   - Claimable royalty model
 */
contract BTF2300Royalties is AccessControl, ReentrancyGuard, Pausable {
    
    // ==================== CONSTANTS ====================
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant DISTRIBUTOR_ROLE = keccak256("DISTRIBUTOR_ROLE");
    
    uint256 public constant ARTIST_SHARE_BPS = 8000; // 80%
    uint256 public constant HOLDER_SHARE_BPS = 1500; // 15%
    uint256 public constant PLATFORM_SHARE_BPS = 500; // 5%
    uint256 public constant BPS_DENOMINATOR = 10000;

    // ==================== STATE VARIABLES ====================
    
    IBTF2300ArtistToken public btfToken;
    address public platformWallet;
    
    // Royalty pools per song token
    struct RoyaltyPool {
        uint256 tokenId;
        uint256 totalRoyaltiesReceived;
        uint256 artistClaimed;
        uint256 holdersClaimed;
        uint256 platformClaimed;
        uint256 lastDistributionTime;
    }
    
    // Holder claim tracking
    struct HolderClaim {
        uint256 lastClaimRound;
        uint256 totalClaimed;
    }
    
    // Distribution round
    struct DistributionRound {
        uint256 roundId;
        uint256 tokenId;
        uint256 totalAmount;
        uint256 holderShareAmount;
        uint256 totalTokensAtRound;
        uint256 timestamp;
    }
    
    // Mappings
    mapping(uint256 => RoyaltyPool) public royaltyPools; // tokenId => pool
    mapping(uint256 => mapping(address => HolderClaim)) public holderClaims; // tokenId => holder => claim
    mapping(uint256 => DistributionRound[]) public distributionRounds; // tokenId => rounds[]
    mapping(uint256 => uint256) public currentRound; // tokenId => current round number
    
    // Streaming data (per 1000 streams pricing)
    mapping(uint256 => uint256) public streamCounts; // tokenId => total streams
    uint256 public pricePerThousandStreams = 0.004 ether; // ~$4 per 1000 streams

    // ==================== EVENTS ====================
    
    event RoyaltyReceived(uint256 indexed tokenId, uint256 amount, string source);
    event RoyaltyDistributed(uint256 indexed tokenId, uint256 roundId, uint256 artistAmount, uint256 holderAmount, uint256 platformAmount);
    event RoyaltyClaimed(uint256 indexed tokenId, address indexed holder, uint256 amount);
    event StreamsRecorded(uint256 indexed tokenId, uint256 streamCount, uint256 royaltyAmount);
    event ArtistRoyaltyClaimed(uint256 indexed tokenId, address indexed artist, uint256 amount);

    // ==================== CONSTRUCTOR ====================
    
    constructor(address _btfToken, address _platformWallet) {
        require(_btfToken != address(0), "Invalid token address");
        require(_platformWallet != address(0), "Invalid platform wallet");
        
        btfToken = IBTF2300ArtistToken(_btfToken);
        platformWallet = _platformWallet;
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(DISTRIBUTOR_ROLE, msg.sender);
    }

    // ==================== ROYALTY DEPOSIT ====================
    
    /**
     * @notice Deposit royalties for a song token
     * @param tokenId Song token ID
     * @param source Description of royalty source (e.g., "Spotify", "Sales", "Sync License")
     */
    function depositRoyalty(uint256 tokenId, string calldata source)
        external
        payable
        nonReentrant
        whenNotPaused
    {
        require(msg.value > 0, "No royalty sent");
        
        // Verify song exists
        (uint256 _tokenId,,,,,,,,, ) = btfToken.songs(tokenId);
        require(_tokenId != 0, "Song not found");
        
        RoyaltyPool storage pool = royaltyPools[tokenId];
        if (pool.tokenId == 0) {
            pool.tokenId = tokenId;
        }
        
        pool.totalRoyaltiesReceived += msg.value;
        
        emit RoyaltyReceived(tokenId, msg.value, source);
    }
    
    /**
     * @notice Record streaming royalties (called by backend oracle)
     * @param tokenId Song token ID
     * @param newStreams Number of new streams to record
     */
    function recordStreams(uint256 tokenId, uint256 newStreams)
        external
        onlyRole(DISTRIBUTOR_ROLE)
        whenNotPaused
    {
        require(newStreams > 0, "Invalid stream count");
        
        streamCounts[tokenId] += newStreams;
        
        // Calculate royalty based on streams
        uint256 royaltyAmount = (newStreams * pricePerThousandStreams) / 1000;
        
        if (royaltyAmount > 0) {
            RoyaltyPool storage pool = royaltyPools[tokenId];
            if (pool.tokenId == 0) {
                pool.tokenId = tokenId;
            }
            pool.totalRoyaltiesReceived += royaltyAmount;
        }
        
        emit StreamsRecorded(tokenId, newStreams, royaltyAmount);
    }

    // ==================== DISTRIBUTION ====================
    
    /**
     * @notice Distribute royalties for a song (creates new round)
     * @param tokenId Song token ID
     */
    function distributeRoyalties(uint256 tokenId)
        external
        onlyRole(DISTRIBUTOR_ROLE)
        nonReentrant
        whenNotPaused
    {
        RoyaltyPool storage pool = royaltyPools[tokenId];
        require(pool.tokenId != 0, "No royalty pool");
        
        uint256 undistributed = pool.totalRoyaltiesReceived - pool.artistClaimed - pool.holdersClaimed - pool.platformClaimed;
        require(undistributed > 0, "No royalties to distribute");
        
        // Calculate shares
        uint256 artistAmount = (undistributed * ARTIST_SHARE_BPS) / BPS_DENOMINATOR;
        uint256 holderAmount = (undistributed * HOLDER_SHARE_BPS) / BPS_DENOMINATOR;
        uint256 platformAmount = undistributed - artistAmount - holderAmount;
        
        // Get song info
        (, uint256 artistId,,,uint256 totalSupply,,,,,) = btfToken.songs(tokenId);
        (, address artistWallet,,,,,,,) = btfToken.artists(artistId);
        
        // Create distribution round for holders
        currentRound[tokenId]++;
        distributionRounds[tokenId].push(DistributionRound({
            roundId: currentRound[tokenId],
            tokenId: tokenId,
            totalAmount: undistributed,
            holderShareAmount: holderAmount,
            totalTokensAtRound: totalSupply,
            timestamp: block.timestamp
        }));
        
        pool.lastDistributionTime = block.timestamp;
        
        // Transfer artist share immediately
        pool.artistClaimed += artistAmount;
        (bool artistSuccess,) = payable(artistWallet).call{value: artistAmount}("");
        require(artistSuccess, "Artist transfer failed");
        
        // Transfer platform share
        pool.platformClaimed += platformAmount;
        (bool platformSuccess,) = payable(platformWallet).call{value: platformAmount}("");
        require(platformSuccess, "Platform transfer failed");
        
        // Holder share stays in contract for claiming
        
        emit RoyaltyDistributed(tokenId, currentRound[tokenId], artistAmount, holderAmount, platformAmount);
    }
    
    /**
     * @notice Claim holder royalties
     * @param tokenId Song token ID
     */
    function claimHolderRoyalties(uint256 tokenId)
        external
        nonReentrant
        whenNotPaused
    {
        uint256 holderBalance = btfToken.balanceOf(msg.sender, tokenId);
        require(holderBalance > 0, "Not a token holder");
        
        HolderClaim storage claim = holderClaims[tokenId][msg.sender];
        uint256 lastClaimed = claim.lastClaimRound;
        uint256 current = currentRound[tokenId];
        
        require(current > lastClaimed, "Nothing to claim");
        
        uint256 totalClaimable = 0;
        
        // Calculate claimable from each round since last claim
        DistributionRound[] storage rounds = distributionRounds[tokenId];
        for (uint256 i = lastClaimed; i < current; i++) {
            DistributionRound storage round = rounds[i];
            
            // Proportional share based on holdings
            uint256 roundShare = (round.holderShareAmount * holderBalance) / round.totalTokensAtRound;
            totalClaimable += roundShare;
        }
        
        require(totalClaimable > 0, "No claimable amount");
        
        // Update claim tracking
        claim.lastClaimRound = current;
        claim.totalClaimed += totalClaimable;
        
        RoyaltyPool storage pool = royaltyPools[tokenId];
        pool.holdersClaimed += totalClaimable;
        
        // Transfer
        (bool success,) = payable(msg.sender).call{value: totalClaimable}("");
        require(success, "Transfer failed");
        
        emit RoyaltyClaimed(tokenId, msg.sender, totalClaimable);
    }

    // ==================== VIEW FUNCTIONS ====================
    
    function getClaimableAmount(uint256 tokenId, address holder)
        external
        view
        returns (uint256)
    {
        uint256 holderBalance = btfToken.balanceOf(holder, tokenId);
        if (holderBalance == 0) return 0;
        
        HolderClaim storage claim = holderClaims[tokenId][holder];
        uint256 lastClaimed = claim.lastClaimRound;
        uint256 current = currentRound[tokenId];
        
        if (current <= lastClaimed) return 0;
        
        uint256 totalClaimable = 0;
        DistributionRound[] storage rounds = distributionRounds[tokenId];
        
        for (uint256 i = lastClaimed; i < current; i++) {
            DistributionRound storage round = rounds[i];
            uint256 roundShare = (round.holderShareAmount * holderBalance) / round.totalTokensAtRound;
            totalClaimable += roundShare;
        }
        
        return totalClaimable;
    }
    
    function getRoyaltyPoolInfo(uint256 tokenId)
        external
        view
        returns (
            uint256 totalReceived,
            uint256 artistClaimed,
            uint256 holdersClaimed,
            uint256 platformClaimed,
            uint256 undistributed
        )
    {
        RoyaltyPool storage pool = royaltyPools[tokenId];
        totalReceived = pool.totalRoyaltiesReceived;
        artistClaimed = pool.artistClaimed;
        holdersClaimed = pool.holdersClaimed;
        platformClaimed = pool.platformClaimed;
        undistributed = totalReceived - artistClaimed - holdersClaimed - platformClaimed;
    }
    
    function getDistributionRound(uint256 tokenId, uint256 roundId)
        external
        view
        returns (
            uint256 totalAmount,
            uint256 holderShareAmount,
            uint256 totalTokensAtRound,
            uint256 timestamp
        )
    {
        require(roundId > 0 && roundId <= currentRound[tokenId], "Invalid round");
        DistributionRound storage round = distributionRounds[tokenId][roundId - 1];
        return (round.totalAmount, round.holderShareAmount, round.totalTokensAtRound, round.timestamp);
    }
    
    function getTotalRounds(uint256 tokenId) external view returns (uint256) {
        return currentRound[tokenId];
    }
    
    function getStreamCount(uint256 tokenId) external view returns (uint256) {
        return streamCounts[tokenId];
    }

    // ==================== ADMIN FUNCTIONS ====================
    
    function setStreamingPrice(uint256 newPrice) external onlyRole(ADMIN_ROLE) {
        pricePerThousandStreams = newPrice;
    }
    
    function setPlatformWallet(address newWallet) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newWallet != address(0), "Invalid address");
        platformWallet = newWallet;
    }
    
    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }
    
    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }
    
    /**
     * @notice Emergency withdraw (admin only)
     */
    function emergencyWithdraw() external onlyRole(DEFAULT_ADMIN_ROLE) {
        uint256 balance = address(this).balance;
        (bool success,) = payable(msg.sender).call{value: balance}("");
        require(success, "Withdraw failed");
    }
    
    receive() external payable {}
}
