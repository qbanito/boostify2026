import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { ScrollArea } from "../ui/scroll-area";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "../../lib/queryClient";
import { useAuth } from "../../hooks/use-auth";
import { BidCard } from "./bid-card";
import { BidSubmitForm } from "./bid-submit-form";
import { ServiceRequestForm } from "./service-request-form";
import { 
  Plus, Eye, MessageSquare, Clock, DollarSign, MapPin, 
  Guitar, Drum, Piano, Mic2, Headphones, Music, Loader2,
  Filter, TrendingUp, Zap
} from "lucide-react";

const INSTRUMENT_ICONS: Record<string, any> = {
  Guitar, Drums: Drum, Piano, Vocals: Mic2, Production: Headphones, Bass: Guitar,
};

const URGENCY_COLORS: Record<string, string> = {
  low: "bg-green-500/20 text-green-400",
  medium: "bg-yellow-500/20 text-yellow-400",
  high: "bg-orange-500/20 text-orange-400",
  urgent: "bg-red-500/20 text-red-400 animate-pulse",
};

const STATUS_COLORS: Record<string, string> = {
  open: "bg-green-500/20 text-green-400",
  in_progress: "bg-blue-500/20 text-blue-400",
  completed: "bg-slate-500/20 text-slate-400",
  cancelled: "bg-red-500/20 text-red-400",
  expired: "bg-gray-500/20 text-gray-400",
};

export function ServiceRequestFeed() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<number | null>(null);
  const [instrumentFilter, setInstrumentFilter] = useState("all");
  const [showBidForm, setShowBidForm] = useState<number | null>(null);

  // Fetch all open requests
  const { data: requestsData, isLoading } = useQuery({
    queryKey: ["/api/service-requests", instrumentFilter],
    queryFn: () => apiRequest("GET", `/api/service-requests?status=open&instrument=${instrumentFilter}`),
  });

  // Fetch my requests
  const { data: myRequests } = useQuery({
    queryKey: ["/api/service-requests/my"],
    queryFn: () => apiRequest("GET", "/api/service-requests/my"),
  });

  // Fetch request detail with bids
  const { data: requestDetail } = useQuery({
    queryKey: [`/api/service-requests/${selectedRequest}`],
    queryFn: () => apiRequest("GET", `/api/service-requests/${selectedRequest}`),
    enabled: !!selectedRequest,
  });

  // Fetch musicians for bid form
  const { data: musiciansData } = useQuery({
    queryKey: ["/api/musicians"],
    queryFn: () => apiRequest("GET", "/api/musicians"),
  });

  // Accept bid mutation
  const acceptBidMutation = useMutation({
    mutationFn: ({ requestId, bidId }: { requestId: number; bidId: number }) =>
      apiRequest("PATCH", `/api/service-requests/${requestId}/bids/${bidId}/accept`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/service-requests"] });
      if (selectedRequest) queryClient.invalidateQueries({ queryKey: [`/api/service-requests/${selectedRequest}`] });
    },
  });

  const requests = requestsData?.data || [];
  const myReqs = myRequests?.data || [];
  const detail = requestDetail?.data;
  const allMusicians = musiciansData?.data || [];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <Zap className="h-5 w-5 text-orange-400" />
          Service Requests — Bid Board
        </h3>
        <div className="flex items-center gap-3">
          <Select value={instrumentFilter} onValueChange={setInstrumentFilter}>
            <SelectTrigger className="w-[160px] bg-slate-800 border-slate-600">
              <Filter className="h-3 w-3 mr-1" />
              <SelectValue placeholder="All Instruments" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Instruments</SelectItem>
              {["Guitar", "Drums", "Piano", "Bass", "Vocals", "Production"].map(i => (
                <SelectItem key={i} value={i}>{i}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Dialog open={showCreateForm} onOpenChange={setShowCreateForm}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-to-r from-orange-500 to-pink-500">
                <Plus className="h-4 w-4 mr-1" /> New Request
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl bg-slate-900 border-orange-500/30 max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-orange-400">Create Service Request</DialogTitle>
              </DialogHeader>
              <ServiceRequestForm
                onSuccess={() => setShowCreateForm(false)}
                onClose={() => setShowCreateForm(false)}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* My Requests Summary */}
      {myReqs.length > 0 && (
        <Card className="bg-slate-900/60 border-orange-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-400">My Active Requests</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {myReqs.filter((r: any) => r.status === "open" || r.status === "in_progress").map((r: any) => (
                <Badge
                  key={r.id}
                  className="cursor-pointer hover:bg-orange-500/30 transition-colors"
                  variant="outline"
                  onClick={() => setSelectedRequest(r.id)}
                >
                  {r.title} ({r.totalBids} bids)
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Feed + Detail */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left: Request Feed */}
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-slate-400 flex items-center gap-1">
            <TrendingUp className="h-3 w-3" /> Open Requests ({requests.length})
          </h4>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-orange-400" />
            </div>
          ) : requests.length === 0 ? (
            <Card className="p-6 bg-slate-800/50 border-slate-700 text-center">
              <Music className="h-8 w-8 mx-auto text-slate-500 mb-2" />
              <p className="text-slate-400">No open requests yet</p>
              <p className="text-xs text-slate-500 mt-1">Be the first to post a service request!</p>
            </Card>
          ) : (
            <ScrollArea className="h-[500px]">
              <div className="space-y-3 pr-2">
                {requests.map((item: any) => {
                  const r = item.request;
                  const InstrumentIcon = INSTRUMENT_ICONS[r.instrumentNeeded] || Music;
                  const isSelected = selectedRequest === r.id;

                  return (
                    <Card
                      key={r.id}
                      className={`p-4 cursor-pointer transition-all hover:border-orange-500/40 ${
                        isSelected ? "border-orange-500 bg-orange-500/5" : "bg-slate-800/50 border-slate-700"
                      }`}
                      onClick={() => setSelectedRequest(r.id)}
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center flex-shrink-0">
                          <InstrumentIcon className="h-5 w-5 text-orange-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-white text-sm truncate">{r.title}</span>
                            <Badge className={`text-xs ${URGENCY_COLORS[r.urgency]}`}>{r.urgency}</Badge>
                          </div>
                          <p className="text-xs text-slate-400 mt-1 line-clamp-1">{r.description}</p>
                          <div className="flex items-center gap-3 mt-2 flex-wrap">
                            <span className="text-green-400 text-sm font-bold">
                              ${r.budgetMin} - ${r.budgetMax}
                            </span>
                            <span className="text-xs text-slate-500 flex items-center gap-1">
                              <MessageSquare className="h-3 w-3" /> {r.totalBids} bids
                            </span>
                            {r.city && (
                              <span className="text-xs text-slate-500 flex items-center gap-1">
                                <MapPin className="h-3 w-3" /> {r.city}
                              </span>
                            )}
                            <span className="text-xs text-slate-500 flex items-center gap-1">
                              <Eye className="h-3 w-3" /> {r.viewCount}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-2">
                            {item.userImage && (
                              <img src={item.userImage} alt="" className="w-4 h-4 rounded-full" />
                            )}
                            <span className="text-xs text-slate-500">
                              by {item.userName || "Anonymous"}
                            </span>
                          </div>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </div>

        {/* Right: Request Detail & Bids */}
        <div className="space-y-3">
          {selectedRequest && detail ? (
            <>
              <Card className="p-4 bg-slate-900/80 border-orange-500/20">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-bold text-white">{detail.request.title}</h4>
                  <Badge className={STATUS_COLORS[detail.request.status]}>{detail.request.status}</Badge>
                </div>
                <p className="text-sm text-slate-300">{detail.request.description}</p>
                <div className="flex items-center gap-4 mt-3 flex-wrap text-sm">
                  <span className="text-green-400 font-bold">${detail.request.budgetMin} - ${detail.request.budgetMax}</span>
                  <Badge variant="outline" className="border-slate-600">{detail.request.instrumentNeeded}</Badge>
                  {detail.request.genre && <Badge variant="outline" className="border-slate-600">{detail.request.genre}</Badge>}
                  <Badge className={URGENCY_COLORS[detail.request.urgency]}>{detail.request.urgency}</Badge>
                </div>
              </Card>

              {/* Bids list */}
              <h4 className="text-sm font-semibold text-slate-400">
                Bids ({detail.bids?.length || 0})
              </h4>
              <ScrollArea className="h-[280px]">
                <div className="space-y-2 pr-2">
                  {detail.bids?.map((b: any) => (
                    <BidCard
                      key={b.bid.id}
                      bid={b}
                      isOwner={detail.request.userId === user?.id}
                      onAccept={(bidId) => acceptBidMutation.mutate({ requestId: selectedRequest, bidId })}
                      accepting={acceptBidMutation.isPending}
                    />
                  ))}
                  {(!detail.bids || detail.bids.length === 0) && (
                    <p className="text-sm text-slate-500 text-center py-4">No bids yet — be the first!</p>
                  )}
                </div>
              </ScrollArea>

              {/* Bid form (if not the owner) */}
              {detail.request.status === "open" && detail.request.userId !== user?.id && (
                <BidSubmitForm
                  requestId={selectedRequest}
                  requestTitle={detail.request.title}
                  budgetMin={detail.request.budgetMin}
                  budgetMax={detail.request.budgetMax}
                  musicians={allMusicians}
                  onSuccess={() => setSelectedRequest(selectedRequest)}
                />
              )}
            </>
          ) : (
            <Card className="p-8 bg-slate-800/50 border-slate-700 text-center">
              <MessageSquare className="h-10 w-10 mx-auto text-slate-600 mb-3" />
              <p className="text-slate-400">Select a request to view bids</p>
              <p className="text-xs text-slate-500 mt-1">Click on any request from the left panel</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
