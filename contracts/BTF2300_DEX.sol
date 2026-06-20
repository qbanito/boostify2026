// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

/**
 * @title BTF-2300 DEX - Decentralized Exchange for Music Tokens
 * @author Boostify Music
 * @notice DEX for trading BTF-2300 artist and song tokens
 * @dev Implements AMM (Automated Market Maker) with:
 *   - Liquidity pools for token trading
 *   - Slippage protection against sandwich attacks
 *   - Rate limiting for flash loan protection
 *   - Multi-token support (ERC-1155)
 */
contract BTF2300DEX is AccessControl, ReentrancyGuard, Pausable {
    
    // ==================== CONSTANTS ====================
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    
    uint256 public constant FEE_BPS = 30; // 0.3% trading fee
    uint256 public constant BPS_DENOMINATOR = 10000;
    uint256 public constant MIN_LIQUIDITY = 1000;

    // ==================== STATE VARIABLES ====================
    
    // BTF-2300 Token contract address
    IERC1155 public btfToken;
    address public feeRecipient;
    
    // Pool structure
    struct LiquidityPool {
        uint256 tokenReserve;      // BTF token reserve
        uint256 ethReserve;        // ETH reserve
        uint256 totalLPTokens;     // Total LP tokens issued
        uint256 feeAccumulated;    // Fees collected
        bool isActive;
        uint256 createdAt;
    }
    
    // Order structure for limit orders
    struct Order {
        uint256 orderId;
        address maker;
        uint256 tokenId;
        uint256 tokenAmount;
        uint256 ethAmount;
        bool isBuyOrder;
        bool isFilled;
        bool isCancelled;
        uint256 createdAt;
    }
    
    // Mappings
    mapping(uint256 => LiquidityPool) public pools; // tokenId => pool
    mapping(uint256 => mapping(address => uint256)) public lpBalances; // tokenId => provider => balance
    mapping(uint256 => Order) public orders; // orderId => order
    mapping(address => uint256[]) public userOrders; // user => orderIds[]
    
    // Security mappings
    mapping(address => uint256) public lastTradeBlock;
    mapping(address => uint256) public dailyVolume;
    mapping(address => uint256) public lastVolumeReset;
    
    // Order counter
    uint256 private _orderIdCounter;
    
    // Daily volume limit per user (anti-manipulation)
    uint256 public maxDailyVolumePerUser = 100 ether;

    // ==================== EVENTS ====================
    
    event PoolCreated(uint256 indexed tokenId, uint256 initialTokens, uint256 initialEth);
    event LiquidityAdded(uint256 indexed tokenId, address indexed provider, uint256 tokensAdded, uint256 ethAdded, uint256 lpTokens);
    event LiquidityRemoved(uint256 indexed tokenId, address indexed provider, uint256 tokensRemoved, uint256 ethRemoved, uint256 lpTokens);
    event TokenSwap(uint256 indexed tokenId, address indexed trader, bool isBuy, uint256 tokenAmount, uint256 ethAmount, uint256 fee);
    event OrderCreated(uint256 indexed orderId, address indexed maker, uint256 tokenId, uint256 tokenAmount, uint256 ethAmount, bool isBuyOrder);
    event OrderFilled(uint256 indexed orderId, address indexed taker, uint256 tokenAmount, uint256 ethAmount);
    event OrderCancelled(uint256 indexed orderId);
    event FeeCollected(uint256 indexed tokenId, uint256 amount);

    // ==================== CONSTRUCTOR ====================
    
    constructor(address _btfToken, address _feeRecipient) {
        require(_btfToken != address(0), "Invalid token address");
        require(_feeRecipient != address(0), "Invalid fee recipient");
        
        btfToken = IERC1155(_btfToken);
        feeRecipient = _feeRecipient;
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(OPERATOR_ROLE, msg.sender);
    }

    // ==================== LIQUIDITY POOL FUNCTIONS ====================
    
    /**
     * @notice Create a new liquidity pool for a token
     * @param tokenId BTF-2300 token ID
     * @param tokenAmount Initial tokens to deposit
     */
    function createPool(uint256 tokenId, uint256 tokenAmount)
        external
        payable
        nonReentrant
        whenNotPaused
    {
        require(pools[tokenId].createdAt == 0, "Pool already exists");
        require(tokenAmount > 0 && msg.value > 0, "Invalid amounts");
        
        // Transfer tokens from creator
        btfToken.safeTransferFrom(msg.sender, address(this), tokenId, tokenAmount, "");
        
        // Calculate initial LP tokens (geometric mean)
        uint256 lpTokens = _sqrt(tokenAmount * msg.value);
        require(lpTokens >= MIN_LIQUIDITY, "Insufficient initial liquidity");
        
        pools[tokenId] = LiquidityPool({
            tokenReserve: tokenAmount,
            ethReserve: msg.value,
            totalLPTokens: lpTokens,
            feeAccumulated: 0,
            isActive: true,
            createdAt: block.timestamp
        });
        
        lpBalances[tokenId][msg.sender] = lpTokens;
        
        emit PoolCreated(tokenId, tokenAmount, msg.value);
        emit LiquidityAdded(tokenId, msg.sender, tokenAmount, msg.value, lpTokens);
    }
    
    /**
     * @notice Add liquidity to existing pool
     * @param tokenId Token ID
     * @param tokenAmount Tokens to add
     * @param minLPTokens Minimum LP tokens expected (slippage protection)
     * @param deadline Transaction deadline
     */
    function addLiquidity(
        uint256 tokenId,
        uint256 tokenAmount,
        uint256 minLPTokens,
        uint256 deadline
    )
        external
        payable
        nonReentrant
        whenNotPaused
        returns (uint256 lpTokens)
    {
        require(block.timestamp <= deadline, "Transaction expired");
        
        LiquidityPool storage pool = pools[tokenId];
        require(pool.isActive, "Pool not active");
        require(tokenAmount > 0 && msg.value > 0, "Invalid amounts");
        
        // Calculate proportional amounts
        uint256 ethRequired = (tokenAmount * pool.ethReserve) / pool.tokenReserve;
        require(msg.value >= ethRequired, "Insufficient ETH");
        
        // Calculate LP tokens
        lpTokens = (tokenAmount * pool.totalLPTokens) / pool.tokenReserve;
        require(lpTokens >= minLPTokens, "Slippage too high");
        
        // Transfer tokens
        btfToken.safeTransferFrom(msg.sender, address(this), tokenId, tokenAmount, "");
        
        // Update pool
        pool.tokenReserve += tokenAmount;
        pool.ethReserve += ethRequired;
        pool.totalLPTokens += lpTokens;
        
        lpBalances[tokenId][msg.sender] += lpTokens;
        
        // Refund excess ETH
        if (msg.value > ethRequired) {
            (bool success,) = payable(msg.sender).call{value: msg.value - ethRequired}("");
            require(success, "ETH refund failed");
        }
        
        emit LiquidityAdded(tokenId, msg.sender, tokenAmount, ethRequired, lpTokens);
        
        return lpTokens;
    }
    
    /**
     * @notice Remove liquidity from pool
     * @param tokenId Token ID
     * @param lpTokenAmount LP tokens to burn
     * @param minTokens Minimum tokens expected
     * @param minEth Minimum ETH expected
     * @param deadline Transaction deadline
     */
    function removeLiquidity(
        uint256 tokenId,
        uint256 lpTokenAmount,
        uint256 minTokens,
        uint256 minEth,
        uint256 deadline
    )
        external
        nonReentrant
        whenNotPaused
        returns (uint256 tokenAmount, uint256 ethAmount)
    {
        require(block.timestamp <= deadline, "Transaction expired");
        require(lpBalances[tokenId][msg.sender] >= lpTokenAmount, "Insufficient LP balance");
        
        LiquidityPool storage pool = pools[tokenId];
        require(pool.isActive, "Pool not active");
        
        // Calculate amounts
        tokenAmount = (lpTokenAmount * pool.tokenReserve) / pool.totalLPTokens;
        ethAmount = (lpTokenAmount * pool.ethReserve) / pool.totalLPTokens;
        
        require(tokenAmount >= minTokens && ethAmount >= minEth, "Slippage too high");
        
        // Update state BEFORE transfers
        lpBalances[tokenId][msg.sender] -= lpTokenAmount;
        pool.tokenReserve -= tokenAmount;
        pool.ethReserve -= ethAmount;
        pool.totalLPTokens -= lpTokenAmount;
        
        // Transfer tokens
        btfToken.safeTransferFrom(address(this), msg.sender, tokenId, tokenAmount, "");
        
        // Transfer ETH
        (bool success,) = payable(msg.sender).call{value: ethAmount}("");
        require(success, "ETH transfer failed");
        
        emit LiquidityRemoved(tokenId, msg.sender, tokenAmount, ethAmount, lpTokenAmount);
        
        return (tokenAmount, ethAmount);
    }

    // ==================== SWAP FUNCTIONS ====================
    
    /**
     * @notice Buy tokens with ETH
     * @param tokenId Token to buy
     * @param minTokensOut Minimum tokens expected (slippage protection)
     * @param deadline Transaction deadline
     */
    function buyTokens(
        uint256 tokenId,
        uint256 minTokensOut,
        uint256 deadline
    )
        external
        payable
        nonReentrant
        whenNotPaused
        returns (uint256 tokensOut)
    {
        require(block.timestamp <= deadline, "Transaction expired");
        require(block.number > lastTradeBlock[msg.sender], "Wait 1 block");
        require(msg.value > 0, "No ETH sent");
        
        _checkVolumeLimit(msg.sender, msg.value);
        
        LiquidityPool storage pool = pools[tokenId];
        require(pool.isActive, "Pool not active");
        
        // Calculate tokens out using constant product formula
        uint256 fee = (msg.value * FEE_BPS) / BPS_DENOMINATOR;
        uint256 ethIn = msg.value - fee;
        
        tokensOut = (ethIn * pool.tokenReserve) / (pool.ethReserve + ethIn);
        require(tokensOut >= minTokensOut, "Slippage too high");
        require(tokensOut <= pool.tokenReserve, "Insufficient liquidity");
        
        // Update state
        lastTradeBlock[msg.sender] = block.number;
        pool.ethReserve += ethIn;
        pool.tokenReserve -= tokensOut;
        pool.feeAccumulated += fee;
        
        // Transfer tokens
        btfToken.safeTransferFrom(address(this), msg.sender, tokenId, tokensOut, "");
        
        // Transfer fee
        (bool feeSuccess,) = payable(feeRecipient).call{value: fee}("");
        require(feeSuccess, "Fee transfer failed");
        
        emit TokenSwap(tokenId, msg.sender, true, tokensOut, msg.value, fee);
        emit FeeCollected(tokenId, fee);
        
        return tokensOut;
    }
    
    /**
     * @notice Sell tokens for ETH
     * @param tokenId Token to sell
     * @param tokenAmount Tokens to sell
     * @param minEthOut Minimum ETH expected
     * @param deadline Transaction deadline
     */
    function sellTokens(
        uint256 tokenId,
        uint256 tokenAmount,
        uint256 minEthOut,
        uint256 deadline
    )
        external
        nonReentrant
        whenNotPaused
        returns (uint256 ethOut)
    {
        require(block.timestamp <= deadline, "Transaction expired");
        require(block.number > lastTradeBlock[msg.sender], "Wait 1 block");
        require(tokenAmount > 0, "Invalid amount");
        
        LiquidityPool storage pool = pools[tokenId];
        require(pool.isActive, "Pool not active");
        
        // Calculate ETH out
        uint256 rawEthOut = (tokenAmount * pool.ethReserve) / (pool.tokenReserve + tokenAmount);
        uint256 fee = (rawEthOut * FEE_BPS) / BPS_DENOMINATOR;
        ethOut = rawEthOut - fee;
        
        require(ethOut >= minEthOut, "Slippage too high");
        require(ethOut <= pool.ethReserve, "Insufficient liquidity");
        
        _checkVolumeLimit(msg.sender, ethOut);
        
        // Update state
        lastTradeBlock[msg.sender] = block.number;
        pool.tokenReserve += tokenAmount;
        pool.ethReserve -= rawEthOut;
        pool.feeAccumulated += fee;
        
        // Transfer tokens from seller
        btfToken.safeTransferFrom(msg.sender, address(this), tokenId, tokenAmount, "");
        
        // Transfer ETH to seller
        (bool success,) = payable(msg.sender).call{value: ethOut}("");
        require(success, "ETH transfer failed");
        
        // Transfer fee
        (bool feeSuccess,) = payable(feeRecipient).call{value: fee}("");
        require(feeSuccess, "Fee transfer failed");
        
        emit TokenSwap(tokenId, msg.sender, false, tokenAmount, ethOut, fee);
        emit FeeCollected(tokenId, fee);
        
        return ethOut;
    }

    // ==================== LIMIT ORDERS ====================
    
    /**
     * @notice Create a limit buy order
     */
    function createBuyOrder(uint256 tokenId, uint256 tokenAmount)
        external
        payable
        nonReentrant
        whenNotPaused
        returns (uint256 orderId)
    {
        require(msg.value > 0 && tokenAmount > 0, "Invalid amounts");
        
        _orderIdCounter++;
        orderId = _orderIdCounter;
        
        orders[orderId] = Order({
            orderId: orderId,
            maker: msg.sender,
            tokenId: tokenId,
            tokenAmount: tokenAmount,
            ethAmount: msg.value,
            isBuyOrder: true,
            isFilled: false,
            isCancelled: false,
            createdAt: block.timestamp
        });
        
        userOrders[msg.sender].push(orderId);
        
        emit OrderCreated(orderId, msg.sender, tokenId, tokenAmount, msg.value, true);
        
        return orderId;
    }
    
    /**
     * @notice Create a limit sell order
     */
    function createSellOrder(uint256 tokenId, uint256 tokenAmount, uint256 ethAmount)
        external
        nonReentrant
        whenNotPaused
        returns (uint256 orderId)
    {
        require(tokenAmount > 0 && ethAmount > 0, "Invalid amounts");
        
        // Transfer tokens to contract
        btfToken.safeTransferFrom(msg.sender, address(this), tokenId, tokenAmount, "");
        
        _orderIdCounter++;
        orderId = _orderIdCounter;
        
        orders[orderId] = Order({
            orderId: orderId,
            maker: msg.sender,
            tokenId: tokenId,
            tokenAmount: tokenAmount,
            ethAmount: ethAmount,
            isBuyOrder: false,
            isFilled: false,
            isCancelled: false,
            createdAt: block.timestamp
        });
        
        userOrders[msg.sender].push(orderId);
        
        emit OrderCreated(orderId, msg.sender, tokenId, tokenAmount, ethAmount, false);
        
        return orderId;
    }
    
    /**
     * @notice Fill a limit order
     */
    function fillOrder(uint256 orderId)
        external
        payable
        nonReentrant
        whenNotPaused
    {
        Order storage order = orders[orderId];
        require(!order.isFilled && !order.isCancelled, "Order not available");
        require(order.maker != msg.sender, "Cannot fill own order");
        
        if (order.isBuyOrder) {
            // Taker is selling tokens, receives ETH
            btfToken.safeTransferFrom(msg.sender, order.maker, order.tokenId, order.tokenAmount, "");
            
            (bool success,) = payable(msg.sender).call{value: order.ethAmount}("");
            require(success, "ETH transfer failed");
        } else {
            // Taker is buying tokens, pays ETH
            require(msg.value >= order.ethAmount, "Insufficient ETH");
            
            btfToken.safeTransferFrom(address(this), msg.sender, order.tokenId, order.tokenAmount, "");
            
            (bool success,) = payable(order.maker).call{value: order.ethAmount}("");
            require(success, "ETH transfer failed");
            
            // Refund excess
            if (msg.value > order.ethAmount) {
                (bool refundSuccess,) = payable(msg.sender).call{value: msg.value - order.ethAmount}("");
                require(refundSuccess, "Refund failed");
            }
        }
        
        order.isFilled = true;
        
        emit OrderFilled(orderId, msg.sender, order.tokenAmount, order.ethAmount);
    }
    
    /**
     * @notice Cancel an order
     */
    function cancelOrder(uint256 orderId)
        external
        nonReentrant
    {
        Order storage order = orders[orderId];
        require(order.maker == msg.sender, "Not order maker");
        require(!order.isFilled && !order.isCancelled, "Order not active");
        
        order.isCancelled = true;
        
        if (order.isBuyOrder) {
            // Refund ETH
            (bool success,) = payable(msg.sender).call{value: order.ethAmount}("");
            require(success, "ETH refund failed");
        } else {
            // Return tokens
            btfToken.safeTransferFrom(address(this), msg.sender, order.tokenId, order.tokenAmount, "");
        }
        
        emit OrderCancelled(orderId);
    }

    // ==================== VIEW FUNCTIONS ====================
    
    function getPoolInfo(uint256 tokenId)
        external
        view
        returns (
            uint256 tokenReserve,
            uint256 ethReserve,
            uint256 totalLPTokens,
            uint256 feeAccumulated,
            bool isActive
        )
    {
        LiquidityPool storage pool = pools[tokenId];
        return (
            pool.tokenReserve,
            pool.ethReserve,
            pool.totalLPTokens,
            pool.feeAccumulated,
            pool.isActive
        );
    }
    
    function getExpectedTokensOut(uint256 tokenId, uint256 ethIn)
        external
        view
        returns (uint256)
    {
        LiquidityPool storage pool = pools[tokenId];
        if (!pool.isActive) return 0;
        
        uint256 fee = (ethIn * FEE_BPS) / BPS_DENOMINATOR;
        uint256 ethAfterFee = ethIn - fee;
        
        return (ethAfterFee * pool.tokenReserve) / (pool.ethReserve + ethAfterFee);
    }
    
    function getExpectedEthOut(uint256 tokenId, uint256 tokenIn)
        external
        view
        returns (uint256)
    {
        LiquidityPool storage pool = pools[tokenId];
        if (!pool.isActive) return 0;
        
        uint256 rawEth = (tokenIn * pool.ethReserve) / (pool.tokenReserve + tokenIn);
        uint256 fee = (rawEth * FEE_BPS) / BPS_DENOMINATOR;
        
        return rawEth - fee;
    }
    
    function getUserOrders(address user) external view returns (uint256[] memory) {
        return userOrders[user];
    }
    
    function getLPBalance(uint256 tokenId, address provider) external view returns (uint256) {
        return lpBalances[tokenId][provider];
    }

    // ==================== ADMIN FUNCTIONS ====================
    
    function setMaxDailyVolume(uint256 newLimit) external onlyRole(ADMIN_ROLE) {
        maxDailyVolumePerUser = newLimit;
    }
    
    function setFeeRecipient(address newRecipient) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newRecipient != address(0), "Invalid address");
        feeRecipient = newRecipient;
    }
    
    function togglePoolActive(uint256 tokenId, bool active) external onlyRole(ADMIN_ROLE) {
        pools[tokenId].isActive = active;
    }
    
    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }
    
    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }

    // ==================== INTERNAL FUNCTIONS ====================
    
    function _checkVolumeLimit(address user, uint256 amount) internal {
        if (block.timestamp >= lastVolumeReset[user] + 1 days) {
            dailyVolume[user] = 0;
            lastVolumeReset[user] = block.timestamp;
        }
        
        dailyVolume[user] += amount;
        require(dailyVolume[user] <= maxDailyVolumePerUser, "Daily volume exceeded");
    }
    
    function _sqrt(uint256 y) internal pure returns (uint256 z) {
        if (y > 3) {
            z = y;
            uint256 x = y / 2 + 1;
            while (x < z) {
                z = x;
                x = (y / x + x) / 2;
            }
        } else if (y != 0) {
            z = 1;
        }
    }
    
    // Required for ERC1155 receiver
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
    
    receive() external payable {}
}
