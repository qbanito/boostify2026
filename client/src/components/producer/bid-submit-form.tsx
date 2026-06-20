import { useState } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { useToast } from "../../hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "../../lib/queryClient";
import { Loader2, Send, DollarSign } from "lucide-react";

interface BidSubmitFormProps {
  requestId: number;
  requestTitle: string;
  budgetMin: string;
  budgetMax: string;
  musicians: Array<{ id: number; name: string; category: string }>;
  onSuccess?: () => void;
}

export function BidSubmitForm({ requestId, requestTitle, budgetMin, budgetMax, musicians, onSuccess }: BidSubmitFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [form, setForm] = useState({
    musicianId: "",
    amount: "",
    message: "",
    estimatedDelivery: "",
    portfolioLink: "",
  });

  const bidMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", `/api/service-requests/${requestId}/bids`, data),
    onSuccess: () => {
      toast({ title: "Bid Submitted!", description: "The client will be notified." });
      queryClient.invalidateQueries({ queryKey: [`/api/service-requests/${requestId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/service-requests"] });
      onSuccess?.();
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to submit bid", variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.musicianId || !form.amount || !form.message) {
      toast({ title: "Missing fields", description: "Select musician, set amount and message", variant: "destructive" });
      return;
    }
    bidMutation.mutate({
      musicianId: parseInt(form.musicianId),
      amount: form.amount,
      message: form.message,
      estimatedDelivery: form.estimatedDelivery || undefined,
      portfolioLinks: form.portfolioLink ? [form.portfolioLink] : undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-4 bg-slate-800/50 rounded-lg border border-orange-500/20">
      <h4 className="text-sm font-semibold text-orange-400">Submit Your Bid for: {requestTitle}</h4>
      <p className="text-xs text-slate-400">Budget range: ${budgetMin} - ${budgetMax}</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <Label className="text-slate-300 text-xs">Select Musician Profile</Label>
          <Select value={form.musicianId} onValueChange={(v) => setForm(f => ({ ...f, musicianId: v }))}>
            <SelectTrigger className="bg-slate-900 border-slate-600 mt-1">
              <SelectValue placeholder="Choose your profile" />
            </SelectTrigger>
            <SelectContent>
              {musicians.map(m => (
                <SelectItem key={m.id} value={String(m.id)}>
                  {m.name} ({m.category})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-slate-300 text-xs flex items-center gap-1">
            <DollarSign className="h-3 w-3" /> Your Price (USD)
          </Label>
          <Input
            type="number"
            min="1"
            value={form.amount}
            onChange={(e) => setForm(f => ({ ...f, amount: e.target.value }))}
            placeholder="150"
            className="bg-slate-900 border-slate-600 mt-1"
          />
        </div>

        <div>
          <Label className="text-slate-300 text-xs">Estimated Delivery</Label>
          <Select value={form.estimatedDelivery} onValueChange={(v) => setForm(f => ({ ...f, estimatedDelivery: v }))}>
            <SelectTrigger className="bg-slate-900 border-slate-600 mt-1">
              <SelectValue placeholder="How fast" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="24 hours">24 hours</SelectItem>
              <SelectItem value="2-3 days">2-3 days</SelectItem>
              <SelectItem value="1 week">1 week</SelectItem>
              <SelectItem value="2 weeks">2 weeks</SelectItem>
              <SelectItem value="1 month">1 month</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-slate-300 text-xs">Portfolio Link (optional)</Label>
          <Input
            value={form.portfolioLink}
            onChange={(e) => setForm(f => ({ ...f, portfolioLink: e.target.value }))}
            placeholder="https://soundcloud.com/..."
            className="bg-slate-900 border-slate-600 mt-1"
          />
        </div>

        <div className="md:col-span-2">
          <Label className="text-slate-300 text-xs">Your Message</Label>
          <Textarea
            value={form.message}
            onChange={(e) => setForm(f => ({ ...f, message: e.target.value }))}
            placeholder="Describe your experience, approach, and why you're the best fit..."
            className="bg-slate-900 border-slate-600 mt-1 h-20"
          />
        </div>
      </div>

      <Button
        type="submit"
        disabled={bidMutation.isPending}
        className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700"
      >
        {bidMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
        Submit Bid
      </Button>
    </form>
  );
}
