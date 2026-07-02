/**
 * RoadmapTimeline — interactive, always-current artist roadmap for BoostiSwap.
 *
 * - Parses legacy "Qx YYYY: label" roadmap strings and derives live status
 *   (completed / in progress / upcoming) from the REAL current quarter.
 * - Appends deterministic future milestones wired to real platform modules
 *   (3D store, News, Events, BoostiSwap pools, artist profile, Explore).
 * - Every milestone is expandable and deep-links into the system.
 */
import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "wouter";
import {
  Rocket,
  CheckCircle2,
  CalendarClock,
  ArrowRight,
  Radio,
  Store,
  Newspaper,
  Ticket,
  Droplets,
  Users,
  Compass,
  Music2,
} from "lucide-react";
import { seededUnit } from "@/lib/seeded";

interface RoadmapTimelineProps {
  artistId: number;
  artistName: string;
  roadmap: string[];
}

type MilestoneStatus = "completed" | "in_progress" | "upcoming";

interface TimelineItem {
  id: string;
  quarterIdx: number; // year*4 + (q-1)
  title: string;
  description: string;
  status: MilestoneStatus;
  href: string;
  linkLabel: string;
  Icon: typeof Rocket;
  isFuture?: boolean; // appended platform milestone
}

const quarterLabel = (idx: number) => `Q${(idx % 4) + 1} ${Math.floor(idx / 4)}`;

const currentQuarterIdx = () => {
  const now = new Date();
  return now.getFullYear() * 4 + Math.floor(now.getMonth() / 3);
};

/** Connect an existing roadmap entry to the platform module it belongs to. */
function moduleForLabel(label: string, slug: string) {
  const l = label.toLowerCase();
  if (/(tour|festival|live|concert|show)/.test(l))
    return { href: "/events", linkLabel: "Explore Live Events", Icon: Ticket, desc: "Connected to Boostify Events — immersive shows, ticket passes and interactive fan experiences." };
  if (/(merch|merchandise|fashion|apparel)/.test(l))
    return { href: `/artist/${slug}/store`, linkLabel: "Visit 3D Store", Icon: Store, desc: "Connected to the artist's official Boostify 3D boutique with Smart Merch drops." };
  if (/(label|deal|production|partner|collab)/.test(l))
    return { href: "/news", linkLabel: "Read Boostify News", Icon: Newspaper, desc: "Announcements and coverage published through the Boostify News network." };
  if (/(album|single|ep|release|track|song|music)/.test(l))
    return { href: `/artist/${slug}`, linkLabel: "Listen on Artist Profile", Icon: Music2, desc: "New music lands directly on the artist's Boostify profile — stream it the moment it drops." };
  return { href: `/artist/${slug}`, linkLabel: "Visit Artist Profile", Icon: Compass, desc: "Track this milestone live from the artist's Boostify profile." };
}

/** Catalog of future, platform-connected projects (deterministic pick per artist). */
function futureCatalog(slug: string) {
  return [
    { key: "merch", title: "Official 3D Merch Boutique Drop", desc: "Limited collection inside the artist's immersive 3D store, powered by Boostify Smart Merch.", href: `/artist/${slug}/store`, linkLabel: "Visit 3D Store", Icon: Store },
    { key: "news", title: "Boostify News Feature", desc: "Editorial spotlight and press push across the Boostify News network and newsletter.", href: "/news", linkLabel: "Read Boostify News", Icon: Newspaper },
    { key: "event", title: "Live Event Experience", desc: "Immersive live show with interactive modules, cinematic visuals and ticket passes.", href: "/events", linkLabel: "Explore Events", Icon: Ticket },
    { key: "liquidity", title: "Access Pack Liquidity Expansion", desc: "Deeper BoostiSwap pools and expanded utility for access-pack holders.", href: "/boostiswap", linkLabel: "View BoostiSwap Pools", Icon: Droplets },
    { key: "fanclub", title: "Fan Club & Exclusive Content", desc: "Members-only drops, behind-the-scenes access and direct artist interaction.", href: `/artist/${slug}`, linkLabel: "Visit Artist Profile", Icon: Users },
    { key: "spotlight", title: "Explore Spotlight Campaign", desc: "Featured placement across Boostify discovery surfaces to grow the fanbase.", href: "/explore", linkLabel: "Open Explore", Icon: Compass },
  ];
}

function buildTimeline(artistId: number, artistName: string, roadmap: string[]): TimelineItem[] {
  const slug = artistName.toLowerCase().replace(/\s+/g, "-");
  const curIdx = currentQuarterIdx();
  const items: TimelineItem[] = [];

  let maxIdx = curIdx - 1;
  roadmap.forEach((entry, i) => {
    const m = entry.match(/Q([1-4])\s+(\d{4})\s*:?\s*(.*)/i);
    const label = m ? m[3].trim() : entry.trim();
    let qIdx: number;
    if (m) {
      qIdx = parseInt(m[2], 10) * 4 + (parseInt(m[1], 10) - 1);
    } else {
      qIdx = curIdx + i; // unparseable → project forward from now
    }
    if (qIdx > maxIdx) maxIdx = qIdx;
    const mod = moduleForLabel(label, slug);
    items.push({
      id: `rm-${artistId}-${i}`,
      quarterIdx: qIdx,
      title: label,
      description: mod.desc,
      status: qIdx < curIdx ? "completed" : qIdx === curIdx ? "in_progress" : "upcoming",
      href: mod.href,
      linkLabel: mod.linkLabel,
      Icon: mod.Icon,
    });
  });

  // Append 3 future platform projects, seeded per artist for variety.
  const catalog = futureCatalog(slug);
  const start = Math.floor(seededUnit(`roadmap-${artistId}`) * catalog.length);
  let nextSlot = Math.max(curIdx, maxIdx + 1);
  for (let k = 0; k < 3; k++) {
    const c = catalog[(start + k) % catalog.length];
    items.push({
      id: `fp-${artistId}-${c.key}`,
      quarterIdx: nextSlot,
      title: c.title,
      description: c.desc,
      status: nextSlot === curIdx ? "in_progress" : "upcoming",
      href: c.href,
      linkLabel: c.linkLabel,
      Icon: c.Icon,
      isFuture: true,
    });
    nextSlot++;
  }

  return items.sort((a, b) => a.quarterIdx - b.quarterIdx);
}

const STATUS_META: Record<MilestoneStatus, { label: string; badge: string; dot: string }> = {
  completed: {
    label: "Completed",
    badge: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    dot: "bg-emerald-400",
  },
  in_progress: {
    label: "In Progress",
    badge: "bg-orange-500/15 text-orange-300 border-orange-500/30",
    dot: "bg-orange-400",
  },
  upcoming: {
    label: "Upcoming",
    badge: "bg-sky-500/15 text-sky-300 border-sky-500/30",
    dot: "bg-sky-400",
  },
};

export function RoadmapTimeline({ artistId, artistName, roadmap }: RoadmapTimelineProps) {
  const [expanded, setExpanded] = useState<string | null>(null);

  const items = useMemo(
    () => buildTimeline(artistId, artistName, roadmap),
    [artistId, artistName, roadmap],
  );

  const completed = items.filter((i) => i.status === "completed").length;
  const pct = Math.round((completed / items.length) * 100);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Rocket className="h-5 w-5 text-orange-400" />
          <h3 className="font-semibold">Roadmap</h3>
        </div>
        <span className="text-xs text-muted-foreground">
          {completed}/{items.length} milestones · {pct}%
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 rounded-full bg-slate-800 mb-4 overflow-hidden">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-orange-400 to-sky-400"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      </div>

      {/* Timeline */}
      <div className="relative pl-5">
        <div className="absolute left-[9px] top-2 bottom-2 w-px bg-gradient-to-b from-emerald-500/40 via-orange-500/40 to-sky-500/30" />
        <div className="space-y-2">
          {items.map((item) => {
            const meta = STATUS_META[item.status];
            const isOpen = expanded === item.id;
            return (
              <div key={item.id} className="relative">
                {/* Node */}
                <span className="absolute -left-5 top-3.5 flex h-[18px] w-[18px] items-center justify-center">
                  {item.status === "completed" ? (
                    <CheckCircle2 className="h-[18px] w-[18px] text-emerald-400 bg-slate-900 rounded-full" />
                  ) : item.status === "in_progress" ? (
                    <>
                      <span className={`absolute h-2.5 w-2.5 rounded-full ${meta.dot} animate-ping opacity-60`} />
                      <span className={`relative h-2.5 w-2.5 rounded-full ${meta.dot} ring-4 ring-orange-500/15`} />
                    </>
                  ) : (
                    <span className={`h-2.5 w-2.5 rounded-full ${meta.dot} opacity-70 ring-4 ring-sky-500/10`} />
                  )}
                </span>

                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setExpanded(isOpen ? null : item.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setExpanded(isOpen ? null : item.id);
                    }
                  }}
                  aria-expanded={isOpen}
                  className={`w-full text-left rounded-lg border p-3 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400/60 ${
                    isOpen
                      ? "bg-slate-800/70 border-orange-500/40"
                      : "bg-gradient-to-r from-orange-500/10 to-amber-500/5 border-orange-500/20 hover:border-orange-500/40 hover:bg-slate-800/50"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <item.Icon className="h-4 w-4 text-orange-400/90 flex-shrink-0" />
                      <p className="text-sm font-medium truncate">{item.title}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {item.isFuture && (
                        <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-violet-300 bg-violet-500/15 border border-violet-500/30 rounded-full px-2 py-0.5">
                          <Radio className="h-2.5 w-2.5" /> Future Project
                        </span>
                      )}
                      <span className={`text-[10px] font-semibold uppercase tracking-wide rounded-full border px-2 py-0.5 ${meta.badge}`}>
                        {meta.label}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 mt-1 text-[11px] text-muted-foreground">
                    <CalendarClock className="h-3 w-3" />
                    {quarterLabel(item.quarterIdx)}
                  </div>

                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25, ease: "easeOut" }}
                        className="overflow-hidden"
                      >
                        <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                          {item.description}
                        </p>
                        <Link
                          href={item.href}
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1.5 mt-2 text-xs font-semibold text-orange-300 hover:text-orange-200 transition-colors"
                        >
                          {item.linkLabel}
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground mt-3">
        Milestones sync with the live Boostify ecosystem — tap any item to open its module.
      </p>
    </div>
  );
}

export default RoadmapTimeline;
