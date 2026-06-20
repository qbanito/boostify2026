import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useTierLimits } from "@/hooks/use-tier-limits";
import { 
  FileText, 
  Check, 
  Shield, 
  DollarSign, 
  Truck, 
  Palette,
  Loader2,
  AlertCircle
} from "lucide-react";

interface MerchCollaborationContractProps {
  artistId: number;
  artistName: string;
  colors: {
    hexPrimary: string;
    hexAccent: string;
    hexBorder: string;
  };
  onContractSigned: () => void;
}

export function MerchCollaborationContract({ 
  artistId, 
  artistName, 
  colors,
  onContractSigned 
}: MerchCollaborationContractProps) {
  const { user } = useAuth();
  const tierLimits = useTierLimits();
  const queryClient = useQueryClient();
  
  const [legalName, setLegalName] = useState("");
  const [email, setEmail] = useState(user?.email || "");
  const [country, setCountry] = useState("");
  const [accepted, setAccepted] = useState(false);

  const isFree = tierLimits.isFree;
  const artistShare = isFree ? 20 : 70;
  const boostifyShare = isFree ? 80 : 30;
  const maintenanceFee = 10;

  const signMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/merch-contract/sign", {
        artistId,
        artistLegalName: legalName,
        artistStageName: artistName,
        artistEmail: email,
        artistCountry: country || undefined,
        subscriptionPlan: tierLimits.tier || 'free',
      });
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["merch-contract", artistId] });
      onContractSigned();
    }
  });

  return (
    <div className="space-y-4">
      {/* Contract Header */}
      <div 
        className="p-4 rounded-xl border-2 text-center"
        style={{ 
          borderColor: colors.hexAccent,
          background: `linear-gradient(135deg, ${colors.hexPrimary}20, ${colors.hexAccent}15)`
        }}
      >
        <div className="flex items-center justify-center gap-2 mb-2">
          <FileText className="h-6 w-6" style={{ color: colors.hexAccent }} />
          <h3 className="text-lg font-bold text-white">
            Collaboration Agreement
          </h3>
        </div>
        <p className="text-sm text-gray-300">
          Boostify Official Store × {artistName}
        </p>
      </div>

      {/* Revenue Split Visual */}
      <div className="grid grid-cols-2 gap-3">
        <div 
          className="p-3 rounded-lg border text-center"
          style={{ borderColor: colors.hexAccent, background: `${colors.hexAccent}15` }}
        >
          <div className="text-2xl font-black" style={{ color: colors.hexAccent }}>
            {artistShare}%
          </div>
          <div className="text-xs text-gray-300 font-medium mt-1">Your Earnings</div>
          <div className="text-[10px] text-gray-500 mt-0.5">
            {isFree ? "of each sale (Free plan)" : "of profit after costs"}
          </div>
        </div>
        <div 
          className="p-3 rounded-lg border text-center"
          style={{ borderColor: colors.hexBorder, background: 'rgba(255,255,255,0.03)' }}
        >
          <div className="text-2xl font-black text-gray-400">
            {boostifyShare}%
          </div>
          <div className="text-xs text-gray-300 font-medium mt-1">Boostify</div>
          <div className="text-[10px] text-gray-500 mt-0.5">
            Production + Distribution
          </div>
        </div>
      </div>

      {/* Upgrade Banner for Free Users */}
      {isFree && (
        <div 
          className="p-3 rounded-lg border flex items-start gap-2"
          style={{ borderColor: '#eab308', background: 'rgba(234, 179, 8, 0.1)' }}
        >
          <AlertCircle className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
          <div className="text-xs text-gray-300">
            <strong className="text-yellow-400">Upgrade to earn 70%!</strong> Paid plan artists earn 70% of profit after production costs vs 20% on the free plan.
          </div>
        </div>
      )}

      {/* Contract Terms */}
      <div 
        className="p-4 rounded-lg border space-y-3 text-xs text-gray-300"
        style={{ borderColor: colors.hexBorder, background: 'rgba(0,0,0,0.3)' }}
      >
        <h4 className="text-sm font-bold text-white flex items-center gap-2">
          <Shield className="h-4 w-4" style={{ color: colors.hexAccent }} />
          Terms & Conditions
        </h4>

        <div className="space-y-2.5">
          <div className="flex items-start gap-2">
            <DollarSign className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" style={{ color: colors.hexAccent }} />
            <p>
              <strong className="text-white">Revenue Split:</strong> Artist receives <strong style={{ color: colors.hexAccent }}>{artistShare}%</strong> {isFree ? 'of each sale' : 'of net profit (sale price minus production, shipping and payment processing costs)'}. Boostify retains {boostifyShare}%. An additional {maintenanceFee}% of profit is allocated to platform maintenance and improvements.
            </p>
          </div>

          <div className="flex items-start gap-2">
            <Truck className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" style={{ color: colors.hexAccent }} />
            <p>
              <strong className="text-white">Production & Fulfillment:</strong> Boostify handles all production, shipping logistics, returns, and customer service through its integrated manufacturing network. The artist has <strong className="text-white">zero upfront investment</strong> and no inventory risk.
            </p>
          </div>

          <div className="flex items-start gap-2">
            <Palette className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" style={{ color: colors.hexAccent }} />
            <p>
              <strong className="text-white">Design Rights:</strong> The artist grants Boostify a non-exclusive license to print and sell merchandise featuring their name, likeness, and uploaded designs. The artist retains full ownership of their original artwork and intellectual property.
            </p>
          </div>

          <div className="flex items-start gap-2">
            <Shield className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" style={{ color: colors.hexAccent }} />
            <p>
              <strong className="text-white">Payments:</strong> Earnings are calculated monthly and paid out via the Boostify Wallet. Minimum payout threshold is $10 USD. Payment processing fees are deducted from the total sale price before profit calculation.
            </p>
          </div>

          <div className="flex items-start gap-2">
            <FileText className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" style={{ color: colors.hexAccent }} />
            <p>
              <strong className="text-white">Termination:</strong> Either party may terminate this agreement at any time. Pending orders will be fulfilled and corresponding commissions paid. Products will be removed from the store within 30 days of termination.
            </p>
          </div>
        </div>
      </div>

      {/* Signature Form */}
      <div 
        className="p-4 rounded-lg border space-y-3"
        style={{ borderColor: colors.hexBorder, background: 'rgba(0,0,0,0.2)' }}
      >
        <h4 className="text-sm font-bold text-white">Sign Agreement</h4>
        
        <div className="space-y-2">
          <input
            type="text"
            placeholder="Full Legal Name *"
            value={legalName}
            onChange={(e) => setLegalName(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-black/50 border text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1"
            style={{ borderColor: colors.hexBorder, focusRingColor: colors.hexAccent } as any}
          />
          <input
            type="email"
            placeholder="Email Address *"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-black/50 border text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1"
            style={{ borderColor: colors.hexBorder } as any}
          />
          <input
            type="text"
            placeholder="Country (optional)"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-black/50 border text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1"
            style={{ borderColor: colors.hexBorder } as any}
          />
        </div>

        <label className="flex items-start gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={accepted}
            onChange={(e) => setAccepted(e.target.checked)}
            className="mt-1 rounded"
          />
          <span className="text-xs text-gray-300">
            I, <strong className="text-white">{legalName || '___'}</strong>, have read and agree to the terms of this Collaboration Agreement. I understand the revenue split and authorize Boostify to produce and sell merchandise on my behalf.
          </span>
        </label>

        <button
          onClick={() => signMutation.mutate()}
          disabled={!accepted || !legalName || !email || signMutation.isPending}
          className="w-full py-3 rounded-xl text-sm font-bold transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ 
            background: accepted && legalName && email
              ? `linear-gradient(135deg, ${colors.hexPrimary}, ${colors.hexAccent})`
              : '#333',
            color: 'white'
          }}
        >
          {signMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Signing...
            </>
          ) : (
            <>
              <Check className="h-4 w-4" />
              Sign & Activate Store
            </>
          )}
        </button>

        {signMutation.isError && (
          <p className="text-xs text-red-400 text-center">
            {(signMutation.error as any)?.message || 'Error signing contract. Please try again.'}
          </p>
        )}
      </div>
    </div>
  );
}
