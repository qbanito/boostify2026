// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title BTF Staking Vault — Stake BTF, Earn Rewards & Unlock Tiers
 * @author Boostify Music
 * @notice Lock BTF tokens to earn staking rewards and unlock ecosystem benefits.
 *
 * ═══════════════════════════════════════════════════════
 *  STAKING TIERS
 * ═══════════════════════════════════════════════════════
 *  Bronze    →   100 BTF  → Verified badge, basic analytics
 *  Silver    →   500 BTF  → Radio priority, 20% service discount
 *  Gold      → 2,000 BTF  → Free AI videos, homepage featuring
 *  Platinum  → 10,000 BTF → Revenue share, DAO voting, VIP support
 *
 *  Lock Periods & APY:
 *    30 days   →  8% APY
 *    90 days   → 15% APY
 *    180 days  → 25% APY
 *    365 days  → 40% APY
 *
 *  Early Unstake Penalty: 5% burned permanently
 * ═══════════════════════════════════════════════════════
 */
contract BTFStakingVault is AccessControl, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ─── Roles ──────────────────────────────────────────
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");
    bytes32 public constant REWARDS_FUNDER_ROLE = keccak256("REWARDS_FUNDER_ROLE");

    // ─── Token ──────────────────────────────────────────
    IERC20 public immutable btfToken;

    // ─── Staking Tiers ──────────────────────────────────
    enum Tier { None, Bronze, Silver, Gold, Platinum }

    uint256 public constant BRONZE_THRESHOLD   = 100 * 10**18;
    uint256 public constant SILVER_THRESHOLD   = 500 * 10**18;
    uint256 public constant GOLD_THRESHOLD     = 2_000 * 10**18;
    uint256 public constant PLATINUM_THRESHOLD = 10_000 * 10**18;

    // ─── Lock Periods (seconds) ─────────────────────────
    uint256 public constant LOCK_30  = 30 days;
    uint256 public constant LOCK_90  = 90 days;
    uint256 public constant LOCK_180 = 180 days;
    uint256 public constant LOCK_365 = 365 days;

    // ─── APY in basis points (per year) ─────────────────
    mapping(uint256 => uint256) public lockPeriodAPY;

    // ─── Early Unstake Penalty ──────────────────────────
    uint256 public earlyUnstakePenaltyBps = 500; // 5%
    uint256 public constant BPS_DENOMINATOR = 10000;

    // ─── Staking Data ───────────────────────────────────
    struct Stake {
        uint256 amount;
        uint256 lockPeriod;
        uint256 stakedAt;
        uint256 lockEndsAt;
        uint256 lastRewardCalculation;
        uint256 accruedRewards;
        bool active;
    }

    mapping(address => Stake[]) public userStakes;
    mapping(address => uint256) public userTotalStaked;

    // ─── Global Stats ───────────────────────────────────
    uint256 public totalStaked;
    uint256 public totalRewardsDistributed;
    uint256 public totalPenaltyBurned;
    uint256 public rewardsPool; // BTF available for staking rewards
    uint256 public totalStakers;

    // ─── Events ─────────────────────────────────────────
    event Staked(address indexed user, uint256 amount, uint256 lockPeriod, uint256 stakeIndex);
    event Unstaked(address indexed user, uint256 amount, uint256 rewards, uint256 penalty, uint256 stakeIndex);
    event RewardsClaimed(address indexed user, uint256 amount, uint256 stakeIndex);
    event RewardsPoolFunded(address indexed funder, uint256 amount);
    event TierAchieved(address indexed user, Tier tier, uint256 totalStaked);
    event EarlyUnstakePenaltyUpdated(uint256 newBps);

    // ─── Errors ─────────────────────────────────────────
    error InvalidLockPeriod(uint256 period);
    error ZeroAmount();
    error StakeNotActive(uint256 index);
    error StakeIndexOutOfBounds(uint256 index, uint256 length);
    error InsufficientRewardsPool(uint256 requested, uint256 available);

    constructor(address _btfToken, address _admin) {
        btfToken = IERC20(_btfToken);

        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(MANAGER_ROLE, _admin);
        _grantRole(REWARDS_FUNDER_ROLE, _admin);

        // Set APY rates
        lockPeriodAPY[LOCK_30]  = 800;   //  8% APY
        lockPeriodAPY[LOCK_90]  = 1500;  // 15% APY
        lockPeriodAPY[LOCK_180] = 2500;  // 25% APY
        lockPeriodAPY[LOCK_365] = 4000;  // 40% APY
    }

    // ═══════════════════════════════════════════════════════
    //  STAKING
    // ═══════════════════════════════════════════════════════

    /**
     * @notice Stake BTF tokens for a lock period
     * @param amount BTF to stake (18 decimals)
     * @param lockPeriod Lock duration in seconds (30/90/180/365 days)
     */
    function stake(uint256 amount, uint256 lockPeriod) external whenNotPaused nonReentrant {
        if (amount == 0) revert ZeroAmount();
        if (lockPeriodAPY[lockPeriod] == 0) revert InvalidLockPeriod(lockPeriod);

        btfToken.safeTransferFrom(msg.sender, address(this), amount);

        bool isNewStaker = userTotalStaked[msg.sender] == 0;

        userStakes[msg.sender].push(Stake({
            amount: amount,
            lockPeriod: lockPeriod,
            stakedAt: block.timestamp,
            lockEndsAt: block.timestamp + lockPeriod,
            lastRewardCalculation: block.timestamp,
            accruedRewards: 0,
            active: true
        }));

        userTotalStaked[msg.sender] += amount;
        totalStaked += amount;

        if (isNewStaker) {
            totalStakers++;
        }

        uint256 stakeIndex = userStakes[msg.sender].length - 1;
        emit Staked(msg.sender, amount, lockPeriod, stakeIndex);

        // Check and emit tier achievement
        Tier newTier = getUserTier(msg.sender);
        if (newTier != Tier.None) {
            emit TierAchieved(msg.sender, newTier, userTotalStaked[msg.sender]);
        }
    }

    /**
     * @notice Unstake BTF tokens. Early unstake incurs a 5% penalty (burned).
     * @param stakeIndex Index of the stake position to unstake
     */
    function unstake(uint256 stakeIndex) external nonReentrant {
        if (stakeIndex >= userStakes[msg.sender].length) {
            revert StakeIndexOutOfBounds(stakeIndex, userStakes[msg.sender].length);
        }

        Stake storage s = userStakes[msg.sender][stakeIndex];
        if (!s.active) revert StakeNotActive(stakeIndex);

        // Calculate pending rewards
        uint256 pendingReward_ = _calculateRewards(s);
        uint256 totalRewards = s.accruedRewards + pendingReward_;

        s.active = false;
        uint256 principal = s.amount;
        uint256 penalty = 0;

        // Early unstake penalty
        if (block.timestamp < s.lockEndsAt) {
            penalty = (principal * earlyUnstakePenaltyBps) / BPS_DENOMINATOR;
            principal -= penalty;
            totalPenaltyBurned += penalty;
            // Burn penalty tokens (send to address(0) equivalent — kept in contract as dead tokens)
            // In production, call BTFToken.burn() if interface available
        }

        // Ensure rewards pool can cover
        if (totalRewards > rewardsPool) {
            totalRewards = rewardsPool; // Cap at available
        }

        uint256 totalPayout = principal + totalRewards;

        userTotalStaked[msg.sender] -= s.amount;
        totalStaked -= s.amount;
        rewardsPool -= totalRewards;
        totalRewardsDistributed += totalRewards;

        if (userTotalStaked[msg.sender] == 0) {
            totalStakers--;
        }

        // Transfer principal + rewards (minus penalty)
        if (totalPayout > 0) {
            btfToken.safeTransfer(msg.sender, totalPayout);
        }

        emit Unstaked(msg.sender, principal, totalRewards, penalty, stakeIndex);
    }

    /**
     * @notice Claim accumulated rewards without unstaking
     * @param stakeIndex Index of the stake position
     */
    function claimRewards(uint256 stakeIndex) external nonReentrant {
        if (stakeIndex >= userStakes[msg.sender].length) {
            revert StakeIndexOutOfBounds(stakeIndex, userStakes[msg.sender].length);
        }

        Stake storage s = userStakes[msg.sender][stakeIndex];
        if (!s.active) revert StakeNotActive(stakeIndex);

        uint256 pendingReward_ = _calculateRewards(s);
        uint256 totalRewards = s.accruedRewards + pendingReward_;

        if (totalRewards == 0) revert ZeroAmount();
        if (totalRewards > rewardsPool) {
            revert InsufficientRewardsPool(totalRewards, rewardsPool);
        }

        s.accruedRewards = 0;
        s.lastRewardCalculation = block.timestamp;
        rewardsPool -= totalRewards;
        totalRewardsDistributed += totalRewards;

        btfToken.safeTransfer(msg.sender, totalRewards);

        emit RewardsClaimed(msg.sender, totalRewards, stakeIndex);
    }

    // ═══════════════════════════════════════════════════════
    //  REWARDS CALCULATION
    // ═══════════════════════════════════════════════════════

    function _calculateRewards(Stake storage s) internal view returns (uint256) {
        if (!s.active) return 0;

        uint256 elapsed = block.timestamp - s.lastRewardCalculation;
        uint256 apyBps = lockPeriodAPY[s.lockPeriod];

        // rewards = (amount × APY × elapsed) / (365 days × 10000)
        return (s.amount * apyBps * elapsed) / (365 days * BPS_DENOMINATOR);
    }

    /**
     * @notice Get pending rewards for a specific stake
     */
    function pendingRewards(address user, uint256 stakeIndex) external view returns (uint256) {
        if (stakeIndex >= userStakes[user].length) return 0;
        Stake storage s = userStakes[user][stakeIndex];
        return s.accruedRewards + _calculateRewards(s);
    }

    // ═══════════════════════════════════════════════════════
    //  TIER SYSTEM
    // ═══════════════════════════════════════════════════════

    function getUserTier(address user) public view returns (Tier) {
        uint256 staked = userTotalStaked[user];
        if (staked >= PLATINUM_THRESHOLD) return Tier.Platinum;
        if (staked >= GOLD_THRESHOLD) return Tier.Gold;
        if (staked >= SILVER_THRESHOLD) return Tier.Silver;
        if (staked >= BRONZE_THRESHOLD) return Tier.Bronze;
        return Tier.None;
    }

    function getTierName(Tier tier) external pure returns (string memory) {
        if (tier == Tier.Platinum) return "Platinum";
        if (tier == Tier.Gold) return "Gold";
        if (tier == Tier.Silver) return "Silver";
        if (tier == Tier.Bronze) return "Bronze";
        return "None";
    }

    // ═══════════════════════════════════════════════════════
    //  REWARDS POOL FUNDING
    // ═══════════════════════════════════════════════════════

    /**
     * @notice Fund the staking rewards pool
     */
    function fundRewardsPool(uint256 amount) external onlyRole(REWARDS_FUNDER_ROLE) {
        if (amount == 0) revert ZeroAmount();
        btfToken.safeTransferFrom(msg.sender, address(this), amount);
        rewardsPool += amount;
        emit RewardsPoolFunded(msg.sender, amount);
    }

    // ═══════════════════════════════════════════════════════
    //  VIEW FUNCTIONS
    // ═══════════════════════════════════════════════════════

    function getUserStakeCount(address user) external view returns (uint256) {
        return userStakes[user].length;
    }

    function getUserStake(address user, uint256 index) external view returns (
        uint256 amount,
        uint256 lockPeriod,
        uint256 stakedAt,
        uint256 lockEndsAt,
        uint256 accruedRewards,
        uint256 pendingReward,
        bool active,
        bool isLocked
    ) {
        Stake storage s = userStakes[user][index];
        return (
            s.amount,
            s.lockPeriod,
            s.stakedAt,
            s.lockEndsAt,
            s.accruedRewards,
            _calculateRewards(s),
            s.active,
            block.timestamp < s.lockEndsAt
        );
    }

    function getVaultStats() external view returns (
        uint256 _totalStaked,
        uint256 _totalStakers,
        uint256 _totalRewardsDistributed,
        uint256 _totalPenaltyBurned,
        uint256 _rewardsPoolBalance
    ) {
        return (totalStaked, totalStakers, totalRewardsDistributed, totalPenaltyBurned, rewardsPool);
    }

    /**
     * @notice Get all active stakes for a user with their tiers and rewards
     */
    function getUserDashboard(address user) external view returns (
        uint256 _totalStaked,
        Tier _tier,
        uint256 _stakeCount,
        uint256 _totalPendingRewards
    ) {
        uint256 totalPending = 0;
        for (uint256 i = 0; i < userStakes[user].length; i++) {
            if (userStakes[user][i].active) {
                totalPending += userStakes[user][i].accruedRewards + _calculateRewards(userStakes[user][i]);
            }
        }
        return (
            userTotalStaked[user],
            getUserTier(user),
            userStakes[user].length,
            totalPending
        );
    }

    // ═══════════════════════════════════════════════════════
    //  ADMIN
    // ═══════════════════════════════════════════════════════

    function setEarlyUnstakePenalty(uint256 _bps) external onlyRole(MANAGER_ROLE) {
        require(_bps <= 1000, "Max 10%");
        earlyUnstakePenaltyBps = _bps;
        emit EarlyUnstakePenaltyUpdated(_bps);
    }

    function setLockPeriodAPY(uint256 lockPeriod, uint256 apyBps) external onlyRole(MANAGER_ROLE) {
        require(apyBps <= 10000, "Max 100% APY");
        lockPeriodAPY[lockPeriod] = apyBps;
    }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    /**
     * @notice Emergency withdraw rewards pool (admin only)
     */
    function emergencyWithdrawRewards(address to) external onlyRole(DEFAULT_ADMIN_ROLE) {
        uint256 amount = rewardsPool;
        rewardsPool = 0;
        btfToken.safeTransfer(to, amount);
    }
}
