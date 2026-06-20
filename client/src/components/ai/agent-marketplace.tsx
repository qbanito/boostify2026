import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Star,
  Download,
  Trash2,
  Filter,
  Sparkles,
  CheckCircle2,
  ShoppingBag,
  TrendingUp,
  Users,
  Zap,
  Music2,
  Video,
  Camera,
  Briefcase,
  Brain,
  ChevronRight,
  ExternalLink,
  ArrowLeft,
  Play,
  Layers,
  Package,
  Settings,
  Shield,
  Award,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
import { useAuth } from "../../hooks/use-auth";

// Types
interface MarketplaceListing {
  id: number;
  authorName: string;
  name: string;
  slug: string;
  shortDescription: string;
  longDescription: string;
  agentType: string;
  category: string;
  tags: string[];
  iconUrl?: string;
  coverImageUrl?: string;
  color: string;
  price: string;
  isFree: boolean;
  configuration: any;
  requiredPlan: string;
  compatibleAgents?: string[];
  installCount: number;
  avgRating: string;
  ratingCount: number;
  status: string;
  isFeatured: boolean;
  isVerified: boolean;
  publishedAt: string;
}

interface InstalledItem {
  install: { id: number; userId: number; listingId: number; rating?: number; review?: string; isActive: boolean };
  listing: MarketplaceListing;
}

const CATEGORIES = [
  { value: "all", label: "All", icon: Layers },
  { value: "workflow", label: "Workflows", icon: Zap },
  { value: "template", label: "Templates", icon: Brain },
  { value: "prompt-pack", label: "Prompts", icon: Sparkles },
  { value: "automation", label: "Automation", icon: Settings },
  { value: "toolkit", label: "Toolkits", icon: Package },
  { value: "integration", label: "Integrations", icon: ExternalLink },
];

const AGENT_TYPE_ICONS: Record<string, any> = {
  composer: Music2,
  "video-director": Video,
  photographer: Camera,
  marketing: TrendingUp,
  "social-media": Users,
  merchandise: ShoppingBag,
  manager: Briefcase,
  "multi-agent": Brain,
  custom: Sparkles,
};

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

export function AgentMarketplace() {
  const { user } = useAuth();
  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [featured, setFeatured] = useState<MarketplaceListing[]>([]);
  const [installed, setInstalled] = useState<InstalledItem[]>([]);
  const [installedIds, setInstalledIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedListing, setSelectedListing] = useState<MarketplaceListing | null>(null);
  const [installing, setInstalling] = useState<number | null>(null);
  const [seeding, setSeeding] = useState(false);

  // Featured + installed: fetch once on mount / when user changes
  useEffect(() => {
    fetchFeatured();
    if (user) fetchInstalled();
  }, [user]);

  // Listings: fetch on first mount + whenever search/category changes,
  // with a 300ms debounce on `search` to avoid hammering the API on every keystroke.
  useEffect(() => {
    const handle = setTimeout(() => {
      fetchListings();
    }, search ? 300 : 0); // immediate when clearing, debounce while typing
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, selectedCategory]);

  async function fetchListings() {
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (selectedCategory !== "all") params.set("category", selectedCategory);
      params.set("limit", "50");

      const res = await fetch(`/api/marketplace/agents?${params}`);
      const data = await res.json();
      if (data.success) setListings(data.listings);
    } catch (err) {
      console.error("Error fetching marketplace:", err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchFeatured() {
    try {
      const res = await fetch("/api/marketplace/agents/featured");
      const data = await res.json();
      if (data.success) setFeatured(data.listings);
    } catch (err) {
      console.error("Error fetching featured:", err);
    }
  }

  async function fetchInstalled() {
    try {
      const res = await fetch("/api/marketplace/agents/user/installed", { credentials: "include" });
      const data = await res.json();
      if (data.success) {
        setInstalled(data.installed);
        setInstalledIds(new Set(data.installed.map((i: InstalledItem) => i.listing.id)));
      }
    } catch (err) {
      console.error("Error fetching installed:", err);
    }
  }

  async function handleInstall(listingId: number) {
    setInstalling(listingId);
    try {
      const res = await fetch(`/api/marketplace/agents/${listingId}/install`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (data.success) {
        setInstalledIds((prev) => new Set([...prev, listingId]));
        setListings((prev) =>
          prev.map((l) => (l.id === listingId ? { ...l, installCount: l.installCount + 1 } : l))
        );
        if (selectedListing?.id === listingId) {
          setSelectedListing((prev) => prev ? { ...prev, installCount: prev.installCount + 1 } : null);
        }
        fetchInstalled();
      }
    } catch (err) {
      console.error("Error installing:", err);
    } finally {
      setInstalling(null);
    }
  }

  async function handleUninstall(listingId: number) {
    setInstalling(listingId);
    try {
      const res = await fetch(`/api/marketplace/agents/${listingId}/uninstall`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (data.success) {
        setInstalledIds((prev) => {
          const next = new Set(prev);
          next.delete(listingId);
          return next;
        });
        setListings((prev) =>
          prev.map((l) =>
            l.id === listingId ? { ...l, installCount: Math.max(l.installCount - 1, 0) } : l
          )
        );
        fetchInstalled();
      }
    } catch (err) {
      console.error("Error uninstalling:", err);
    } finally {
      setInstalling(null);
    }
  }

  async function handleSeed() {
    setSeeding(true);
    try {
      const res = await fetch("/api/marketplace/agents/seed", {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (data.success) {
        fetchListings();
        fetchFeatured();
      }
    } catch (err) {
      console.error("Error seeding:", err);
    } finally {
      setSeeding(false);
    }
  }

  function renderStars(rating: number) {
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`h-3.5 w-3.5 ${
              star <= Math.round(rating)
                ? "text-yellow-400 fill-yellow-400"
                : "text-gray-600"
            }`}
          />
        ))}
      </div>
    );
  }

  // Detail view for a selected listing
  if (selectedListing) {
    const AgentIcon = AGENT_TYPE_ICONS[selectedListing.agentType] || Brain;
    const isInstalled = installedIds.has(selectedListing.id);
    const config = selectedListing.configuration;

    return (
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        className="space-y-6"
      >
        {/* Back button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSelectedListing(null)}
          className="text-gray-400 hover:text-white gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Marketplace
        </Button>

        {/* Header card */}
        <Card className="bg-[#1C1C24] border-[#27272A] overflow-hidden">
          <div className={`h-2 bg-gradient-to-r ${selectedListing.color || "from-orange-500 to-amber-600"}`} />
          <CardContent className="p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row gap-6">
              <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${selectedListing.color || "from-orange-500 to-amber-600"} flex items-center justify-center flex-shrink-0`}>
                <AgentIcon className="h-8 w-8 text-white" />
              </div>
              <div className="flex-1 space-y-3">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                      {selectedListing.name}
                      {selectedListing.isVerified && (
                        <Shield className="h-5 w-5 text-blue-400" />
                      )}
                    </h2>
                    <p className="text-gray-400 text-sm">by {selectedListing.authorName}</p>
                  </div>
                  {isInstalled ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleUninstall(selectedListing.id)}
                      disabled={installing === selectedListing.id}
                      className="border-red-500/30 text-red-400 hover:bg-red-500/10 gap-2"
                    >
                      <Trash2 className="h-4 w-4" />
                      {installing === selectedListing.id ? "Removing..." : "Uninstall"}
                    </Button>
                  ) : (
                    <Button
                      onClick={() => handleInstall(selectedListing.id)}
                      disabled={installing === selectedListing.id}
                      className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white gap-2"
                    >
                      <Download className="h-4 w-4" />
                      {installing === selectedListing.id ? "Installing..." : "Install Free"}
                    </Button>
                  )}
                </div>

                <p className="text-gray-300">{selectedListing.shortDescription}</p>

                <div className="flex items-center gap-4 flex-wrap text-sm">
                  <div className="flex items-center gap-1.5">
                    {renderStars(Number(selectedListing.avgRating))}
                    <span className="text-white font-medium ml-1">{Number(selectedListing.avgRating).toFixed(1)}</span>
                    <span className="text-gray-500">({selectedListing.ratingCount})</span>
                  </div>
                  <div className="flex items-center gap-1 text-gray-400">
                    <Download className="h-3.5 w-3.5" />
                    {selectedListing.installCount.toLocaleString()} installs
                  </div>
                  <Badge variant="outline" className="border-[#27272A] text-gray-300 text-xs">
                    {selectedListing.category}
                  </Badge>
                  <Badge variant="outline" className="border-[#27272A] text-gray-300 text-xs">
                    {selectedListing.agentType}
                  </Badge>
                </div>

                {selectedListing.tags?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {selectedListing.tags.map((tag) => (
                      <Badge key={tag} className="bg-[#27272A] text-gray-400 text-xs border-0">
                        #{tag}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Description & details */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card className="bg-[#1C1C24] border-[#27272A]">
              <CardHeader>
                <CardTitle className="text-white text-lg">Description</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-300 leading-relaxed whitespace-pre-line">
                  {selectedListing.longDescription}
                </p>
              </CardContent>
            </Card>

            {/* Steps (for multi-agent / workflow) */}
            {config?.steps && config.steps.length > 0 && (
              <Card className="bg-[#1C1C24] border-[#27272A]">
                <CardHeader>
                  <CardTitle className="text-white text-lg flex items-center gap-2">
                    <Play className="h-5 w-5 text-orange-500" />
                    Workflow Steps
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {config.steps.map((step: any, i: number) => {
                    const StepIcon = AGENT_TYPE_ICONS[step.agentType] || Brain;
                    return (
                      <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-[#0F0F13] border border-[#27272A]">
                        <div className="w-7 h-7 rounded-full bg-orange-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <span className="text-orange-400 text-xs font-bold">{i + 1}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="text-white font-medium text-sm">{step.name}</h4>
                            <Badge variant="outline" className="border-[#27272A] text-gray-400 text-[10px] py-0">
                              <StepIcon className="h-3 w-3 mr-1" />
                              {step.agentType}
                            </Badge>
                          </div>
                          <p className="text-gray-400 text-xs">{step.description}</p>
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {config?.requiredInputs && config.requiredInputs.length > 0 && (
              <Card className="bg-[#1C1C24] border-[#27272A]">
                <CardHeader className="pb-3">
                  <CardTitle className="text-white text-sm flex items-center gap-2">
                    <Settings className="h-4 w-4 text-orange-500" />
                    Required Inputs
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {config.requiredInputs.map((input: any) => (
                    <div key={input.key} className="flex items-center justify-between p-2 rounded bg-[#0F0F13] border border-[#27272A]">
                      <span className="text-gray-300 text-sm">{input.label}</span>
                      {input.required && (
                        <Badge className="bg-orange-500/10 text-orange-400 border-0 text-[10px]">Required</Badge>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            <Card className="bg-[#1C1C24] border-[#27272A]">
              <CardHeader className="pb-3">
                <CardTitle className="text-white text-sm">Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Plan Required</span>
                  <span className="text-white capitalize">{selectedListing.requiredPlan}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Price</span>
                  <span className="text-green-400 font-medium">Free</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Category</span>
                  <span className="text-white capitalize">{selectedListing.category}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Agent Type</span>
                  <span className="text-white capitalize">{selectedListing.agentType}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </motion.div>
    );
  }

  // Grid view
  return (
    <div className="space-y-6">
      {/* Header row */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <ShoppingBag className="h-5 w-5 text-orange-500" />
            Agent Marketplace
          </h2>
          <p className="text-gray-400 text-sm mt-1">
            Discover pre-built workflows, templates and automations for your AI agents
          </p>
        </div>
        {listings.length === 0 && !loading && (
          <Button
            onClick={handleSeed}
            disabled={seeding}
            size="sm"
            className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white gap-2"
          >
            <Sparkles className="h-4 w-4" />
            {seeding ? "Populating..." : "Populate Marketplace"}
          </Button>
        )}
      </div>

      {/* Search + category filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
          <Input
            placeholder="Search agents, workflows..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-[#1C1C24] border-[#27272A] text-white placeholder:text-gray-500"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {CATEGORIES.map((cat) => {
            const CatIcon = cat.icon;
            return (
              <Button
                key={cat.value}
                variant={selectedCategory === cat.value ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory(cat.value)}
                className={
                  selectedCategory === cat.value
                    ? "bg-orange-500 hover:bg-orange-600 text-white border-0 gap-1.5"
                    : "border-[#27272A] text-gray-400 hover:text-white hover:bg-[#27272A] gap-1.5"
                }
              >
                <CatIcon className="h-3.5 w-3.5" />
                <span className="hidden md:inline">{cat.label}</span>
              </Button>
            );
          })}
        </div>
      </div>

      {/* Featured section */}
      {selectedCategory === "all" && !search && featured.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-3"
        >
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
            <Award className="h-4 w-4 text-yellow-400" />
            Featured
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {featured.slice(0, 4).map((listing) => (
              <FeaturedCard
                key={listing.id}
                listing={listing}
                isInstalled={installedIds.has(listing.id)}
                installing={installing}
                onInstall={handleInstall}
                onUninstall={handleUninstall}
                onClick={() => setSelectedListing(listing)}
                renderStars={renderStars}
              />
            ))}
          </div>
        </motion.div>
      )}

      {/* Installed agents */}
      {installed.length > 0 && selectedCategory === "all" && !search && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-3"
        >
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-400" />
            Installed ({installed.length})
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {installed.map(({ listing }) => (
              <InstalledCard
                key={listing.id}
                listing={listing}
                installing={installing}
                onUninstall={handleUninstall}
                onClick={() => setSelectedListing(listing)}
              />
            ))}
          </div>
        </motion.div>
      )}

      {/* Main listing grid */}
      <div className="space-y-3">
        {(selectedCategory !== "all" || search) && (
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
            {search ? `Results for "${search}"` : CATEGORIES.find((c) => c.value === selectedCategory)?.label}
          </h3>
        )}
        {!selectedCategory || selectedCategory === "all" && !search ? (
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
            <Layers className="h-4 w-4" />
            All Agents
          </h3>
        ) : null}

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-48 rounded-xl bg-[#1C1C24] border border-[#27272A] animate-pulse" />
            ))}
          </div>
        ) : listings.length === 0 ? (
          <Card className="bg-[#1C1C24] border-[#27272A] p-8 text-center">
            <ShoppingBag className="h-12 w-12 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400 mb-2">No agents found</p>
            <p className="text-gray-500 text-sm">Try adjusting your search or filters</p>
          </Card>
        ) : (
          <motion.div
            variants={container}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            {listings.map((listing) => (
              <motion.div key={listing.id} variants={item}>
                <ListingCard
                  listing={listing}
                  isInstalled={installedIds.has(listing.id)}
                  installing={installing}
                  onInstall={handleInstall}
                  onUninstall={handleUninstall}
                  onClick={() => setSelectedListing(listing)}
                  renderStars={renderStars}
                />
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>
    </div>
  );
}

// Sub-components

function FeaturedCard({
  listing,
  isInstalled,
  installing,
  onInstall,
  onUninstall,
  onClick,
  renderStars,
}: {
  listing: MarketplaceListing;
  isInstalled: boolean;
  installing: number | null;
  onInstall: (id: number) => void;
  onUninstall: (id: number) => void;
  onClick: () => void;
  renderStars: (r: number) => JSX.Element;
}) {
  const AgentIcon = AGENT_TYPE_ICONS[listing.agentType] || Brain;

  return (
    <Card
      className="bg-[#1C1C24] border-[#27272A] hover:border-orange-500/40 transition-all cursor-pointer group overflow-hidden"
      onClick={onClick}
    >
      <div className={`h-1.5 bg-gradient-to-r ${listing.color || "from-orange-500 to-amber-600"}`} />
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start gap-3">
          <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${listing.color || "from-orange-500 to-amber-600"} flex items-center justify-center flex-shrink-0`}>
            <AgentIcon className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-white font-semibold text-sm truncate group-hover:text-orange-400 transition-colors flex items-center gap-1">
              {listing.name}
              {listing.isVerified && <Shield className="h-3.5 w-3.5 text-blue-400 flex-shrink-0" />}
            </h4>
            <p className="text-gray-500 text-xs">{listing.authorName}</p>
          </div>
        </div>
        <p className="text-gray-400 text-xs line-clamp-2">{listing.shortDescription}</p>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {renderStars(Number(listing.avgRating))}
            <span className="text-gray-500 text-xs">({listing.ratingCount})</span>
          </div>
          <div className="flex items-center gap-1 text-gray-500 text-xs">
            <Download className="h-3 w-3" />
            {listing.installCount}
          </div>
        </div>
        <div onClick={(e) => e.stopPropagation()}>
          {isInstalled ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onUninstall(listing.id)}
              disabled={installing === listing.id}
              className="w-full border-green-500/30 text-green-400 hover:bg-green-500/10 text-xs h-8"
            >
              <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
              Installed
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={() => onInstall(listing.id)}
              disabled={installing === listing.id}
              className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white text-xs h-8"
            >
              <Download className="h-3.5 w-3.5 mr-1" />
              {installing === listing.id ? "..." : "Install"}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ListingCard({
  listing,
  isInstalled,
  installing,
  onInstall,
  onUninstall,
  onClick,
  renderStars,
}: {
  listing: MarketplaceListing;
  isInstalled: boolean;
  installing: number | null;
  onInstall: (id: number) => void;
  onUninstall: (id: number) => void;
  onClick: () => void;
  renderStars: (r: number) => JSX.Element;
}) {
  const AgentIcon = AGENT_TYPE_ICONS[listing.agentType] || Brain;

  return (
    <Card
      className="bg-[#1C1C24] border-[#27272A] hover:border-orange-500/30 transition-all cursor-pointer group"
      onClick={onClick}
    >
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start gap-3">
          <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${listing.color || "from-orange-500 to-amber-600"} flex items-center justify-center flex-shrink-0`}>
            <AgentIcon className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <h4 className="text-white font-semibold text-sm truncate group-hover:text-orange-400 transition-colors">
                {listing.name}
              </h4>
              {listing.isVerified && <Shield className="h-3.5 w-3.5 text-blue-400 flex-shrink-0" />}
              {listing.isFeatured && <Award className="h-3.5 w-3.5 text-yellow-400 flex-shrink-0" />}
            </div>
            <p className="text-gray-500 text-[11px]">{listing.authorName}</p>
          </div>
          <Badge variant="outline" className="border-[#27272A] text-gray-400 text-[10px] py-0 flex-shrink-0">
            {listing.category}
          </Badge>
        </div>

        <p className="text-gray-400 text-xs line-clamp-2 min-h-[2rem]">{listing.shortDescription}</p>

        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-2">
            {renderStars(Number(listing.avgRating))}
            <span className="text-gray-500 text-[11px]">
              {Number(listing.avgRating).toFixed(1)} ({listing.ratingCount})
            </span>
          </div>
          <div className="flex items-center gap-1 text-gray-500 text-xs">
            <Download className="h-3 w-3" />
            {listing.installCount.toLocaleString()}
          </div>
        </div>

        <div onClick={(e) => e.stopPropagation()}>
          {isInstalled ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onUninstall(listing.id)}
              disabled={installing === listing.id}
              className="w-full border-green-500/30 text-green-400 hover:bg-green-500/10 text-xs h-8"
            >
              <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
              Installed
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={() => onInstall(listing.id)}
              disabled={installing === listing.id}
              className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white text-xs h-8"
            >
              <Download className="h-3.5 w-3.5 mr-1" />
              {installing === listing.id ? "Installing..." : "Install Free"}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function InstalledCard({
  listing,
  installing,
  onUninstall,
  onClick,
}: {
  listing: MarketplaceListing;
  installing: number | null;
  onUninstall: (id: number) => void;
  onClick: () => void;
}) {
  const AgentIcon = AGENT_TYPE_ICONS[listing.agentType] || Brain;

  return (
    <Card
      className="bg-[#0F0F13] border-[#27272A] hover:border-green-500/30 transition-all cursor-pointer group"
      onClick={onClick}
    >
      <CardContent className="p-3 flex items-center gap-3">
        <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${listing.color || "from-orange-500 to-amber-600"} flex items-center justify-center flex-shrink-0`}>
          <AgentIcon className="h-4 w-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-white text-sm font-medium truncate">{listing.name}</h4>
          <p className="text-gray-500 text-[11px] truncate">{listing.shortDescription}</p>
        </div>
        <div onClick={(e) => e.stopPropagation()}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onUninstall(listing.id)}
            disabled={installing === listing.id}
            className="text-gray-500 hover:text-red-400 h-8 w-8 p-0"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
