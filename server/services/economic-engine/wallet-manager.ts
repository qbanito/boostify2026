/**
 * BOOSTIFY ECONOMIC ENGINE — Wallet Manager
 * Manages treasury wallets, approvals, and multi-sig operations
 * Handles ERC-20 token approvals and transfers securely
 */

import { ethers } from 'ethers';
import { getProvider, getSigner, POLYGON_ADDRESSES, getTokenBalance, getMaticBalance } from './blockchain-provider';

// ============================================
// ERC-20 ABI (minimal)
// ============================================

const ERC20_ABI = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function transferFrom(address from, address to, uint256 amount) returns (bool)',
];

// ============================================
// WALLET MANAGER
// ============================================

export class WalletManager {
  private signer: ethers.Wallet;

  constructor() {
    this.signer = getSigner();
  }

  get address(): string {
    return this.signer.address;
  }

  // ── Balance Queries ──

  async getWalletBalances(): Promise<{
    matic: string;
    usdc: string;
    usdt: string;
    weth: string;
    btf: string;
  }> {
    const addr = this.address;
    const [matic, usdc, usdt, weth] = await Promise.all([
      getMaticBalance(addr),
      getTokenBalance(POLYGON_ADDRESSES.USDC, addr),
      getTokenBalance(POLYGON_ADDRESSES.USDT, addr),
      getTokenBalance(POLYGON_ADDRESSES.WETH, addr),
    ]);

    let btf = 0n;
    if (POLYGON_ADDRESSES.BTF_TOKEN) {
      btf = await getTokenBalance(POLYGON_ADDRESSES.BTF_TOKEN, addr);
    }

    return {
      matic: ethers.formatEther(matic),
      usdc: ethers.formatUnits(usdc, 6),
      usdt: ethers.formatUnits(usdt, 6),
      weth: ethers.formatEther(weth),
      btf: ethers.formatEther(btf), // Assuming 18 decimals
    };
  }

  // ── Token Operations ──

  async approveToken(
    tokenAddress: string,
    spenderAddress: string,
    amount: bigint
  ): Promise<ethers.TransactionReceipt | null> {
    const contract = new ethers.Contract(tokenAddress, ERC20_ABI, this.signer);
    const tx = await contract.approve(spenderAddress, amount);
    return tx.wait();
  }

  async transferToken(
    tokenAddress: string,
    toAddress: string,
    amount: bigint
  ): Promise<ethers.TransactionReceipt | null> {
    const contract = new ethers.Contract(tokenAddress, ERC20_ABI, this.signer);
    const tx = await contract.transfer(toAddress, amount);
    return tx.wait();
  }

  async checkAllowance(
    tokenAddress: string,
    spenderAddress: string
  ): Promise<bigint> {
    const provider = getProvider();
    const contract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
    return contract.allowance(this.address, spenderAddress);
  }

  async ensureAllowance(
    tokenAddress: string,
    spenderAddress: string,
    requiredAmount: bigint
  ): Promise<boolean> {
    const currentAllowance = await this.checkAllowance(tokenAddress, spenderAddress);
    if (currentAllowance >= requiredAmount) return true;

    // Approve max to avoid repeated approvals
    const maxApproval = ethers.MaxUint256;
    const receipt = await this.approveToken(tokenAddress, spenderAddress, maxApproval);
    return receipt !== null && receipt.status === 1;
  }

  // ── gas safety check ──

  async hasEnoughGas(estimatedGas: bigint = 500000n): Promise<boolean> {
    const balance = await getMaticBalance(this.address);
    const gasPrice = (await getProvider().getFeeData()).gasPrice || 0n;
    const gasCost = estimatedGas * gasPrice * 2n; // 2x safety margin
    return balance > gasCost;
  }

  // ── Token info ──

  async getTokenInfo(tokenAddress: string): Promise<{
    name: string;
    symbol: string;
    decimals: number;
    totalSupply: string;
  }> {
    const provider = getProvider();
    const contract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
    const [name, symbol, decimals, totalSupply] = await Promise.all([
      contract.name(),
      contract.symbol(),
      contract.decimals(),
      contract.totalSupply(),
    ]);
    return {
      name,
      symbol,
      decimals: Number(decimals),
      totalSupply: ethers.formatUnits(totalSupply, decimals),
    };
  }
}

// ── Singleton ──
let _walletManager: WalletManager | null = null;

export function getWalletManager(): WalletManager {
  if (!_walletManager) {
    _walletManager = new WalletManager();
  }
  return _walletManager;
}
