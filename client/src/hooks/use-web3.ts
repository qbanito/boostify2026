import { useWeb3Context } from '../lib/context/web3-context';

/**
 * Safe Web3 hook that provides wallet data when WagmiProvider is available.
 * Returns default values (isConnected: false, etc.) when Web3 is not ready.
 * 
 * This hook is safe to use anywhere in the app - it will never throw an error
 * even if called before WagmiProvider is initialized.
 */
export function useWeb3() {
  return useWeb3Context();
}

// Type export for components that need it
export type Web3State = ReturnType<typeof useWeb3>;
