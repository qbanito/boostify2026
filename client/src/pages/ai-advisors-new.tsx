// Futuristic AI Advisors Page
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Megaphone, 
  Users, 
  Music2, 
  Palette, 
  TrendingUp, 
  Target,
  Scale,
  HeadphonesIcon,
  BarChart3,
  Compass,
  Sparkles,
  Zap,
  Bot,
  Crown,
  Lock,
  User,
  ChevronDown
} from 'lucide-react';
import { AdvisorCard, type AdvisorData } from '../components/ai-advisors/advisor-card';
import { AdvisorChatModal } from '../components/ai-advisors/advisor-chat-modal';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { useAuth } from '../hooks/use-auth';
import { useArtistContext, type ArtistContext } from '../hooks/use-artist-context';
import { useLocation } from 'wouter';
import { cn } from '../lib/utils';

// Advisor data with full info
const advisors: AdvisorData[] = [
  {
    id: 'publicist',
    name: 'Maya PR',
    title: 'Digital Publicist',
    description: 'Expert in PR campaigns, media relations, and building your public image to get featured on blogs and playlists.',
    icon: Megaphone,
    color: 'from-pink-500 to-rose-600',
    glowColor: '#ec4899',
    personality: 'Energetic, strategic, and well-connected. You have extensive experience in the music industry PR world.',
    expertise: ['PR Campaigns', 'Media Relations', 'Press Releases', 'Playlist Pitching'],
    specializations: ['Media', 'PR', 'Outreach'],
    status: 'online' as const,
  },
  {
    id: 'manager',
    name: 'Marcus Cole',
    title: 'Artist Manager',
    description: 'Strategic advisor for career development, deal negotiations, and building a sustainable music career.',
    icon: Users,
    color: 'from-blue-500 to-indigo-600',
    glowColor: '#3b82f6',
    personality: 'Experienced, no-nonsense, and protective of artist interests. You focus on long-term career building.',
    expertise: ['Career Strategy', 'Contract Negotiation', 'Team Building', 'Tour Planning'],
    specializations: ['Deals', 'Booking', 'Strategy'],
    status: 'online' as const,
  },
  {
    id: 'producer',
    name: 'Kai Beats',
    title: 'Music Producer',
    description: 'Creative collaborator for production techniques, sound design, and taking your tracks to the next level.',
    icon: Music2,
    color: 'from-purple-500 to-violet-600',
    glowColor: '#8b5cf6',
    personality: 'Creative, tech-savvy, and passionate about sonic innovation. You stay current with production trends.',
    expertise: ['Sound Design', 'Mixing Tips', 'DAW Workflow', 'Genre-specific Production'],
    specializations: ['Production', 'Mixing', 'Sound'],
    status: 'online' as const,
  },
  {
    id: 'creative',
    name: 'Luna Arte',
    title: 'Creative Director',
    description: 'Visual storyteller helping with branding, music videos, album artwork, and overall aesthetic direction.',
    icon: Palette,
    color: 'from-cyan-500 to-teal-600',
    glowColor: '#06b6d4',
    personality: 'Visionary, artistic, and detail-oriented. You understand how visuals amplify music and build brands.',
    expertise: ['Visual Branding', 'Album Artwork', 'Music Videos', 'Social Media Aesthetics'],
    specializations: ['Branding', 'Videos', 'Design'],
    status: 'online' as const,
  },
  {
    id: 'business',
    name: 'Jordan Banks',
    title: 'Business Advisor',
    description: 'Financial strategist for music business, royalties, publishing deals, and building multiple income streams.',
    icon: TrendingUp,
    color: 'from-emerald-500 to-green-600',
    glowColor: '#10b981',
    personality: 'Analytical, practical, and focused on sustainable income. You understand music business intricacies.',
    expertise: ['Revenue Streams', 'Publishing', 'Royalties', 'Music Business Structure'],
    specializations: ['Finance', 'Royalties', 'Deals'],
    status: 'online' as const,
  },
  {
    id: 'marketing',
    name: 'Zara Storm',
    title: 'Marketing Expert',
    description: 'Digital marketing specialist for social media growth, content strategy, and fan engagement tactics.',
    icon: Target,
    color: 'from-orange-500 to-amber-600',
    glowColor: '#f97316',
    personality: 'Data-driven, creative, and trend-aware. You excel at turning listeners into loyal fans.',
    expertise: ['Social Media Strategy', 'Content Marketing', 'Fan Engagement', 'Viral Growth'],
    specializations: ['Social', 'Content', 'Growth'],
    status: 'online' as const,
  },
  {
    id: 'lawyer',
    name: 'Elena Rights',
    title: 'Music Lawyer',
    description: 'Legal expert for contracts, copyright, licensing, and protecting your music and intellectual property.',
    icon: Scale,
    color: 'from-slate-500 to-zinc-600',
    glowColor: '#64748b',
    personality: 'Thorough, protective, and knowledgeable about entertainment law. You explain complex legal concepts simply.',
    expertise: ['Contracts', 'Copyright', 'Licensing', 'Music Rights'],
    specializations: ['Legal', 'Contracts', 'Rights'],
    status: 'online' as const,
  },
  {
    id: 'support',
    name: 'Sage Heart',
    title: 'Artist Wellness Coach',
    description: 'Mental health and wellness advisor for managing the unique pressures of a music career.',
    icon: HeadphonesIcon,
    color: 'from-rose-500 to-pink-600',
    glowColor: '#f43f5e',
    personality: 'Empathetic, supportive, and holistic. You understand the mental challenges artists face.',
    expertise: ['Mental Health', 'Work-Life Balance', 'Performance Anxiety', 'Creative Burnout'],
    specializations: ['Wellness', 'Balance', 'Support'],
    status: 'online' as const,
  },
  {
    id: 'analytics',
    name: 'Data Drake',
    title: 'Analytics Specialist',
    description: 'Data expert who decodes streaming stats, audience insights, and helps optimize your release strategy.',
    icon: BarChart3,
    color: 'from-indigo-500 to-blue-600',
    glowColor: '#6366f1',
    personality: 'Analytical, insightful, and strategic. You turn complex data into actionable insights.',
    expertise: ['Streaming Analytics', 'Audience Insights', 'Release Strategy', 'Performance Metrics'],
    specializations: ['Data', 'Insights', 'Strategy'],
    status: 'online' as const,
  },
  {
    id: 'strategist',
    name: 'Nova Vision',
    title: 'Career Strategist',
    description: 'Long-term planning expert who helps chart your path to success with actionable roadmaps.',
    icon: Compass,
    color: 'from-yellow-500 to-orange-600',
    glowColor: '#eab308',
    personality: 'Forward-thinking, motivational, and experienced. You create clear paths through industry complexity.',
    expertise: ['Goal Setting', 'Career Roadmaps', 'Industry Navigation', 'Milestone Planning'],
    specializations: ['Planning', 'Goals', 'Vision'],
    status: 'online' as const,
  },
];

// Animated background particles
function ParticleField() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {Array.from({ length: 50 }).map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-1 h-1 bg-orange-500/30 rounded-full"
          initial={{
            x: Math.random() * window.innerWidth,
            y: Math.random() * window.innerHeight,
            scale: Math.random() * 0.5 + 0.5,
          }}
          animate={{
            y: [null, -20, 20],
            opacity: [0.3, 0.7, 0.3],
          }}
          transition={{
            duration: Math.random() * 5 + 5,
            repeat: Infinity,
            delay: Math.random() * 5,
          }}
        />
      ))}
    </div>
  );
}

// Grid background
function GridBackground() {
  return (
    <div className="absolute inset-0 pointer-events-none opacity-20">
      <div 
        className="absolute inset-0"
        style={{
          backgroundImage: `
            linear-gradient(rgba(249, 115, 22, 0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(249, 115, 22, 0.1) 1px, transparent 1px)
          `,
          backgroundSize: '50px 50px',
        }}
      />
    </div>
  );
}

// Hero section with 3D-like effect
function HeroSection() {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative text-center mb-12 px-4"
    >
      {/* Glowing orb behind title */}
      <motion.div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-gradient-to-r from-orange-500/20 to-purple-500/20 rounded-full blur-3xl"
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.3, 0.5, 0.3],
        }}
        transition={{ duration: 5, repeat: Infinity }}
      />
      
      <div className="relative z-10">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', delay: 0.2 }}
          className="inline-flex items-center gap-2 px-4 py-2 mb-6 bg-orange-500/10 border border-orange-500/20 rounded-full"
        >
          <Bot className="h-4 w-4 text-orange-500" />
          <span className="text-sm text-orange-400">AI-Powered Advisors</span>
          <Sparkles className="h-4 w-4 text-orange-500" />
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-4xl md:text-6xl font-bold mb-4"
        >
          <span className="text-white">Your Personal</span>
          <br />
          <span className="bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 bg-clip-text text-transparent">
            Music Industry Experts
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="text-lg text-gray-400 max-w-2xl mx-auto mb-8"
        >
          Get personalized advice from AI advisors specialized in every aspect of the music industry. 
          From PR to production, marketing to legal — your team is ready.
        </motion.p>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="flex flex-wrap justify-center gap-8"
        >
          {[
            { value: '10+', label: 'Expert Advisors' },
            { value: '24/7', label: 'Available' },
            { value: '∞', label: 'Possibilities' },
          ].map((stat, i) => (
            <div key={i} className="text-center">
              <div className="text-2xl font-bold text-orange-500">{stat.value}</div>
              <div className="text-sm text-gray-500">{stat.label}</div>
            </div>
          ))}
        </motion.div>
      </div>
    </motion.div>
  );
}

// Category filter
function CategoryFilter({ 
  categories, 
  active, 
  onChange 
}: { 
  categories: string[]; 
  active: string; 
  onChange: (cat: string) => void; 
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.6 }}
      className="flex flex-wrap justify-center gap-2 mb-8"
    >
      {categories.map((cat) => (
        <Button
          key={cat}
          variant={active === cat ? 'default' : 'outline'}
          size="sm"
          onClick={() => onChange(cat)}
          className={cn(
            "transition-all",
            active === cat 
              ? "bg-gradient-to-r from-orange-500 to-orange-600 border-0" 
              : "bg-transparent border-[#27272A] text-gray-400 hover:text-white hover:border-orange-500/50"
          )}
        >
          {cat}
        </Button>
      ))}
    </motion.div>
  );
}

// Main page component
export default function AIAdvisorsPage() {
  const { user, userSubscription } = useAuth();
  const [, setLocation] = useLocation();
  const { artists, selectedArtist, setSelectedArtistId, isLoading: artistsLoading } = useArtistContext();
  const [selectedAdvisor, setSelectedAdvisor] = useState<AdvisorData | null>(null);
  const [activeCategory, setActiveCategory] = useState('All');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showArtistSelector, setShowArtistSelector] = useState(false);

  const PAID_PLANS = ['creator', 'professional', 'enterprise', 'artist', 'premium'];
  const isPaidUser = userSubscription && PAID_PLANS.includes(userSubscription);

  useEffect(() => {
    if (!user || (userSubscription !== undefined && !isPaidUser)) {
      setLocation('/auth');
    }
  }, [user, isPaidUser, userSubscription, setLocation]);

  const categories = ['All', 'Strategy', 'Creative', 'Business', 'Wellness'];

  const filteredAdvisors = advisors.filter(advisor => {
    if (activeCategory === 'All') return true;
    
    const categoryMap: Record<string, string[]> = {
      'Strategy': ['manager', 'strategist', 'analytics'],
      'Creative': ['producer', 'creative', 'publicist'],
      'Business': ['business', 'lawyer', 'marketing'],
      'Wellness': ['support'],
    };
    
    return categoryMap[activeCategory]?.includes(advisor.id);
  });

  const handleAdvisorClick = (advisor: AdvisorData) => {
    setSelectedAdvisor(advisor);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    // Delay clearing advisor to allow exit animation
    setTimeout(() => setSelectedAdvisor(null), 300);
  };

  return (
    <div className="relative min-h-screen bg-[#05050A] text-white overflow-hidden">
      {/* Background effects */}
      <GridBackground />
      <ParticleField />

      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#05050A]/50 to-[#05050A] pointer-events-none" />

      {/* Content */}
      <div className="relative z-10 container mx-auto px-4 py-12 max-w-7xl">
        {/* Hero */}
        <HeroSection />

        {/* Artist Selector */}
        {artists.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="flex justify-center mb-8"
          >
            <div className="relative">
              <button
                onClick={() => setShowArtistSelector(!showArtistSelector)}
                className="flex items-center gap-3 px-4 py-3 bg-[#1A1A24] border border-[#27272A] rounded-xl hover:border-orange-500/50 transition-colors"
              >
                {selectedArtist?.profileImage ? (
                  <img 
                    src={selectedArtist.profileImage} 
                    alt={selectedArtist.artistName}
                    className="w-8 h-8 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center">
                    <User className="w-4 h-4 text-white" />
                  </div>
                )}
                <div className="text-left">
                  <p className="text-xs text-gray-500">Advising for</p>
                  <p className="text-sm font-medium text-white">
                    {selectedArtist?.artistName || 'Select an artist'}
                  </p>
                </div>
                <ChevronDown className={cn(
                  "w-4 h-4 text-gray-400 transition-transform",
                  showArtistSelector && "rotate-180"
                )} />
              </button>

              {/* Dropdown */}
              <AnimatePresence>
                {showArtistSelector && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="absolute top-full left-0 right-0 mt-2 bg-[#1A1A24] border border-[#27272A] rounded-xl overflow-hidden z-50 shadow-xl"
                  >
                    {artists.map((artist) => (
                      <button
                        key={artist.id}
                        onClick={() => {
                          setSelectedArtistId(artist.id);
                          setShowArtistSelector(false);
                        }}
                        className={cn(
                          "w-full flex items-center gap-3 px-4 py-3 hover:bg-[#27272A] transition-colors text-left",
                          selectedArtist?.id === artist.id && "bg-orange-500/10"
                        )}
                      >
                        {artist.profileImage ? (
                          <img 
                            src={artist.profileImage} 
                            alt={artist.artistName}
                            className="w-8 h-8 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center">
                            <User className="w-4 h-4 text-white" />
                          </div>
                        )}
                        <div>
                          <p className="text-sm font-medium text-white">{artist.artistName}</p>
                          <p className="text-xs text-gray-500">{artist.genres?.join(', ') || artist.genre || 'Artist'}</p>
                        </div>
                        {selectedArtist?.id === artist.id && (
                          <div className="ml-auto w-2 h-2 rounded-full bg-orange-500" />
                        )}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}

        {/* No artists warning */}
        {!artistsLoading && artists.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex justify-center mb-8"
          >
            <div className="flex items-center gap-3 px-4 py-3 bg-orange-500/10 border border-orange-500/30 rounded-xl">
              <User className="w-5 h-5 text-orange-500" />
              <p className="text-sm text-orange-200">
                Create an artist in "My Artists" to get personalized advice from advisors
              </p>
            </div>
          </motion.div>
        )}

        {/* Category filter */}
        <CategoryFilter 
          categories={categories} 
          active={activeCategory} 
          onChange={setActiveCategory} 
        />

        {/* Advisors grid */}
        <motion.div 
          layout
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
        >
          <AnimatePresence mode="popLayout">
            {filteredAdvisors.map((advisor, index) => (
              <AdvisorCard
                key={advisor.id}
                advisor={advisor}
                index={index}
                onClick={() => handleAdvisorClick(advisor)}
              />
            ))}
          </AnimatePresence>
        </motion.div>

        {/* Upgrade CTA for non-pro users */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1 }}
          className="mt-16 text-center"
        >
          <div className="inline-flex flex-col items-center p-8 bg-gradient-to-br from-[#0D0D12] to-[#1A1A24] border border-[#27272A] rounded-2xl max-w-lg">
            <Crown className="h-12 w-12 text-orange-500 mb-4" />
            <h3 className="text-xl font-bold mb-2">Unlock Full Advisor Access</h3>
            <p className="text-gray-400 mb-6 text-sm">
              Get unlimited conversations with all advisors, priority responses, and exclusive features.
            </p>
            <Button className="bg-gradient-to-r from-orange-500 to-orange-600 hover:opacity-90">
              <Zap className="h-4 w-4 mr-2" />
              Upgrade to Pro
            </Button>
          </div>
        </motion.div>
      </div>

      {/* Chat Modal */}
      {selectedAdvisor && (
        <AdvisorChatModal
          advisor={selectedAdvisor}
          artist={selectedArtist}
          isOpen={isModalOpen}
          onClose={handleCloseModal}
        />
      )}
    </div>
  );
}
