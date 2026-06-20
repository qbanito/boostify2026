// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title BTF Token — Boostify Music Ecosystem Currency
 * @author Boostify Music
 * @notice Native ERC-20 utility token for the Boostify Music ecosystem on Polygon.
 *
 * ═══════════════════════════════════════════════════════
 *  TOKENOMICS
 * ═══════════════════════════════════════════════════════
 *  Total Supply:  100,000,000 BTF (fixed cap, deflationary via burns)
 *
 *  Allocation:
 *    40%  Ecosystem Rewards   — Earn-to-Create pool (4-year vesting)
 *    15%  Liquidity Pool      — BoostiSwap / DEX liquidity
 *    15%  Team & Development  — 1-year cliff, 3-year vesting
 *    15%  Treasury / DAO      — Governed by Platinum stakers
 *    10%  Early Supporters    — 6-month cliff, 1-year vesting
 *     5%  Marketing           — Partnerships & growth
 *
 *  Burn Mechanisms:
 *    • 2% tax on every transfer (burned permanently)
 *    • 50% of BTF spent on platform services is burned
 *    • Buyback & Burn from platform revenue
 *    • NFT minting fees partially burned
 *    • Early unstaking penalty burned
 *
 *  Anti-Whale: Max 2% of total supply per wallet (excludes contract addresses)
 * ═══════════════════════════════════════════════════════
 */
contract BTFToken is ERC20, ERC20Burnable, ERC20Permit, AccessControl, Pausable, ReentrancyGuard {

    // ─── Roles ──────────────────────────────────────────
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant BURNER_ROLE = keccak256("BURNER_ROLE");
    bytes32 public constant FEE_MANAGER_ROLE = keccak256("FEE_MANAGER_ROLE");
    bytes32 public constant REWARDS_ROLE = keccak256("REWARDS_ROLE");

    // ─── Supply Constants ───────────────────────────────
    uint256 public constant MAX_SUPPLY = 100_000_000 * 10**18; // 100M BTF
    uint256 public constant ECOSYSTEM_REWARDS_POOL = 40_000_000 * 10**18;
    uint256 public constant LIQUIDITY_POOL = 15_000_000 * 10**18;
    uint256 public constant TEAM_POOL = 15_000_000 * 10**18;
    uint256 public constant TREASURY_POOL = 15_000_000 * 10**18;
    uint256 public constant EARLY_SUPPORTERS_POOL = 10_000_000 * 10**18;
    uint256 public constant MARKETING_POOL = 5_000_000 * 10**18;

    // ─── Fee Configuration ──────────────────────────────
    uint256 public transferBurnBps = 200; // 2% burn on transfers
    uint256 public serviceBurnBps = 5000; // 50% of service payments burned
    uint256 public constant MAX_BURN_BPS = 500; // Max 5% burn cap
    uint256 public constant BPS_DENOMINATOR = 10000;

    // ─── Anti-Whale ─────────────────────────────────────
    uint256 public maxWalletBps = 200; // 2% of MAX_SUPPLY per wallet
    mapping(address => bool) public isExcludedFromLimits;
    mapping(address => bool) public isExcludedFromFees;

    // ─── Ecosystem Rewards Tracking ─────────────────────
    uint256 public ecosystemRewardsDistributed;
    uint256 public totalBurned;

    // ─── Vesting ────────────────────────────────────────
    struct VestingSchedule {
        uint256 totalAmount;
        uint256 released;
        uint256 startTime;
        uint256 cliffDuration; // seconds
        uint256 vestingDuration; // seconds after cliff
        bool revoked;
    }
    mapping(address => VestingSchedule) public vestingSchedules;

    // ─── Events ─────────────────────────────────────────
    event TokensBurned(address indexed from, uint256 amount, string reason);
    event EcosystemReward(address indexed artist, uint256 amount, string action);
    event ServicePayment(address indexed payer, uint256 amount, uint256 burned, string service);
    event VestingCreated(address indexed beneficiary, uint256 amount, uint256 cliff, uint256 duration);
    event VestingReleased(address indexed beneficiary, uint256 amount);
    event AntiWhaleUpdated(uint256 newMaxBps);
    event TransferBurnUpdated(uint256 newBps);
    event BuybackBurn(uint256 amount, uint256 timestamp);

    // ─── Errors ─────────────────────────────────────────
    error ExceedsMaxWallet(address wallet, uint256 amount, uint256 maxAllowed);
    error ExceedsMaxSupply(uint256 requested, uint256 remaining);
    error ExceedsRewardsPool(uint256 requested, uint256 remaining);
    error InvalidBurnRate(uint256 bps);
    error ZeroAddress();
    error ZeroAmount();
    error VestingAlreadyExists();
    error NoVestingSchedule();
    error NothingToRelease();

    constructor(
        address _admin,
        address _ecosystemWallet,
        address _liquidityWallet,
        address _teamWallet,
        address _treasuryWallet,
        address _earlySupportersWallet,
        address _marketingWallet
    ) ERC20("Boostify Token", "BTF") ERC20Permit("Boostify Token") {
        if (_admin == address(0)) revert ZeroAddress();

        // Grant roles
        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(MINTER_ROLE, _admin);
        _grantRole(BURNER_ROLE, _admin);
        _grantRole(FEE_MANAGER_ROLE, _admin);
        _grantRole(REWARDS_ROLE, _admin);

        // Exclude core addresses from limits & fees
        isExcludedFromLimits[_admin] = true;
        isExcludedFromLimits[address(this)] = true;
        isExcludedFromFees[_admin] = true;
        isExcludedFromFees[address(this)] = true;

        address[6] memory wallets = [
            _ecosystemWallet, _liquidityWallet, _teamWallet,
            _treasuryWallet, _earlySupportersWallet, _marketingWallet
        ];
        for (uint i = 0; i < wallets.length; i++) {
            isExcludedFromLimits[wallets[i]] = true;
            isExcludedFromFees[wallets[i]] = true;
        }

        // ─── Mint initial allocations ───────────────────
        // Ecosystem rewards → held by this contract, distributed via rewardArtist()
        _mint(address(this), ECOSYSTEM_REWARDS_POOL);

        // Liquidity → directly to liquidity wallet (for DEX pool setup)
        _mint(_liquidityWallet, LIQUIDITY_POOL);

        // Team → vested (1-year cliff, 3-year vest)
        _mint(address(this), TEAM_POOL);
        _createVesting(_teamWallet, TEAM_POOL, 365 days, 1095 days);

        // Treasury → directly to treasury multisig
        _mint(_treasuryWallet, TREASURY_POOL);

        // Early supporters → vested (6-month cliff, 1-year vest)
        _mint(address(this), EARLY_SUPPORTERS_POOL);
        _createVesting(_earlySupportersWallet, EARLY_SUPPORTERS_POOL, 180 days, 365 days);

        // Marketing → directly available
        _mint(_marketingWallet, MARKETING_POOL);
    }

    // ═══════════════════════════════════════════════════════
    //  TRANSFERS WITH BURN TAX (OZ v4 compatible)
    // ═══════════════════════════════════════════════════════

    /**
     * @dev Hook: enforce pause on all token movements except minting.
     */
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal virtual override {
        super._beforeTokenTransfer(from, to, amount);
        // Allow minting during construction even if paused later
        if (from != address(0)) {
            require(!paused(), "BTFToken: transfers paused");
        }
    }

    /**
     * @dev Override _transfer to apply burn tax and anti-whale on every transfer.
     */
    function _transfer(
        address from,
        address to,
        uint256 amount
    ) internal virtual override {
        // Skip fees for excluded addresses
        if (isExcludedFromFees[from] || isExcludedFromFees[to]) {
            super._transfer(from, to, amount);
        } else {
            // Calculate & apply burn tax
            uint256 burnAmount = (amount * transferBurnBps) / BPS_DENOMINATOR;
            uint256 transferAmount = amount - burnAmount;

            // Transfer net amount first
            super._transfer(from, to, transferAmount);

            // Burn the tax from sender
            if (burnAmount > 0) {
                _burn(from, burnAmount);
                totalBurned += burnAmount;
                emit TokensBurned(from, burnAmount, "transfer_tax");
            }
        }

        // Anti-whale check on receiver
        if (to != address(0) && !isExcludedFromLimits[to]) {
            uint256 maxWallet = (MAX_SUPPLY * maxWalletBps) / BPS_DENOMINATOR;
            if (balanceOf(to) > maxWallet) {
                revert ExceedsMaxWallet(to, balanceOf(to), maxWallet);
            }
        }
    }

    // ═══════════════════════════════════════════════════════
    //  ECOSYSTEM REWARDS - Earn-to-Create
    // ═══════════════════════════════════════════════════════

    /**
     * @notice Reward an artist for ecosystem activity
     * @param artist Recipient address
     * @param amount BTF amount (18 decimals)
     * @param action Description of earning action (e.g. "upload_song", "milestone_1k_streams")
     */
    function rewardArtist(
        address artist,
        uint256 amount,
        string calldata action
    ) external onlyRole(REWARDS_ROLE) nonReentrant {
        if (artist == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();

        uint256 remaining = ECOSYSTEM_REWARDS_POOL - ecosystemRewardsDistributed;
        if (amount > remaining) revert ExceedsRewardsPool(amount, remaining);

        ecosystemRewardsDistributed += amount;

        // Transfer from contract's ecosystem pool (no burn tax — excluded)
        _transfer(address(this), artist, amount);

        emit EcosystemReward(artist, amount, action);
    }

    /**
     * @notice Get remaining rewards in ecosystem pool
     */
    function ecosystemRewardsRemaining() external view returns (uint256) {
        return ECOSYSTEM_REWARDS_POOL - ecosystemRewardsDistributed;
    }

    // ═══════════════════════════════════════════════════════
    //  SERVICE PAYMENTS WITH BURN
    // ═══════════════════════════════════════════════════════

    /**
     * @notice Pay for a platform service with BTF. A portion is burned.
     * @param amount Total BTF payment
     * @param service Name of the service (e.g. "ai_music_video", "song_boost")
     */
    function payForService(
        uint256 amount,
        string calldata service
    ) external nonReentrant {
        if (amount == 0) revert ZeroAmount();

        uint256 burnAmount = (amount * serviceBurnBps) / BPS_DENOMINATOR;
        uint256 platformAmount = amount - burnAmount;

        // Burn portion
        if (burnAmount > 0) {
            _burn(msg.sender, burnAmount);
            totalBurned += burnAmount;
        }

        // Send remainder to platform treasury
        if (platformAmount > 0) {
            _transfer(msg.sender, address(this), platformAmount);
        }

        emit ServicePayment(msg.sender, amount, burnAmount, service);
    }

    // ═══════════════════════════════════════════════════════
    //  BUYBACK & BURN
    // ═══════════════════════════════════════════════════════

    /**
     * @notice Platform buyback: burn BTF purchased from the market
     * @param amount BTF to burn (must be held by this contract from buyback)
     */
    function buybackBurn(uint256 amount) external onlyRole(BURNER_ROLE) {
        if (amount == 0) revert ZeroAmount();
        _burn(address(this), amount);
        totalBurned += amount;
        emit BuybackBurn(amount, block.timestamp);
    }

    // ═══════════════════════════════════════════════════════
    //  VESTING
    // ═══════════════════════════════════════════════════════

    function _createVesting(
        address beneficiary,
        uint256 amount,
        uint256 cliffDuration,
        uint256 vestingDuration
    ) internal {
        vestingSchedules[beneficiary] = VestingSchedule({
            totalAmount: amount,
            released: 0,
            startTime: block.timestamp,
            cliffDuration: cliffDuration,
            vestingDuration: vestingDuration,
            revoked: false
        });
        emit VestingCreated(beneficiary, amount, cliffDuration, vestingDuration);
    }

    /**
     * @notice Release vested tokens
     */
    function releaseVested() external nonReentrant {
        VestingSchedule storage schedule = vestingSchedules[msg.sender];
        if (schedule.totalAmount == 0) revert NoVestingSchedule();

        uint256 releasable = _vestedAmount(schedule) - schedule.released;
        if (releasable == 0) revert NothingToRelease();

        schedule.released += releasable;
        _transfer(address(this), msg.sender, releasable);

        emit VestingReleased(msg.sender, releasable);
    }

    function vestedAmount(address beneficiary) external view returns (uint256) {
        return _vestedAmount(vestingSchedules[beneficiary]);
    }

    function releasableAmount(address beneficiary) external view returns (uint256) {
        VestingSchedule storage schedule = vestingSchedules[beneficiary];
        return _vestedAmount(schedule) - schedule.released;
    }

    function _vestedAmount(VestingSchedule storage schedule) internal view returns (uint256) {
        if (schedule.totalAmount == 0 || schedule.revoked) return 0;

        uint256 elapsed = block.timestamp - schedule.startTime;

        // Before cliff: nothing vested
        if (elapsed < schedule.cliffDuration) return 0;

        // After cliff + vesting: everything vested
        uint256 totalDuration = schedule.cliffDuration + schedule.vestingDuration;
        if (elapsed >= totalDuration) return schedule.totalAmount;

        // During vesting: linear proportional
        uint256 vestingElapsed = elapsed - schedule.cliffDuration;
        return (schedule.totalAmount * vestingElapsed) / schedule.vestingDuration;
    }

    /**
     * @notice Revoke vesting (admin only). Unreleased tokens return to contract.
     */
    function revokeVesting(address beneficiary) external onlyRole(DEFAULT_ADMIN_ROLE) {
        VestingSchedule storage schedule = vestingSchedules[beneficiary];
        if (schedule.totalAmount == 0) revert NoVestingSchedule();
        schedule.revoked = true;
    }

    // ═══════════════════════════════════════════════════════
    //  ADMIN FUNCTIONS
    // ═══════════════════════════════════════════════════════

    function setTransferBurnBps(uint256 _bps) external onlyRole(FEE_MANAGER_ROLE) {
        if (_bps > MAX_BURN_BPS) revert InvalidBurnRate(_bps);
        transferBurnBps = _bps;
        emit TransferBurnUpdated(_bps);
    }

    function setServiceBurnBps(uint256 _bps) external onlyRole(FEE_MANAGER_ROLE) {
        if (_bps > BPS_DENOMINATOR) revert InvalidBurnRate(_bps);
        serviceBurnBps = _bps;
    }

    function setMaxWalletBps(uint256 _bps) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_bps >= 100 && _bps <= 10000, "Must be between 1% and 100%");
        maxWalletBps = _bps;
        emit AntiWhaleUpdated(_bps);
    }

    function setExcludedFromLimits(address account, bool excluded) external onlyRole(DEFAULT_ADMIN_ROLE) {
        isExcludedFromLimits[account] = excluded;
    }

    function setExcludedFromFees(address account, bool excluded) external onlyRole(FEE_MANAGER_ROLE) {
        isExcludedFromFees[account] = excluded;
    }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    // ═══════════════════════════════════════════════════════
    //  VIEW FUNCTIONS
    // ═══════════════════════════════════════════════════════

    /**
     * @notice Current circulating supply (total minted - total burned)
     */
    function circulatingSupply() external view returns (uint256) {
        return totalSupply(); // ERC20 totalSupply already accounts for burns
    }

    /**
     * @notice Effective max wallet balance
     */
    function maxWalletAmount() external view returns (uint256) {
        return (MAX_SUPPLY * maxWalletBps) / BPS_DENOMINATOR;
    }

    /**
     * @notice Get full token stats
     */
    function getTokenStats() external view returns (
        uint256 _totalSupply,
        uint256 _totalBurned,
        uint256 _ecosystemDistributed,
        uint256 _ecosystemRemaining,
        uint256 _transferBurnBps,
        uint256 _serviceBurnBps,
        uint256 _maxWalletBps
    ) {
        return (
            totalSupply(),
            totalBurned,
            ecosystemRewardsDistributed,
            ECOSYSTEM_REWARDS_POOL - ecosystemRewardsDistributed,
            transferBurnBps,
            serviceBurnBps,
            maxWalletBps
        );
    }
}
