import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  ArrowRight,
  BadgeDollarSign,
  BarChart3,
  Bot,
  Boxes,
  BriefcaseBusiness,
  Clapperboard,
  Compass,
  FileText,
  Headphones,
  Image,
  Megaphone,
  Mic2,
  Music2,
  Radio,
  Search,
  Settings,
  Shirt,
  ShoppingBag,
  Sparkles,
  Store,
  Users,
  Wand2,
  Wrench,
} from "lucide-react";
import Layout from "../components/layout";
import { Badge } from "../components/ui/badge";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { cn } from "../lib/utils";

type CategoryId = "all" | "studio" | "artists" | "growth" | "ai" | "market" | "ops";

interface ExploreItem {
  title: string;
  subtitle: string;
  href: string;
  category: Exclude<CategoryId, "all">;
  plan: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
  tags: string[];
}

const categories: Array<{ id: CategoryId; label: string }> = [
  { id: "all", label: "Todo" },
  { id: "studio", label: "Studio" },
  { id: "artists", label: "Artistas" },
  { id: "growth", label: "Crecimiento" },
  { id: "ai", label: "AI" },
  { id: "market", label: "Marketplace" },
  { id: "ops", label: "Operaciones" },
];

const exploreItems: ExploreItem[] = [
  {
    title: "Mini Studio",
    subtitle: "Timeline, mixer, vocal booth, AI Lab y sesiones por artista.",
    href: "/mini-studio",
    category: "studio",
    plan: "Free",
    icon: Headphones,
    accent: "bg-cyan-500/15 text-cyan-300 border-cyan-400/30",
    tags: ["daw", "mixer", "tracks", "stems"],
  },
  {
    title: "Producer Tools",
    subtitle: "Herramientas para producción, edición y preparación de canciones.",
    href: "/producer-tools",
    category: "studio",
    plan: "Pro",
    icon: Wrench,
    accent: "bg-emerald-500/15 text-emerald-300 border-emerald-400/30",
    tags: ["produccion", "audio", "tools"],
  },
  {
    title: "Music Generator",
    subtitle: "Generación musical para ideas, demos y referencias de trabajo.",
    href: "/music-generator",
    category: "studio",
    plan: "Pro",
    icon: Music2,
    accent: "bg-violet-500/15 text-violet-300 border-violet-400/30",
    tags: ["musica", "generador", "ideas"],
  },
  {
    title: "Mastering Room",
    subtitle: "Pulido final, loudness y preparación de masters para release.",
    href: "/music-mastering",
    category: "studio",
    plan: "Pro",
    icon: Radio,
    accent: "bg-amber-500/15 text-amber-300 border-amber-400/30",
    tags: ["master", "loudness", "release"],
  },
  {
    title: "Mis Artistas",
    subtitle: "Perfiles, canciones y proyectos separados por artista.",
    href: "/my-artists",
    category: "artists",
    plan: "Free",
    icon: Users,
    accent: "bg-sky-500/15 text-sky-300 border-sky-400/30",
    tags: ["artistas", "canciones", "perfiles"],
  },
  {
    title: "Artist Dashboard",
    subtitle: "Panel central del artista con métricas, catálogo y acciones.",
    href: "/artist-dashboard",
    category: "artists",
    plan: "Artist",
    icon: BriefcaseBusiness,
    accent: "bg-lime-500/15 text-lime-300 border-lime-400/30",
    tags: ["dashboard", "catalogo", "artist"],
  },
  {
    title: "Artist Generator",
    subtitle: "Creación de identidad, concepto visual y dirección artística.",
    href: "/artist-generator",
    category: "artists",
    plan: "Premium",
    icon: Sparkles,
    accent: "bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-400/30",
    tags: ["identidad", "branding", "artist"],
  },
  {
    title: "AI Agents",
    subtitle: "Agentes para marketing, estrategia, operaciones y contenido.",
    href: "/ai-agents",
    category: "ai",
    plan: "Pro",
    icon: Bot,
    accent: "bg-indigo-500/15 text-indigo-300 border-indigo-400/30",
    tags: ["agents", "ai", "automatizacion"],
  },
  {
    title: "AI Advisors",
    subtitle: "Asesores inteligentes para decisiones de carrera y campaña.",
    href: "/ai-advisors",
    category: "ai",
    plan: "Basic",
    icon: Wand2,
    accent: "bg-teal-500/15 text-teal-300 border-teal-400/30",
    tags: ["advisor", "estrategia", "ai"],
  },
  {
    title: "AI Video Creation",
    subtitle: "Flujos de video musical, conceptos y piezas promocionales.",
    href: "/ai-video-creation",
    category: "ai",
    plan: "Pro",
    icon: Clapperboard,
    accent: "bg-red-500/15 text-red-300 border-red-400/30",
    tags: ["video", "ai", "clips"],
  },
  {
    title: "Promotion",
    subtitle: "Campanas para alcance, visibilidad y crecimiento de audiencia.",
    href: "/promotion",
    category: "growth",
    plan: "Basic",
    icon: Megaphone,
    accent: "bg-orange-500/15 text-orange-300 border-orange-400/30",
    tags: ["promo", "marketing", "campanas"],
  },
  {
    title: "Analytics",
    subtitle: "Lectura de datos, audiencia y rendimiento de lanzamientos.",
    href: "/analytics",
    category: "growth",
    plan: "Pro",
    icon: BarChart3,
    accent: "bg-blue-500/15 text-blue-300 border-blue-400/30",
    tags: ["analytics", "metricas", "growth"],
  },
  {
    title: "Social Network",
    subtitle: "Feed, comunidad y actividad social dentro de Boostify.",
    href: "/social-network",
    category: "growth",
    plan: "Free",
    icon: Compass,
    accent: "bg-rose-500/15 text-rose-300 border-rose-400/30",
    tags: ["social", "fans", "community"],
  },
  {
    title: "Store",
    subtitle: "Productos, ventas y experiencias para fans.",
    href: "/store",
    category: "market",
    plan: "Free",
    icon: Store,
    accent: "bg-emerald-500/15 text-emerald-300 border-emerald-400/30",
    tags: ["tienda", "ventas", "fans"],
  },
  {
    title: "Merchandise",
    subtitle: "Merch, mockups y productos conectados al artista.",
    href: "/merchandise",
    category: "market",
    plan: "Artist",
    icon: Shirt,
    accent: "bg-pink-500/15 text-pink-300 border-pink-400/30",
    tags: ["merch", "productos", "artist"],
  },
  {
    title: "BoostiSwap",
    subtitle: "Web3, tokenizacion y economia del ecosistema Boostify.",
    href: "/boostiswap",
    category: "market",
    plan: "Public",
    icon: BadgeDollarSign,
    accent: "bg-yellow-500/15 text-yellow-300 border-yellow-400/30",
    tags: ["web3", "token", "market"],
  },
  {
    title: "Kling Store",
    subtitle: "Recursos y herramientas avanzadas para video generativo.",
    href: "/kling-store",
    category: "market",
    plan: "Premium",
    icon: ShoppingBag,
    accent: "bg-purple-500/15 text-purple-300 border-purple-400/30",
    tags: ["video", "store", "generativo"],
  },
  {
    title: "Resources",
    subtitle: "Guias, ideas y recursos para planificar la carrera artistica.",
    href: "/resources",
    category: "ops",
    plan: "Public",
    icon: FileText,
    accent: "bg-slate-500/15 text-slate-200 border-slate-400/30",
    tags: ["recursos", "guias", "docs"],
  },
  {
    title: "Tools",
    subtitle: "Calculadoras, checklist de release y utilidades rapidas.",
    href: "/tools",
    category: "ops",
    plan: "Public",
    icon: Boxes,
    accent: "bg-cyan-500/15 text-cyan-300 border-cyan-400/30",
    tags: ["tools", "release", "calculadora"],
  },
  {
    title: "Settings",
    subtitle: "Cuenta, preferencias y configuracion del workspace.",
    href: "/settings",
    category: "ops",
    plan: "Free",
    icon: Settings,
    accent: "bg-zinc-500/15 text-zinc-200 border-zinc-400/30",
    tags: ["ajustes", "cuenta", "configuracion"],
  },
  {
    title: "Image Generator",
    subtitle: "Visuales para portada, promo y contenido del artista.",
    href: "/image-generator",
    category: "ai",
    plan: "Pro",
    icon: Image,
    accent: "bg-green-500/15 text-green-300 border-green-400/30",
    tags: ["imagen", "cover", "visual"],
  },
  {
    title: "Vocal Booth",
    subtitle: "Grabacion vocal y preparacion de tomas desde el estudio.",
    href: "/mini-studio",
    category: "studio",
    plan: "Free",
    icon: Mic2,
    accent: "bg-red-500/15 text-red-300 border-red-400/30",
    tags: ["vocal", "record", "studio"],
  },
];

function getInitialCategory(location: string): CategoryId {
  return location.startsWith("/marketplace") ? "market" : "all";
}

export default function ExplorePage() {
  const [location] = useLocation();
  const [activeCategory, setActiveCategory] = useState<CategoryId>(() => getInitialCategory(location));
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    setActiveCategory(getInitialCategory(location));
  }, [location]);

  const filteredItems = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return exploreItems.filter((item) => {
      const matchesCategory = activeCategory === "all" || item.category === activeCategory;
      const matchesSearch =
        normalizedSearch.length === 0 ||
        item.title.toLowerCase().includes(normalizedSearch) ||
        item.subtitle.toLowerCase().includes(normalizedSearch) ||
        item.tags.some((tag) => tag.includes(normalizedSearch));

      return matchesCategory && matchesSearch;
    });
  }, [activeCategory, searchTerm]);

  const featuredItems = useMemo(() => {
    const source = activeCategory === "all" ? exploreItems : exploreItems.filter((item) => item.category === activeCategory);
    return source.slice(0, 4);
  }, [activeCategory]);

  const categoryCounts = useMemo(() => {
    return categories.reduce<Record<CategoryId, number>>((counts, category) => {
      counts[category.id] = category.id === "all"
        ? exploreItems.length
        : exploreItems.filter((item) => item.category === category.id).length;
      return counts;
    }, {} as Record<CategoryId, number>);
  }, []);

  return (
    <Layout>
      <main className="min-h-screen bg-[#080b10] text-white">
        <section className="border-b border-white/10 bg-[#0d121a]">
          <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl">
                <div className="mb-3 inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/5 px-3 py-1 text-sm text-slate-300">
                  <Compass className="h-4 w-4 text-cyan-300" />
                  Boostify Explore
                </div>
                <h1 className="text-3xl font-semibold text-white sm:text-4xl">Explorar</h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
                  Acceso directo a Studio, artistas, AI, crecimiento, marketplace y operaciones desde un solo panel.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2 rounded-lg border border-white/10 bg-black/20 p-2 text-center">
                <div className="px-3 py-2">
                  <div className="text-lg font-semibold text-white">{exploreItems.length}</div>
                  <div className="text-xs text-slate-400">modulos</div>
                </div>
                <div className="px-3 py-2">
                  <div className="text-lg font-semibold text-white">7</div>
                  <div className="text-xs text-slate-400">areas</div>
                </div>
                <div className="px-3 py-2">
                  <div className="text-lg font-semibold text-white">100%</div>
                  <div className="text-xs text-slate-400">rutas</div>
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {featuredItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.title}
                    href={item.href}
                    className="group flex min-h-[112px] flex-col justify-between rounded-lg border border-white/10 bg-white/[0.04] p-4 transition hover:border-cyan-300/50 hover:bg-white/[0.07] focus:outline-none focus:ring-2 focus:ring-cyan-300/60"
                  >
                      <div className="flex items-center justify-between gap-3">
                        <span className={cn("inline-flex h-10 w-10 items-center justify-center rounded-md border", item.accent)}>
                          <Icon className="h-5 w-5" />
                        </span>
                        <ArrowRight className="h-4 w-4 text-slate-500 transition group-hover:translate-x-1 group-hover:text-cyan-200" />
                      </div>
                      <div>
                        <div className="mt-4 text-sm font-semibold text-white">{item.title}</div>
                        <div className="mt-1 text-xs text-slate-400">{item.plan}</div>
                      </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full lg:max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Buscar herramienta, sala o flujo"
                className="h-11 border-white/10 bg-white/[0.04] pl-10 text-white placeholder:text-slate-500 focus-visible:ring-cyan-400"
              />
            </div>

            <div className="flex gap-2 overflow-x-auto pb-1 lg:pb-0">
              {categories.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => setActiveCategory(category.id)}
                  className={cn(
                    "inline-flex h-10 shrink-0 items-center gap-2 rounded-md border px-3 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-cyan-300/60",
                    activeCategory === category.id
                      ? "border-cyan-300/60 bg-cyan-300/15 text-cyan-100"
                      : "border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/25 hover:bg-white/[0.07]"
                  )}
                >
                  {category.label}
                  <span className="rounded bg-black/25 px-1.5 py-0.5 text-xs text-slate-300">{categoryCounts[category.id]}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredItems.map((item) => {
              const Icon = item.icon;
              return (
                <Card key={`${item.title}-${item.href}`} className="border-white/10 bg-white/[0.04] text-white shadow-none">
                  <CardHeader className="space-y-4">
                    <div className="flex items-start justify-between gap-4">
                      <span className={cn("inline-flex h-11 w-11 items-center justify-center rounded-md border", item.accent)}>
                        <Icon className="h-5 w-5" />
                      </span>
                      <Badge variant="outline" className="border-white/15 bg-black/20 text-slate-300">
                        {item.plan}
                      </Badge>
                    </div>
                    <div>
                      <CardTitle className="text-lg text-white">{item.title}</CardTitle>
                      <p className="mt-2 text-sm leading-6 text-slate-300">{item.subtitle}</p>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {item.tags.slice(0, 3).map((tag) => (
                        <span key={tag} className="rounded-md border border-white/10 bg-black/20 px-2 py-1 text-xs text-slate-400">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Link
                      href={item.href}
                      className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-white px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-cyan-100 focus:outline-none focus:ring-2 focus:ring-cyan-300/60"
                    >
                      Abrir
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </CardFooter>
                </Card>
              );
            })}
          </div>

          {filteredItems.length === 0 && (
            <div className="mt-10 rounded-lg border border-white/10 bg-white/[0.04] px-6 py-10 text-center">
              <Search className="mx-auto h-8 w-8 text-slate-500" />
              <h2 className="mt-4 text-lg font-semibold text-white">No hay resultados</h2>
              <p className="mt-2 text-sm text-slate-400">Prueba otra busqueda o cambia de categoria.</p>
            </div>
          )}
        </section>
      </main>
    </Layout>
  );
}
