/**
 * AI Advisors Page with Subscription Plans
 * 
 * This page allows users to get professional advice
 * based on their current subscription plan.
 * 
 * Enhanced with sophisticated UI elements and native CSS animations.
 */

import { useState, useEffect, useRef } from 'react';
import { useToast } from '../hooks/use-toast';
import { useAuth } from '../hooks/use-auth';
import { useLocation } from 'wouter';
import { Advisor } from '../lib/services/advisor-call-service';
import { useSubscription } from '../lib/context/subscription-context';
import { PlanTierGuard } from '../components/youtube-views/plan-tier-guard';
import { ArtistLandingPage } from '../components/artist/artist-landing-page';

// Components
import { CallHistory } from '../components/ai-advisors/call-history';
import { CallLimits } from '../components/ai-advisors/call-limits';
import { CallModal } from '../components/ai-advisors/call-modal-super-simple';

// UI Components
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '../components/ui/card';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '../components/ui/tabs';
import { Button } from '../components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '../components/ui/alert';
import { Badge } from '../components/ui/badge';
import { Separator } from '../components/ui/separator';

// Icons
import {
  MessageSquare,
  Phone,
  VideoIcon,
  Music,
  Users,
  TrendingUp,
  BriefcaseBusiness,
  FileText,
  AlertTriangle,
  ChevronRight,
  BookOpen,
  Megaphone,
  HandCoins,
  BarChart,
  Rocket,
  Star,
  SparkleIcon,
  BadgeCheck,
  LightbulbIcon
} from 'lucide-react';

// Create advisors list
const advisors: Advisor[] = [
  {
    id: 'publicist',
    name: 'Sarah Mills',
    title: 'Publicist',
    description: 'Expert in media relations and press management for musicians',
    icon: Megaphone,
    color: 'from-purple-500 to-blue-500',
    animationDelay: 0,
  },
  {
    id: 'manager',
    name: 'Mark Johnson',
    title: 'Manager',
    description: 'Specialist in career planning and artist development',
    icon: Users,
    color: 'from-blue-500 to-cyan-400',
    animationDelay: 0.1,
  },
  {
    id: 'producer',
    name: 'David Williams',
    title: 'Music Producer',
    description: 'Expert in music production and arrangement techniques',
    icon: Music,
    color: 'from-amber-500 to-orange-600',
    animationDelay: 0.2,
  },
  {
    id: 'creative',
    name: 'Emily Rodriguez',
    title: 'Creative Director',
    description: 'Visual arts and creative concept development specialist',
    icon: VideoIcon,
    color: 'from-pink-500 to-rose-500',
    animationDelay: 0.3,
  },
  {
    id: 'business',
    name: 'Robert Chen',
    title: 'Business Consultant',
    description: 'Monetization and business strategy specialist',
    icon: BriefcaseBusiness,
    color: 'from-emerald-500 to-green-600',
    animationDelay: 0.4,
  },
  {
    id: 'marketing',
    name: 'Alicia Torres',
    title: 'Marketing Specialist',
    description: 'Digital marketing and promotional campaign advisor',
    icon: TrendingUp,
    color: 'from-red-500 to-rose-600',
    animationDelay: 0.5,
  },
  {
    id: 'lawyer',
    name: 'Michael Barnes',
    title: 'Music Attorney',
    description: 'Contracts and intellectual property rights expert',
    icon: FileText,
    color: 'from-indigo-500 to-violet-600',
    animationDelay: 0.6,
  },
  {
    id: 'support',
    name: 'Lucia Gonzalez',
    title: 'Artist Support',
    description: 'General assistance for all your artist needs',
    icon: HandCoins,
    color: 'from-teal-500 to-green-400',
    animationDelay: 0.7,
  },
  {
    id: 'analytics',
    name: 'Thomas Lee',
    title: 'Data Analyst',
    description: 'Music metrics interpretation and trend analysis',
    icon: BarChart,
    color: 'from-cyan-500 to-blue-600',
    animationDelay: 0.8,
  },
  {
    id: 'strategist',
    name: 'Rebecca Taylor',
    title: 'Growth Strategist',
    description: 'Audience expansion and new market specialist',
    icon: Rocket,
    color: 'from-orange-500 to-amber-400',
    animationDelay: 0.9,
  },
];

// Quick tips list
const quickTips = [
  "Maintain consistent social media presence to increase visibility",
  "Invest in quality visuals to stand out from competition",
  "Build genuine relationships with followers by responding to comments",
  "Collaborate with other artists to access new audiences",
  "Define your unique value proposition: what makes you different?",
  "Use analytics tools to better understand your audience",
  "Establish a release calendar to maintain interest",
  "Consider working with an independent digital distributor for your releases",
  "Develop exclusive content for your most dedicated followers",
  "Register your works with copyright management societies"
];

// Subscription features by plan
const subscriptionFeatures = {
  free: {
    title: "Discover (Free)",
    description: "Basic access to the platform",
    price: "$0",
    features: [
      "Access to Sarah Mills (Publicist)",
      "3 advisor calls per month",
      "Basic community features",
      "Limited reporting tools"
    ],
    color: "from-gray-500 to-slate-600"
  },
  artist: {
    title: "Artist Plan",
    description: "Essential tools for emerging artists",
    price: "$19.99",
    features: [
      "Access to 3 specialized advisors",
      "10 advisor calls per month",
      "Basic analytics dashboard",
      "Email support within 48 hours",
      "Content planning tools"
    ],
    color: "from-blue-500 to-indigo-600"
  },
  creator: {
    title: "Elevate Plan",
    description: "Growth tools for active creators",
    price: "$49.99",
    features: [
      "Access to 6 specialized advisors",
      "20 advisor calls per month",
      "Analytics dashboard",
      "Email support within 24 hours",
      "Content planning & scheduling",
      "PR Kit access"
    ],
    color: "from-cyan-500 to-blue-600"
  },
  professional: {
    title: "Amplify Plan",
    description: "Complete toolkit for serious musicians",
    price: "$89.99",
    features: [
      "Access to all 10 specialized advisors",
      "30 advisor calls per month",
      "Advanced analytics dashboard",
      "Priority email support within 24 hours",
      "Content planning & scheduling",
      "Personalized growth strategy",
      "AI-enhanced performance insights"
    ],
    color: "from-purple-500 to-indigo-600",
    highlighted: true
  },
  enterprise: {
    title: "Dominate Plan",
    description: "Full power for industry leaders",
    price: "$149.99",
    features: [
      "Access to all advisors + VIP priority",
      "Unlimited advisor calls",
      "Executive analytics suite",
      "24/7 VIP support",
      "AI marketing campaigns",
      "Custom growth strategy",
      "Dedicated account manager"
    ],
    color: "from-amber-500 to-orange-600"
  }
};

export default function AIAdvisorsPage() {
  const { toast } = useToast();
  const { user, userSubscription } = useAuth();
  const [, setLocation] = useLocation();
  const { subscription, currentPlan } = useSubscription();
  
  // Call state
  const [selectedAdvisor, setSelectedAdvisor] = useState<Advisor | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [calling, setCalling] = useState(false);
  
  // Handle advisor click
  const handleAdvisorClick = (advisor: Advisor) => {
    if (!user) {
      toast({
        title: "Login required",
        description: "You need to be logged in to contact an advisor",
        variant: "destructive"
      });
      
      // Redirect to login
      setLocation('/login');
      return;
    }
    
    setSelectedAdvisor(advisor);
    setModalOpen(true);
  };
  
  // Particle background component with native CSS
  const ParticleBackground = () => {
    const containerRef = useRef<HTMLDivElement>(null);
    
    useEffect(() => {
      // Create particles using DOM elements with CSS animations
      // This is more efficient than Canvas for a limited number of particles
      if (!containerRef.current) return;
      
      const container = containerRef.current;
      const particleCount = 40; // Reduced for better performance
      
      // Clear existing particles
      container.innerHTML = '';
      
      // Create particles
      for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        
        // Random properties for variety
        const size = Math.random() * 6 + 2;
        const posX = Math.random() * 100;
        const posY = Math.random() * 100;
        const delay = Math.random() * 5;
        const duration = Math.random() * 20 + 10;
        const hue = Math.random() * 60 + 200; // Blue to purple range
        
        // Apply styles
        particle.className = 'particle';
        particle.style.cssText = `
          position: absolute;
          width: ${size}px;
          height: ${size}px;
          border-radius: 50%;
          background-color: hsla(${hue}, 100%, 70%, 0.6);
          top: ${posY}%;
          left: ${posX}%;
          animation: float ${duration}s ease-in-out infinite;
          animation-delay: -${delay}s;
          filter: blur(${size > 5 ? 1 : 0}px);
          opacity: ${Math.min(0.8, Math.random() + 0.3)};
          z-index: 0;
          pointer-events: none;
        `;
        
        // Add to container
        container.appendChild(particle);
      }
      
      // Add global animation for float effect 
      const styleTag = document.createElement('style');
      styleTag.innerHTML = `
        @keyframes float {
          0%, 100% {
            transform: translateY(0) translateX(0);
          }
          25% {
            transform: translateY(-30px) translateX(15px);
          }
          50% {
            transform: translateY(-15px) translateX(-15px);
          }
          75% {
            transform: translateY(30px) translateX(10px);
          }
        }
      `;
      document.head.appendChild(styleTag);
      
      return () => {
        document.head.removeChild(styleTag);
      };
    }, []);
    
    return (
      <div 
        ref={containerRef} 
        className="absolute inset-0 overflow-hidden opacity-40 pointer-events-none"
      />
    );
  };

  // Animated title component with CSS-only effects
  const AnimatedTitle = ({ children }: { children: React.ReactNode }) => {
    return (
      <div className="relative">
        <h1 
          className="text-4xl md:text-5xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-purple-600 via-blue-500 to-indigo-400 pb-1"
          style={{
            backgroundSize: '300% 100%',
            animation: 'gradientAnimation 6s ease infinite'
          }}
        >
          {children}
        </h1>
        {/* Add dynamic gradient animation */}
        <style>{`
          @keyframes gradientAnimation {
            0% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
            100% { background-position: 0% 50%; }
          }
        `}</style>
      </div>
    );
  };

  // Auth guard - redirect if not logged in
  useEffect(() => {
    if (!user) {
      setLocation('/auth');
    }
  }, [user, setLocation]);

  if (!user) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <Card className="bg-zinc-900/50 border-orange-500/20 p-8 max-w-md text-center">
          <h2 className="text-2xl font-bold mb-4">Authentication Required</h2>
          <p className="text-white/70 mb-6">You need to be logged in to access AI Advisors.</p>
          <Button onClick={() => setLocation('/auth')} className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600">Sign In / Sign Up</Button>
        </Card>
      </div>
    );
  }

  return (
    <PlanTierGuard 
      requiredPlan="artist" 
      userSubscription={userSubscription} 
      featureName="AI Advisors"
    >
      <div className="container max-w-6xl py-6 md:py-10 space-y-6 relative">
        {/* Add global animation for fadeIn effect used on cards */}
        <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0) translateX(0); }
          25% { transform: translateY(-30px) translateX(15px); }
          50% { transform: translateY(-15px) translateX(-15px); }
          75% { transform: translateY(30px) translateX(10px); }
        }
        @keyframes gradientAnimation {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
      `}</style>
      
      <ParticleBackground />
      {/* Header */}
      <div className="space-y-4 relative z-10">
        <AnimatedTitle>AI Advisors</AnimatedTitle>
        <p className="text-muted-foreground text-lg max-w-2xl">
          Connect with specialized advisors in the music industry to boost your career
        </p>
      </div>
      
      {/* Introduction/Banner */}
      <div className="mb-8 p-6 bg-gradient-to-r from-primary/10 via-background to-blue-500/10 rounded-xl border border-muted/60 relative overflow-hidden">
        <div className="absolute inset-0 bg-grid-pattern-light opacity-10 pointer-events-none"></div>
        
        {/* Decorative particle effects */}
        <div className="absolute top-10 right-10 w-20 h-20 bg-primary/10 rounded-full blur-xl"></div>
        <div className="absolute bottom-12 left-32 w-16 h-16 bg-blue-400/10 rounded-full blur-lg"></div>
        
        <div className="relative z-10 md:max-w-3xl">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-2">Expert guidance at your fingertips</h2>
          <p className="text-muted-foreground text-lg mb-4">
            Connect with specialized AI advisors to get personalized insights and advice for your music career. Our advisors combine deep industry expertise with AI-powered analytics to help you make informed decisions.
          </p>
          
          <div className="flex flex-wrap gap-3 mt-4">
            <div className="bg-card/50 backdrop-blur-sm px-3 py-1.5 rounded-full border border-border/50 flex items-center text-sm">
              <Phone className="mr-2 h-3.5 w-3.5 text-primary" />
              One-on-one calls
            </div>
            <div className="bg-card/50 backdrop-blur-sm px-3 py-1.5 rounded-full border border-border/50 flex items-center text-sm">
              <Users className="mr-2 h-3.5 w-3.5 text-primary" />
              10 specialized experts
            </div>
            <div className="bg-card/50 backdrop-blur-sm px-3 py-1.5 rounded-full border border-border/50 flex items-center text-sm">
              <TrendingUp className="mr-2 h-3.5 w-3.5 text-primary" />
              Data-driven insights
            </div>
          </div>
        </div>
      </div>
      
      {/* Enhanced tabs */}
      <Tabs defaultValue="advisors" className="w-full">
        <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-6">
          <div className="flex items-center">
            <TabsList className="p-1 bg-muted/60">
              <TabsTrigger value="advisors" className="rounded-md data-[state=active]:bg-card data-[state=active]:shadow-sm text-sm px-4">
                <Phone className="mr-2 h-4 w-4" />
                Advisors
              </TabsTrigger>
              <TabsTrigger value="history" className="rounded-md data-[state=active]:bg-card data-[state=active]:shadow-sm text-sm px-4">
                <MessageSquare className="mr-2 h-4 w-4" />
                History
              </TabsTrigger>
              <TabsTrigger value="plans" className="rounded-md data-[state=active]:bg-card data-[state=active]:shadow-sm text-sm px-4">
                <BookOpen className="mr-2 h-4 w-4" />
                Plans
              </TabsTrigger>
            </TabsList>
          </div>
          
          {/* Current plan badge */}
          <div className="flex items-center gap-1.5">
            <span className="text-sm text-muted-foreground">Current subscription:</span>
            <Badge 
              variant={
                currentPlan === 'enterprise' ? 'default' : 
                currentPlan === 'professional' ? 'secondary' : 
                currentPlan === 'creator' ? 'outline' : 
                currentPlan === 'artist' ? 'outline' :
                'secondary'
              }
              className="py-1.5 font-medium uppercase tracking-wide"
            >
              {currentPlan === 'free' ? 'DISCOVER' : currentPlan === 'artist' ? 'ARTIST' : currentPlan === 'creator' ? 'ELEVATE' : currentPlan === 'professional' ? 'AMPLIFY' : currentPlan === 'enterprise' ? 'DOMINATE' : currentPlan.toUpperCase()} PLAN
            </Badge>
          </div>
        </div>
        
        {/* Content: Advisors Tab */}
        <TabsContent value="advisors" className="pt-4 space-y-6">
          {/* Access alert (if applicable) */}
          {!user ? (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Limited access</AlertTitle>
              <AlertDescription>
                Sign in to contact advisors and receive personalized help.
                <Button 
                  variant="link" 
                  className="p-0 ml-2 h-auto" 
                  onClick={() => setLocation('/login')}
                >
                  Sign in
                </Button>
              </AlertDescription>
            </Alert>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Side panel - Stats and limits */}
              <div className="space-y-4">
                {/* Call limits */}
                <CallLimits 
                  variant="compact" 
                  showUpgradeButton={true}
                />
                
                {/* Compact recent history */}
                <CallHistory 
                  variant="compact" 
                  maxCalls={5} 
                  showHeader={false}
                  showFooter={false}
                />
                
                {/* Quick tips */}
                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex items-center">
                      <LightbulbIcon className="w-4 h-4 mr-2 text-primary" />
                      <CardTitle className="text-sm">Quick Tips</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="pb-3">
                    <div className="text-sm">
                      {quickTips[Math.floor(Math.random() * quickTips.length)]}
                    </div>
                  </CardContent>
                  <CardFooter className="pt-0">
                    <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => setLocation('/resources')}>
                      More resources
                      <ChevronRight className="ml-1 h-3 w-3" />
                    </Button>
                  </CardFooter>
                </Card>
              </div>
              
              {/* Advisors list */}
              <div className="md:col-span-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {advisors.map((advisor, index) => (
                    <Card 
                      key={advisor.id}
                      className={`group overflow-hidden transition-all duration-300 hover:shadow-md border-border/70
                        ${advisor.id === 'publicist' ? 'ring-2 ring-primary/20 bg-primary/5' : ''}
                        ${currentPlan === 'free' && advisor.id !== 'publicist' ? 'opacity-75' : ''}
                      `}
                      style={{
                        animationDelay: `${advisor.animationDelay || 0}s`,
                        animation: `fadeIn 0.5s ease-out both`
                      }}
                    >
                      <CardHeader className="pb-3 relative">
                        <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-gradient-to-br opacity-10 -translate-y-1/2 translate-x-1/2" 
                          style={{background: `linear-gradient(to bottom right, ${advisor.color.split(' ')[0].replace('from-', '')}, ${advisor.color.split(' ')[1].replace('to-', '')})`}}
                        />
                        
                        <div className="flex items-start justify-between relative z-10">
                          <div className="flex">
                            <div 
                              className={`flex items-center justify-center w-12 h-12 rounded-full mr-3 bg-gradient-to-br ${advisor.color}`}
                            >
                              {advisor.icon && <advisor.icon className="w-6 h-6 text-white" />}
                            </div>
                            <div>
                              <CardTitle>{advisor.name}</CardTitle>
                              <CardDescription className="text-sm mt-1">{advisor.title}</CardDescription>
                            </div>
                          </div>
                          
                          {/* Availability Badge */}
                          {currentPlan === 'free' && advisor.id !== 'publicist' ? (
                            <Badge variant="outline" className="bg-background border-amber-500/50 text-amber-500 text-xs">
                              Pro Only
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-background border-green-500/50 text-green-500 text-xs">
                              Available
                            </Badge>
                          )}
                        </div>
                        
                        <Separator className="mt-3 bg-border/40" />
                      </CardHeader>
                      
                      <CardContent className="text-sm pb-3">
                        {advisor.description}
                      </CardContent>
                      
                      <CardFooter className="pt-0">
                        <Button 
                          className={`w-full gap-2 ${
                            advisor.id === 'publicist' ? 
                            'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700' : 
                            (currentPlan === 'free' ? 'bg-muted text-muted-foreground hover:bg-muted/80' : '')
                          }`}
                          onClick={() => handleAdvisorClick(advisor)}
                          disabled={currentPlan === 'free' && advisor.id !== 'publicist'}
                        >
                          <Phone className="w-4 h-4" />
                          <span>{currentPlan === 'free' && advisor.id !== 'publicist' ? 'Upgrade to Pro' : 'Contact Advisor'}</span>
                        </Button>
                      </CardFooter>
                    </Card>
                  ))}
                </div>
              </div>
            </div>
          )}
        </TabsContent>
        
        {/* Content: History Tab */}
        <TabsContent value="history" className="pt-4">
          {!user ? (
            <div className="text-center py-12">
              <MessageSquare className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-medium">Sign in to view your history</h3>
              <p className="text-muted-foreground mb-6">
                You need to sign in to view your advisor call history
              </p>
              <Button onClick={() => setLocation('/login')}>
                Sign in
              </Button>
            </div>
          ) : (
            <CallHistory 
              showHeader={true}
              showFooter={true}
              showFilters={true}
              maxCalls={50}
            />
          )}
        </TabsContent>
        
        {/* Content: Plans Tab */}
        <TabsContent value="plans" className="pt-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Free Plan with visual effects */}
            <Card className={`border-2 relative overflow-hidden ${currentPlan === 'free' ? 'border-primary' : 'border-transparent'}`}>
              {/* Subtle background effect */}
              <div className="absolute -bottom-16 -left-16 w-32 h-32 bg-gradient-to-tr from-blue-300/10 to-transparent rounded-full blur-xl"></div>
              
              <CardHeader className="relative z-10">
                <CardTitle className="text-2xl font-bold">Free Plan</CardTitle>
                <CardDescription className="text-base">Basic AI advisors access</CardDescription>
                <div className="mt-3 flex items-end">
                  <span className="text-4xl font-extrabold">$0</span>
                  <span className="text-muted-foreground ml-1 mb-1">/month</span>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-5 relative z-10">
                <div className="space-y-3">
                  <div className="flex items-center">
                    <div className="w-4 h-4 rounded-full bg-primary/20 flex items-center justify-center mr-2">
                      <div className="w-2 h-2 rounded-full bg-primary" />
                    </div>
                    <span>3 monthly calls</span>
                  </div>
                  
                  <div className="flex items-center">
                    <div className="w-4 h-4 rounded-full bg-primary/20 flex items-center justify-center mr-2">
                      <div className="w-2 h-2 rounded-full bg-primary" />
                    </div>
                    <span>Access to 1 advisor</span>
                  </div>
                  
                  <div className="flex items-center">
                    <div className="w-4 h-4 rounded-full bg-primary/20 flex items-center justify-center mr-2">
                      <div className="w-2 h-2 rounded-full bg-primary" />
                    </div>
                    <span>Maximum duration: 5 minutes</span>
                  </div>
                </div>
                
                <Separator />
                
                <div className="space-y-2">
                  <p className="font-semibold text-sm flex items-center">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary mr-2"></div>
                    Available advisors:
                  </p>
                  <div className="text-sm">
                    <span className="inline-block w-1 h-1 rounded-full bg-primary mr-2"></span>
                    Sarah Mills (Publicist)
                  </div>
                </div>
              </CardContent>
              
              <CardFooter className="relative z-10">
                <Button 
                  variant={currentPlan === 'free' ? 'outline' : 'default'} 
                  className="w-full relative group overflow-hidden"
                  disabled={currentPlan === 'free'}
                  onClick={() => setLocation('/account')}
                >
                  <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out"></div>
                  <span className="relative z-10">
                    {currentPlan === 'free' ? 'Current Plan' : 'Select Plan'}
                  </span>
                </Button>
              </CardFooter>
            </Card>
            
            {/* Artist Plan with visual effects */}
            <Card className={`border-2 relative overflow-hidden ${currentPlan === 'artist' ? 'border-primary' : 'border-transparent'}`}>
              {/* Background effects */}
              <div className="absolute -top-24 -right-24 w-36 h-36 bg-gradient-to-bl from-cyan-400/10 to-transparent rounded-full blur-xl"></div>
              <div className="absolute -bottom-16 -left-16 w-32 h-32 bg-gradient-to-tr from-blue-400/10 to-transparent rounded-full blur-xl"></div>
              
              <CardHeader className="relative z-10">
                <CardTitle className="text-2xl font-bold">Artist Plan</CardTitle>
                <CardDescription className="text-base">For emerging artists</CardDescription>
                <div className="mt-3 flex items-end">
                  <span className="text-4xl font-extrabold">$19.99</span>
                  <span className="text-muted-foreground ml-1 mb-1">/month</span>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-5 relative z-10">
                <div className="space-y-3">
                  <div className="flex items-center border-l-4 border-blue-400/40 pl-3 py-1 bg-gradient-to-r from-blue-400/5 to-transparent rounded-sm">
                    <div className="w-4 h-4 rounded-full bg-primary/20 flex items-center justify-center mr-2">
                      <div className="w-2 h-2 rounded-full bg-primary" />
                    </div>
                    <span className="font-medium">10 monthly calls</span>
                  </div>
                  
                  <div className="flex items-center">
                    <div className="w-4 h-4 rounded-full bg-primary/20 flex items-center justify-center mr-2">
                      <div className="w-2 h-2 rounded-full bg-primary" />
                    </div>
                    <span>Access to 3 advisors</span>
                  </div>
                  
                  <div className="flex items-center">
                    <div className="w-4 h-4 rounded-full bg-primary/20 flex items-center justify-center mr-2">
                      <div className="w-2 h-2 rounded-full bg-primary" />
                    </div>
                    <span>Maximum duration: 10 minutes</span>
                  </div>
                </div>
                
                <Separator />
                
                <div className="space-y-2">
                  <p className="font-semibold text-sm flex items-center">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary mr-2"></div>
                    Available advisors:
                  </p>
                  <div className="grid grid-cols-1 gap-2">
                    <div className="text-sm flex items-center">
                      <span className="inline-block w-1 h-1 rounded-full bg-primary mr-2"></span>
                      Sarah Mills (Publicist)
                    </div>
                    <div className="text-sm flex items-center">
                      <span className="inline-block w-1 h-1 rounded-full bg-primary mr-2"></span>
                      Emily Rodríguez (Creative Director)
                    </div>
                    <div className="text-sm flex items-center">
                      <span className="inline-block w-1 h-1 rounded-full bg-primary mr-2"></span>
                      Lucia González (Artist Support)
                    </div>
                  </div>
                </div>
              </CardContent>
              
              <CardFooter className="relative z-10">
                <Button 
                  variant={currentPlan === 'artist' ? 'outline' : 'default'} 
                  className="w-full relative group overflow-hidden"
                  disabled={currentPlan === 'artist'}
                  onClick={() => setLocation('/account')}
                >
                  <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out"></div>
                  <span className="relative z-10">
                    {currentPlan === 'artist' ? 'Current Plan' : 'Select Plan'}
                  </span>
                </Button>
              </CardFooter>
            </Card>
            
            {/* Amplify Plan - Enhanced version with visual effects */}
            <Card className={`border-2 relative overflow-hidden ${currentPlan === 'professional' ? 'border-primary' : 'border-transparent'}`}>
              {/* Top glow effect */}
              <div className="absolute -top-24 -right-24 w-48 h-48 bg-gradient-to-br from-primary/20 via-primary/10 to-transparent rounded-full blur-xl"></div>
              <div className="absolute -bottom-16 -left-16 w-40 h-40 bg-gradient-to-tr from-blue-500/20 to-transparent rounded-full blur-xl"></div>
              
              {/* Recommended badge with special effect */}
              <div className="absolute -top-1 -right-1 rotate-12">
                <div className="relative">
                  <Badge 
                    variant="default" 
                    className="px-3 py-1.5 font-semibold uppercase text-xs tracking-wide shadow-md relative z-10"
                  >
                    Recommended
                  </Badge>
                  <div className="absolute inset-0 bg-primary/20 rounded-sm blur-sm -z-0 scale-110"></div>
                </div>
              </div>
              
              <CardHeader className="relative z-10">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-2xl font-bold flex items-center">
                      Amplify Plan
                      <div className="inline-block ml-2 w-2 h-2 rounded-full bg-primary animate-pulse"></div>
                    </CardTitle>
                    <CardDescription className="text-base">For professional artists</CardDescription>
                  </div>
                </div>
                <div className="mt-3 flex items-end">
                  <span className="text-4xl font-extrabold">$89.99</span>
                  <span className="text-muted-foreground ml-1 mb-1">/month</span>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-5 relative z-10">
                <div className="space-y-3">
                  {/* Highlighted element with special border */}
                  <div className="flex items-center border-l-4 border-primary pl-3 py-1 bg-gradient-to-r from-primary/5 to-transparent rounded-sm">
                    <div className="w-4 h-4 rounded-full bg-primary/20 flex items-center justify-center mr-2">
                      <div className="w-2 h-2 rounded-full bg-primary" />
                    </div>
                    <span className="font-medium">30 monthly calls</span>
                  </div>
                  
                  <div className="flex items-center">
                    <div className="w-4 h-4 rounded-full bg-primary/20 flex items-center justify-center mr-2">
                      <div className="w-2 h-2 rounded-full bg-primary" />
                    </div>
                    <span>Access to all advisors</span>
                  </div>
                  
                  <div className="flex items-center">
                    <div className="w-4 h-4 rounded-full bg-primary/20 flex items-center justify-center mr-2">
                      <div className="w-2 h-2 rounded-full bg-primary" />
                    </div>
                    <span>Maximum duration: 20 minutes</span>
                  </div>
                  
                  <div className="flex items-center">
                    <div className="w-4 h-4 rounded-full bg-primary/20 flex items-center justify-center mr-2">
                      <div className="w-2 h-2 rounded-full bg-primary" />
                    </div>
                    <span>Call history export</span>
                  </div>
                  
                  <div className="flex items-center">
                    <div className="w-4 h-4 rounded-full bg-primary/20 flex items-center justify-center mr-2">
                      <div className="w-2 h-2 rounded-full bg-primary" />
                    </div>
                    <span>Priority support</span>
                  </div>
                </div>
                
                <Separator />
                
                <div className="space-y-2">
                  <p className="font-semibold text-sm flex items-center">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary mr-2"></div>
                    Featured advisors:
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="text-sm flex items-center">
                      <span className="inline-block w-1 h-1 rounded-full bg-primary mr-2"></span>
                      Mark Johnson (Manager)
                    </div>
                    <div className="text-sm flex items-center">
                      <span className="inline-block w-1 h-1 rounded-full bg-primary mr-2"></span>
                      David Williams (Producer)
                    </div>
                    <div className="text-sm flex items-center">
                      <span className="inline-block w-1 h-1 rounded-full bg-primary mr-2"></span>
                      Alicia Torres (Marketing)
                    </div>
                    <div className="text-sm flex items-center">
                      <span className="inline-block w-1 h-1 rounded-full bg-primary mr-2"></span>
                      All 10 music advisors
                    </div>
                  </div>
                </div>
              </CardContent>
              
              <CardFooter className="relative z-10">
                <Button 
                  variant={currentPlan === 'professional' ? 'outline' : 'default'} 
                  className="w-full relative group overflow-hidden"
                  disabled={currentPlan === 'professional'}
                  onClick={() => setLocation('/account')}
                >
                  {/* Animated glowing effect on hover */}
                  <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out"></div>
                  <span className="relative z-10">
                    {currentPlan === 'professional' ? 'Current Plan' : 'Select Plan'}
                  </span>
                </Button>
              </CardFooter>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
      
      {/* Call modal */}
      <CallModal 
        advisor={selectedAdvisor}
        open={modalOpen}
        onOpenChange={setModalOpen}
      />
      </div>
    </PlanTierGuard>
  );
}