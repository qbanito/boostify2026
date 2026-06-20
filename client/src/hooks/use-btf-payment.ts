/**
 * useBTFPayment — Tier-aware payment hook for all Boostify services
 * 
 * Wraps useBTFToken().payForService with:
 * - Automatic tier discount calculation
 * - Balance validation
 * - Payment state machine (idle → confirming → paying → success/error)
 * - Transaction receipt tracking
 */

import { useState, useCallback, useMemo } from 'react';
import { useBTFToken } from './use-btf-token';
import { useWeb3 } from './use-web3';
import {
  BTF_SERVICE_PRICES,
  calculateServicePrice,
  type BTFServiceId,
  type PriceCalculation,
} from '@/lib/btf-service-pricing';
import type { StakingTier } from '@/lib/btf-token-config';

export type PaymentStatus = 'idle' | 'confirming' | 'paying' | 'success' | 'error';

export interface PaymentResult {
  txHash: string | null;
  serviceId: BTFServiceId;
  amountPaid: number;
  burnedAmount: number;
  status: 'success' | 'error';
  error?: string;
}

export function useBTFPayment() {
  const { payForService, balance, userDashboard, isLoading: tokenLoading, refreshAll } = useBTFToken();
  const { isConnected, address } = useWeb3();

  const [status, setStatus] = useState<PaymentStatus>('idle');
  const [lastResult, setLastResult] = useState<PaymentResult | null>(null);
  const [pendingService, setPendingService] = useState<BTFServiceId | null>(null);

  // Current user tier (from staking dashboard)
  const userTier: StakingTier = useMemo(() => {
    return userDashboard?.tier || 'None';
  }, [userDashboard]);

  const btfBalance = useMemo(() => parseFloat(balance) || 0, [balance]);

  /**
   * Get pricing info for a service (with tier discount)
   */
  const getPrice = useCallback((serviceId: BTFServiceId): PriceCalculation => {
    return calculateServicePrice(serviceId, userTier);
  }, [userTier]);

  /**
   * Check if user can afford a service
   */
  const canAfford = useCallback((serviceId: BTFServiceId): boolean => {
    const { finalPrice } = calculateServicePrice(serviceId, userTier);
    return btfBalance >= finalPrice;
  }, [userTier, btfBalance]);

  /**
   * Initiate payment for a service
   * Returns txHash on success, null on failure
   */
  const payForBTFService = useCallback(async (
    serviceId: BTFServiceId,
    customAmount?: number // For variable-price services like tips
  ): Promise<PaymentResult> => {
    if (!isConnected || !address) {
      const result: PaymentResult = {
        txHash: null,
        serviceId,
        amountPaid: 0,
        burnedAmount: 0,
        status: 'error',
        error: 'Wallet not connected',
      };
      setLastResult(result);
      return result;
    }

    const service = BTF_SERVICE_PRICES[serviceId];
    if (!service) {
      const result: PaymentResult = {
        txHash: null,
        serviceId,
        amountPaid: 0,
        burnedAmount: 0,
        status: 'error',
        error: 'Unknown service',
      };
      setLastResult(result);
      return result;
    }

    const pricing = calculateServicePrice(serviceId, userTier);
    const amount = customAmount || pricing.finalPrice;

    // Free service — skip on-chain tx
    if (amount === 0) {
      const result: PaymentResult = {
        txHash: null,
        serviceId,
        amountPaid: 0,
        burnedAmount: 0,
        status: 'success',
      };
      setStatus('success');
      setLastResult(result);
      return result;
    }

    // Check balance
    if (btfBalance < amount) {
      const result: PaymentResult = {
        txHash: null,
        serviceId,
        amountPaid: amount,
        burnedAmount: 0,
        status: 'error',
        error: `Insufficient BTF balance. Need ${amount} BTF, have ${btfBalance.toFixed(2)} BTF`,
      };
      setLastResult(result);
      return result;
    }

    setPendingService(serviceId);
    setStatus('paying');

    try {
      const txHash = await payForService(amount.toString(), service.onChainServiceId);

      if (txHash) {
        const burned = Math.floor(amount * 50 / 100);
        const result: PaymentResult = {
          txHash,
          serviceId,
          amountPaid: amount,
          burnedAmount: burned,
          status: 'success',
        };
        setStatus('success');
        setLastResult(result);
        refreshAll();
        return result;
      } else {
        const result: PaymentResult = {
          txHash: null,
          serviceId,
          amountPaid: amount,
          burnedAmount: 0,
          status: 'error',
          error: 'Transaction rejected or failed',
        };
        setStatus('error');
        setLastResult(result);
        return result;
      }
    } catch (err: any) {
      const result: PaymentResult = {
        txHash: null,
        serviceId,
        amountPaid: amount,
        burnedAmount: 0,
        status: 'error',
        error: err.shortMessage || err.message || 'Unknown error',
      };
      setStatus('error');
      setLastResult(result);
      return result;
    } finally {
      setPendingService(null);
    }
  }, [isConnected, address, userTier, btfBalance, payForService, refreshAll]);

  /**
   * Send a tip to an artist (uses transfer, not payForService)
   * Tips use direct transfer (2% burn via transfer tax)
   */
  const { transferBTF } = useBTFToken();

  const sendTip = useCallback(async (
    artistAddress: string,
    amount: number
  ): Promise<PaymentResult> => {
    if (!isConnected || !address) {
      return {
        txHash: null,
        serviceId: 'fan_tip',
        amountPaid: 0,
        burnedAmount: 0,
        status: 'error',
        error: 'Wallet not connected',
      };
    }

    if (btfBalance < amount) {
      return {
        txHash: null,
        serviceId: 'fan_tip',
        amountPaid: amount,
        burnedAmount: 0,
        status: 'error',
        error: `Insufficient BTF. Need ${amount}, have ${btfBalance.toFixed(2)}`,
      };
    }

    setStatus('paying');
    setPendingService('fan_tip');

    try {
      const txHash = await transferBTF(artistAddress, amount.toString());
      const burned = Math.floor(amount * 2 / 100); // 2% transfer burn

      if (txHash) {
        const result: PaymentResult = {
          txHash,
          serviceId: 'fan_tip',
          amountPaid: amount,
          burnedAmount: burned,
          status: 'success',
        };
        setStatus('success');
        setLastResult(result);
        refreshAll();
        return result;
      }

      return {
        txHash: null,
        serviceId: 'fan_tip',
        amountPaid: amount,
        burnedAmount: 0,
        status: 'error',
        error: 'Transaction rejected',
      };
    } catch (err: any) {
      return {
        txHash: null,
        serviceId: 'fan_tip',
        amountPaid: amount,
        burnedAmount: 0,
        status: 'error',
        error: err.shortMessage || err.message,
      };
    } finally {
      setStatus('idle');
      setPendingService(null);
    }
  }, [isConnected, address, btfBalance, transferBTF, refreshAll]);

  const reset = useCallback(() => {
    setStatus('idle');
    setLastResult(null);
    setPendingService(null);
  }, []);

  return {
    // State
    status,
    lastResult,
    pendingService,
    userTier,
    btfBalance,
    isLoading: tokenLoading || status === 'paying',
    isConnected,

    // Actions
    getPrice,
    canAfford,
    payForBTFService,
    sendTip,
    reset,
  };
}
