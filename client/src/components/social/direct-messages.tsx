/**
 * DirectMessages — Real DM/messaging system for Boostify Social Network
 *
 * Backed by `/api/social/dm/*` (Postgres). Polls every 5s while the
 * panel is mounted so messages round-trip between users.
 *
 * Design: dark theme, orange-500 accents, slate backgrounds — matches
 * social-network.tsx.
 */

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import {
  Card, CardContent, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/firebase";
import { formatDistanceToNow } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageSquare, Search, Send, X, Plus, ArrowLeft,
  CheckCheck, Check, Loader2, UserPlus, Inbox,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface DMUser {
  id: string;
  displayName: string;
  avatar?: string | null;
  isArtist?: boolean;
}

interface DirectMessage {
  id:            string;
  conversationId: string;
  senderId:      string;
  senderName:    string;
  senderAvatar?: string | null;
  recipientId:   string;
  recipientName?: string;
  recipientAvatar?: string | null;
  content:       string;
  createdAt:     number; // unix ms
  read:          boolean;
}

interface Conversation {
  id:            string;
  partnerId:     string;
  partnerName:   string;
  partnerAvatar?: string | null;
  lastMessage:   string;
  lastMessageAt: number;
  unreadCount:   number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const UNREAD_CACHE_KEY = "boostify_dm_unread_cache";

/** Public helper — lets the parent tab badge display an unread count.
 *  Returns the last cached count from localStorage; the component
 *  refreshes the cache on every fetch so the badge stays close. */
export function getUnreadDMCount(_userId?: string): number {
  try {
    const v = localStorage.getItem(UNREAD_CACHE_KEY);
    return v ? Math.max(0, parseInt(v, 10) || 0) : 0;
  } catch { return 0; }
}

function makeConversationId(a: string, b: string): string {
  return [a, b].sort().join(":");
}

function fmtRelative(ts: number): string {
  try {
    return formatDistanceToNow(new Date(ts), { addSuffix: true });
  } catch { return ""; }
}

function avatarInitials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join("");
}

function avatarColor(seed: string): string {
  const palette = [
    "from-orange-500 to-red-500",
    "from-purple-500 to-indigo-500",
    "from-pink-500 to-rose-500",
    "from-cyan-500 to-blue-500",
    "from-green-500 to-emerald-500",
    "from-amber-500 to-orange-500",
  ];
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) & 0xffffffff;
  return palette[Math.abs(h) % palette.length];
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function UserAvatar({
  name,
  src,
  size = "md",
}: {
  name: string;
  src?: string | null;
  size?: "sm" | "md" | "lg";
}) {
  const sz = size === "sm" ? "h-8 w-8" : size === "lg" ? "h-12 w-12" : "h-10 w-10";
  const txt = size === "sm" ? "text-xs" : size === "lg" ? "text-base" : "text-sm";
  return (
    <Avatar className={`${sz} flex-shrink-0`}>
      <AvatarImage src={src ?? undefined} alt={name} />
      <AvatarFallback
        className={`bg-gradient-to-br ${avatarColor(name)} text-white font-semibold ${txt}`}
      >
        {avatarInitials(name)}
      </AvatarFallback>
    </Avatar>
  );
}

interface NewConversationModalProps {
  users:    DMUser[];
  myId:     string;
  onSelect: (user: DMUser) => void;
  onClose:  () => void;
}

function NewConversationModal({
  users, myId, onSelect, onClose,
}: NewConversationModalProps) {
  const [search, setSearch] = useState("");
  const filtered = useMemo(
    () =>
      users.filter(
        (u) =>
          u.id !== myId &&
          u.displayName.toLowerCase().includes(search.toLowerCase()),
      ),
    [users, myId, search],
  );

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        className="relative z-10 w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden"
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700/50">
          <h3 className="text-base font-bold flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-orange-400" />
            New Conversation
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-muted-foreground hover:text-white transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-4 py-3 border-b border-slate-700/30">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search users or artists…"
              className="pl-9 bg-slate-800/60 border-slate-600 h-9 text-sm"
            />
          </div>
        </div>

        <div className="overflow-y-auto max-h-64 divide-y divide-slate-700/20">
          {filtered.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No users found
            </div>
          ) : (
            filtered.map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => { onSelect(u); onClose(); }}
                className="w-full flex items-center gap-3 px-5 py-3 hover:bg-slate-800/60 transition-colors text-left"
              >
                <UserAvatar name={u.displayName} src={u.avatar} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-white truncate">{u.displayName}</p>
                  {u.isArtist && (
                    <p className="text-[10px] text-orange-400/80">Artist</p>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

function ConvoItem({
  convo,
  active,
  onClick,
}: {
  convo: Conversation;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-start gap-3 px-4 py-3 transition-colors rounded-xl ${
        active
          ? "bg-orange-500/10 border border-orange-500/30"
          : "hover:bg-slate-800/50 border border-transparent"
      }`}
    >
      <div className="relative flex-shrink-0">
        <UserAvatar name={convo.partnerName} src={convo.partnerAvatar} size="md" />
        {convo.unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-orange-500 text-[9px] font-bold text-white flex items-center justify-center px-1">
            {convo.unreadCount > 9 ? "9+" : convo.unreadCount}
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1 text-left">
        <div className="flex items-center justify-between gap-2 mb-0.5">
          <p className={`text-sm font-semibold truncate ${active ? "text-orange-300" : "text-white"}`}>
            {convo.partnerName}
          </p>
          <span className="text-[10px] text-muted-foreground flex-shrink-0">
            {fmtRelative(convo.lastMessageAt)}
          </span>
        </div>
        <p className={`text-xs truncate ${
          convo.unreadCount > 0 ? "text-gray-300 font-medium" : "text-muted-foreground"
        }`}>
          {convo.lastMessage || "No messages yet"}
        </p>
      </div>
    </button>
  );
}

function MessageBubble({
  msg,
  isMine,
}: {
  msg: DirectMessage;
  isMine: boolean;
}) {
  return (
    <motion.div
      className={`flex gap-2.5 ${isMine ? "flex-row-reverse" : "flex-row"}`}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15 }}
    >
      {!isMine && (
        <UserAvatar name={msg.senderName} src={msg.senderAvatar} size="sm" />
      )}
      <div className={`max-w-[70%] space-y-1 ${isMine ? "items-end" : "items-start"} flex flex-col`}>
        {!isMine && (
          <span className="text-[10px] text-muted-foreground ml-1">
            {msg.senderName}
          </span>
        )}
        <div
          className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
            isMine
              ? "bg-gradient-to-br from-orange-500 to-orange-600 text-white rounded-tr-sm"
              : "bg-slate-800/80 text-gray-100 border border-slate-700/50 rounded-tl-sm"
          }`}
        >
          {msg.content}
        </div>
        <div className={`flex items-center gap-1 ${isMine ? "flex-row-reverse" : "flex-row"}`}>
          <span className="text-[9px] text-muted-foreground">
            {fmtRelative(msg.createdAt)}
          </span>
          {isMine && (
            msg.read
              ? <CheckCheck className="h-3 w-3 text-blue-400" />
              : <Check className="h-3 w-3 text-muted-foreground" />
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 5000;

export function DirectMessages() {
  const { user } = useAuth() || {};
  const { toast } = useToast();

  const myId = user?.id ? String(user.id) : null;
  const myName =
    (user as any)?.artistName ||
    user?.firstName ||
    user?.email?.split("@")[0] ||
    "Me";
  const myAvatar = (user as any)?.profileImageUrl ?? (user as any)?.profileImage ?? null;

  // ── Available users ──
  const [availableUsers, setAvailableUsers] = useState<DMUser[]>([]);

  useEffect(() => {
    const load = async () => {
      const merged: DMUser[] = [];
      const seen = new Set<string>();

      try {
        const response = await apiRequest({
          url: "/api/social/users",
          method: "GET",
        }) as Array<{ id: string | number; displayName: string; avatar?: string | null }>;
        if (Array.isArray(response)) {
          for (const u of response) {
            const id = String(u.id);
            if (!seen.has(id)) {
              seen.add(id);
              merged.push({ id, displayName: u.displayName, avatar: u.avatar });
            }
          }
        }
      } catch { /* silent */ }

      try {
        const snap = await getDocs(collection(db, "users"));
        snap.docs.forEach((doc) => {
          const d = doc.data() as any;
          const uid = d.uid ? String(d.uid) : doc.id;
          if (!seen.has(uid) && d.displayName) {
            seen.add(uid);
            merged.push({
              id: uid,
              displayName: d.displayName,
              avatar: d.photoURL ?? d.profileImage ?? null,
              isArtist: true,
            });
          }
        });
      } catch { /* silent */ }

      try {
        const res = await apiRequest({
          url: "/api/artist-generator/my-artists",
          method: "GET",
        }) as { artists?: Array<{ id: number | string; name: string; profileImage?: string }> };
        if (res?.artists) {
          for (const a of res.artists) {
            const uid = String(a.id);
            if (!seen.has(uid) && a.name) {
              seen.add(uid);
              merged.push({ id: uid, displayName: a.name, avatar: a.profileImage ?? null, isArtist: true });
            }
          }
        }
      } catch { /* silent */ }

      setAvailableUsers(merged);
    };
    load();
  }, []);

  // ── State ──
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvoId, setActiveConvoId] = useState<string | null>(null);
  const [activePartnerId, setActivePartnerId] = useState<string | null>(null);
  const [activeMessages, setActiveMessages] = useState<DirectMessage[]>([]);
  const [composerText, setComposerText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [showNewModal, setShowNewModal] = useState(false);
  const [search, setSearch] = useState("");
  const [mobileShowThread, setMobileShowThread] = useState(false);
  const [convosLoading, setConvosLoading] = useState(true);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const lastFetchRef = useRef<number>(0);

  // ── Fetch conversations + cache unread count ──
  const refreshConversations = useCallback(async () => {
    if (!myId) return;
    try {
      const res = await apiRequest({
        url: "/api/social/dm/conversations",
        method: "GET",
      }) as { conversations: Conversation[] };
      const list = (res?.conversations || []).map((c) => ({
        ...c,
        // backend may not yet know partner display info — patch from local cache.
        partnerName: c.partnerName || availableUsers.find(u => u.id === c.partnerId)?.displayName || "User",
        partnerAvatar: c.partnerAvatar || availableUsers.find(u => u.id === c.partnerId)?.avatar || null,
      }));
      setConversations(list);
      const total = list.reduce((s, c) => s + (c.unreadCount || 0), 0);
      try { localStorage.setItem(UNREAD_CACHE_KEY, String(total)); } catch { /* quota */ }
    } catch (err) {
      // silent — retried by polling
    } finally {
      setConvosLoading(false);
    }
  }, [myId, availableUsers]);

  // ── Fetch messages for active conversation ──
  const refreshActiveMessages = useCallback(async () => {
    if (!myId || !activePartnerId) return;
    try {
      const res = await apiRequest({
        url: `/api/social/dm/conversations/${encodeURIComponent(activePartnerId)}`,
        method: "GET",
      }) as { conversationId: string; messages: DirectMessage[] };
      setActiveMessages(res?.messages || []);
      // Mark as read (fire and forget)
      apiRequest({
        url: `/api/social/dm/conversations/${encodeURIComponent(activePartnerId)}/read`,
        method: "POST",
      }).then(() => refreshConversations()).catch(() => {});
    } catch { /* silent */ }
  }, [myId, activePartnerId, refreshConversations]);

  // ── Initial load + polling ──
  useEffect(() => {
    if (!myId) return;
    refreshConversations();
    const i = window.setInterval(() => {
      refreshConversations();
      lastFetchRef.current = Date.now();
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(i);
  }, [myId, refreshConversations]);

  useEffect(() => {
    if (!activePartnerId) return;
    refreshActiveMessages();
    const i = window.setInterval(refreshActiveMessages, POLL_INTERVAL_MS);
    return () => window.clearInterval(i);
  }, [activePartnerId, refreshActiveMessages]);

  // ── Filtered conversations ──
  const filteredConvos = useMemo(
    () => conversations.filter((c) =>
      c.partnerName.toLowerCase().includes(search.toLowerCase()),
    ),
    [conversations, search],
  );

  const activeConvo = useMemo(
    () => conversations.find((c) => c.id === activeConvoId) ?? null,
    [conversations, activeConvoId],
  );

  // Partner display fallback when starting a brand-new convo from the modal
  const [pendingPartner, setPendingPartner] = useState<DMUser | null>(null);
  const displayedPartner = activeConvo
    ? { id: activeConvo.partnerId, displayName: activeConvo.partnerName, avatar: activeConvo.partnerAvatar }
    : pendingPartner
      ? { id: pendingPartner.id, displayName: pendingPartner.displayName, avatar: pendingPartner.avatar }
      : null;

  // ── Auto-scroll on new messages ──
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeMessages.length]);

  // ── Open conversation ──
  const openConversation = useCallback(
    (partner: DMUser) => {
      if (!myId) return;
      const convoId = makeConversationId(myId, partner.id);
      setActiveConvoId(convoId);
      setActivePartnerId(partner.id);
      setPendingPartner(partner);
      setMobileShowThread(true);
    },
    [myId],
  );

  // ── Send message ──
  const handleSend = useCallback(async () => {
    const text = composerText.trim();
    if (!text || !myId || !activePartnerId || !displayedPartner) return;
    setIsSending(true);

    // Optimistic insert
    const optimistic: DirectMessage = {
      id: `temp-${Date.now()}`,
      conversationId: makeConversationId(myId, activePartnerId),
      senderId: myId,
      senderName: myName,
      senderAvatar: myAvatar,
      recipientId: activePartnerId,
      content: text,
      createdAt: Date.now(),
      read: false,
    };
    setActiveMessages((prev) => [...prev, optimistic]);
    setComposerText("");

    try {
      await apiRequest({
        url: "/api/social/dm/messages",
        method: "POST",
        data: {
          recipientId: activePartnerId,
          recipientName: displayedPartner.displayName,
          recipientAvatar: displayedPartner.avatar || null,
          content: text,
          senderName: myName,
          senderAvatar: myAvatar,
        },
      });
      await refreshActiveMessages();
      await refreshConversations();
    } catch (err: any) {
      setActiveMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      toast({
        title: "Could not send",
        description: err?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  }, [composerText, myId, activePartnerId, displayedPartner, myName, myAvatar, refreshActiveMessages, refreshConversations, toast]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const totalUnread = useMemo(
    () => conversations.reduce((s, c) => s + (c.unreadCount || 0), 0),
    [conversations],
  );

  // ─── Render ──────────────────────────────────────────────────────────────

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <MessageSquare className="h-12 w-12 text-muted-foreground opacity-30" />
        <p className="text-muted-foreground text-sm">
          Sign in to access your messages.
        </p>
      </div>
    );
  }

  return (
    <div className="h-[calc(100dvh-260px)] min-h-[480px] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-orange-400" />
          <h2 className="text-lg font-bold">Direct Messages</h2>
          {totalUnread > 0 && (
            <Badge className="bg-orange-500/20 text-orange-300 border-orange-500/40 text-xs">
              {totalUnread} new
            </Badge>
          )}
        </div>
        <Button
          size="sm"
          onClick={() => setShowNewModal(true)}
          className="bg-orange-500 hover:bg-orange-600 text-white gap-1.5"
        >
          <Plus className="h-4 w-4" />
          New Message
        </Button>
      </div>

      <div className="flex-1 flex gap-0 rounded-2xl overflow-hidden border border-slate-700/50 bg-slate-900/40 min-h-0">
        {/* Left: conversation list */}
        <div
          className={`${
            mobileShowThread ? "hidden md:flex" : "flex"
          } md:flex flex-col w-full md:w-72 lg:w-80 flex-shrink-0 border-r border-slate-700/40`}
        >
          <div className="p-3 border-b border-slate-700/30">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search conversations…"
                className="pl-8 bg-slate-800/50 border-slate-600/50 h-8 text-xs"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {convosLoading ? (
              <div className="flex items-center justify-center h-full py-12">
                <Loader2 className="h-5 w-5 animate-spin text-orange-400" />
              </div>
            ) : filteredConvos.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 py-12">
                <Inbox className="h-10 w-10 text-muted-foreground opacity-30" />
                <p className="text-sm text-muted-foreground text-center px-4">
                  {search
                    ? "No conversations match your search"
                    : "No messages yet. Start a conversation!"}
                </p>
                {!search && (
                  <button
                    type="button"
                    onClick={() => setShowNewModal(true)}
                    className="text-xs text-orange-400 hover:text-orange-300 flex items-center gap-1.5 transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Send your first message
                  </button>
                )}
              </div>
            ) : (
              filteredConvos.map((convo) => (
                <ConvoItem
                  key={convo.id}
                  convo={convo}
                  active={activeConvoId === convo.id}
                  onClick={() => openConversation({
                    id: convo.partnerId,
                    displayName: convo.partnerName,
                    avatar: convo.partnerAvatar,
                  })}
                />
              ))
            )}
          </div>
        </div>

        {/* Right: thread view */}
        <div
          className={`${
            mobileShowThread ? "flex" : "hidden md:flex"
          } md:flex flex-col flex-1 min-w-0`}
        >
          {activePartnerId && displayedPartner ? (
            <>
              <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-700/40 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setMobileShowThread(false)}
                  className="md:hidden p-1.5 rounded-lg hover:bg-slate-800 text-muted-foreground hover:text-white transition-colors"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <UserAvatar name={displayedPartner.displayName} src={displayedPartner.avatar} />
                <div>
                  <p className="font-semibold text-sm text-white">
                    {displayedPartner.displayName}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {activeMessages.length} message{activeMessages.length !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 min-h-0">
                {activeMessages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full gap-3 opacity-60">
                    <MessageSquare className="h-10 w-10 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      No messages yet. Say hello!
                    </p>
                  </div>
                ) : (
                  activeMessages.map((msg) => (
                    <MessageBubble
                      key={msg.id}
                      msg={msg}
                      isMine={msg.senderId === myId}
                    />
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              <div className="px-4 py-3 border-t border-slate-700/40 flex-shrink-0">
                <div className="flex items-end gap-2">
                  <Textarea
                    value={composerText}
                    onChange={(e) => setComposerText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={`Message ${displayedPartner.displayName}…`}
                    rows={1}
                    className="flex-1 resize-none bg-slate-800/60 border-slate-600 text-sm min-h-[38px] max-h-[120px]"
                    style={{ overflowY: composerText.split("\n").length > 3 ? "auto" : "hidden" }}
                  />
                  <button
                    type="button"
                    onClick={handleSend}
                    disabled={isSending || !composerText.trim()}
                    className="flex-shrink-0 w-9 h-9 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:bg-slate-700 disabled:text-muted-foreground text-white flex items-center justify-center transition-colors"
                  >
                    {isSending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </button>
                </div>
                <p className="text-[9px] text-muted-foreground mt-1.5">
                  Press Enter to send · Shift+Enter for new line
                </p>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8 text-center">
              <motion.div
                animate={{ y: [0, -6, 0] }}
                transition={{ duration: 3, repeat: Infinity }}
              >
                <MessageSquare className="h-14 w-14 text-orange-400/30" />
              </motion.div>
              <div className="space-y-1">
                <p className="text-white font-semibold">Your messages</p>
                <p className="text-sm text-muted-foreground max-w-xs">
                  Send private messages to artists and fellow fans on Boostify.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowNewModal(true)}
                className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
              >
                <Plus className="h-4 w-4" />
                Start a conversation
              </button>
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {showNewModal && (
          <NewConversationModal
            users={availableUsers}
            myId={myId ?? ""}
            onSelect={(u) => openConversation(u)}
            onClose={() => setShowNewModal(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
