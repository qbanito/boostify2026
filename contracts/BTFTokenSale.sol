// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

/**
 * @title BTFTokenSale — Direct BTF Token Purchase with MATIC
 * @author Boostify Music
 * @notice Allows users to buy BTF tokens directly with MATIC at a configurable rate.
 *         No DEX liquidity pool required — tokens are sold from the contract's BTF balance.
 *
 * Flow:
 *   1. Owner deposits BTF tokens into this contract
 *   2. Owner sets the rate (BTF per 1 MATIC, in 18-decimal precision)
 *   3. Users call buyTokens() with MATIC → receive BTF
 *   4. Owner can withdraw collected MATIC and unsold BTF at any time
 *
 * NOTE: If BTFToken has a transfer burn tax, exclude this contract's address
 *       from fees via BTFToken.setExcludedFromFees(saleContract, true)
 *       so buyers receive the full amount.
 */
contract BTFTokenSale is Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // ─── State ──────────────────────────────────────────
    IERC20 public immutable btfToken;

    /// @notice BTF tokens per 1 MATIC (scaled to 18 decimals).
    ///         Example: rate = 1000e18 means 1 MATIC = 1,000 BTF
    uint256 public rate;

    /// @notice Minimum purchase in MATIC (wei). Default: 0.1 MATIC
    uint256 public minPurchase = 0.1 ether;

    /// @notice Maximum purchase in MATIC (wei) per tx. Default: 10,000 MATIC
    uint256 public maxPurchase = 10_000 ether;

    /// @notice Total MATIC raised
    uint256 public totalMaticRaised;

    /// @notice Total BTF sold
    uint256 public totalBTFSold;

    /// @notice Total number of purchases
    uint256 public totalPurchases;

    /// @notice Per-wallet purchase tracking
    mapping(address => uint256) public purchasedByWallet;

    // ─── Events ─────────────────────────────────────────
    event TokensPurchased(
        address indexed buyer,
        uint256 maticPaid,
        uint256 btfReceived,
        uint256 timestamp
    );
    event RateUpdated(uint256 oldRate, uint256 newRate);
    event LimitsUpdated(uint256 minPurchase, uint256 maxPurchase);
    event MATICWithdrawn(address indexed to, uint256 amount);
    event BTFWithdrawn(address indexed to, uint256 amount);
    event BTFDeposited(address indexed from, uint256 amount);

    // ─── Errors ─────────────────────────────────────────
    error ZeroRate();
    error ZeroAmount();
    error BelowMinPurchase(uint256 sent, uint256 minimum);
    error AboveMaxPurchase(uint256 sent, uint256 maximum);
    error InsufficientBTFBalance(uint256 requested, uint256 available);

    // ─── Constructor ────────────────────────────────────
    /**
     * @param _btfToken Address of the BTF ERC-20 token
     * @param _rate     Initial rate: BTF per 1 MATIC (18 decimals)
     *                  e.g., 1000 * 10**18 = 1 MATIC buys 1000 BTF
     */
    constructor(address _btfToken, uint256 _rate) {
        require(_btfToken != address(0), "Invalid token address");
        if (_rate == 0) revert ZeroRate();

        btfToken = IERC20(_btfToken);
        rate = _rate;
    }

    // ═══════════════════════════════════════════════════════
    //  PUBLIC — BUY TOKENS
    // ═══════════════════════════════════════════════════════

    /**
     * @notice Buy BTF tokens with MATIC. Send MATIC with this call.
     * @return btfAmount The amount of BTF tokens received
     */
    function buyTokens() external payable nonReentrant whenNotPaused returns (uint256 btfAmount) {
        if (msg.value == 0) revert ZeroAmount();
        if (msg.value < minPurchase) revert BelowMinPurchase(msg.value, minPurchase);
        if (msg.value > maxPurchase) revert AboveMaxPurchase(msg.value, maxPurchase);

        // Calculate BTF amount: (maticAmount * rate) / 1e18
        btfAmount = (msg.value * rate) / 1 ether;

        uint256 available = btfToken.balanceOf(address(this));
        if (available < btfAmount) revert InsufficientBTFBalance(btfAmount, available);

        // Transfer BTF to buyer
        btfToken.safeTransfer(msg.sender, btfAmount);

        // Update stats
        totalMaticRaised += msg.value;
        totalBTFSold += btfAmount;
        totalPurchases += 1;
        purchasedByWallet[msg.sender] += btfAmount;

        emit TokensPurchased(msg.sender, msg.value, btfAmount, block.timestamp);
    }

    // ═══════════════════════════════════════════════════════
    //  VIEW — QUOTE
    // ═══════════════════════════════════════════════════════

    /**
     * @notice Get the BTF amount for a given MATIC amount (quote)
     * @param maticAmount MATIC amount in wei
     * @return btfAmount BTF amount to be received
     * @return isAvailable Whether the contract has enough BTF
     */
    function getQuote(uint256 maticAmount) external view returns (uint256 btfAmount, bool isAvailable) {
        btfAmount = (maticAmount * rate) / 1 ether;
        isAvailable = btfToken.balanceOf(address(this)) >= btfAmount;
    }

    /**
     * @notice Get sale info for the frontend
     */
    function getSaleInfo() external view returns (
        uint256 _rate,
        uint256 _minPurchase,
        uint256 _maxPurchase,
        uint256 _btfAvailable,
        uint256 _totalRaised,
        uint256 _totalSold,
        uint256 _totalPurchases,
        bool _isPaused
    ) {
        return (
            rate,
            minPurchase,
            maxPurchase,
            btfToken.balanceOf(address(this)),
            totalMaticRaised,
            totalBTFSold,
            totalPurchases,
            paused()
        );
    }

    // ═══════════════════════════════════════════════════════
    //  ADMIN FUNCTIONS
    // ═══════════════════════════════════════════════════════

    /**
     * @notice Update the BTF/MATIC rate
     * @param _newRate New rate (BTF per 1 MATIC, 18 decimals)
     */
    function setRate(uint256 _newRate) external onlyOwner {
        if (_newRate == 0) revert ZeroRate();
        uint256 old = rate;
        rate = _newRate;
        emit RateUpdated(old, _newRate);
    }

    /**
     * @notice Update purchase limits
     */
    function setLimits(uint256 _minPurchase, uint256 _maxPurchase) external onlyOwner {
        require(_maxPurchase >= _minPurchase, "Max must be >= min");
        minPurchase = _minPurchase;
        maxPurchase = _maxPurchase;
        emit LimitsUpdated(_minPurchase, _maxPurchase);
    }

    /**
     * @notice Pause the sale
     */
    function pause() external onlyOwner { _pause(); }

    /**
     * @notice Unpause the sale
     */
    function unpause() external onlyOwner { _unpause(); }

    /**
     * @notice Withdraw collected MATIC to owner
     */
    function withdrawMATIC() external onlyOwner {
        uint256 bal = address(this).balance;
        require(bal > 0, "No MATIC to withdraw");
        (bool ok, ) = payable(owner()).call{value: bal}("");
        require(ok, "MATIC transfer failed");
        emit MATICWithdrawn(owner(), bal);
    }

    /**
     * @notice Withdraw unsold BTF tokens to owner
     */
    function withdrawBTF(uint256 amount) external onlyOwner {
        uint256 available = btfToken.balanceOf(address(this));
        require(amount <= available, "Exceeds balance");
        btfToken.safeTransfer(owner(), amount);
        emit BTFWithdrawn(owner(), amount);
    }

    /**
     * @notice Withdraw all unsold BTF + MATIC (emergency)
     */
    function emergencyWithdraw() external onlyOwner {
        uint256 btfBal = btfToken.balanceOf(address(this));
        if (btfBal > 0) {
            btfToken.safeTransfer(owner(), btfBal);
            emit BTFWithdrawn(owner(), btfBal);
        }
        uint256 maticBal = address(this).balance;
        if (maticBal > 0) {
            (bool ok, ) = payable(owner()).call{value: maticBal}("");
            require(ok, "MATIC transfer failed");
            emit MATICWithdrawn(owner(), maticBal);
        }
    }

    /// @notice Accept direct MATIC transfers (treated as buyTokens)
    receive() external payable {
        // Direct MATIC send → auto-buy
        if (msg.value > 0 && !paused()) {
            uint256 btfAmount = (msg.value * rate) / 1 ether;
            uint256 available = btfToken.balanceOf(address(this));
            if (available >= btfAmount && msg.value >= minPurchase && msg.value <= maxPurchase) {
                btfToken.safeTransfer(msg.sender, btfAmount);
                totalMaticRaised += msg.value;
                totalBTFSold += btfAmount;
                totalPurchases += 1;
                purchasedByWallet[msg.sender] += btfAmount;
                emit TokensPurchased(msg.sender, msg.value, btfAmount, block.timestamp);
            }
            // If conditions not met, MATIC stays in contract for owner to withdraw
        }
    }
}
