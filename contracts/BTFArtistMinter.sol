// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

/**
 * @title BTF AI Artist Minter V2 — Continuous Bonding + Value Appreciation
 * @author Boostify Music
 * @notice Mint AI Artists by paying BTF. Max 1,000 artists (800 public + 200 platform reserve).
 *
 * ═══════════════════════════════════════════════════════
 *  TOKENOMICS V2 — CONTINUOUS PRICING + VALUE APPRECIATION
 * ═══════════════════════════════════════════════════════
 *
 *  Total Supply:    1,000 AI Artists (hard cap, immutable)
 *  Public Supply:     800  (purchased with BTF via bonding curve)
 *  Platform Reserve:  200  (minted by Boostify at zero cost)
 *
 *  Continuous Bonding Curve (price increases with EVERY mint):
 *    Tier 1:  Public  1-160   base 2,000 BTF  (+10 BTF/mint)
 *    Tier 2:  Public 161-400  base 3,500 BTF  (+20 BTF/mint)
 *    Tier 3:  Public 401-600  base 6,000 BTF  (+40 BTF/mint)
 *    Tier 4:  Public 601-720  base 10,000 BTF (+80 BTF/mint)
 *    Tier 5:  Public 721-800  base 20,000 BTF (+150 BTF/mint)
 *
 *  Token Distribution on each public mint:
 *    40% → Burned permanently (deflationary pressure)
 *    30% → Staking Vault (rewards for BTF stakers)
 *    20% → Treasury (platform development)
 *    10% → Reserve Fund (ecosystem growth)
 *
 *  Value Appreciation System:
 *    Each AI Artist earns a Value Score on-chain as it produces:
 *      - song_created:      +50 points
 *      - video_created:    +200 points
 *      - collab_completed: +100 points
 *      - fan_interaction:   +25 points
 *      - merch_sold:        +75 points
 *      - stream_milestone: +150 points
 *
 *  Why V2 is better:
 *    • EVERY mint raises the next price (continuous, not flat tiers)
 *    • 20% platform reserve ensures Boostify has skin in the game
 *    • Artists gain on-chain value as they produce content
 *    • 4-way distribution maximizes ecosystem sustainability
 *    • Activity reporters = backend can track off-chain actions on-chain
 * ═══════════════════════════════════════════════════════
 */
contract BTFArtistMinter is Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // ─── Core State ─────────────────────────────────────
    IERC20 public immutable btfToken;
    address public stakingVault;
    address public treasury;
    address public reserveFund;

    uint256 public constant MAX_ARTISTS = 1000;
    uint256 public constant PUBLIC_SUPPLY = 800;
    uint256 public constant PLATFORM_RESERVE = 200;

    uint256 public publicMinted;
    uint256 public platformMinted;

    // ─── Continuous Bonding Curve ────────────────────────
    // Price = baseTierPrice + (positionInTier * stepIncrease)
    // Each mint within a tier increases price by `stepIncrease`

    // Tier boundaries (cumulative public minted)
    uint256 public constant TIER_1_END = 160;
    uint256 public constant TIER_2_END = 400;
    uint256 public constant TIER_3_END = 600;
    uint256 public constant TIER_4_END = 720;
    // Tier 5 = 721..800

    // Base prices (in BTF, no decimals — applied in getCurrentPrice)
    uint256 public constant TIER_1_BASE = 2_000;
    uint256 public constant TIER_2_BASE = 3_500;
    uint256 public constant TIER_3_BASE = 6_000;
    uint256 public constant TIER_4_BASE = 10_000;
    uint256 public constant TIER_5_BASE = 20_000;

    // Step increase per mint within tier (BTF)
    uint256 public constant TIER_1_STEP = 10;
    uint256 public constant TIER_2_STEP = 20;
    uint256 public constant TIER_3_STEP = 40;
    uint256 public constant TIER_4_STEP = 80;
    uint256 public constant TIER_5_STEP = 150;

    // ─── Distribution BPS (basis points) ────────────────
    uint256 public burnBps = 4000;       // 40% burned
    uint256 public stakingBps = 3000;    // 30% to staking vault
    uint256 public treasuryBps = 2000;   // 20% to treasury
    uint256 public reserveFundBps = 1000;// 10% to reserve fund
    uint256 public constant BPS_DENOMINATOR = 10000;

    // ─── Artist Records ─────────────────────────────────
    struct ArtistRecord {
        uint256 id;                 // Sequential 1-1000
        address owner;              // Who minted / owns it
        uint256 mintedAt;           // Block timestamp
        uint256 pricePaid;          // BTF paid (wei), 0 for platform reserve
        uint256 tier;               // Price tier at mint (1-5), 0 for reserve
        string artistName;          // On-chain artist name
        string genre;               // On-chain genre tag
        bool isActive;              // Can be deactivated
        bool isPlatformReserve;     // True if minted by platform
        uint256 valueScore;         // Accumulated value from activity
        uint256 totalSongs;
        uint256 totalVideos;
        uint256 totalCollabs;
        uint256 totalInteractions;
    }

    mapping(uint256 => ArtistRecord) public artists;
    mapping(address => uint256[]) public ownerArtists;
    mapping(address => uint256) public ownerMintCount;

    // ─── Limits ─────────────────────────────────────────
    uint256 public maxPerWallet = 5;

    // ─── Stats ──────────────────────────────────────────
    uint256 public totalBTFCollected;
    uint256 public totalBTFBurned;
    uint256 public totalBTFToStaking;
    uint256 public totalBTFToTreasury;
    uint256 public totalBTFToReserve;
    uint256 public globalValueScore;

    // ─── Activity System ────────────────────────────────
    mapping(address => bool) public activityReporters;
    mapping(string => uint256) public activityValues;

    // ─── Events ─────────────────────────────────────────
    event ArtistMinted(
        uint256 indexed artistId,
        address indexed owner,
        string artistName,
        string genre,
        uint256 pricePaid,
        uint256 tier,
        uint256 burned,
        uint256 toStaking,
        uint256 toTreasury,
        uint256 toReserve,
        uint256 timestamp
    );
    event PlatformArtistMinted(
        uint256 indexed artistId,
        string artistName,
        string genre,
        uint256 timestamp
    );
    event ActivityRecorded(
        uint256 indexed artistId,
        string activityType,
        uint256 valueAdded,
        uint256 newTotalValue
    );
    event ArtistDeactivated(uint256 indexed artistId, address indexed owner);
    event ArtistReactivated(uint256 indexed artistId, address indexed owner);
    event ArtistTransferred(uint256 indexed artistId, address indexed from, address indexed to);
    event DistributionUpdated(uint256 burnBps, uint256 stakingBps, uint256 treasuryBps, uint256 reserveFundBps);
    event MaxPerWalletUpdated(uint256 newMax);
    event StakingVaultUpdated(address newVault);
    event TreasuryUpdated(address newTreasury);
    event ReserveFundUpdated(address newReserveFund);
    event ActivityReporterSet(address reporter, bool enabled);

    // ─── Errors ─────────────────────────────────────────
    error MaxArtistsReached();
    error MaxPerWalletReached(address wallet, uint256 current, uint256 max);
    error InsufficientBTFBalance(uint256 required, uint256 available);
    error InsufficientBTFAllowance(uint256 required, uint256 allowance);
    error ArtistNotFound(uint256 artistId);
    error NotArtistOwner(uint256 artistId, address caller);
    error ArtistAlreadyInactive(uint256 artistId);
    error ArtistAlreadyActive(uint256 artistId);
    error InvalidDistribution();
    error ZeroAddress();
    error EmptyName();
    error PlatformReserveExhausted();
    error NotActivityReporter();
    error InvalidActivityType();

    // ─── Constructor ────────────────────────────────────
    constructor(
        address _btfToken,
        address _stakingVault,
        address _treasury,
        address _reserveFund,
        address _admin
    ) Ownable() {
        if (_btfToken == address(0) || _stakingVault == address(0) || 
            _treasury == address(0) || _reserveFund == address(0)) 
            revert ZeroAddress();

        btfToken = IERC20(_btfToken);
        stakingVault = _stakingVault;
        treasury = _treasury;
        reserveFund = _reserveFund;

        // Initialize activity values
        activityValues["song_created"] = 50;
        activityValues["video_created"] = 200;
        activityValues["collab_completed"] = 100;
        activityValues["fan_interaction"] = 25;
        activityValues["merch_sold"] = 75;
        activityValues["stream_milestone"] = 150;

        _transferOwnership(_admin);
    }

    // ═══════════════════════════════════════════════════════
    //  CONTINUOUS BONDING CURVE — PRICE CALCULATION
    // ═══════════════════════════════════════════════════════

    /**
     * @notice Get the current tier based on public minted count
     */
    function getCurrentTier() public view returns (uint256 tier) {
        uint256 nextPublic = publicMinted + 1;
        if (nextPublic <= TIER_1_END) return 1;
        if (nextPublic <= TIER_2_END) return 2;
        if (nextPublic <= TIER_3_END) return 3;
        if (nextPublic <= TIER_4_END) return 4;
        return 5;
    }

    /**
     * @notice Get the current mint price in BTF (with 18 decimals).
     *         Price = baseTierPrice + (positionInTier * stepIncrease)
     */
    function getCurrentPrice() public view returns (uint256 price) {
        uint256 nextPublic = publicMinted + 1;
        uint256 basePrice;
        uint256 step;
        uint256 positionInTier;

        if (nextPublic <= TIER_1_END) {
            basePrice = TIER_1_BASE;
            step = TIER_1_STEP;
            positionInTier = nextPublic - 1; // 0-indexed within tier
        } else if (nextPublic <= TIER_2_END) {
            basePrice = TIER_2_BASE;
            step = TIER_2_STEP;
            positionInTier = nextPublic - TIER_1_END - 1;
        } else if (nextPublic <= TIER_3_END) {
            basePrice = TIER_3_BASE;
            step = TIER_3_STEP;
            positionInTier = nextPublic - TIER_2_END - 1;
        } else if (nextPublic <= TIER_4_END) {
            basePrice = TIER_4_BASE;
            step = TIER_4_STEP;
            positionInTier = nextPublic - TIER_3_END - 1;
        } else {
            basePrice = TIER_5_BASE;
            step = TIER_5_STEP;
            positionInTier = nextPublic - TIER_4_END - 1;
        }

        return (basePrice + (positionInTier * step)) * 10**18;
    }

    /**
     * @notice Get remaining public supply
     */
    function remainingPublicSupply() external view returns (uint256) {
        return PUBLIC_SUPPLY - publicMinted;
    }

    /**
     * @notice Get remaining platform reserve
     */
    function remainingPlatformReserve() external view returns (uint256) {
        return PLATFORM_RESERVE - platformMinted;
    }

    /**
     * @notice Get the price for a specific future public mint number
     */
    function getPriceForPublicMint(uint256 publicNumber) external pure returns (uint256) {
        require(publicNumber >= 1 && publicNumber <= PUBLIC_SUPPLY, "Invalid public number");

        uint256 basePrice;
        uint256 step;
        uint256 positionInTier;

        if (publicNumber <= TIER_1_END) {
            basePrice = TIER_1_BASE;
            step = TIER_1_STEP;
            positionInTier = publicNumber - 1;
        } else if (publicNumber <= TIER_2_END) {
            basePrice = TIER_2_BASE;
            step = TIER_2_STEP;
            positionInTier = publicNumber - TIER_1_END - 1;
        } else if (publicNumber <= TIER_3_END) {
            basePrice = TIER_3_BASE;
            step = TIER_3_STEP;
            positionInTier = publicNumber - TIER_2_END - 1;
        } else if (publicNumber <= TIER_4_END) {
            basePrice = TIER_4_BASE;
            step = TIER_4_STEP;
            positionInTier = publicNumber - TIER_3_END - 1;
        } else {
            basePrice = TIER_5_BASE;
            step = TIER_5_STEP;
            positionInTier = publicNumber - TIER_4_END - 1;
        }

        return (basePrice + (positionInTier * step)) * 10**18;
    }

    // ═══════════════════════════════════════════════════════
    //  MINT AI ARTIST (PUBLIC — PAYS BTF)
    // ═══════════════════════════════════════════════════════

    function mintArtist(
        string calldata artistName,
        string calldata genre
    ) external nonReentrant whenNotPaused returns (uint256 artistId) {
        if (bytes(artistName).length == 0) revert EmptyName();
        if (publicMinted >= PUBLIC_SUPPLY) revert MaxArtistsReached();
        if (ownerMintCount[msg.sender] >= maxPerWallet)
            revert MaxPerWalletReached(msg.sender, ownerMintCount[msg.sender], maxPerWallet);

        uint256 price = getCurrentPrice();
        uint256 tier = getCurrentTier();

        uint256 balance = btfToken.balanceOf(msg.sender);
        if (balance < price) revert InsufficientBTFBalance(price, balance);

        uint256 allowance = btfToken.allowance(msg.sender, address(this));
        if (allowance < price) revert InsufficientBTFAllowance(price, allowance);

        // Increment public counter
        publicMinted++;
        // Global artist ID = publicMinted (public artists get IDs 1..800)
        artistId = publicMinted;

        // Calculate 4-way distribution
        uint256 burnAmount = (price * burnBps) / BPS_DENOMINATOR;
        uint256 stakingAmount = (price * stakingBps) / BPS_DENOMINATOR;
        uint256 treasuryAmount = (price * treasuryBps) / BPS_DENOMINATOR;
        uint256 reserveAmount = price - burnAmount - stakingAmount - treasuryAmount;

        // Transfer BTF
        btfToken.safeTransferFrom(msg.sender, address(this), price);

        // 40% burn
        if (burnAmount > 0) {
            IERC20Burnable(address(btfToken)).burn(burnAmount);
            totalBTFBurned += burnAmount;
        }
        // 30% staking
        if (stakingAmount > 0) {
            btfToken.safeTransfer(stakingVault, stakingAmount);
            totalBTFToStaking += stakingAmount;
        }
        // 20% treasury
        if (treasuryAmount > 0) {
            btfToken.safeTransfer(treasury, treasuryAmount);
            totalBTFToTreasury += treasuryAmount;
        }
        // 10% reserve fund
        if (reserveAmount > 0) {
            btfToken.safeTransfer(reserveFund, reserveAmount);
            totalBTFToReserve += reserveAmount;
        }

        totalBTFCollected += price;

        // Record artist
        artists[artistId] = ArtistRecord({
            id: artistId,
            owner: msg.sender,
            mintedAt: block.timestamp,
            pricePaid: price,
            tier: tier,
            artistName: artistName,
            genre: genre,
            isActive: true,
            isPlatformReserve: false,
            valueScore: 0,
            totalSongs: 0,
            totalVideos: 0,
            totalCollabs: 0,
            totalInteractions: 0
        });

        ownerArtists[msg.sender].push(artistId);
        ownerMintCount[msg.sender]++;

        emit ArtistMinted(
            artistId, msg.sender, artistName, genre, price, tier,
            burnAmount, stakingAmount, treasuryAmount, reserveAmount,
            block.timestamp
        );

        return artistId;
    }

    // ═══════════════════════════════════════════════════════
    //  MINT PLATFORM RESERVE (FREE — ADMIN ONLY)
    // ═══════════════════════════════════════════════════════

    function mintPlatformArtist(
        string calldata artistName,
        string calldata genre
    ) external onlyOwner returns (uint256 artistId) {
        if (bytes(artistName).length == 0) revert EmptyName();
        if (platformMinted >= PLATFORM_RESERVE) revert PlatformReserveExhausted();

        platformMinted++;
        // Platform IDs start at 801 (after public supply)
        artistId = PUBLIC_SUPPLY + platformMinted;

        artists[artistId] = ArtistRecord({
            id: artistId,
            owner: msg.sender,
            mintedAt: block.timestamp,
            pricePaid: 0,
            tier: 0, // No tier for platform artists
            artistName: artistName,
            genre: genre,
            isActive: true,
            isPlatformReserve: true,
            valueScore: 0,
            totalSongs: 0,
            totalVideos: 0,
            totalCollabs: 0,
            totalInteractions: 0
        });

        ownerArtists[msg.sender].push(artistId);

        emit PlatformArtistMinted(artistId, artistName, genre, block.timestamp);
        return artistId;
    }

    // ═══════════════════════════════════════════════════════
    //  VALUE APPRECIATION — ACTIVITY TRACKING
    // ═══════════════════════════════════════════════════════

    modifier onlyActivityReporter() {
        if (!activityReporters[msg.sender] && msg.sender != owner())
            revert NotActivityReporter();
        _;
    }

    /**
     * @notice Record an activity for an artist, increasing its value score
     * @param artistId The artist ID
     * @param activityType e.g. "song_created", "video_created", etc.
     */
    function recordActivity(
        uint256 artistId,
        string calldata activityType
    ) external onlyActivityReporter {
        ArtistRecord storage record = artists[artistId];
        if (record.owner == address(0)) revert ArtistNotFound(artistId);
        if (!record.isActive) revert ArtistAlreadyInactive(artistId);

        uint256 value = activityValues[activityType];
        if (value == 0) revert InvalidActivityType();

        record.valueScore += value;
        globalValueScore += value;

        // Update specific counters
        if (_strEq(activityType, "song_created")) {
            record.totalSongs++;
        } else if (_strEq(activityType, "video_created")) {
            record.totalVideos++;
        } else if (_strEq(activityType, "collab_completed")) {
            record.totalCollabs++;
        } else {
            record.totalInteractions++;
        }

        emit ActivityRecorded(artistId, activityType, value, record.valueScore);
    }

    /**
     * @notice Batch record activities for multiple artists
     */
    function batchRecordActivity(
        uint256[] calldata artistIds,
        string[] calldata activityTypes
    ) external onlyActivityReporter {
        require(artistIds.length == activityTypes.length, "Length mismatch");
        for (uint256 i = 0; i < artistIds.length; i++) {
            ArtistRecord storage record = artists[artistIds[i]];
            if (record.owner == address(0)) continue;
            if (!record.isActive) continue;

            uint256 value = activityValues[activityTypes[i]];
            if (value == 0) continue;

            record.valueScore += value;
            globalValueScore += value;

            if (_strEq(activityTypes[i], "song_created")) {
                record.totalSongs++;
            } else if (_strEq(activityTypes[i], "video_created")) {
                record.totalVideos++;
            } else if (_strEq(activityTypes[i], "collab_completed")) {
                record.totalCollabs++;
            } else {
                record.totalInteractions++;
            }

            emit ActivityRecorded(artistIds[i], activityTypes[i], value, record.valueScore);
        }
    }

    // ═══════════════════════════════════════════════════════
    //  ARTIST MANAGEMENT
    // ═══════════════════════════════════════════════════════

    function deactivateArtist(uint256 artistId) external {
        ArtistRecord storage record = artists[artistId];
        if (record.owner == address(0)) revert ArtistNotFound(artistId);
        if (record.owner != msg.sender) revert NotArtistOwner(artistId, msg.sender);
        if (!record.isActive) revert ArtistAlreadyInactive(artistId);
        record.isActive = false;
        emit ArtistDeactivated(artistId, msg.sender);
    }

    function reactivateArtist(uint256 artistId) external {
        ArtistRecord storage record = artists[artistId];
        if (record.owner == address(0)) revert ArtistNotFound(artistId);
        if (record.owner != msg.sender) revert NotArtistOwner(artistId, msg.sender);
        if (record.isActive) revert ArtistAlreadyActive(artistId);
        record.isActive = true;
        emit ArtistReactivated(artistId, msg.sender);
    }

    function transferArtist(uint256 artistId, address newOwner) external nonReentrant {
        if (newOwner == address(0)) revert ZeroAddress();
        ArtistRecord storage record = artists[artistId];
        if (record.owner == address(0)) revert ArtistNotFound(artistId);
        if (record.owner != msg.sender) revert NotArtistOwner(artistId, msg.sender);

        address oldOwner = record.owner;
        record.owner = newOwner;
        ownerMintCount[oldOwner]--;
        ownerMintCount[newOwner]++;
        ownerArtists[newOwner].push(artistId);

        uint256[] storage oldArtists = ownerArtists[oldOwner];
        for (uint256 i = 0; i < oldArtists.length; i++) {
            if (oldArtists[i] == artistId) {
                oldArtists[i] = oldArtists[oldArtists.length - 1];
                oldArtists.pop();
                break;
            }
        }

        emit ArtistTransferred(artistId, oldOwner, newOwner);
    }

    // ═══════════════════════════════════════════════════════
    //  VIEW FUNCTIONS
    // ═══════════════════════════════════════════════════════

    function totalMinted() external view returns (uint256) {
        return publicMinted + platformMinted;
    }

    function getOwnerArtists(address owner) external view returns (uint256[] memory) {
        return ownerArtists[owner];
    }

    function getArtistBatch(uint256[] calldata ids) external view returns (ArtistRecord[] memory) {
        ArtistRecord[] memory records = new ArtistRecord[](ids.length);
        for (uint256 i = 0; i < ids.length; i++) {
            records[i] = artists[ids[i]];
        }
        return records;
    }

    /**
     * @notice Full artist info including value appreciation data
     */
    function getArtistFull(uint256 artistId) external view returns (
        uint256 id,
        address owner,
        uint256 mintedAt,
        uint256 pricePaid,
        uint256 tier,
        string memory artistName,
        string memory genre,
        bool isActive,
        bool isPlatformReserve,
        uint256 valueScore,
        uint256 totalSongs,
        uint256 totalVideos,
        uint256 totalCollabs,
        uint256 totalInteractions
    ) {
        ArtistRecord storage r = artists[artistId];
        return (
            r.id, r.owner, r.mintedAt, r.pricePaid, r.tier,
            r.artistName, r.genre, r.isActive, r.isPlatformReserve,
            r.valueScore, r.totalSongs, r.totalVideos, r.totalCollabs, r.totalInteractions
        );
    }

    /**
     * @notice Get global minting + value stats (V2 — 12 return values)
     */
    function getMintStats() external view returns (
        uint256 _publicMinted,
        uint256 _remainingPublic,
        uint256 _currentPrice,
        uint256 _currentTier,
        uint256 _totalCollected,
        uint256 _totalBurned,
        uint256 _totalToStaking,
        uint256 _totalToTreasury,
        uint256 _platformMinted,
        uint256 _remainingPlatform,
        uint256 _totalToReserve,
        uint256 _globalValueScore
    ) {
        return (
            publicMinted,
            PUBLIC_SUPPLY - publicMinted,
            publicMinted < PUBLIC_SUPPLY ? getCurrentPrice() : 0,
            publicMinted < PUBLIC_SUPPLY ? getCurrentTier() : 5,
            totalBTFCollected,
            totalBTFBurned,
            totalBTFToStaking,
            totalBTFToTreasury,
            platformMinted,
            PLATFORM_RESERVE - platformMinted,
            totalBTFToReserve,
            globalValueScore
        );
    }

    /**
     * @notice Full bonding curve with step increases
     */
    function getBondingCurve() external pure returns (
        uint256[5] memory basePrices,
        uint256[5] memory steps,
        uint256[5] memory boundaries
    ) {
        basePrices = [
            TIER_1_BASE * 10**18,
            TIER_2_BASE * 10**18,
            TIER_3_BASE * 10**18,
            TIER_4_BASE * 10**18,
            TIER_5_BASE * 10**18
        ];
        steps = [
            TIER_1_STEP * 10**18,
            TIER_2_STEP * 10**18,
            TIER_3_STEP * 10**18,
            TIER_4_STEP * 10**18,
            TIER_5_STEP * 10**18
        ];
        boundaries = [TIER_1_END, TIER_2_END, TIER_3_END, TIER_4_END, uint256(PUBLIC_SUPPLY)];
    }

    // ═══════════════════════════════════════════════════════
    //  ADMIN FUNCTIONS
    // ═══════════════════════════════════════════════════════

    function updateDistribution(
        uint256 _burnBps,
        uint256 _stakingBps,
        uint256 _treasuryBps,
        uint256 _reserveFundBps
    ) external onlyOwner {
        if (_burnBps + _stakingBps + _treasuryBps + _reserveFundBps != BPS_DENOMINATOR)
            revert InvalidDistribution();
        burnBps = _burnBps;
        stakingBps = _stakingBps;
        treasuryBps = _treasuryBps;
        reserveFundBps = _reserveFundBps;
        emit DistributionUpdated(_burnBps, _stakingBps, _treasuryBps, _reserveFundBps);
    }

    function updateMaxPerWallet(uint256 _max) external onlyOwner {
        maxPerWallet = _max;
        emit MaxPerWalletUpdated(_max);
    }

    function updateStakingVault(address _vault) external onlyOwner {
        if (_vault == address(0)) revert ZeroAddress();
        stakingVault = _vault;
        emit StakingVaultUpdated(_vault);
    }

    function updateTreasury(address _treasury) external onlyOwner {
        if (_treasury == address(0)) revert ZeroAddress();
        treasury = _treasury;
        emit TreasuryUpdated(_treasury);
    }

    function updateReserveFund(address _fund) external onlyOwner {
        if (_fund == address(0)) revert ZeroAddress();
        reserveFund = _fund;
        emit ReserveFundUpdated(_fund);
    }

    function setActivityReporter(address reporter, bool enabled) external onlyOwner {
        activityReporters[reporter] = enabled;
        emit ActivityReporterSet(reporter, enabled);
    }

    function setActivityValue(string calldata activityType, uint256 value) external onlyOwner {
        activityValues[activityType] = value;
    }

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    function recoverToken(address token, uint256 amount) external onlyOwner {
        require(token != address(btfToken), "Cannot recover BTF");
        IERC20(token).safeTransfer(owner(), amount);
    }

    // ─── Internal Helpers ───────────────────────────────
    function _strEq(string memory a, string memory b) internal pure returns (bool) {
        return keccak256(abi.encodePacked(a)) == keccak256(abi.encodePacked(b));
    }
}

// ─── Interface for ERC20Burnable ────────────────────────
interface IERC20Burnable {
    function burn(uint256 amount) external;
}
