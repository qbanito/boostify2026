import React, { useState } from "react";
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useDisconnect } from 'wagmi';
import { Button } from "../ui/button";
import { useWeb3 } from "../../hooks/use-web3";
import { useWeb3Ready } from "../../lib/context/web3-context";
import { Wallet, ChevronDown, Loader2 } from "lucide-react";
import { useToast } from "../../hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";

// Inner component that uses wagmi hooks - only rendered when Web3 is ready
function WalletConnectButtonInner() {
  const { address, isConnected } = useWeb3();
  const { disconnect } = useDisconnect();
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();

  // Truncate address for display
  const truncatedAddress = address
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : "";

  if (!isConnected) {
    return (
      <ConnectButton
        showBalance={false}
        chainStatus="none"
        accountStatus="avatar"
      />
    );
  }

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="gap-2 bg-gradient-to-r from-orange-500/10 to-orange-600/10 border-orange-500/50 hover:border-orange-500 hover:bg-orange-500/20"
        >
          <Wallet className="h-4 w-4 text-orange-400" />
          <span className="text-orange-400 font-medium">{truncatedAddress}</span>
          <ChevronDown className="h-3 w-3 text-orange-400" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel className="text-xs">🔗 Wallet Conectada</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => {
          navigator.clipboard.writeText(address || "");
          toast({
            title: "📋 Dirección copiada",
            description: truncatedAddress,
          });
        }}>
          📋 Copiar Dirección
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => {
            disconnect();
            setIsOpen(false);
            toast({
              title: "🔌 Wallet desconectada",
              description: "Tu billetera ha sido desconectada correctamente.",
            });
          }}
          className="text-red-400 hover:text-red-300 hover:bg-red-500/10 cursor-pointer"
        >
          🔌 Desconectar
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Outer wrapper that checks if Web3 is ready before rendering wagmi hooks
export function WalletConnectButton() {
  const { isWeb3Ready } = useWeb3();
  const { toast } = useToast();

  // Show loading button while Web3 is not ready
  if (!isWeb3Ready) {
    return (
      <Button
        variant="outline"
        onClick={() => {
          toast({
            title: "⏳ Inicializando Web3...",
            description: "Por favor espera un momento mientras se conecta a la blockchain.",
          });
        }}
        className="gap-2 bg-gradient-to-r from-orange-500/20 to-orange-600/20 border-orange-500/50 hover:border-orange-400 hover:bg-orange-500/30 cursor-pointer"
      >
        <Wallet className="h-4 w-4 text-orange-400" />
        <span className="text-orange-400">Conectar Wallet</span>
      </Button>
    );
  }

  // Web3 is ready, render the inner component that uses wagmi hooks
  return <WalletConnectButtonInner />;
}
