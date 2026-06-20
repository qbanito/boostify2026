import { Header } from "../components/layout/header";
import { Card } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { ScrollArea } from "../components/ui/scroll-area";
import { Badge } from "../components/ui/badge";
import { Progress } from "../components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { useState } from "react";
import { useAuth } from "../hooks/use-auth";
import { useToast } from "../hooks/use-toast";
import { motion } from "framer-motion";
import { SiInstagram } from "react-icons/si";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { db } from "../lib/firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { CircularProgressbar, buildStyles } from 'react-circular-progressbar';
import {
  Users,
  TrendingUp,
  MessageCircle,
  Calendar,
  Brain,
  BarChart2,
  Home,
  UserPlus,
  Sparkles,
  Target,
  ChevronRight,
  BadgeCheck,
  Share2,
  Rocket,
  SendHorizontal,
  Globe
} from "lucide-react";
import 'react-circular-progressbar/dist/styles.css';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart
} from "recharts";

interface InstagramStats {
  followers: number;
  following: number;
  engagement: number;
  automationStatus: 'active' | 'paused' | 'stopped';
}

export default function InstagramBoostPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedTab, setSelectedTab] = useState("community");

  const [stats, setStats] = useState<InstagramStats>({
    followers: 0,
    following: 0,
    engagement: 0,
    automationStatus: 'stopped'
  });

  // Firestore listener for stats
  useQuery({
    queryKey: ["instagram-stats", user?.uid],
    queryFn: async () => {
      if (!user) return null;
      const statsRef = collection(db, 'instagram_stats');
      const statsQuery = query(statsRef, where("userId", "==", user.uid));

      return new Promise((resolve) => {
        const unsubscribe = onSnapshot(statsQuery, (snapshot) => {
          snapshot.forEach((doc) => {
            setStats(doc.data() as InstagramStats);
          });
        });

        return () => unsubscribe();
      });
    },
    enabled: !!user
  });

  // Sample data for charts
  const engagementData = [
    { name: 'Mon', value: 45 },
    { name: 'Tue', value: 52 },
    { name: 'Wed', value: 49 },
    { name: 'Thu', value: 63 },
    { name: 'Fri', value: 58 },
    { name: 'Sat', value: 71 },
    { name: 'Sun', value: 68 }
  ];

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1 pt-20">
        <div className="flex-1 space-y-8 p-8 pt-6 bg-gradient-to-b from-background to-background/80">
          {/* Hero Section with Video Background */}
          <div className="relative w-full min-h-[60vh] sm:min-h-[70vh] overflow-hidden">
            <video
              autoPlay
              loop
              muted
              playsInline
              className="absolute inset-0 w-full h-full object-cover opacity-50"
              src="/assets/instagram_promo.mp4"
            />
            <div className="absolute inset-0 bg-gradient-to-br from-orange-900/90 via-orange-600/80 to-background" />
            <div className="relative h-full flex items-center">
              <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                <div className="max-w-2xl space-y-6">
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                  >
                    <span className="inline-flex items-center rounded-full bg-orange-500/10 px-3 py-1.5 text-sm font-medium text-orange-500 ring-1 ring-inset ring-orange-500/20 mb-6">
                      <Sparkles className="mr-1.5 h-3.5 w-3.5" /> AI-Powered Growth
                    </span>
                    <h1 className="text-3xl sm:text-4xl md:text-6xl font-bold text-white mb-4 sm:mb-6 leading-tight">
                      Instagram Growth
                      <span className="block bg-clip-text text-transparent bg-gradient-to-r from-orange-400 to-orange-600">
                        Reimagined
                      </span>
                    </h1>
                    <p className="text-base sm:text-lg md:text-xl text-white/90 mb-8 font-medium max-w-xl">
                      Transform your Instagram presence with our AI-powered platform. Grow organically and engage authentically.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-4">
                      <Button
                        size="lg"
                        className="w-full sm:w-auto bg-orange-500 hover:bg-orange-600 text-white px-6 py-3"
                      >
                        <Rocket className="mr-2 h-5 w-5" />
                        Start Growing
                      </Button>
                      <Button
                        size="lg"
                        variant="outline"
                        className="w-full sm:w-auto bg-black/50 hover:bg-black/60 border-white/20 text-white px-6 py-3"
                      >
                        Learn More
                        <ChevronRight className="ml-2 h-4 w-4" />
                      </Button>
                    </div>
                  </motion.div>
                </div>
              </div>
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="flex items-center justify-between"
          >
            <div className="flex items-center gap-4">
              <SiInstagram className="w-12 h-12 text-orange-500" />
              <div>
                <h2 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-orange-500 to-orange-600 bg-clip-text text-transparent">
                  Instagram Growth Suite
                </h2>
                <p className="text-muted-foreground mt-2">
                  All-in-one platform for Instagram growth and engagement
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Link href="/dashboard">
                <Button variant="outline" className="gap-2">
                  <Home className="w-4 h-4" />
                  Dashboard
                </Button>
              </Link>
            </div>
          </motion.div>

          {/* Stats Grid - Responsive adjustments */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mt-8 sm:mt-12">
            {[
              { icon: Users, label: "Active Users", value: "10K+" },
              { icon: TrendingUp, label: "Growth Rate", value: "85%" },
              { icon: MessageCircle, label: "Engagement", value: "95%" },
              { icon: Globe, label: "Countries", value: "150+" }
            ].map((stat, index) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="bg-white/10 backdrop-blur-md rounded-xl p-4 sm:p-6 border border-white/20"
              >
                <div className="flex items-center gap-3 mb-2">
                  <stat.icon className="h-5 w-5 text-orange-500" />
                  <h3 className="text-sm font-medium text-white/70">{stat.label}</h3>
                </div>
                <p className="text-2xl sm:text-3xl font-bold text-white">{stat.value}</p>
              </motion.div>
            ))}
          </div>


          {/* Main Content */}
          <Tabs defaultValue="community" value={selectedTab} onValueChange={setSelectedTab} className="space-y-8">
            <TabsList className="flex flex-nowrap overflow-x-auto p-1 bg-background/50 backdrop-blur-sm rounded-full border border-orange-500/20">
              <TabsTrigger value="community" className="data-[state=active]:bg-orange-500 rounded-full px-4 py-2 whitespace-nowrap">
                <Calendar className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">Community</span>
                <span className="sm:hidden">Com</span>
              </TabsTrigger>
              <TabsTrigger value="influencers" className="data-[state=active]:bg-orange-500 rounded-full px-4 py-2 whitespace-nowrap">
                <UserPlus className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">Influencers</span>
                <span className="sm:hidden">Inf</span>
              </TabsTrigger>
              <TabsTrigger value="strategies" className="data-[state=active]:bg-orange-500 rounded-full px-4 py-2 whitespace-nowrap">
                <Sparkles className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">Strategies</span>
                <span className="sm:hidden">Str</span>
              </TabsTrigger>
              <TabsTrigger value="reports" className="data-[state=active]:bg-orange-500 rounded-full px-4 py-2 whitespace-nowrap">
                <BarChart2 className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">Reports</span>
                <span className="sm:hidden">Rep</span>
              </TabsTrigger>
              <TabsTrigger value="ai" className="data-[state=active]:bg-orange-500 rounded-full px-4 py-2 whitespace-nowrap">
                <Brain className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">AI Assistant</span>
                <span className="sm:hidden">AI</span>
              </TabsTrigger>
            </TabsList>

            {/* Community Tab */}
            <TabsContent value="community">
              <div className="grid gap-4 sm:gap-6 md:grid-cols-2">
                <Card className="p-4 sm:p-6 hover:bg-orange-500/5 transition-colors bg-gradient-to-br from-background to-orange-500/5">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="p-3 bg-orange-500/10 rounded-lg">
                      <Calendar className="h-6 w-6 text-orange-500" />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold">Content Calendar</h3>
                      <p className="text-sm text-muted-foreground">
                        Plan and schedule your content
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4 mb-6">
                    {['Product Showcase', 'Behind the Scenes', 'User Feature'].map((task, index) => (
                      <motion.div
                        key={task}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.5, delay: index * 0.1 }}
                        className="p-4 rounded-xl border border-orange-500/20 hover:border-orange-500/40 hover:bg-orange-500/5 transition-all"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{task}</span>
                          <Button variant="ghost" size="sm" className="hover:bg-orange-500/10">
                            Schedule <ChevronRight className="ml-2 h-4 w-4" />
                          </Button>
                        </div>
                      </motion.div>
                    ))}
                  </div>

                  <Button className="w-full bg-orange-500 hover:bg-orange-600">
                    Schedule New Post
                  </Button>
                </Card>

                <Card className="p-4 sm:p-6 hover:bg-orange-500/5 transition-colors bg-gradient-to-br from-background to-orange-500/5">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="p-3 bg-orange-500/10 rounded-lg">
                      <MessageCircle className="h-6 w-6 text-orange-500" />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold">Community Management</h3>
                      <p className="text-sm text-muted-foreground">
                        Engage with your audience
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4 mb-6">
                    <div className="p-4 rounded-xl border border-orange-500/20 bg-background/50">
                      <h4 className="font-medium mb-4">Engagement Tasks</h4>
                      <div className="space-y-3">
                        {['Respond to comments', 'Like relevant posts', 'Follow back engaged users'].map((task, index) => (
                          <motion.div
                            key={task}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.5, delay: index * 0.1 }}
                            className="flex items-center gap-2"
                          >
                            <BadgeCheck className="h-4 w-4 text-orange-500" />
                            <span>{task}</span>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <Button className="w-full bg-orange-500 hover:bg-orange-600">
                    View Community Dashboard
                  </Button>
                </Card>
              </div>
            </TabsContent>

            {/* Influencers Tab */}
            <TabsContent value="influencers">
              <div className="grid gap-4 sm:gap-6 md:grid-cols-2">
                <Card className="p-4 sm:p-6 hover:bg-orange-500/5 transition-colors bg-gradient-to-br from-background to-orange-500/5">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="p-3 bg-orange-500/10 rounded-lg">
                      <UserPlus className="h-6 w-6 text-orange-500" />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold">Influencer Discovery</h3>
                      <p className="text-sm text-muted-foreground">
                        Find and connect with relevant influencers
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4 mb-6">
                    <Input
                      placeholder="Search influencers by niche..."
                      className="bg-background border-orange-500/20 focus:border-orange-500"
                    />
                    <div className="space-y-4">
                      {[
                        { name: 'Sarah Johnson', niche: 'Fashion & Lifestyle' },
                        { name: 'Mike Stevens', niche: 'Tech & Gaming' }
                      ].map((influencer, index) => (
                        <motion.div
                          key={influencer.name}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.5, delay: index * 0.1 }}
                          className="p-4 rounded-xl border border-orange-500/20 hover:border-orange-500/40 hover:bg-orange-500/5 transition-all"
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-full bg-orange-500/20" />
                            <div>
                              <h4 className="font-medium">{influencer.name}</h4>
                              <p className="text-sm text-muted-foreground">{influencer.niche}</p>
                            </div>
                            <Button className="ml-auto" variant="outline">
                              Connect
                            </Button>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>

                  <Button className="w-full bg-orange-500 hover:bg-orange-600">
                    View All Influencers
                  </Button>
                </Card>

                <Card className="p-4 sm:p-6 hover:bg-orange-500/5 transition-colors bg-gradient-to-br from-background to-orange-500/5">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="p-3 bg-orange-500/10 rounded-lg">
                      <Share2 className="h-6 w-6 text-orange-500" />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold">Active Collaborations</h3>
                      <p className="text-sm text-muted-foreground">
                        Manage your influencer partnerships
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4 mb-6">
                    <div className="p-4 rounded-xl border border-orange-500/20 bg-background/50">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h4 className="font-medium">Summer Collection Campaign</h4>
                          <p className="text-sm text-muted-foreground">3 Influencers • 15 Posts</p>
                        </div>
                        <Badge variant="outline" className="bg-green-500/10 text-green-500">
                          Active
                        </Badge>
                      </div>
                      <Progress
                        value={75}
                        className="bg-orange-500/20 h-2 rounded-full" //Added styling here
                      />
                      <p className="text-sm text-muted-foreground mt-2">75% Complete</p>
                    </div>
                  </div>

                  <Button className="w-full bg-orange-500 hover:bg-orange-600">
                    Create New Campaign
                  </Button>
                </Card>
              </div>
            </TabsContent>

            {/* Strategies Tab */}
            <TabsContent value="strategies">
              <div className="grid gap-4 sm:gap-6 md:grid-cols-2">
                <Card className="p-4 sm:p-6 hover:bg-orange-500/5 transition-colors bg-gradient-to-br from-background to-orange-500/5">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="p-3 bg-orange-500/10 rounded-lg">
                      <Sparkles className="h-6 w-6 text-orange-500" />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold">Growth Strategies</h3>
                      <p className="text-sm text-muted-foreground">
                        Optimize your Instagram presence
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4 mb-6">
                    {/* Strategy cards */}
                    <div className="p-4 rounded-xl border border-orange-500/20 bg-background/50">
                      <h4 className="font-medium mb-2">Content Mix Strategy</h4>
                      <p className="text-sm text-muted-foreground mb-4">
                        Optimal content distribution for maximum engagement
                      </p>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="p-2 bg-orange-500/10 rounded text-center">
                          <div className="text-lg font-bold text-orange-500">40%</div>
                          <div className="text-xs">Entertainment</div>
                        </div>
                        <div className="p-2 bg-orange-600/10 rounded text-center">
                          <div className="text-lg font-bold text-orange-600">35%</div>
                          <div className="text-xs">Education</div>
                        </div>
                        <div className="p-2 bg-orange-700/10 rounded text-center">
                          <div className="text-lg font-bold text-orange-700">25%</div>
                          <div className="text-xs">Promotion</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <Button className="w-full bg-orange-500 hover:bg-orange-600">
                    Get Custom Strategy
                  </Button>
                </Card>

                <Card className="p-4 sm:p-6 hover:bg-orange-500/5 transition-colors bg-gradient-to-br from-background to-orange-500/5">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="p-3 bg-orange-500/10 rounded-lg">
                      <Target className="h-6 w-6 text-orange-500" />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold">Hashtag Strategy</h3>
                      <p className="text-sm text-muted-foreground">
                        Optimize your hashtag usage
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4 mb-6">
                    <div className="flex flex-wrap gap-2">
                      <span className="px-3 py-1 bg-orange-500/10 rounded-full text-sm">
                        #fashion
                      </span>
                      <span className="px-3 py-1 bg-orange-500/10 rounded-full text-sm">
                        #style
                      </span>
                      <span className="px-3 py-1 bg-orange-500/10 rounded-full text-sm">
                        #beauty
                      </span>
                      {/* Add more hashtags */}
                    </div>
                    <Input
                      placeholder="Search hashtags..."
                      className="bg-background border-orange-500/20 focus:border-orange-500"
                    />
                  </div>

                  <Button className="w-full bg-orange-500 hover:bg-orange-600">
                    Generate Hashtags
                  </Button>
                </Card>
              </div>
            </TabsContent>

            {/* Reports Tab */}
            <TabsContent value="reports">
              <div className="grid gap-4 sm:gap-6 md:grid-cols-2">
                <Card className="p-4 sm:p-6 hover:bg-orange-500/5 transition-colors bg-gradient-to-br from-background to-orange-500/5">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="p-3 bg-orange-500/10 rounded-lg">
                      <BarChart2 className="h-6 w-6 text-orange-500" />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold">Growth Analytics</h3>
                      <p className="text-sm text-muted-foreground">
                        Track your Instagram growth
                      </p>
                    </div>
                  </div>

                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={engagementData}>
                        <defs>
                          <linearGradient id="colorEngagement" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#ec4899" stopOpacity={0.8}/>
                            <stop offset="95%" stopColor="#ec4899" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip />
                        <Area
                          type="monotone"
                          dataKey="value"
                          stroke="#ec4899"
                          fillOpacity={1}
                          fill="url(#colorEngagement)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </Card>

                <Card className="p-4 sm:p-6 hover:bg-orange-500/5 transition-colors bg-gradient-to-br from-background to-orange-500/5">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="p-3 bg-orange-500/10 rounded-lg">
                      <Users className="h-6 w-6 text-orange-500" />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold">Audience Insights</h3>
                      <p className="text-sm text-muted-foreground">
                        Understand your followers
                      </p>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div>
                      <h4 className="font-medium mb-4">Demographics</h4>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span>Age 18-24</span>
                          <div className="w-48 h-2 bg-orange-500/20 rounded-full overflow-hidden">
                            <div className="w-3/4 h-full bg-orange-500" />
                          </div>
                          <span>75%</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Age 25-34</span>
                          <div className="w-48 h-2 bg-orange-500/20 rounded-full overflow-hidden">
                            <div className="w-1/2 h-full bg-orange-500" />
                          </div>
                          <span>50%</span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-medium mb-4">Top Locations</h4>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span>United States</span>
                          <div className="w-48 h-2 bg-orange-500/20 rounded-full overflow-hidden">
                            <div className="w-4/5 h-full bg-orange-500" />
                          </div>
                          <span>80%</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>United Kingdom</span>
                          <div className="w-48 h-2 bg-orange-500/20 rounded-full overflow-hidden">
                            <div className="w-2/5 h-full bg-orange-500" />
                          </div>
                          <span>40%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              </div>
            </TabsContent>

            {/* AI Assistant Tab */}
            <TabsContent value="ai">
              <Card className="p-4 sm:p-6 hover:bg-orange-500/5 transition-colors bg-gradient-to-br from-background to-orange-500/5">
                <div className="flex items-center gap-4 mb-6">
                  <div className="p-3 bg-orange-500/10 rounded-lg">
                    <Brain className="h-6 w-6 text-orange-500" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold">AI Assistant</h3>
                    <p className="text-sm text-muted-foreground">
                      Get AI-powered insights and recommendations
                    </p>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="p-4 rounded-xl border border-orange-500/20 bg-background/50">
                    <h4 className="font-medium mb-4">Ask AI Assistant</h4>
                    <textarea
                      className="w-full p-3 rounded-lg bg-background border border-input"
                      placeholder="Ask anything about Instagram growth..."
                      rows={4}
                    />
                    <Button className="w-full mt-4 bg-orange-500 hover:bg-orange-600">
                      <SendHorizontal className="mr-2 h-4 w-4" />
                      Get AI Response
                    </Button>
                  </div>

                  <div className="space-y-4">
                    <h4 className="font-medium">Quick Actions</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <Button variant="outline" className="justify-start">
                        <Sparkles className="mr-2 h-4 w-4" />
                        Generate Content
                      </Button>
                      <Button variant="outline" className="justify-start">
                        <Target className="mr-2 h-4 w-4" />
                        Hashtag Analysis
                      </Button>
                      <Button variant="outline" className="justify-start">
                        <Calendar className="mr-2 h-4 w-4" />
                        Best Post Time
                      </Button>
                      <Button variant="outline" className="justify-start">
                        <MessageCircle className="mr-2 h-4 w-4" />
                        Engagement Tips
                      </Button>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl border border-orange-500/20 bg-background/50">
                    <h4 className="font-medium mb-4">Recent AI Insights</h4>
                    <div className="space-y-4">
                      <div className="flex gap-3">
                        <Brain className="h-5 w-5 text-orange-500 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="font-medium">Content Performance Analysis</p>
                          <p className="text-sm text-muted-foreground">
                            Your carousel posts receive 45% more engagement than single images. Consider creating more carousel content.
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <Brain className="h-5 w-5 text-orange-500 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="font-medium">Growth Opportunity</p>
                          <p className="text-sm text-muted-foreground">
                            Your followers are most active between 6 PM - 8 PM EST. Adjust your posting schedule accordingly.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}