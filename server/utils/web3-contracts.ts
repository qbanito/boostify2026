/**
 * Smart Contract Integration para BoostiSwap
 * Integra la tokenización de canciones con el DEX
 * 
 * FEES STRUCTURE:
 * - 10% Tax de Desarrollo en transferencias de tokens
 * - 5% Fee en transacciones de BoostiSwap DEX
 */

// ABIs de Smart Contracts (Solidity)
export const MUSIC_TOKEN_ABI = [
  {
    type: "function",
    name: "mint",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" }
    ],
    outputs: [],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    name: "burn",
    inputs: [{ name: "amount", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    name: "transfer",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" }
    ],
    outputs: [{ type: "bool" }],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    name: "balanceOf",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "setTaxRate",
    inputs: [{ name: "newTaxRate", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    name: "getTaxRate",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view"
  }
];

export const BOOSTISWAP_ROUTER_ABI = [
  {
    type: "function",
    name: "swapExactTokensForTokens",
    inputs: [
      { name: "amountIn", type: "uint256" },
      { name: "amountOutMin", type: "uint256" },
      { name: "path", type: "address[]" },
      { name: "to", type: "address" },
      { name: "deadline", type: "uint256" }
    ],
    outputs: [{ name: "amounts", type: "uint256[]" }],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    name: "addLiquidity",
    inputs: [
      { name: "tokenA", type: "address" },
      { name: "tokenB", type: "address" },
      { name: "amountADesired", type: "uint256" },
      { name: "amountBDesired", type: "uint256" },
      { name: "amountAMin", type: "uint256" },
      { name: "amountBMin", type: "uint256" },
      { name: "to", type: "address" },
      { name: "deadline", type: "uint256" }
    ],
    outputs: [
      { name: "amountA", type: "uint256" },
      { name: "amountB", type: "uint256" },
      { name: "liquidity", type: "uint256" }
    ],
    stateMutability: "nonpayable"
  }
];

export const BOOSTISWAP_FACTORY_ABI = [
  {
    type: "function",
    name: "createPair",
    inputs: [
      { name: "tokenA", type: "address" },
      { name: "tokenB", type: "address" }
    ],
    outputs: [{ name: "pair", type: "address" }],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    name: "getPair",
    inputs: [
      { name: "tokenA", type: "address" },
      { name: "tokenB", type: "address" }
    ],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view"
  }
];

// ============================================
// FEE CONSTANTS
// ============================================

// Token Transfer Fees
export const TOKEN_DEVELOPMENT_TAX = 10; // 10% tax en transferencias de tokens para desarrollo
export const TOKEN_ARTIST_SHARE = 90; // 90% va al artista/destinatario

// DEX Transaction Fees
export const BOOSTISWAP_FEE_PERCENTAGE = 5; // 5% fee en transacciones del DEX para Boostify
export const LP_FEE_PERCENTAGE = 0.25; // 0.25% para proveedores de liquidez
export const PROTOCOL_FEE_PERCENTAGE = 0.05; // 0.05% para DAO

// ============================================
// FEE CALCULATORS
// ============================================

/**
 * Calcula los fees para transferencias de tokens
 * 10% tax de desarrollo para Boostify
 * 90% para el destinatario
 */
export function calculateTokenTransferFees(amount: number) {
  const developmentTax = amount * (TOKEN_DEVELOPMENT_TAX / 100);
  const recipientReceives = amount - developmentTax;
  
  return {
    totalAmount: amount,
    developmentTax,      // 10% para Boostify desarrollo
    recipientReceives,   // 90% para destinatario
    taxPercentage: TOKEN_DEVELOPMENT_TAX
  };
}

/**
 * Calcula los fees para transacciones en BoostiSwap DEX
 * 5% para Boostify
 */
export function calculateDEXFees(amount: number) {
  const boostifyFee = amount * (BOOSTISWAP_FEE_PERCENTAGE / 100);
  const lpFee = amount * (LP_FEE_PERCENTAGE / 100);
  const protocolFee = amount * (PROTOCOL_FEE_PERCENTAGE / 100);
  const artistReceives = amount - boostifyFee;
  
  return {
    totalAmount: amount,
    boostifyFee,         // 5% para Boostify
    lpFee,              // 0.25% para LP providers
    protocolFee,        // 0.05% para DAO
    artistReceives,
    totalFees: boostifyFee + lpFee + protocolFee
  };
}

/**
 * Calcula fees totales (transfer + DEX)
 */
export function calculateTotalFees(amount: number, type: 'transfer' | 'dex' = 'dex') {
  if (type === 'transfer') {
    return calculateTokenTransferFees(amount);
  } else {
    return calculateDEXFees(amount);
  }
}

// Price impact calculator (AMM formula: x*y=k)
export function calculatePriceImpact(
  inputAmount: number,
  inputReserve: number,
  outputReserve: number
): number {
  const outputWithoutFee = (inputAmount * outputReserve) / (inputReserve + inputAmount);
  const priceImpactPercentage = ((inputAmount / inputReserve) * 100);
  return priceImpactPercentage;
}

/**
 * Calcula el output de un swap con 5% DEX fee
 */
export function calculateSwapOutput(
  inputAmount: number,
  inputReserve: number,
  outputReserve: number,
  feePercentage: number = BOOSTISWAP_FEE_PERCENTAGE
) {
  const inputAmountWithFee = inputAmount * (1 - feePercentage / 100);
  const outputAmount = (inputAmountWithFee * outputReserve) / (inputReserve + inputAmountWithFee);
  const priceImpact = calculatePriceImpact(inputAmount, inputReserve, outputReserve);
  
  return {
    outputAmount,
    priceImpact,
    fees: calculateDEXFees(inputAmount)
  };
}
