/**
 * BTF Card Purchase API — Buy BTF tokens with credit/debit card via Stripe
 * 
 * Flow:
 *   1. Client requests a quote (USD → BTF) with their wallet address
 *   2. Server creates Stripe PaymentIntent, stores pending purchase
 *   3. Client completes payment via Stripe Elements
 *   4. Server verifies payment, transfers BTF from treasury to user's wallet
 * 
 * Routes:
 *   GET  /api/btf-card/quote         — Get current BTF price in USD
 *   POST /api/btf-card/create-payment — Create PaymentIntent for BTF purchase  
 *   POST /api/btf-card/verify-payment — Verify payment & trigger BTF transfer
 *   GET  /api/btf-card/purchase-status/:id — Check purchase status
 */

import { Router, type Request, type Response } from 'express';
import Stripe from 'stripe';
import { createPublicClient, createWalletClient, http, fallback, parseUnits, formatUnits } from 'viem';
import { polygon } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { sendTokenPurchaseEmail } from '../services/brevo-email-service.js';

const router = Router();

// ═══════════════════════════════════════════════════════
//  CONFIGURATION
// ═══════════════════════════════════════════════════════

const BTF_TOKEN_ADDRESS = '0x3DF18dAa074D8744cC620a89CFc8b7c4138CEb05' as `0x${string}`;

// Price: 1 BTF = $0.001 USD (1000 BTF per $1)
// This should match MATIC sale rate roughly: 1 MATIC (~$0.40) = 1000 BTF → 1 BTF ≈ $0.0004
// We set a slightly higher price for card purchases to cover Stripe fees + gas
const BTF_PRICE_USD = 0.001; // $0.001 per BTF → $1 = 1000 BTF
const MIN_PURCHASE_USD = 5;   // $5 minimum
const MAX_PURCHASE_USD = 1000; // $1000 maximum

const POLYGON_RPCS = [
  'https://polygon-bor-rpc.publicnode.com',
  'https://polygon-rpc.com',
  'https://1rpc.io/matic',
];

// Stripe
const stripe = new Stripe(process.env.TESTING_STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-01-27.acacia' as any,
});

// BTF ERC-20 transfer ABI
const TRANSFER_ABI = [{
  inputs: [
    { name: 'to', type: 'address' },
    { name: 'amount', type: 'uint256' },
  ],
  name: 'transfer',
  outputs: [{ name: '', type: 'bool' }],
  stateMutability: 'nonpayable',
  type: 'function',
}] as const;

const BALANCE_OF_ABI = [{
  inputs: [{ name: 'account', type: 'address' }],
  name: 'balanceOf',
  outputs: [{ name: '', type: 'uint256' }],
  stateMutability: 'view',
  type: 'function',
}] as const;

// In-memory purchase records (in production use a database)
interface PurchaseRecord {
  id: string;
  paymentIntentId: string;
  walletAddress: string;
  usdAmount: number;
  btfAmount: string;
  status: 'pending' | 'paid' | 'transferring' | 'completed' | 'failed';
  txHash?: string;
  error?: string;
  createdAt: Date;
  completedAt?: Date;
}

const purchases = new Map<string, PurchaseRecord>();

// ═══════════════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════════════

function getPublicClient() {
  return createPublicClient({
    chain: polygon,
    transport: fallback(
      POLYGON_RPCS.map(url => http(url, { timeout: 15000, retryCount: 2 })),
      { rank: true }
    ),
  });
}

function getTreasuryAccount() {
  const pk = process.env.PLATFORM_PRIVATE_KEY;
  if (!pk) throw new Error('PLATFORM_PRIVATE_KEY not configured');
  const formatted = pk.startsWith('0x') ? pk as `0x${string}` : `0x${pk}` as `0x${string}`;
  return privateKeyToAccount(formatted);
}

function getWalletClient() {
  const account = getTreasuryAccount();
  return createWalletClient({
    account,
    chain: polygon,
    transport: fallback(
      POLYGON_RPCS.map(url => http(url, { timeout: 15000, retryCount: 2 })),
      { rank: true }
    ),
  });
}

async function getTreasuryBTFBalance(): Promise<string> {
  const client = getPublicClient();
  const account = getTreasuryAccount();
  const balance = await client.readContract({
    address: BTF_TOKEN_ADDRESS,
    abi: BALANCE_OF_ABI,
    functionName: 'balanceOf',
    args: [account.address],
  });
  return formatUnits(balance, 18);
}

// ═══════════════════════════════════════════════════════
//  ROUTES
// ═══════════════════════════════════════════════════════

/**
 * GET /api/btf-card/quote
 * Get current BTF price and purchase limits
 */
router.get('/quote', async (_req: Request, res: Response) => {
  try {
    const treasuryBalance = await getTreasuryBTFBalance();
    const maxBTFAvailable = parseFloat(treasuryBalance);

    res.json({
      success: true,
      pricePerBTF: BTF_PRICE_USD,
      btfPerDollar: Math.floor(1 / BTF_PRICE_USD),
      minPurchaseUSD: MIN_PURCHASE_USD,
      maxPurchaseUSD: MAX_PURCHASE_USD,
      treasuryAvailable: maxBTFAvailable > 1000000 ? '1000000+' : Math.floor(maxBTFAvailable).toString(),
      currency: 'usd',
    });
  } catch (error: any) {
    console.error('[BTF-Card] Quote error:', error.message);
    res.json({
      success: true,
      pricePerBTF: BTF_PRICE_USD,
      btfPerDollar: Math.floor(1 / BTF_PRICE_USD),
      minPurchaseUSD: MIN_PURCHASE_USD,
      maxPurchaseUSD: MAX_PURCHASE_USD,
      treasuryAvailable: 'unknown',
      currency: 'usd',
    });
  }
});

/**
 * POST /api/btf-card/create-payment
 * Create a Stripe PaymentIntent for BTF purchase
 * 
 * Body: { usdAmount: number, walletAddress: string }
 */
router.post('/create-payment', async (req: Request, res: Response) => {
  try {
    const { usdAmount, walletAddress } = req.body;

    // Validate
    if (!usdAmount || !walletAddress) {
      return res.status(400).json({ error: 'usdAmount and walletAddress are required' });
    }

    if (typeof usdAmount !== 'number' || usdAmount < MIN_PURCHASE_USD || usdAmount > MAX_PURCHASE_USD) {
      return res.status(400).json({
        error: `Amount must be between $${MIN_PURCHASE_USD} and $${MAX_PURCHASE_USD}`,
      });
    }

    if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
      return res.status(400).json({ error: 'Invalid wallet address' });
    }

    // Calculate BTF amount
    const btfAmount = Math.floor(usdAmount / BTF_PRICE_USD);
    const btfAmountWei = parseUnits(btfAmount.toString(), 18);

    // Check treasury has enough BTF
    try {
      const treasuryBalance = await getTreasuryBTFBalance();
      if (parseFloat(treasuryBalance) < btfAmount) {
        return res.status(400).json({ error: 'Insufficient BTF in treasury. Please try a smaller amount.' });
      }
    } catch (e) {
      console.warn('[BTF-Card] Could not verify treasury balance, proceeding anyway');
    }

    // Create Stripe PaymentIntent
    const amountCents = Math.round(usdAmount * 100);
    const purchaseId = `btf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: 'usd',
      metadata: {
        type: 'btf_token_purchase',
        purchaseId,
        walletAddress,
        btfAmount: btfAmount.toString(),
        btfAmountWei: btfAmountWei.toString(),
        pricePerBTF: BTF_PRICE_USD.toString(),
      },
      description: `Purchase ${btfAmount.toLocaleString()} BTF tokens`,
    });

    // Store purchase record
    purchases.set(purchaseId, {
      id: purchaseId,
      paymentIntentId: paymentIntent.id,
      walletAddress,
      usdAmount,
      btfAmount: btfAmount.toString(),
      status: 'pending',
      createdAt: new Date(),
    });

    console.log(`[BTF-Card] Created payment: $${usdAmount} → ${btfAmount} BTF → ${walletAddress}`);

    res.json({
      success: true,
      clientSecret: paymentIntent.client_secret,
      purchaseId,
      btfAmount: btfAmount.toString(),
      usdAmount,
    });
  } catch (error: any) {
    console.error('[BTF-Card] Create payment error:', error);
    res.status(500).json({ error: error.message || 'Failed to create payment' });
  }
});

/**
 * POST /api/btf-card/verify-payment
 * Verify Stripe payment succeeded and transfer BTF tokens
 * 
 * Body: { purchaseId: string, paymentIntentId: string }
 */
router.post('/verify-payment', async (req: Request, res: Response) => {
  try {
    const { purchaseId, paymentIntentId } = req.body;

    if (!purchaseId || !paymentIntentId) {
      return res.status(400).json({ error: 'purchaseId and paymentIntentId are required' });
    }

    // Find purchase record
    const purchase = purchases.get(purchaseId);
    if (!purchase) {
      return res.status(404).json({ error: 'Purchase not found' });
    }

    if (purchase.status === 'completed') {
      return res.json({
        success: true,
        status: 'completed',
        txHash: purchase.txHash,
        btfAmount: purchase.btfAmount,
      });
    }

    // Verify payment with Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    if (paymentIntent.status !== 'succeeded') {
      return res.status(400).json({
        error: `Payment not completed. Status: ${paymentIntent.status}`,
      });
    }

    // Verify it matches our purchase
    if (paymentIntent.metadata.purchaseId !== purchaseId) {
      return res.status(400).json({ error: 'Payment mismatch' });
    }

    // Mark as transferring
    purchase.status = 'transferring';

    // Transfer BTF from treasury to user wallet
    try {
      const walletClient = getWalletClient();
      const publicClient = getPublicClient();
      const btfAmountWei = parseUnits(purchase.btfAmount, 18);

      console.log(`[BTF-Card] Transferring ${purchase.btfAmount} BTF to ${purchase.walletAddress}...`);

      const txHash = await walletClient.writeContract({
        address: BTF_TOKEN_ADDRESS,
        abi: TRANSFER_ABI,
        functionName: 'transfer',
        args: [purchase.walletAddress as `0x${string}`, btfAmountWei],
      });

      console.log(`[BTF-Card] TX submitted: ${txHash}`);

      // Wait for confirmation
      const receipt = await publicClient.waitForTransactionReceipt({
        hash: txHash,
        timeout: 60_000,
      });

      if (receipt.status === 'success') {
        purchase.status = 'completed';
        purchase.txHash = txHash;
        purchase.completedAt = new Date();
        console.log(`[BTF-Card] ✅ Transfer confirmed: ${txHash}`);

        res.json({
          success: true,
          status: 'completed',
          txHash,
          btfAmount: purchase.btfAmount,
          walletAddress: purchase.walletAddress,
        });
      } else {
        purchase.status = 'failed';
        purchase.error = 'Transaction reverted';
        console.error(`[BTF-Card] ❌ Transfer reverted: ${txHash}`);
        res.status(500).json({ error: 'BTF transfer failed on-chain' });
      }
    } catch (transferError: any) {
      purchase.status = 'failed';
      purchase.error = transferError.message;
      console.error('[BTF-Card] Transfer error:', transferError.message);
      res.status(500).json({
        error: 'BTF transfer failed. Payment was received — contact support for manual resolution.',
        paymentIntentId,
      });
    }
  } catch (error: any) {
    console.error('[BTF-Card] Verify payment error:', error);
    res.status(500).json({ error: error.message || 'Verification failed' });
  }
});

/**
 * GET /api/btf-card/purchase-status/:id
 * Check the status of a BTF purchase
 */
router.get('/purchase-status/:id', async (req: Request, res: Response) => {
  const purchase = purchases.get(req.params.id);
  if (!purchase) {
    return res.status(404).json({ error: 'Purchase not found' });
  }

  res.json({
    success: true,
    id: purchase.id,
    status: purchase.status,
    usdAmount: purchase.usdAmount,
    btfAmount: purchase.btfAmount,
    walletAddress: purchase.walletAddress,
    txHash: purchase.txHash || null,
    error: purchase.error || null,
    createdAt: purchase.createdAt,
    completedAt: purchase.completedAt || null,
  });
});

/**
 * POST /api/btf-card/send-purchase-email
 * Send a purchase confirmation / invoice email to the authenticated user.
 * Called from the token-purchase-success page after a successful buy.
 *
 * Body: { txHash, amount, tokenType, artistName, method, usdAmount }
 */
router.post('/send-purchase-email', async (req: Request, res: Response) => {
  try {
    const { txHash, amount, tokenType, artistName, method, usdAmount } = req.body;
    const user = (req as any).user;

    if (!txHash || !amount) {
      return res.status(400).json({ error: 'txHash and amount are required' });
    }

    // Get user email from Clerk auth or body fallback
    const userEmail = user?.email;
    if (!userEmail) {
      return res.status(401).json({ error: 'User email not available. Please log in.' });
    }

    const userName = user?.firstName || user?.username || 'Usuario';
    const isBTF = tokenType !== 'artist';
    const tokenSymbol = isBTF ? 'BTF' : 'BTF-2300';
    const displayArtist = artistName || (isBTF ? 'Boostify Token' : 'Artist Token');

    const result = await sendTokenPurchaseEmail({
      userEmail,
      userName,
      artistName: displayArtist,
      tokenAmount: Number(amount),
      tokenSymbol,
      transactionHash: txHash,
    });

    if (result.success) {
      console.log(`[BTF-Card] ✉️  Invoice email sent to ${userEmail} for ${amount} ${tokenSymbol}`);
      res.json({ success: true });
    } else {
      console.error('[BTF-Card] Email send failed:', result.error);
      res.status(500).json({ error: 'Failed to send email', detail: result.error });
    }
  } catch (error: any) {
    console.error('[BTF-Card] Send email error:', error);
    res.status(500).json({ error: error.message || 'Email send failed' });
  }
});

export default router;
