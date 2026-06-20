/**
 * Public Venue Booking Proposal Page
 * Venues can view artist info and accept/counter/decline booking proposals
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Music, MapPin, DollarSign, Clock, Calendar, CheckCircle2,
  XCircle, MessageSquare, Star, Globe, ExternalLink, Loader2,
} from "lucide-react";

export default function VenueProposalPage() {
  const [, params] = useRoute("/venue-proposal/:dealId");
  const dealId = params?.dealId;
  const qc = useQueryClient();

  const [response, setResponse] = useState<"accept" | "counter_offer" | "reject" | null>(null);
  const [counterOffer, setCounterOffer] = useState("");
  const [message, setMessage] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: [`/api/venue-outreach/proposal/${dealId}`],
    queryFn: async () => {
      const res = await fetch(`/api/venue-outreach/proposal/${dealId}`);
      if (!res.ok) throw new Error((await res.json()).error || "Not found");
      return res.json();
    },
    enabled: !!dealId,
  });

  const respondMut = useMutation({
    mutationFn: async (body: { action: string; counterOffer?: string; message?: string }) => {
      const res = await fetch(`/api/venue-outreach/proposal/${dealId}/respond`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [`/api/venue-outreach/proposal/${dealId}`] }),
  });

  if (isLoading) return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-orange-400" />
    </div>
  );

  if (error || !data) return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
      <div className="text-center">
        <XCircle className="h-12 w-12 text-red-400 mx-auto mb-3" />
        <p className="text-gray-400">Proposal not found or expired</p>
      </div>
    </div>
  );

  const { deal, venue, artist } = data;
  const artistImg = artist?.profileImage || `https://ui-avatars.com/api/?name=${encodeURIComponent(artist?.artistName || "A")}&size=200&background=F59E0B&color=fff&bold=true`;
  const alreadyResponded = ["booked", "confirmed", "rejected", "negotiating"].includes(deal.status);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Hero Header */}
      <div className="bg-gradient-to-br from-orange-500 to-amber-600 py-12 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <h1 className="text-3xl font-bold text-white mb-2">🎤 Live Music Booking Proposal</h1>
          <p className="text-white/80">for {venue?.name || "your venue"}</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        {/* Artist Card */}
        <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
          <div className="flex items-start gap-4 p-5">
            <img src={artistImg} alt={artist?.artistName} className="w-24 h-24 rounded-xl object-cover flex-shrink-0" />
            <div>
              <h2 className="text-xl font-bold">{artist?.artistName || artist?.username}</h2>
              <Badge variant="outline" className="mt-1 text-orange-400 border-orange-500/30">{artist?.genre || "Artist"}</Badge>
              {artist?.biography && <p className="text-sm text-gray-400 mt-2 line-clamp-3">{artist.biography}</p>}
              <div className="flex flex-wrap gap-3 mt-3">
                {artist?.spotifyUrl && (
                  <a href={artist.spotifyUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-green-400 flex items-center gap-1 hover:underline">
                    <Music className="h-3 w-3" /> Spotify
                  </a>
                )}
                {artist?.youtubeChannel && (
                  <a href={artist.youtubeChannel} target="_blank" rel="noopener noreferrer" className="text-xs text-red-400 flex items-center gap-1 hover:underline">
                    <Globe className="h-3 w-3" /> YouTube
                  </a>
                )}
                {artist?.instagramHandle && (
                  <a href={`https://instagram.com/${artist.instagramHandle}`} target="_blank" rel="noopener noreferrer" className="text-xs text-pink-400 flex items-center gap-1 hover:underline">
                    @{artist.instagramHandle}
                  </a>
                )}
                {artist?.slug && (
                  <a href={`/artist/${artist.slug}`} target="_blank" rel="noopener noreferrer" className="text-xs text-orange-400 flex items-center gap-1 hover:underline">
                    <ExternalLink className="h-3 w-3" /> Full Profile
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Booking Details */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-5">
          <h3 className="text-sm font-semibold mb-3 text-orange-400">Booking Details</h3>
          <div className="grid grid-cols-2 gap-3">
            {deal.proposedFee && (
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-orange-400" />
                <div><p className="text-[10px] text-gray-500">Show Fee</p><p className="text-sm font-semibold">${deal.proposedFee}</p></div>
              </div>
            )}
            {deal.setDuration && (
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-blue-400" />
                <div><p className="text-[10px] text-gray-500">Set Duration</p><p className="text-sm font-semibold">{deal.setDuration}</p></div>
              </div>
            )}
            {deal.technicalRequirements && (
              <div className="col-span-2 flex items-start gap-2">
                <Star className="h-4 w-4 text-yellow-400 mt-0.5" />
                <div><p className="text-[10px] text-gray-500">Requirements</p><p className="text-sm">{deal.technicalRequirements}</p></div>
              </div>
            )}
            {deal.proposedDate && (
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-green-400" />
                <div><p className="text-[10px] text-gray-500">Proposed Date</p><p className="text-sm font-semibold">{new Date(deal.proposedDate).toLocaleDateString()}</p></div>
              </div>
            )}
          </div>
        </div>

        {/* Status / Response */}
        {alreadyResponded ? (
          <div className={`rounded-xl p-5 border ${
            deal.status === "booked" || deal.status === "confirmed" ? "bg-green-500/10 border-green-500/30" :
            deal.status === "rejected" ? "bg-red-500/10 border-red-500/30" :
            "bg-purple-500/10 border-purple-500/30"
          }`}>
            <p className="text-sm font-medium flex items-center gap-2">
              {deal.status === "booked" || deal.status === "confirmed" ? <><CheckCircle2 className="h-5 w-5 text-green-400" /> Booking Accepted!</> :
               deal.status === "rejected" ? <><XCircle className="h-5 w-5 text-red-400" /> Proposal Declined</> :
               <><MessageSquare className="h-5 w-5 text-purple-400" /> Negotiation in Progress</>}
            </p>
            {deal.venueResponse && <p className="text-xs text-gray-400 mt-2">Response: {deal.venueResponse}</p>}
            {deal.counterOffer && <p className="text-xs text-orange-400 mt-1">Counter-offer: ${deal.counterOffer}</p>}
          </div>
        ) : (
          <div className="bg-white/5 border border-white/10 rounded-xl p-5">
            <h3 className="text-sm font-semibold mb-4">Your Response</h3>
            {respondMut.isSuccess ? (
              <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 text-center">
                <CheckCircle2 className="h-8 w-8 text-green-400 mx-auto mb-2" />
                <p className="text-sm font-medium text-green-400">Response submitted! Thank you.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => setResponse("accept")}
                    className={response === "accept" ? "bg-green-600 text-white" : "bg-white/10 text-gray-300"}>
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" /> Accept Booking
                  </Button>
                  <Button size="sm" onClick={() => setResponse("counter_offer")}
                    className={response === "counter_offer" ? "bg-orange-600 text-white" : "bg-white/10 text-gray-300"}>
                    <DollarSign className="h-3.5 w-3.5 mr-1.5" /> Counter-Offer
                  </Button>
                  <Button size="sm" onClick={() => setResponse("reject")}
                    className={response === "reject" ? "bg-red-600 text-white" : "bg-white/10 text-gray-300"}>
                    <XCircle className="h-3.5 w-3.5 mr-1.5" /> Decline
                  </Button>
                </div>

                {response === "counter_offer" && (
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Your proposed fee (USD)</label>
                    <Input placeholder="750" value={counterOffer} onChange={e => setCounterOffer(e.target.value)} className="bg-white/5 border-white/10 h-9 text-sm" />
                  </div>
                )}

                {response && (
                  <>
                    <div>
                      <label className="text-xs text-gray-400 mb-1 block">Message (optional)</label>
                      <Textarea placeholder="Thank you for the opportunity..." value={message} onChange={e => setMessage(e.target.value)} rows={3} className="bg-white/5 border-white/10 text-sm" />
                    </div>
                    <Button onClick={() => respondMut.mutate({ action: response, counterOffer: counterOffer || undefined, message: message || undefined })}
                      disabled={respondMut.isPending}
                      className="bg-orange-500 hover:bg-orange-600 text-black font-semibold">
                      {respondMut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                      Submit Response
                    </Button>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="text-center py-4">
          <p className="text-[10px] text-gray-600">Powered by Boostify Music · Professional Artist Bookings</p>
        </div>
      </div>
    </div>
  );
}
