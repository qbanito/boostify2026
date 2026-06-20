import React, { createContext, useContext, ReactNode, useMemo } from 'react';
import { useAccount, useBalance, useChainId } from 'wagmi';

interface Web3ContextType {
  isWeb3Ready: boolean;
  address?: `0x${string}`;
  isConnected: boolean;
  chainId?: number;
  balance?: string;
  balanceFormatted?: string;
  symbol?: string;
}

const defaultWeb3Context: Web3ContextType = {
  isWeb3Ready: false,
  address: undefined,
  isConnected: false,
  chainId: undefined,
  balance: undefined,
  balanceFormatted: undefined,
  symbol: undefined,
};

const Web3Context = createContext<Web3ContextType>(defaultWeb3Context);

// Provider for when Web3 is NOT ready - provides default values
export function Web3NotReadyProvider({ children }: { children: ReactNode }) {
  return (
    <Web3Context.Provider value={defaultWeb3Context}>
      {children}
    </Web3Context.Provider>
  );
}

// Provider for when Web3 IS ready - uses wagmi hooks directly
export function Web3ReadyInternalProvider({ children }: { children: ReactNode }) {
  // Use wagmi hooks directly - these work because we're inside WagmiProvider
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { data: balanceData } = useBalance({ address });

  const value = useMemo<Web3ContextType>(() => ({
    isWeb3Ready: true,
    address,
    isConnected,
    chainId,
    balance: balanceData?.value?.toString(),
    balanceFormatted: balanceData?.formatted,
    symbol: balanceData?.symbol,
  }), [address, isConnected, chainId, balanceData]);

  return (
    <Web3Context.Provider value={value}>
      {children}
    </Web3Context.Provider>
  );
}

export function useWeb3Context() {
  return useContext(Web3Context);
}

// Legacy compatibility - keeping old interface
export function Web3ReadyProvider({ children, isReady }: { children: ReactNode; isReady: boolean }) {
  // This is just a pass-through now, the actual provider choice is in App.tsx
  return <>{children}</>;
}

export function useWeb3Ready() {
  const ctx = useContext(Web3Context);
  return { isWeb3Ready: ctx.isWeb3Ready };
}
