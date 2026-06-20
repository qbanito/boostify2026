// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

/**
 * @title BTF-2300 Artist Token Standard
 * @author Boostify Music
 * @notice Complete tokenization system for music artists on Polygon
 * @dev Implements ERC-1155 multi-token standard with:
 *   - Artist identity tokens (unique per artist)
 *   - Song/catalog tokens (fractional ownership)
 *   - Automated royalty distribution (80% artist / 20% platform)
 *   - On-chain licensing and IP management
 *   - Anti-front-running protection
 *   - Reentrancy guards
 */
contract BTF2300ArtistToken is ERC1155, AccessControl, ReentrancyGuard, Pausable {
    using Counters for Counters.Counter;
    using Strings for uint256;

    // ==================== CONSTANTS ====================
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant ARTIST_ROLE = keccak256("ARTIST_ROLE");
    
    uint256 public constant ARTIST_ROYALTY_BPS = 8000; // 80%
    uint256 public constant PLATFORM_ROYALTY_BPS = 2000; // 20%
    uint256 public constant BPS_DENOMINATOR = 10000;
    
    // Token type prefixes for ID generation
    uint256 public constant ARTIST_TOKEN_PREFIX = 1_000_000_000;
    uint256 public constant SONG_TOKEN_PREFIX = 2_000_000_000;
    uint256 public constant CATALOG_TOKEN_PREFIX = 3_000_000_000;
    uint256 public constant LICENSE_TOKEN_PREFIX = 4_000_000_000;

    // ==================== STATE VARIABLES ====================
    Counters.Counter private _artistIdCounter;
    Counters.Counter private _songIdCounter;
    Counters.Counter private _catalogIdCounter;
    Counters.Counter private _licenseIdCounter;

    address public platformWallet;
    string public baseMetadataURI;
    string public contractName = "BTF-2300 Artist Token";
    string public contractSymbol = "BTF2300";

    // ==================== STRUCTS ====================
    
    struct ArtistProfile {
        uint256 artistId;
        address walletAddress;
        string artistName;
        string profileURI; // IPFS URI for extended metadata
        uint256 totalEarnings;
        uint256 totalSongs;
        bool isVerified;
        bool isActive;
        uint256 registeredAt;
    }
    
    struct SongToken {
        uint256 tokenId;
        uint256 artistId;
        string title;
        string metadataURI;
        uint256 totalSupply;
        uint256 availableSupply;
        uint256 pricePerToken; // in wei
        bool isActive;
        uint256 totalEarnings;
        uint256 createdAt;
    }
    
    struct CatalogToken {
        uint256 tokenId;
        uint256 artistId;
        string catalogName;
        uint256[] songTokenIds;
        uint256 pricePerToken;
        uint256 totalSupply;
        uint256 availableSupply;
        bool isActive;
        uint256 createdAt;
    }
    
    struct LicenseToken {
        uint256 tokenId;
        uint256 songTokenId;
        address licensee;
        string licenseType; // "sync", "mechanical", "performance", "master"
        uint256 priceNegotiated;
        uint256 expiresAt;
        bool isExclusive;
        bool isActive;
        uint256 createdAt;
    }

    // ==================== MAPPINGS ====================
    
    // Artist mappings
    mapping(uint256 => ArtistProfile) public artists;
    mapping(address => uint256) public artistIdByWallet;
    mapping(uint256 => uint256) public artistIdentityToken; // artistId => tokenId
    
    // Song mappings
    mapping(uint256 => SongToken) public songs;
    mapping(uint256 => uint256[]) public artistSongs; // artistId => songTokenIds[]
    
    // Catalog mappings
    mapping(uint256 => CatalogToken) public catalogs;
    mapping(uint256 => uint256[]) public artistCatalogs; // artistId => catalogTokenIds[]
    
    // License mappings
    mapping(uint256 => LicenseToken) public licenses;
    mapping(uint256 => uint256[]) public songLicenses; // songTokenId => licenseTokenIds[]
    
    // Security mappings
    mapping(address => uint256) public nonces;
    mapping(address => uint256) public lastPurchaseBlock;

    // ==================== EVENTS ====================
    
    event ArtistRegistered(
        uint256 indexed artistId,
        address indexed wallet,
        string artistName,
        uint256 identityTokenId
    );
    
    event SongTokenized(
        uint256 indexed tokenId,
        uint256 indexed artistId,
        string title,
        uint256 totalSupply,
        uint256 pricePerToken
    );
    
    event TokensPurchased(
        uint256 indexed tokenId,
        address indexed buyer,
        uint256 amount,
        uint256 totalPaid,
        uint256 artistEarnings,
        uint256 platformEarnings
    );
    
    event LicenseCreated(
        uint256 indexed licenseTokenId,
        uint256 indexed songTokenId,
        address indexed licensee,
        string licenseType,
        uint256 price
    );
    
    event RoyaltyDistributed(
        uint256 indexed tokenId,
        address indexed artist,
        uint256 artistAmount,
        uint256 platformAmount
    );
    
    event CatalogCreated(
        uint256 indexed catalogId,
        uint256 indexed artistId,
        string catalogName,
        uint256 songCount
    );
    
    event ArtistVerified(uint256 indexed artistId, bool verified);
    event ArtistProfileUpdated(uint256 indexed artistId, string artistName, string profileURI);
    event TokenPriceUpdated(uint256 indexed tokenId, uint256 oldPrice, uint256 newPrice);

    // ==================== CONSTRUCTOR ====================
    
    constructor(
        address _platformWallet,
        string memory _baseMetadataURI
    ) ERC1155(_baseMetadataURI) {
        require(_platformWallet != address(0), "Invalid platform wallet");
        
        platformWallet = _platformWallet;
        baseMetadataURI = _baseMetadataURI;
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
    }

    // ==================== ARTIST REGISTRATION ====================
    
    /**
     * @notice Register a new artist and mint their identity token
     * @param wallet Artist's wallet address
     * @param artistName Display name for the artist
     * @param profileURI IPFS URI containing extended metadata
     */
    function registerArtist(
        address wallet,
        string calldata artistName,
        string calldata profileURI
    ) 
        external 
        onlyRole(MINTER_ROLE)
        whenNotPaused
        returns (uint256 artistId, uint256 identityTokenId) 
    {
        require(wallet != address(0), "Invalid wallet address");
        require(artistIdByWallet[wallet] == 0, "Artist already registered");
        require(bytes(artistName).length > 0, "Name cannot be empty");
        
        _artistIdCounter.increment();
        artistId = _artistIdCounter.current();
        
        // Generate unique identity token ID
        identityTokenId = ARTIST_TOKEN_PREFIX + artistId;
        
        artists[artistId] = ArtistProfile({
            artistId: artistId,
            walletAddress: wallet,
            artistName: artistName,
            profileURI: profileURI,
            totalEarnings: 0,
            totalSongs: 0,
            isVerified: false,
            isActive: true,
            registeredAt: block.timestamp
        });
        
        artistIdByWallet[wallet] = artistId;
        artistIdentityToken[artistId] = identityTokenId;
        
        // Mint 1 unique identity token to artist
        _mint(wallet, identityTokenId, 1, "");
        
        // Grant ARTIST_ROLE
        _grantRole(ARTIST_ROLE, wallet);
        
        emit ArtistRegistered(artistId, wallet, artistName, identityTokenId);
        
        return (artistId, identityTokenId);
    }
    
    /**
     * @notice Update artist profile (name and/or profileURI)
     * @param artistId The artist's ID
     * @param newName New artist name (empty to keep current)
     * @param newProfileURI New profile URI (empty to keep current)
     */
    function updateArtistProfile(
        uint256 artistId,
        string calldata newName,
        string calldata newProfileURI
    ) 
        external 
    {
        ArtistProfile storage artist = artists[artistId];
        require(artist.walletAddress != address(0), "Artist not found");
        require(
            msg.sender == artist.walletAddress || hasRole(ADMIN_ROLE, msg.sender),
            "Not authorized"
        );
        
        if (bytes(newName).length > 0) {
            artist.artistName = newName;
        }
        if (bytes(newProfileURI).length > 0) {
            artist.profileURI = newProfileURI;
        }
        
        emit ArtistProfileUpdated(artistId, artist.artistName, artist.profileURI);
    }
    
    /**
     * @notice Verify an artist (admin only)
     */
    function verifyArtist(uint256 artistId, bool verified) 
        external 
        onlyRole(ADMIN_ROLE) 
    {
        require(artists[artistId].walletAddress != address(0), "Artist not found");
        artists[artistId].isVerified = verified;
        emit ArtistVerified(artistId, verified);
    }

    // ==================== SONG TOKENIZATION ====================
    
    /**
     * @notice Tokenize a song - create fractional ownership tokens
     * @param artistId The artist's ID
     * @param title Song title
     * @param metadataURI IPFS URI for song metadata
     * @param totalSupply Total tokens to create
     * @param pricePerToken Price per token in wei
     */
    function tokenizeSong(
        uint256 artistId,
        string calldata title,
        string calldata metadataURI,
        uint256 totalSupply,
        uint256 pricePerToken
    )
        external
        onlyRole(MINTER_ROLE)
        whenNotPaused
        returns (uint256 tokenId)
    {
        require(artists[artistId].walletAddress != address(0), "Artist not found");
        require(artists[artistId].isActive, "Artist not active");
        require(totalSupply > 0, "Supply must be > 0");
        require(pricePerToken > 0, "Price must be > 0");
        require(bytes(title).length > 0, "Title cannot be empty");
        
        _songIdCounter.increment();
        tokenId = SONG_TOKEN_PREFIX + _songIdCounter.current();
        
        songs[tokenId] = SongToken({
            tokenId: tokenId,
            artistId: artistId,
            title: title,
            metadataURI: metadataURI,
            totalSupply: totalSupply,
            availableSupply: totalSupply,
            pricePerToken: pricePerToken,
            isActive: true,
            totalEarnings: 0,
            createdAt: block.timestamp
        });
        
        artistSongs[artistId].push(tokenId);
        artists[artistId].totalSongs++;
        
        // Mint all tokens to contract (custody model)
        _mint(address(this), tokenId, totalSupply, "");
        
        emit SongTokenized(tokenId, artistId, title, totalSupply, pricePerToken);
        
        return tokenId;
    }

    // ==================== TOKEN PURCHASE ====================
    
    /**
     * @notice Purchase song tokens with front-running protection
     * @param tokenId Song token ID
     * @param amount Number of tokens to buy
     * @param maxPricePerToken Maximum price willing to pay (slippage protection)
     * @param deadline Transaction must complete before this timestamp
     */
    function buyTokens(
        uint256 tokenId,
        uint256 amount,
        uint256 maxPricePerToken,
        uint256 deadline
    )
        external
        payable
        nonReentrant
        whenNotPaused
        returns (bool)
    {
        // Front-running protections
        require(block.timestamp <= deadline, "Transaction expired");
        require(block.number > lastPurchaseBlock[msg.sender], "Wait 1 block between purchases");
        
        SongToken storage song = songs[tokenId];
        require(song.tokenId != 0, "Song not found");
        require(song.isActive, "Song not active for sale");
        require(amount > 0 && amount <= song.availableSupply, "Invalid amount");
        require(song.pricePerToken <= maxPricePerToken, "Price exceeded max");
        
        uint256 totalPrice = song.pricePerToken * amount;
        require(msg.value >= totalPrice, "Insufficient ETH");
        
        // Update nonce for replay protection
        nonces[msg.sender]++;
        lastPurchaseBlock[msg.sender] = block.number;
        
        // Update state BEFORE transfers
        song.availableSupply -= amount;
        
        // Calculate splits
        uint256 artistEarnings = (totalPrice * ARTIST_ROYALTY_BPS) / BPS_DENOMINATOR;
        
        // Update artist earnings
        uint256 artistId = song.artistId;
        artists[artistId].totalEarnings += artistEarnings;
        song.totalEarnings += artistEarnings;
        
        // Transfer tokens to buyer
        _safeTransferFrom(address(this), msg.sender, tokenId, amount, "");
        
        // Distribute payment using helper
        _distributeTokenPayment(artistId, totalPrice, artistEarnings);
        
        emit TokensPurchased(tokenId, msg.sender, amount, totalPrice, artistEarnings, totalPrice - artistEarnings);
        
        return true;
    }
    
    /**
     * @dev Internal helper to distribute token payment (avoids stack too deep)
     */
    function _distributeTokenPayment(
        uint256 artistId, 
        uint256 totalPrice, 
        uint256 artistEarnings
    ) internal {
        uint256 platformEarnings = totalPrice - artistEarnings;
        
        // Transfer ETH to artist
        address artistWallet = artists[artistId].walletAddress;
        (bool artistSuccess,) = payable(artistWallet).call{value: artistEarnings}("");
        require(artistSuccess, "Artist payment failed");
        
        // Transfer ETH to platform
        (bool platformSuccess,) = payable(platformWallet).call{value: platformEarnings}("");
        require(platformSuccess, "Platform payment failed");
        
        // Refund excess
        uint256 excess = msg.value - totalPrice;
        if (excess > 0) {
            (bool refundSuccess,) = payable(msg.sender).call{value: excess}("");
            require(refundSuccess, "Refund failed");
        }
        
        emit RoyaltyDistributed(0, artistWallet, artistEarnings, platformEarnings);
    }

    // ==================== CATALOG MANAGEMENT ====================
    
    /**
     * @notice Create a catalog token bundling multiple songs
     */
    function createCatalog(
        uint256 artistId,
        string calldata catalogName,
        uint256[] calldata songTokenIds,
        uint256 totalSupply,
        uint256 pricePerToken
    )
        external
        onlyRole(MINTER_ROLE)
        whenNotPaused
        returns (uint256 catalogTokenId)
    {
        require(artists[artistId].isActive, "Artist not active");
        require(songTokenIds.length > 0, "Must include songs");
        
        // Verify all songs belong to artist
        for (uint256 i = 0; i < songTokenIds.length; i++) {
            require(songs[songTokenIds[i]].artistId == artistId, "Song not owned by artist");
        }
        
        _catalogIdCounter.increment();
        catalogTokenId = CATALOG_TOKEN_PREFIX + _catalogIdCounter.current();
        
        catalogs[catalogTokenId] = CatalogToken({
            tokenId: catalogTokenId,
            artistId: artistId,
            catalogName: catalogName,
            songTokenIds: songTokenIds,
            pricePerToken: pricePerToken,
            totalSupply: totalSupply,
            availableSupply: totalSupply,
            isActive: true,
            createdAt: block.timestamp
        });
        
        artistCatalogs[artistId].push(catalogTokenId);
        
        _mint(address(this), catalogTokenId, totalSupply, "");
        
        emit CatalogCreated(catalogTokenId, artistId, catalogName, songTokenIds.length);
        
        return catalogTokenId;
    }

    // ==================== LICENSING ====================
    
    /**
     * @notice Create a license token for a song
     */
    function createLicense(
        uint256 songTokenId,
        address licensee,
        string calldata licenseType,
        uint256 priceNegotiated,
        uint256 duration,
        bool isExclusive
    )
        external
        payable
        nonReentrant
        whenNotPaused
        returns (uint256 licenseTokenId)
    {
        require(songs[songTokenId].tokenId != 0, "Song not found");
        require(msg.value >= priceNegotiated, "Insufficient payment");
        
        _licenseIdCounter.increment();
        licenseTokenId = LICENSE_TOKEN_PREFIX + _licenseIdCounter.current();
        
        licenses[licenseTokenId] = LicenseToken({
            tokenId: licenseTokenId,
            songTokenId: songTokenId,
            licensee: licensee,
            licenseType: licenseType,
            priceNegotiated: priceNegotiated,
            expiresAt: block.timestamp + duration,
            isExclusive: isExclusive,
            isActive: true,
            createdAt: block.timestamp
        });
        
        songLicenses[songTokenId].push(licenseTokenId);
        
        // Mint license NFT to licensee
        _mint(licensee, licenseTokenId, 1, "");
        
        // Distribute payment using helper
        _distributeLicensePayment(songTokenId, priceNegotiated);
        
        emit LicenseCreated(licenseTokenId, songTokenId, licensee, licenseType, priceNegotiated);
        
        return licenseTokenId;
    }
    
    /**
     * @dev Internal helper to distribute license payment (avoids stack too deep)
     */
    function _distributeLicensePayment(uint256 songTokenId, uint256 priceNegotiated) internal {
        uint256 artistId = songs[songTokenId].artistId;
        uint256 artistEarnings = (priceNegotiated * ARTIST_ROYALTY_BPS) / BPS_DENOMINATOR;
        uint256 platformEarnings = priceNegotiated - artistEarnings;
        
        artists[artistId].totalEarnings += artistEarnings;
        
        address artistWallet = artists[artistId].walletAddress;
        (bool artistSuccess,) = payable(artistWallet).call{value: artistEarnings}("");
        require(artistSuccess, "Artist payment failed");
        
        (bool platformSuccess,) = payable(platformWallet).call{value: platformEarnings}("");
        require(platformSuccess, "Platform payment failed");
        
        // Refund excess
        if (msg.value > priceNegotiated) {
            (bool refundSuccess,) = payable(msg.sender).call{value: msg.value - priceNegotiated}("");
            require(refundSuccess, "Refund failed");
        }
    }
    
    /**
     * @notice Check if a license is valid
     */
    function isLicenseValid(uint256 licenseTokenId) public view returns (bool) {
        LicenseToken storage license = licenses[licenseTokenId];
        return license.isActive && block.timestamp < license.expiresAt;
    }

    // ==================== ADMIN FUNCTIONS ====================
    
    function updateTokenPrice(uint256 tokenId, uint256 newPrice) 
        external 
        onlyRole(ADMIN_ROLE) 
    {
        require(newPrice > 0, "Price must be > 0");
        
        if (songs[tokenId].tokenId != 0) {
            uint256 oldPrice = songs[tokenId].pricePerToken;
            songs[tokenId].pricePerToken = newPrice;
            emit TokenPriceUpdated(tokenId, oldPrice, newPrice);
        } else if (catalogs[tokenId].tokenId != 0) {
            uint256 oldPrice = catalogs[tokenId].pricePerToken;
            catalogs[tokenId].pricePerToken = newPrice;
            emit TokenPriceUpdated(tokenId, oldPrice, newPrice);
        } else {
            revert("Token not found");
        }
    }
    
    function toggleTokenActive(uint256 tokenId, bool active) 
        external 
        onlyRole(ADMIN_ROLE) 
    {
        if (songs[tokenId].tokenId != 0) {
            songs[tokenId].isActive = active;
        } else if (catalogs[tokenId].tokenId != 0) {
            catalogs[tokenId].isActive = active;
        } else {
            revert("Token not found");
        }
    }
    
    function updatePlatformWallet(address newWallet) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE) 
    {
        require(newWallet != address(0), "Invalid address");
        platformWallet = newWallet;
    }
    
    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }
    
    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }

    // ==================== VIEW FUNCTIONS ====================
    
    function getArtistSongs(uint256 artistId) 
        external 
        view 
        returns (uint256[] memory) 
    {
        return artistSongs[artistId];
    }
    
    function getArtistCatalogs(uint256 artistId) 
        external 
        view 
        returns (uint256[] memory) 
    {
        return artistCatalogs[artistId];
    }
    
    function getSongLicenses(uint256 songTokenId) 
        external 
        view 
        returns (uint256[] memory) 
    {
        return songLicenses[songTokenId];
    }
    
    function getNonce(address user) external view returns (uint256) {
        return nonces[user];
    }
    
    function uri(uint256 tokenId) public view override returns (string memory) {
        if (songs[tokenId].tokenId != 0) {
            return songs[tokenId].metadataURI;
        } else if (catalogs[tokenId].tokenId != 0) {
            return string(abi.encodePacked(baseMetadataURI, "catalog/", tokenId.toString()));
        } else if (tokenId >= ARTIST_TOKEN_PREFIX && tokenId < SONG_TOKEN_PREFIX) {
            uint256 artistId = tokenId - ARTIST_TOKEN_PREFIX;
            return artists[artistId].profileURI;
        } else if (licenses[tokenId].tokenId != 0) {
            return string(abi.encodePacked(baseMetadataURI, "license/", tokenId.toString()));
        }
        return "";
    }
    
    function getCurrentTokenCounts() 
        external 
        view 
        returns (
            uint256 totalArtists,
            uint256 totalSongs,
            uint256 totalCatalogs,
            uint256 totalLicenses
        ) 
    {
        return (
            _artistIdCounter.current(),
            _songIdCounter.current(),
            _catalogIdCounter.current(),
            _licenseIdCounter.current()
        );
    }

    // ==================== INTERFACE SUPPORT ====================
    
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC1155, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
    
    // ==================== ERC1155 RECEIVER ====================
    // Required for the contract to hold its own tokens (custody model)
    
    function onERC1155Received(
        address,
        address,
        uint256,
        uint256,
        bytes calldata
    ) external pure returns (bytes4) {
        return this.onERC1155Received.selector;
    }
    
    function onERC1155BatchReceived(
        address,
        address,
        uint256[] calldata,
        uint256[] calldata,
        bytes calldata
    ) external pure returns (bytes4) {
        return this.onERC1155BatchReceived.selector;
    }
    
    // Allow contract to receive ETH
    receive() external payable {}
}
