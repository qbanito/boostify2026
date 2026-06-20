import React from "react";
import { Link } from "wouter";
import { 
  BookOpen, 
  Users, 
  Globe, 
  FileText, 
  Mic, 
  Video, 
  Music, 
  Calendar, 
  Lightbulb, 
  Mail,
  ArrowRight,
  MessageSquare,
  Share2,
  BookMarked,
  ExternalLink,
  Star,
  ChevronRight,
  Wrench,
  Clock,
  Download,
  Tag
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import Layout from "../components/layout";

// Resource categories
const categories = [
  { id: "quick-tips", label: "Quick Tips" },
  { id: "collaboration", label: "Collaboration" },
  { id: "guides", label: "Comprehensive Guides" },
  { id: "tools", label: "Tools & Resources" },
];

// Quick tips data
const quickTips = [
  {
    title: "Optimize Your Social Media Strategy",
    description: "Focus on 1-2 platforms where your audience is most active rather than trying to manage all social networks.",
    icon: <Globe className="h-5 w-5" />,
    color: "from-blue-500 to-indigo-600",
  },
  {
    title: "Email Marketing Best Practices",
    description: "Build your mailing list from day one. Email remains one of the most effective marketing channels with direct access to fans.",
    icon: <Mail className="h-5 w-5" />,
    color: "from-amber-500 to-orange-600",
  },
  {
    title: "Content Creation Schedule",
    description: "Create a consistent content calendar to maintain engagement. Aim for quality over quantity.",
    icon: <Calendar className="h-5 w-5" />,
    color: "from-green-500 to-emerald-600",
  },
  {
    title: "Networking Essentials",
    description: "Attend industry events and connect with other artists. Meaningful relationships are crucial for career growth.",
    icon: <Users className="h-5 w-5" />,
    color: "from-pink-500 to-rose-600",
  },
  {
    title: "Streaming Platform Optimization",
    description: "Ensure your music metadata is complete and accurate. Use high-quality artwork and consistent branding across platforms.",
    icon: <Music className="h-5 w-5" />,
    color: "from-purple-500 to-violet-600",
  },
  {
    title: "Video Content Strategy",
    description: "Short-form video content has the highest engagement. Create vertical videos optimized for mobile viewing.",
    icon: <Video className="h-5 w-5" />,
    color: "from-red-500 to-pink-600",
  },
];

// Collaboration opportunities
const collaborationOpportunities = [
  {
    title: "Find Co-Writers",
    description: "Connect with songwriters who complement your strengths. Co-writing can lead to fresh ideas and more commercial appeal.",
    cta: "Find Writers",
    icon: <FileText className="h-5 w-5" />,
  },
  {
    title: "Producer Matchmaking",
    description: "Discover producers who specialize in your genre and can elevate your sound to professional standards.",
    cta: "Find Producers",
    icon: <Music className="h-5 w-5" />,
  },
  {
    title: "Featured Artists",
    description: "Collaborate with other artists to reach new audiences and create cross-promotional opportunities.",
    cta: "Find Artists",
    icon: <Mic className="h-5 w-5" />,
  },
  {
    title: "Visual Collaborators",
    description: "Connect with photographers, videographers, and graphic designers to create compelling visual content.",
    cta: "Find Creatives",
    icon: <Video className="h-5 w-5" />,
  },
];

// Comprehensive guides
const guides = [
  {
    id: "music-distribution",
    title: "The Complete Guide to Music Distribution",
    description: "Everything you need to know about getting your music on streaming platforms and maximizing revenue.",
    readTime: "15 min read",
    color: "border-blue-600",
  },
  {
    id: "artist-branding",
    title: "Building Your Artist Brand",
    description: "Step-by-step process to define, develop and maintain a consistent artist brand that resonates with fans.",
    readTime: "12 min read",
    color: "border-amber-600",
  },
  {
    id: "music-marketing-budget",
    title: "Music Marketing on a Budget",
    description: "Effective strategies to promote your music with limited resources and maximize your marketing impact.",
    readTime: "10 min read",
    color: "border-green-600",
  },
  {
    id: "music-publishing",
    title: "Understanding Music Publishing",
    description: "Comprehensive breakdown of publishing rights, royalties, and how to protect your intellectual property.",
    readTime: "20 min read",
    color: "border-red-600",
  },
];

// Tools and resources
const tools = [
  {
    title: "Royalty Calculator",
    description: "Estimate your streaming revenue across different platforms based on play counts.",
    buttonText: "Calculate Royalties",
    link: "/tools/royalty-calculator",
  },
  {
    title: "Press Kit Generator",
    description: "Create a professional electronic press kit with our simple template builder.",
    buttonText: "Create Press Kit",
    link: "/tools/press-kit",
  },
  {
    title: "Release Planner",
    description: "Step-by-step checklist for planning your next music release for maximum impact.",
    buttonText: "Plan Your Release",
    link: "/tools/release-planner",
  },
  {
    title: "Playlist Submission Tool",
    description: "Submit your music to curated playlists that match your genre and style.",
    buttonText: "Submit Music",
    link: "/tools/playlist-submission",
  },
];

// Feature card component
interface FeatureCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  color: string;
}

const FeatureCard = ({ title, description, icon, color }: FeatureCardProps) => {
  return (
    <Card className="bg-zinc-950 border-zinc-800 text-white h-full">
      <CardHeader className="pb-2">
        <div className={`w-12 h-12 rounded-lg flex items-center justify-center bg-gradient-to-br ${color} mb-3`}>
          {icon}
        </div>
        <CardTitle className="text-xl">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-zinc-400">{description}</p>
      </CardContent>
    </Card>
  );
};

// Collaboration card component
interface CollaborationCardProps {
  title: string;
  description: string;
  cta: string;
  icon: React.ReactNode;
}

const CollaborationCard = ({ title, description, cta, icon }: CollaborationCardProps) => {
  return (
    <Card className="bg-zinc-950 border-zinc-800 text-white h-full flex flex-col">
      <CardHeader className="pb-2">
        <div className="w-12 h-12 rounded-lg flex items-center justify-center bg-gradient-to-br from-amber-500 to-orange-600 mb-3">
          {icon}
        </div>
        <CardTitle className="text-xl">{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex-grow">
        <p className="text-zinc-400">{description}</p>
      </CardContent>
      <CardFooter>
        <Button className="w-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700">
          {cta} <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </CardFooter>
    </Card>
  );
};

// Guide card component
interface GuideCardProps {
  title: string;
  description: string;
  readTime: string;
  color: string;
  id?: string;
}

const GuideCard = ({ title, description, readTime, color, id }: GuideCardProps) => {
  return (
    <Card className={`bg-zinc-950 border-l-4 ${color} border-t-zinc-800 border-r-zinc-800 border-b-zinc-800 text-white h-full flex flex-col`}>
      <CardHeader className="pb-2">
        <CardTitle className="text-xl">{title}</CardTitle>
        <CardDescription className="flex items-center text-zinc-500">
          <Clock className="h-4 w-4 mr-1" /> {readTime}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-grow">
        <p className="text-zinc-400">{description}</p>
      </CardContent>
      <CardFooter>
        <Link href={id ? `/guides/${id}` : "/guides"} className="w-full">
          <Button variant="outline" className="w-full border-zinc-700 text-white hover:bg-zinc-800">
            Read Guide <BookMarked className="ml-2 h-4 w-4" />
          </Button>
        </Link>
      </CardFooter>
    </Card>
  );
};

// Tool card component
interface ToolCardProps {
  title: string;
  description: string;
  buttonText: string;
  link?: string; // Opcional para enlaces específicos
}

const ToolCard = ({ title, description, buttonText, link }: ToolCardProps) => {
  return (
    <Card className="bg-zinc-950 border-zinc-800 text-white h-full flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-xl">{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex-grow">
        <p className="text-zinc-400">{description}</p>
      </CardContent>
      <CardFooter>
        {link ? (
          <Link href={link} className="w-full">
            <Button className="w-full bg-gradient-to-r from-zinc-700 to-zinc-600 hover:from-zinc-600 hover:to-zinc-500">
              {buttonText}
            </Button>
          </Link>
        ) : (
          <Button className="w-full bg-gradient-to-r from-zinc-700 to-zinc-600 hover:from-zinc-600 hover:to-zinc-500">
            {buttonText}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
};

// Community spotlight section
const CommunitySpotlight = () => {
  return (
    <div className="bg-gradient-to-br from-zinc-900 to-zinc-950 rounded-xl p-6 mt-12">
      <h2 className="text-2xl font-bold text-white mb-4">Community Spotlight</h2>
      <p className="text-zinc-400 mb-6">See how other artists are leveraging collaboration to grow their careers</p>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-zinc-950/50 border-zinc-800 text-white">
          <CardHeader>
            <CardTitle className="text-lg">Sarah J. - Singer/Songwriter</CardTitle>
            <CardDescription className="text-zinc-500">Increased streaming by 350%</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-zinc-400">"Collaborating with producers from different genres helped me discover a unique sound that resonates with a much wider audience."</p>
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button variant="ghost" className="text-zinc-400 hover:text-white">
              <MessageSquare className="h-4 w-4 mr-2" /> Connect
            </Button>
            <Button variant="ghost" className="text-zinc-400 hover:text-white">
              <Share2 className="h-4 w-4 mr-2" /> Share
            </Button>
          </CardFooter>
        </Card>
        
        <Card className="bg-zinc-950/50 border-zinc-800 text-white">
          <CardHeader>
            <CardTitle className="text-lg">Marcus T. - Hip-Hop Producer</CardTitle>
            <CardDescription className="text-zinc-500">Landed major label placement</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-zinc-400">"Regular virtual sessions with songwriters expanded my network. One connection led to my first major label placement within 3 months."</p>
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button variant="ghost" className="text-zinc-400 hover:text-white">
              <MessageSquare className="h-4 w-4 mr-2" /> Connect
            </Button>
            <Button variant="ghost" className="text-zinc-400 hover:text-white">
              <Share2 className="h-4 w-4 mr-2" /> Share
            </Button>
          </CardFooter>
        </Card>
        
        <Card className="bg-zinc-950/50 border-zinc-800 text-white">
          <CardHeader>
            <CardTitle className="text-lg">Elena R. - Indie Artist</CardTitle>
            <CardDescription className="text-zinc-500">Built international audience</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-zinc-400">"Featuring international artists opened up completely new markets for my music. My top streaming cities are now in countries I've never even visited."</p>
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button variant="ghost" className="text-zinc-400 hover:text-white">
              <MessageSquare className="h-4 w-4 mr-2" /> Connect
            </Button>
            <Button variant="ghost" className="text-zinc-400 hover:text-white">
              <Share2 className="h-4 w-4 mr-2" /> Share
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
};

// Call-to-action section
const CollaborationCTA = () => {
  return (
    <div className="mt-16 bg-gradient-to-r from-amber-500 to-orange-600 rounded-xl p-8 text-center">
      <Lightbulb className="h-12 w-12 mx-auto mb-4 text-white" />
      <h2 className="text-3xl font-bold text-white mb-4">Ready to Expand Your Reach?</h2>
      <p className="text-white/90 max-w-2xl mx-auto mb-6">
        Collaboration is the fastest way to reach new audiences and accelerate your growth as an artist. Our platform makes it easy to find the perfect collaborators.
      </p>
      <div className="flex flex-col sm:flex-row justify-center gap-4">
        <Button className="bg-white text-orange-600 hover:bg-white/90">
          Find Collaborators
        </Button>
        <Button variant="outline" className="border-white text-white hover:bg-white/20">
          Learn More
        </Button>
      </div>
    </div>
  );
};

export default function ResourcesPage() {
  return (
    <Layout>
      <div className="container max-w-7xl mx-auto px-4 py-12">
        {/* Hero section */}
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-extrabold text-white mb-6">Artist Resources</h1>
          <p className="text-xl text-zinc-400 max-w-3xl mx-auto">
            Access tools, guides, and collaboration opportunities to accelerate your music career
          </p>
        </div>

        {/* Tabs for different resource categories */}
        <Tabs defaultValue="quick-tips" className="mb-12">
          <TabsList className="grid grid-cols-2 md:grid-cols-4 bg-zinc-900 p-1 mb-8">
            {categories.map((category) => (
              <TabsTrigger
                key={category.id}
                value={category.id}
                className="data-[state=active]:bg-orange-600 data-[state=active]:text-white"
              >
                {category.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* Quick tips content */}
          <TabsContent value="quick-tips" className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {quickTips.map((tip, index) => (
                <FeatureCard
                  key={index}
                  title={tip.title}
                  description={tip.description}
                  icon={tip.icon}
                  color={tip.color}
                />
              ))}
            </div>
            <div className="text-center">
              <Link href="/tips" className="inline-block">
                <div className="flex items-center justify-center h-10 px-4 py-2 border border-zinc-700 text-white rounded-md hover:bg-zinc-800 transition-colors">
                  View All Tips <ArrowRight className="ml-2 h-4 w-4" />
                </div>
              </Link>
            </div>
          </TabsContent>

          {/* Collaboration content */}
          <TabsContent value="collaboration" className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {collaborationOpportunities.map((opportunity, index) => (
                <CollaborationCard
                  key={index}
                  title={opportunity.title}
                  description={opportunity.description}
                  cta={opportunity.cta}
                  icon={opportunity.icon}
                />
              ))}
            </div>
            <CommunitySpotlight />
            <CollaborationCTA />
          </TabsContent>

          {/* Guides content */}
          <TabsContent value="guides" className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {guides.map((guide, index) => (
                <GuideCard
                  key={index}
                  title={guide.title}
                  description={guide.description}
                  readTime={guide.readTime}
                  color={guide.color}
                />
              ))}
            </div>
            <div className="text-center">
              <Link href="/guides" className="inline-block">
                <div className="flex items-center justify-center h-10 px-4 py-2 border border-zinc-700 text-white rounded-md hover:bg-zinc-800 transition-colors">
                  Browse All Guides <BookOpen className="ml-2 h-4 w-4" />
                </div>
              </Link>
            </div>
          </TabsContent>

          {/* Tools content */}
          <TabsContent value="tools" className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {tools.map((tool, index) => (
                <ToolCard
                  key={index}
                  title={tool.title}
                  description={tool.description}
                  buttonText={tool.buttonText}
                  link={tool.link}
                />
              ))}
            </div>
            <div className="text-center">
              <Link href="/tools" className="inline-block">
                <Button className="bg-gradient-to-r from-zinc-700 to-zinc-600 hover:from-zinc-600 hover:to-zinc-500">
                  View All Tools <Wrench className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </TabsContent>
        </Tabs>

        {/* Newsletter subscription */}
        <div className="bg-zinc-900 rounded-xl p-8 mt-16">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            <div>
              <h2 className="text-2xl font-bold text-white mb-3">Weekly Resources & Opportunities</h2>
              <p className="text-zinc-400 mb-2">
                Get the latest collaboration opportunities, industry insights, and resource updates delivered to your inbox.
              </p>
              <p className="text-zinc-500 text-sm">Join 25,000+ artists who stay ahead of the curve.</p>
            </div>
            <div>
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="email"
                  placeholder="Your email address"
                  className="flex-grow px-4 py-3 rounded-md bg-zinc-800 border border-zinc-700 text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
                <Button className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 whitespace-nowrap">
                  Subscribe
                </Button>
              </div>
              <p className="text-zinc-500 text-xs mt-2">
                We respect your privacy. Unsubscribe at any time.
              </p>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}