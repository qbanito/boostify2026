import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Switch } from "../ui/switch";
import { useToast } from "../../hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "../../lib/queryClient";
import { Loader2, Send, MapPin, DollarSign, Clock, Music } from "lucide-react";

const INSTRUMENTS = ["Guitar", "Drums", "Piano", "Bass", "Vocals", "Production", "Violin", "Saxophone", "Trumpet", "Cello", "Other"];
const GENRES = ["Rock", "Pop", "Jazz", "Blues", "Classical", "Hip Hop", "R&B", "Electronic", "Latin", "Folk", "Metal", "Country", "Reggaeton", "Funk"];
const URGENCIES = [
  { value: "low", label: "Low — No rush", color: "text-green-400" },
  { value: "medium", label: "Medium — Within a week", color: "text-yellow-400" },
  { value: "high", label: "High — 2-3 days", color: "text-orange-400" },
  { value: "urgent", label: "Urgent — ASAP", color: "text-red-400" },
];

interface ServiceRequestFormProps {
  onSuccess?: () => void;
  onClose?: () => void;
}

export function ServiceRequestForm({ onSuccess, onClose }: ServiceRequestFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [form, setForm] = useState({
    title: "",
    description: "",
    instrumentNeeded: "",
    genre: "",
    budgetMin: "",
    budgetMax: "",
    city: "",
    country: "",
    isRemote: true,
    urgency: "medium",
    deadline: "",
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/service-requests", data),
    onSuccess: () => {
      toast({ title: "Request Published!", description: "Musicians will be notified and can start bidding." });
      queryClient.invalidateQueries({ queryKey: ["/api/service-requests"] });
      onSuccess?.();
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to create request", variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.instrumentNeeded || !form.budgetMin || !form.budgetMax) {
      toast({ title: "Missing fields", description: "Fill in title, instrument, and budget", variant: "destructive" });
      return;
    }
    createMutation.mutate({
      ...form,
      deadline: form.deadline ? new Date(form.deadline).toISOString() : undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Title */}
        <div className="md:col-span-2">
          <Label htmlFor="title" className="text-slate-300">What do you need?</Label>
          <Input
            id="title"
            value={form.title}
            onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))}
            placeholder="e.g., Session guitarist for Rock album recording"
            className="bg-slate-800 border-slate-600 mt-1"
          />
        </div>

        {/* Instrument */}
        <div>
          <Label className="text-slate-300">Instrument Needed</Label>
          <Select value={form.instrumentNeeded} onValueChange={(v) => setForm(f => ({ ...f, instrumentNeeded: v }))}>
            <SelectTrigger className="bg-slate-800 border-slate-600 mt-1">
              <SelectValue placeholder="Select instrument" />
            </SelectTrigger>
            <SelectContent>
              {INSTRUMENTS.map(i => (
                <SelectItem key={i} value={i}>{i}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Genre */}
        <div>
          <Label className="text-slate-300">Genre</Label>
          <Select value={form.genre} onValueChange={(v) => setForm(f => ({ ...f, genre: v }))}>
            <SelectTrigger className="bg-slate-800 border-slate-600 mt-1">
              <SelectValue placeholder="Select genre" />
            </SelectTrigger>
            <SelectContent>
              {GENRES.map(g => (
                <SelectItem key={g} value={g}>{g}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Budget */}
        <div>
          <Label className="text-slate-300 flex items-center gap-1">
            <DollarSign className="h-3 w-3" /> Budget Min
          </Label>
          <Input
            type="number"
            min="0"
            value={form.budgetMin}
            onChange={(e) => setForm(f => ({ ...f, budgetMin: e.target.value }))}
            placeholder="50"
            className="bg-slate-800 border-slate-600 mt-1"
          />
        </div>
        <div>
          <Label className="text-slate-300 flex items-center gap-1">
            <DollarSign className="h-3 w-3" /> Budget Max
          </Label>
          <Input
            type="number"
            min="0"
            value={form.budgetMax}
            onChange={(e) => setForm(f => ({ ...f, budgetMax: e.target.value }))}
            placeholder="500"
            className="bg-slate-800 border-slate-600 mt-1"
          />
        </div>

        {/* Urgency */}
        <div>
          <Label className="text-slate-300 flex items-center gap-1">
            <Clock className="h-3 w-3" /> Urgency
          </Label>
          <Select value={form.urgency} onValueChange={(v) => setForm(f => ({ ...f, urgency: v }))}>
            <SelectTrigger className="bg-slate-800 border-slate-600 mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {URGENCIES.map(u => (
                <SelectItem key={u.value} value={u.value}>
                  <span className={u.color}>{u.label}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Deadline */}
        <div>
          <Label className="text-slate-300">Deadline</Label>
          <Input
            type="date"
            value={form.deadline}
            onChange={(e) => setForm(f => ({ ...f, deadline: e.target.value }))}
            className="bg-slate-800 border-slate-600 mt-1"
          />
        </div>

        {/* Location */}
        <div>
          <Label className="text-slate-300 flex items-center gap-1">
            <MapPin className="h-3 w-3" /> City
          </Label>
          <Input
            value={form.city}
            onChange={(e) => setForm(f => ({ ...f, city: e.target.value }))}
            placeholder="Los Angeles"
            className="bg-slate-800 border-slate-600 mt-1"
          />
        </div>
        <div>
          <Label className="text-slate-300">Country</Label>
          <Input
            value={form.country}
            onChange={(e) => setForm(f => ({ ...f, country: e.target.value }))}
            placeholder="USA"
            className="bg-slate-800 border-slate-600 mt-1"
          />
        </div>

        {/* Remote toggle */}
        <div className="flex items-center gap-2 md:col-span-2">
          <Switch
            checked={form.isRemote}
            onCheckedChange={(v) => setForm(f => ({ ...f, isRemote: v }))}
          />
          <Label className="text-slate-300">Accept remote musicians</Label>
        </div>

        {/* Description */}
        <div className="md:col-span-2">
          <Label className="text-slate-300">Description</Label>
          <Textarea
            value={form.description}
            onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
            placeholder="Describe the project, style references, specific requirements..."
            className="bg-slate-800 border-slate-600 mt-1 h-24"
          />
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <Button
          type="submit"
          disabled={createMutation.isPending}
          className="bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600 flex-1"
        >
          {createMutation.isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Send className="h-4 w-4 mr-2" />
          )}
          Publish Request & Notify Musicians
        </Button>
        {onClose && (
          <Button type="button" variant="outline" onClick={onClose} className="border-slate-600">
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
