import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Music,
  Video,
  ImageIcon,
  Users,
  Ticket,
  Zap,
  ShieldCheck,
  Star,
  Sparkles,
  Headphones,
  BadgeCheck,
  Palette,
} from "lucide-react";
import { UtilityDisclaimer } from "@/components/btf/utility-disclaimer";

const utilityMetrics = [
  { icon: Zap, label: "Active Services", value: "12+", sub: "AI tools available now" },
  { icon: Music, label: "AI Songs Generated", value: "50K+", sub: "Across all artists" },
  { icon: Video, label: "Videos Created", value: "8K+", sub: "With AI generation" },
  { icon: Users, label: "Artist Access Packs", value: "1,000+", sub: "Artist profiles activated" },
];

const accessBenefits = [
  { icon: Music, title: "Exclusive Song Access", desc: "Unlock premium tracks and special editions before public release." },
  { icon: Sparkles, title: "AI Visualizer", desc: "Generate custom animated visuals for any song using AI." },
  { icon: ImageIcon, title: "Cover Artwork Generation", desc: "Create professional cover art with AI tools." },
  { icon: Headphones, title: "Behind-the-Scenes Content", desc: "Access private studio sessions and creative process content." },
  { icon: Users, title: "Community Access", desc: "Join exclusive artist communities and fan groups." },
  { icon: Ticket, title: "Early Release Access", desc: "Get new music and content before the general public." },
  { icon: Palette, title: "Creative Voting", desc: "Vote on setlists, cover art, remix direction, and more." },
  { icon: BadgeCheck, title: "Digital Collectibles", desc: "Own limited-edition digital assets tied to the artist's catalog." },
];

const roadmap = [
  { quarter: "Q2 2025", title: "Exclusive Release Packs", desc: "First artist access packs launched" },
  { quarter: "Q3 2025", title: "AI Visualizer Collection", desc: "AI-generated visual experiences" },
  { quarter: "Q4 2025", title: "Music Production Courses", desc: "Creator education unlocked with BTF Credits" },
  { quarter: "Q1 2026", title: "Collaborative Remix Experience", desc: "Fan-driven remixes and creative voting" },
  { quarter: "Q2 2026", title: "Live Event Access", desc: "Virtual front-row and backstage digital passes" },
  { quarter: "Q3 2026", title: "Full Creator Suite", desc: "All AI tools, campaigns, and content in one place" },
];

/** @deprecated Name kept for backward compat — now renders UtilityValueSection */
export function InvestmentPotential() {
  return (
    <section className="relative py-24 px-4 bg-gradient-to-b from-slate-900 to-black overflow-hidden">
      {/* Background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-gradient-to-l from-orange-500/10 to-transparent rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-0 w-96 h-96 bg-gradient-to-r from-purple-500/10 to-transparent rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 container mx-auto max-w-6xl">
        {/* Header */}
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            <span className="bg-gradient-to-r from-orange-400 via-pink-400 to-purple-400 bg-clip-text text-transparent">
              Utility Access
            </span>
          </h2>
          <p className="text-lg text-slate-300 max-w-2xl mx-auto">
            BTF Credits unlock real digital services inside Boostify — AI tools, exclusive content, artist access packs, and creative experiences.
          </p>
        </div>

        {/* Platform Activity Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-12">
          {utilityMetrics.map((metric, i) => {
            const Icon = metric.icon;
            return (
              <Card key={i} className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 border-slate-700/50 hover:border-orange-500/30 transition">
                <CardContent className="pt-6">
                  <Icon className="w-8 h-8 text-orange-400 mb-3" />
                  <p className="text-2xl font-bold text-white mb-1">{metric.value}</p>
                  <p className="text-sm text-slate-300 font-medium">{metric.label}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{metric.sub}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Access Benefits Grid */}
        <Card className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 border-slate-700/50 mb-12">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-orange-400" />
              What BTF Credits Unlock
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {accessBenefits.map((benefit, i) => {
                const Icon = benefit.icon;
                return (
                  <div key={i} className="bg-white/5 rounded-xl p-4 hover:bg-white/8 transition">
                    <Icon className="w-6 h-6 text-orange-400 mb-2" />
                    <p className="text-sm font-semibold text-white mb-1">{benefit.title}</p>
                    <p className="text-xs text-slate-400">{benefit.desc}</p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Creative Roadmap */}
        <Card className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 border-slate-700/50 mb-10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Star className="w-5 h-5 text-purple-400" />
              Content Activation Roadmap
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {roadmap.map((item, i) => (
                <div key={i} className="bg-white/5 rounded-xl p-4">
                  <span className="text-xs font-mono text-orange-400 mb-1 block">{item.quarter}</span>
                  <p className="font-semibold text-white text-sm mb-1">{item.title}</p>
                  <p className="text-xs text-slate-400">{item.desc}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Legal Disclaimer */}
        <UtilityDisclaimer variant="long" size="sm" className="mt-4" />
      </div>
    </section>
  );
}
