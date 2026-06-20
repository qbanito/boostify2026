/**
 * Public Sponsor Proposal Landing Page
 * Accessible at /sponsor/proposal/:dealId — no authentication required
 */

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useRoute } from 'wouter';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import {
  CheckCircle2,
  DollarSign,
  ExternalLink,
  Music,
  Target,
  Loader2,
  ThumbsUp,
  ThumbsDown,
  MessageSquare,
  Send,
} from 'lucide-react';

const DEAL_TYPE_LABELS: Record<string, string> = {
  sponsorship: '💰 Sponsorship',
  collaboration: '🤝 Collaboration',
  endorsement: '⭐ Endorsement',
  product_placement: '🎬 Product Placement',
  affiliate: '🔗 Affiliate Partnership',
};

export default function SponsorProposalPage() {
  const [, params] = useRoute('/sponsor/proposal/:dealId');
  const dealId = params?.dealId;

  const [responseAction, setResponseAction] = useState<string | null>(null);
  const [counterAmount, setCounterAmount] = useState('');
  const [sponsorMessage, setSponsorMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['/api/sponsors/proposal', dealId],
    queryFn: async () => {
      const res = await fetch(`/api/sponsors/proposal/${dealId}`);
      if (!res.ok) throw new Error('Proposal not found');
      return res.json();
    },
    enabled: !!dealId,
  });

  const respondMutation = useMutation({
    mutationFn: async (payload: { action: string; counterAmount?: string; message?: string }) => {
      const res = await fetch(`/api/sponsors/proposal/${dealId}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to respond');
      return res.json();
    },
    onSuccess: () => {
      setSubmitted(true);
      refetch();
    },
  });

  const handleRespond = (action: string) => {
    respondMutation.mutate({
      action,
      counterAmount: action === 'counter_offer' ? counterAmount : undefined,
      message: sponsorMessage || undefined,
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    );
  }

  if (error || !data?.success) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-white">
        <div className="text-center">
          <Target className="h-12 w-12 text-gray-600 mx-auto mb-4" />
          <h1 className="text-xl font-bold">Proposal Not Found</h1>
          <p className="text-gray-500 mt-2">This proposal may have expired or been removed.</p>
        </div>
      </div>
    );
  }

  const { deal, artist, brand, payment } = data;

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-black to-gray-950">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-600/20 via-orange-500/10 to-transparent border-b border-orange-500/20">
        <div className="max-w-3xl mx-auto px-6 py-8">
          <div className="flex items-center gap-2 mb-2">
            <Music className="h-5 w-5 text-orange-400" />
            <span className="text-sm text-orange-400 font-medium">Boostify Music</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white">{deal.title}</h1>
          <div className="flex items-center gap-2 mt-3">
            <Badge className="bg-orange-500/20 text-orange-300">{DEAL_TYPE_LABELS[deal.dealType] || deal.dealType}</Badge>
            <Badge className={deal.status === 'proposed' ? 'bg-blue-500/20 text-blue-400' : deal.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}>
              {deal.status}
            </Badge>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        {/* Artist Card */}
        {artist && (
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">About the Artist</h2>
            <div className="flex items-center gap-4">
              {artist.profileImage && (
                <img src={artist.profileImage} alt={artist.name} className="w-16 h-16 rounded-full object-cover" />
              )}
              <div>
                <p className="text-lg font-bold text-white">{artist.name}</p>
                <p className="text-sm text-gray-400">{artist.genre}</p>
              </div>
            </div>
            {artist.biography && (
              <p className="text-sm text-gray-400 mt-4 line-clamp-3">{artist.biography}</p>
            )}
          </div>
        )}

        {/* Deal Details */}
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Proposal Details</h2>
          {deal.description && <p className="text-sm text-gray-300 mb-4">{deal.description}</p>}

          <div className="grid grid-cols-2 gap-4">
            {deal.proposedAmount && (
              <div className="bg-gray-800/50 rounded-lg p-3">
                <p className="text-xs text-gray-500">Investment</p>
                <p className="text-lg font-bold text-emerald-400">${parseFloat(deal.proposedAmount).toLocaleString()}</p>
              </div>
            )}
            {deal.agreedAmount && (
              <div className="bg-gray-800/50 rounded-lg p-3">
                <p className="text-xs text-gray-500">Agreed Amount</p>
                <p className="text-lg font-bold text-green-400">${parseFloat(deal.agreedAmount).toLocaleString()}</p>
              </div>
            )}
          </div>

          {deal.contractTerms && (
            <div className="mt-4 p-3 bg-gray-800/30 rounded-lg">
              <p className="text-xs text-gray-500 mb-1">Contract Terms</p>
              <p className="text-sm text-gray-300 whitespace-pre-wrap">{deal.contractTerms}</p>
            </div>
          )}
        </div>

        {/* Payment Section */}
        {payment && payment.deal && payment.deal.stripePaymentUrl && (
          <div className="bg-gradient-to-r from-emerald-500/10 to-green-500/10 border border-emerald-500/30 rounded-xl p-6 text-center">
            <DollarSign className="h-8 w-8 text-emerald-400 mx-auto mb-2" />
            <h2 className="text-lg font-bold text-white mb-1">Ready to Proceed?</h2>
            <p className="text-sm text-gray-400 mb-4">Complete your payment securely through Stripe</p>
            <a href={payment.deal.stripePaymentUrl} target="_blank" rel="noopener noreferrer">
              <Button className="bg-emerald-600 hover:bg-emerald-700 text-white px-8">
                <DollarSign className="h-4 w-4 mr-2" />
                Complete Payment
                <ExternalLink className="h-3 w-3 ml-2" />
              </Button>
            </a>
          </div>
        )}

        {/* ── Sponsor Response Section ── */}
        {['proposed', 'negotiating'].includes(deal.status) && !submitted && (
          <div className="bg-gray-900/70 border border-orange-500/30 rounded-xl p-6">
            <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4 flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-orange-400" />
              Your Response
            </h2>

            {!responseAction ? (
              <div className="space-y-3">
                <p className="text-sm text-gray-400">How would you like to proceed with this proposal?</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <button
                    onClick={() => setResponseAction('interested')}
                    className="flex items-center gap-2 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg hover:border-blue-400 transition-colors text-left"
                  >
                    <ThumbsUp className="h-5 w-5 text-blue-400 shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-white">Interested</p>
                      <p className="text-[11px] text-gray-500">Let's discuss details</p>
                    </div>
                  </button>
                  <button
                    onClick={() => setResponseAction('counter_offer')}
                    className="flex items-center gap-2 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg hover:border-yellow-400 transition-colors text-left"
                  >
                    <DollarSign className="h-5 w-5 text-yellow-400 shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-white">Counter-Offer</p>
                      <p className="text-[11px] text-gray-500">Suggest a different amount</p>
                    </div>
                  </button>
                  <button
                    onClick={() => setResponseAction('rejected')}
                    className="flex items-center gap-2 p-4 bg-red-500/10 border border-red-500/30 rounded-lg hover:border-red-400 transition-colors text-left"
                  >
                    <ThumbsDown className="h-5 w-5 text-red-400 shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-white">Decline</p>
                      <p className="text-[11px] text-gray-500">Not interested right now</p>
                    </div>
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Badge className={
                    responseAction === 'interested' ? 'bg-blue-500/20 text-blue-400' :
                    responseAction === 'counter_offer' ? 'bg-yellow-500/20 text-yellow-400' :
                    'bg-red-500/20 text-red-400'
                  }>
                    {responseAction === 'interested' ? '👍 Interested' : responseAction === 'counter_offer' ? '💰 Counter-Offer' : '👎 Decline'}
                  </Badge>
                  <button onClick={() => setResponseAction(null)} className="text-xs text-gray-500 hover:text-gray-300">Change</button>
                </div>

                {responseAction === 'counter_offer' && (
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Your proposed amount ($)</label>
                    <Input
                      type="number"
                      placeholder="e.g. 5000"
                      value={counterAmount}
                      onChange={(e) => setCounterAmount(e.target.value)}
                      className="bg-gray-800 border-gray-700"
                    />
                  </div>
                )}

                <div>
                  <label className="text-xs text-gray-400 block mb-1">Message (optional)</label>
                  <Textarea
                    placeholder={
                      responseAction === 'interested' ? "We'd love to learn more about this opportunity..." :
                      responseAction === 'counter_offer' ? "We're interested but at a different investment level..." :
                      "Thank you for considering us, but..."
                    }
                    value={sponsorMessage}
                    onChange={(e) => setSponsorMessage(e.target.value)}
                    className="bg-gray-800 border-gray-700 min-h-[80px]"
                  />
                </div>

                <Button
                  onClick={() => handleRespond(responseAction === 'interested' ? 'interested' : responseAction)}
                  disabled={respondMutation.isPending || (responseAction === 'counter_offer' && !counterAmount)}
                  className={
                    responseAction === 'rejected'
                      ? 'bg-red-600 hover:bg-red-700 w-full'
                      : 'bg-orange-600 hover:bg-orange-700 w-full'
                  }
                >
                  {respondMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Send className="h-4 w-4 mr-2" />
                  )}
                  Submit Response
                </Button>

                {respondMutation.isError && (
                  <p className="text-xs text-red-400">{(respondMutation.error as Error).message}</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Response Submitted Confirmation */}
        {submitted && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-6 text-center">
            <CheckCircle2 className="h-8 w-8 text-emerald-400 mx-auto mb-2" />
            <h2 className="text-lg font-bold text-white">Response Submitted!</h2>
            <p className="text-sm text-gray-400 mt-1">The artist has been notified. They'll be in touch soon.</p>
          </div>
        )}

        {/* Status Complete */}
        {['active', 'completed'].includes(deal.status) && (
          <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-6 text-center">
            <CheckCircle2 className="h-8 w-8 text-green-400 mx-auto mb-2" />
            <h2 className="text-lg font-bold text-white">Deal {deal.status === 'completed' ? 'Completed' : 'Active'}</h2>
            <p className="text-sm text-gray-400 mt-1">This sponsorship deal is {deal.status}. Thank you for your partnership!</p>
          </div>
        )}

        {/* Footer */}
        <div className="text-center pt-4 border-t border-gray-800">
          <p className="text-xs text-gray-600">Powered by <span className="text-orange-500 font-semibold">Boostify Music</span></p>
          <p className="text-[10px] text-gray-700 mt-1">The #1 platform for artist-brand partnerships</p>
        </div>
      </div>
    </div>
  );
}
