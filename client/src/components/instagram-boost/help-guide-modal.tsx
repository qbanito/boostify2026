import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain,
  Hash,
  Lightbulb,
  Clock,
  User,
  Users,
  TrendingUp,
  BarChart2,
  Sparkles,
  Plug,
  Bot,
  Shield,
  Zap,
  CheckCircle,
  ArrowRight,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Rocket,
  Target,
  Play,
  MessageCircle,
  Chrome,
  RefreshCw,
  Eye,
  Heart,
  Star,
  Calendar,
  UserPlus,
} from 'lucide-react';
import { SiInstagram } from 'react-icons/si';

interface HelpGuideModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface GuideSection {
  id: string;
  icon: any;
  title: string;
  badge?: string;
  badgeColor?: string;
  description: string;
  steps: { icon: any; text: string }[];
}

const sections: GuideSection[] = [
  {
    id: 'ai-tools',
    icon: Brain,
    title: 'AI Tools',
    badge: 'FREE',
    badgeColor: 'bg-green-500/20 text-green-400 border-green-500/30',
    description: 'Generate professional Instagram content using AI assistants.',
    steps: [
      { icon: Sparkles, text: 'Caption Generator — Paste your topic, pick a tone, and get 3 viral captions with emojis and CTAs ready to post.' },
      { icon: Hash, text: 'Hashtag Research — Enter your niche and get 30 hashtags organized by reach (high, medium, niche) for maximum discovery.' },
      { icon: Lightbulb, text: 'Content Ideas — Get 7 fresh post ideas with format (Reel, Carousel, Story) and engagement tips.' },
      { icon: Clock, text: 'Best Time to Post — See your optimal posting schedule based on audience activity patterns.' },
      { icon: User, text: 'Bio Optimizer — Get 3 bio variations with emoji, keywords, and CTA that drive profile visits.' },
    ],
  },
  {
    id: 'extension',
    icon: Plug,
    title: 'Chrome Extension',
    badge: 'KEY FEATURE',
    badgeColor: 'bg-[#833ab4]/20 text-[#833ab4] border-[#833ab4]/30',
    description: 'Connect your real Instagram account for live data and automated actions.',
    steps: [
      { icon: Chrome, text: 'Install the Boostify Chrome Extension from the Chrome Web Store or download the .crx file.' },
      { icon: Shield, text: 'Copy your connection token from the Extension tab and paste it into the extension popup.' },
      { icon: RefreshCw, text: 'The extension syncs your followers, engagement, and posts automatically every few minutes.' },
      { icon: Play, text: 'Queue AI-generated actions (post captions, update bio, add hashtags) that the extension executes for you.' },
      { icon: Eye, text: 'Track every synced snapshot in the history table with timestamps and growth deltas.' },
    ],
  },
  {
    id: 'boostbot',
    icon: Bot,
    title: 'BoostBot AI Assistant',
    badge: 'AI AGENT',
    badgeColor: 'bg-[#fd1d1d]/20 text-[#fd1d1d] border-[#fd1d1d]/30',
    description: 'Your personal Instagram growth expert available 24/7.',
    steps: [
      { icon: MessageCircle, text: 'Click the floating bot icon (bottom-right) to open a conversation.' },
      { icon: Target, text: 'Ask for a full profile audit — BoostBot reads your real metrics and gives a growth score.' },
      { icon: TrendingUp, text: 'Get personalized advice on content strategy, Reels, Stories, and engagement tactics.' },
      { icon: Hash, text: 'Request hashtag sets or captions on-the-fly without switching tabs.' },
      { icon: Zap, text: 'Powered by OpenClaw — when enabled, uses an advanced AI agent for deeper analysis.' },
    ],
  },
  {
    id: 'community',
    icon: Calendar,
    title: 'Community & Calendar',
    badge: 'PRO',
    badgeColor: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    description: 'Plan your content calendar and track community engagement.',
    steps: [
      { icon: Calendar, text: 'Visual content calendar showing scheduled and published posts.' },
      { icon: Heart, text: 'Engagement dashboard with likes, comments, saves, and shares over time.' },
      { icon: Users, text: 'Audience stats showing follower growth, reach, and impressions.' },
      { icon: Star, text: 'Community score tracking your overall account health.' },
    ],
  },
  {
    id: 'influencers',
    icon: UserPlus,
    title: 'Influencer Discovery',
    badge: 'PREMIUM',
    badgeColor: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    description: 'Find and connect with influencers in your niche for collaborations.',
    steps: [
      { icon: Target, text: 'Search influencers by niche, follower range, and engagement rate.' },
      { icon: BarChart2, text: 'Compare metrics side-by-side to find the best match.' },
      { icon: MessageCircle, text: 'Launch outreach campaigns with AI-written messages.' },
      { icon: TrendingUp, text: 'Track collaboration ROI with performance analytics.' },
    ],
  },
  {
    id: 'strategies',
    icon: Sparkles,
    title: 'Growth Strategies',
    badge: 'PREMIUM',
    badgeColor: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    description: 'Data-driven strategies customized for your account.',
    steps: [
      { icon: Target, text: 'Content mix optimizer — get the ideal ratio of entertainment, education, and promotion.' },
      { icon: Hash, text: 'Hashtag library — save and organize hashtag sets by category for quick access.' },
      { icon: Clock, text: 'Posting schedule builder with timezone-aware recommendations.' },
      { icon: Rocket, text: 'Growth playbooks with step-by-step plans based on your current follower count.' },
    ],
  },
];

export function HelpGuideModal({ open, onOpenChange }: HelpGuideModalProps) {
  const [expandedSection, setExpandedSection] = useState<string | null>('ai-tools');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden p-0 rounded-2xl border-[#833ab4]/30">
        <div className="flex flex-col max-h-[90vh]">
          {/* Header */}
          <div className="bg-gradient-to-r from-[#833ab4] via-[#fd1d1d] to-[#fcb045] p-5 sm:p-6">
            <DialogHeader>
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                  <SiInstagram className="h-6 w-6 text-white" />
                </div>
                <div>
                  <DialogTitle className="text-xl font-black text-white">
                    Instagram Growth Suite
                  </DialogTitle>
                  <DialogDescription className="text-white/80 text-sm mt-0.5">
                    Everything you need to grow your Instagram account
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            {/* Quick stats row */}
            <div className="flex flex-wrap gap-3 mt-4">
              {[
                { icon: Brain, label: '5 AI Tools' },
                { icon: Plug, label: 'Chrome Extension' },
                { icon: Bot, label: 'AI Assistant' },
                { icon: Sparkles, label: '6 Modules' },
              ].map((item) => (
                <div
                  key={item.label}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/15 backdrop-blur-sm text-white text-xs font-medium"
                >
                  <item.icon className="h-3 w-3" />
                  {item.label}
                </div>
              ))}
            </div>
          </div>

          {/* Quick Start Banner */}
          <div className="mx-4 sm:mx-5 mt-4 p-3 rounded-xl bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/20">
            <div className="flex items-start gap-2.5">
              <Rocket className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-sm text-foreground">Quick Start — 3 Steps</p>
                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 mt-1 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <span className="h-4 w-4 rounded-full bg-[#833ab4] text-white text-[10px] flex items-center justify-center font-bold">1</span>
                    Select your artist
                  </span>
                  <ArrowRight className="h-3 w-3 hidden sm:block text-muted-foreground/50" />
                  <span className="flex items-center gap-1">
                    <span className="h-4 w-4 rounded-full bg-[#fd1d1d] text-white text-[10px] flex items-center justify-center font-bold">2</span>
                    Generate AI content
                  </span>
                  <ArrowRight className="h-3 w-3 hidden sm:block text-muted-foreground/50" />
                  <span className="flex items-center gap-1">
                    <span className="h-4 w-4 rounded-full bg-[#fcb045] text-white text-[10px] flex items-center justify-center font-bold">3</span>
                    Connect Extension
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Scrollable Sections */}
          <div className="flex-1 overflow-y-auto px-4 sm:px-5 py-4 space-y-2">
            {sections.map((section) => {
              const isExpanded = expandedSection === section.id;
              return (
                <div
                  key={section.id}
                  className={`rounded-xl border transition-all duration-200 ${
                    isExpanded
                      ? 'border-[#833ab4]/30 bg-[#833ab4]/5 shadow-sm'
                      : 'border-border hover:border-[#833ab4]/20 bg-card'
                  }`}
                >
                  {/* Section Header (clickable) */}
                  <button
                    onClick={() => setExpandedSection(isExpanded ? null : section.id)}
                    className="w-full flex items-center gap-3 p-3 sm:p-4 text-left"
                  >
                    <div
                      className={`h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${
                        isExpanded ? 'bg-gradient-to-br from-[#833ab4] to-[#fd1d1d]' : 'bg-muted'
                      }`}
                    >
                      <section.icon
                        className={`h-4.5 w-4.5 ${isExpanded ? 'text-white' : 'text-foreground'}`}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm text-foreground">{section.title}</span>
                        {section.badge && (
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${section.badgeColor}`}
                          >
                            {section.badge}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{section.description}</p>
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    )}
                  </button>

                  {/* Expanded Content */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="px-3 sm:px-4 pb-3 sm:pb-4 space-y-2">
                          {section.steps.map((step, i) => (
                            <div
                              key={i}
                              className="flex items-start gap-2.5 p-2.5 rounded-lg bg-background/80 border border-border/50"
                            >
                              <div className="h-7 w-7 rounded-md bg-gradient-to-br from-[#833ab4]/15 to-[#fd1d1d]/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                                <step.icon className="h-3.5 w-3.5 text-[#fd1d1d]" />
                              </div>
                              <p className="text-sm text-foreground/90 leading-relaxed">
                                {step.text}
                              </p>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div className="border-t border-border px-4 sm:px-5 py-3 flex items-center justify-between bg-card/50">
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5" />
              Your data is secure and never shared
            </p>
            <Button
              size="sm"
              onClick={() => onOpenChange(false)}
              className="bg-gradient-to-r from-[#833ab4] to-[#fd1d1d] hover:opacity-90 text-white rounded-lg text-xs px-4"
            >
              Got it
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
