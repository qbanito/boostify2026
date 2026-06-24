import { useState, useRef, useEffect } from "react";
import axios from "axios";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { useToast } from "../../hooks/use-toast";
import { Bot, Send, Loader2, MessageSquare, CheckCircle2, Sparkles } from "lucide-react";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const GREETING: ChatMessage = {
  role: "assistant",
  content:
    "Hi — I'm the Boostify Music Investor Relations agent. Ask me anything about the business model, technology, market, or roadmap. When you're ready, share your point of view and I'll make sure the founding team receives it personally.\n\n(Hola, soy el agente de Relaciones con Inversores de Boostify Music. Pregúntame lo que quieras sobre el modelo de negocio.)",
};

export function InvestorRoomModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { toast } = useToast();
  const [messages, setMessages] = useState<ChatMessage[]>([GREETING]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Submit form
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [investorType, setInvestorType] = useState("individual");
  const [interestLevel, setInterestLevel] = useState("medium");
  const [viewpoints, setViewpoints] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, thinking]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || thinking) return;
    const next = [...messages, { role: "user" as const, content: text }];
    setMessages(next);
    setInput("");
    setThinking(true);
    try {
      const { data } = await axios.post("/api/investor-room/chat", {
        messages: next.filter((m) => m !== GREETING),
      });
      if (data?.success && data.reply) {
        setMessages((m) => [...m, { role: "assistant", content: data.reply }]);
      } else {
        setMessages((m) => [
          ...m,
          { role: "assistant", content: "Sorry, I couldn't respond right now. Please try again." },
        ]);
      }
    } catch {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: "Sorry, I couldn't respond right now. Please try again." },
      ]);
    } finally {
      setThinking(false);
    }
  };

  const submit = async () => {
    if (!name.trim() || name.trim().length < 2) {
      toast({ title: "Name required", description: "Please enter your name.", variant: "destructive" });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      toast({ title: "Valid email required", description: "Please enter a valid email.", variant: "destructive" });
      return;
    }
    if (viewpoints.trim().length < 5) {
      toast({ title: "Share your point of view", description: "Please write a few words.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const { data } = await axios.post("/api/investor-room/submit", {
        name: name.trim(),
        email: email.trim(),
        company: company.trim() || undefined,
        investorType,
        interestLevel,
        viewpoints: viewpoints.trim(),
        transcript: messages.filter((m) => m !== GREETING),
      });
      if (data?.success) {
        setSubmitted(true);
        toast({
          title: "Perspective sent",
          description: "Thank you — our team has received your point of view.",
        });
      } else {
        throw new Error(data?.error || "Failed");
      }
    } catch (e: any) {
      toast({
        title: "Could not submit",
        description: e?.response?.data?.error || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => {
    setSubmitted(false);
    setMessages([GREETING]);
    setInput("");
    setName("");
    setEmail("");
    setCompany("");
    setViewpoints("");
    setInvestorType("individual");
    setInterestLevel("medium");
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v && submitted) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-4xl w-[95vw] p-0 overflow-hidden bg-zinc-950 border-zinc-800 text-zinc-100">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-zinc-800">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-orange-500/15 text-orange-400">
              <Bot className="h-5 w-5" />
            </span>
            Investor Room
          </DialogTitle>
          <DialogDescription className="text-zinc-400">
            Talk to our trained agent about the business model, then register your point of view.
          </DialogDescription>
        </DialogHeader>

        {submitted ? (
          <div className="px-8 py-16 text-center">
            <CheckCircle2 className="h-14 w-14 text-emerald-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">Thank you for your perspective</h3>
            <p className="text-zinc-400 max-w-md mx-auto">
              Your notes have reached our founding team. If a conversation would be valuable,
              someone will reach out personally. A confirmation is on its way to your inbox.
            </p>
            <Button variant="outline" className="mt-6 border-zinc-700" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-0 max-h-[75vh]">
            {/* Chat column */}
            <div className="flex flex-col border-r border-zinc-800 min-h-[420px]">
              <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                {messages.map((m, i) => (
                  <div
                    key={i}
                    className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap leading-relaxed ${
                        m.role === "user"
                          ? "bg-orange-500 text-white rounded-br-sm"
                          : "bg-zinc-800/80 text-zinc-100 rounded-bl-sm"
                      }`}
                    >
                      {m.content}
                    </div>
                  </div>
                ))}
                {thinking && (
                  <div className="flex justify-start">
                    <div className="bg-zinc-800/80 rounded-2xl rounded-bl-sm px-4 py-3">
                      <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />
                    </div>
                  </div>
                )}
              </div>
              <div className="border-t border-zinc-800 p-3 flex items-end gap-2">
                <Textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                  placeholder="Ask about the business model…"
                  rows={1}
                  className="resize-none bg-zinc-900 border-zinc-700 min-h-[42px] max-h-28"
                />
                <Button
                  size="icon"
                  onClick={sendMessage}
                  disabled={thinking || !input.trim()}
                  className="bg-orange-500 hover:bg-orange-600 shrink-0"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Viewpoint form column */}
            <div className="flex flex-col overflow-y-auto px-5 py-4">
              <div className="flex items-center gap-2 mb-3 text-zinc-300">
                <MessageSquare className="h-4 w-4 text-orange-400" />
                <span className="font-medium text-sm">Your point of view</span>
              </div>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-zinc-400">Name *</Label>
                    <Input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="bg-zinc-900 border-zinc-700 mt-1"
                      placeholder="Your name"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-zinc-400">Email *</Label>
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="bg-zinc-900 border-zinc-700 mt-1"
                      placeholder="you@email.com"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-zinc-400">Company / Fund (optional)</Label>
                  <Input
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    className="bg-zinc-900 border-zinc-700 mt-1"
                    placeholder="Organization"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-zinc-400">Investor type</Label>
                    <Select value={investorType} onValueChange={setInvestorType}>
                      <SelectTrigger className="bg-zinc-900 border-zinc-700 mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="individual">Individual</SelectItem>
                        <SelectItem value="corporate">Corporate</SelectItem>
                        <SelectItem value="institutional">Institutional</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs text-zinc-400">Interest level</Label>
                    <Select value={interestLevel} onValueChange={setInterestLevel}>
                      <SelectTrigger className="bg-zinc-900 border-zinc-700 mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Exploring</SelectItem>
                        <SelectItem value="medium">Interested</SelectItem>
                        <SelectItem value="high">Very interested</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-zinc-400">Your perspective & questions *</Label>
                  <Textarea
                    value={viewpoints}
                    onChange={(e) => setViewpoints(e.target.value)}
                    rows={5}
                    className="bg-zinc-900 border-zinc-700 mt-1 resize-none"
                    placeholder="Share what stands out, your questions, concerns, or where you see fit…"
                  />
                </div>
                <Button
                  onClick={submit}
                  disabled={submitting}
                  className="w-full bg-orange-500 hover:bg-orange-600"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Sending…
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" /> Send my perspective
                    </>
                  )}
                </Button>
                <p className="text-[11px] text-zinc-500 text-center leading-relaxed">
                  We'll send a copy to our team and a one-time confirmation to your inbox.
                  No marketing list, no spam.
                </p>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
