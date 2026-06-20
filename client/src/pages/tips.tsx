import React, { useState } from "react";
import { Link } from "wouter";
import {
  Globe,
  Mail,
  Calendar,
  Users,
  Music,
  Video,
  Mic,
  Instagram,
  Twitter,
  Youtube,
  TrendingUp,
  DollarSign,
  FileText,
  BookOpen,
  Search,
  Share2,
  Heart,
  ArrowRight,
  Tag,
  Filter
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import Layout from "../components/layout";

// Categories and tags
const categories = [
  { id: "all", label: "All Tips" },
  { id: "social-media", label: "Social Media" },
  { id: "marketing", label: "Marketing" },
  { id: "revenue", label: "Revenue" },
  { id: "production", label: "Production" },
  { id: "networking", label: "Networking" }
];

const tags = [
  "Beginners", "Advanced", "Free", "Tools", "Growth", "Engagement", 
  "Production", "Equipment", "Monetization", "Streaming", "Algorithms"
];

// Quick tips data with extended information
const allTips = [
  {
    id: 1,
    title: "Optimize Your Social Media Strategy",
    description: "Focus on 1-2 platforms where your audience is most active rather than trying to manage all social networks.",
    icon: <Globe className="h-5 w-5" />,
    color: "from-blue-500 to-indigo-600",
    category: "social-media",
    tags: ["Beginners", "Growth"],
    content: "Many artists spread themselves too thin by trying to maintain a presence on every social media platform. Research shows that focusing your efforts on the 1-2 platforms where your target audience is most active yields better results than a scattered approach. Start by identifying where your ideal fans spend their time online, then develop a consistent posting schedule for those platforms. Quality engagement on fewer platforms beats minimal engagement across many."
  },
  {
    id: 2,
    title: "Email Marketing Best Practices",
    description: "Build your mailing list from day one. Email remains one of the most effective marketing channels with direct access to fans.",
    icon: <Mail className="h-5 w-5" />,
    color: "from-amber-500 to-orange-600",
    category: "marketing",
    tags: ["Growth", "Engagement"],
    content: "Despite the popularity of social media, email marketing remains one of the most valuable assets for musicians. Unlike social platforms where algorithms control who sees your content, email gives you direct access to your fans' inboxes. Start collecting emails at every opportunity - at shows, through your website, and via social media. Keep your messages valuable and personal, not just promotional. Segment your list based on engagement and geographic location to send more targeted communications."
  },
  {
    id: 3,
    title: "Content Creation Schedule",
    description: "Create a consistent content calendar to maintain engagement. Aim for quality over quantity.",
    icon: <Calendar className="h-5 w-5" />,
    color: "from-green-500 to-emerald-600",
    category: "marketing",
    tags: ["Beginners", "Organization"],
    content: "Consistency is key to building and maintaining audience engagement. Create a realistic content calendar that outlines what you'll post and when across your active platforms. Focus on creating high-quality content rather than posting just to meet a quota. A good rule of thumb is to aim for a 4:1 ratio of value-giving content (behind-the-scenes, tutorials, personal stories) to promotional content (new releases, merchandise). Use scheduling tools to plan content in advance, which helps maintain consistency even during busy periods."
  },
  {
    id: 4,
    title: "Networking Essentials",
    description: "Attend industry events and connect with other artists. Meaningful relationships are crucial for career growth.",
    icon: <Users className="h-5 w-5" />,
    color: "from-pink-500 to-rose-600",
    category: "networking",
    tags: ["Growth", "Relationships"],
    content: "Networking is often overlooked by emerging artists but is crucial for long-term success. Industry relationships can lead to collaborations, mentorships, and opportunities that wouldn't be accessible otherwise. Attend local music events, conferences, and workshops to build genuine connections with others in the industry. Focus on how you can provide value rather than what you can gain. Follow up with new contacts promptly and maintain relationships through occasional check-ins. Remember that networking is about building authentic, mutually beneficial relationships, not just collecting contacts."
  },
  {
    id: 5,
    title: "Streaming Platform Optimization",
    description: "Ensure your music metadata is complete and accurate. Use high-quality artwork and consistent branding across platforms.",
    icon: <Music className="h-5 w-5" />,
    color: "from-purple-500 to-violet-600",
    category: "marketing",
    tags: ["Streaming", "Algorithms"],
    content: "Proper optimization of your streaming profiles can significantly impact discoverability. First, ensure all metadata is accurate and complete - this includes properly formatted artist names, featured artists, composers, and producers. Use high-resolution artwork that's consistent with your brand identity. Complete all profile information on each platform, including bio, social links, and upcoming releases. For platforms like Spotify, regularly update playlists and artist picks to show activity. Submit upcoming releases to platform editors for playlist consideration at least 4 weeks before release date. Monitor analytics regularly to understand what content resonates most with your audience."
  },
  {
    id: 6,
    title: "Video Content Strategy",
    description: "Short-form video content has the highest engagement. Create vertical videos optimized for mobile viewing.",
    icon: <Video className="h-5 w-5" />,
    color: "from-red-500 to-pink-600",
    category: "marketing",
    tags: ["Engagement", "Growth"],
    content: "Short-form vertical video has become the dominant content format across social platforms. Platforms prioritize this content in their algorithms, making it essential for artist growth strategies. Create a mix of performance clips, behind-the-scenes content, and personal moments. Keep videos under 60 seconds for optimal engagement, with a strong hook in the first 3 seconds. Film in vertical format (9:16 ratio) to optimize for mobile viewing. Don't repurpose the same content across platforms - make slight adjustments to fit each platform's specific format and audience expectations. Use trending sounds and challenges on platforms like TikTok and Instagram to increase discoverability."
  },
  {
    id: 7,
    title: "Instagram Strategy for Musicians",
    description: "Use all of Instagram's features: Feed, Stories, Reels, and Live. Each serves a different purpose in your content strategy.",
    icon: <Instagram className="h-5 w-5" />,
    color: "from-pink-500 to-purple-600",
    category: "social-media",
    tags: ["Engagement", "Growth"],
    content: "Instagram remains one of the most important platforms for artists, offering multiple content formats to engage fans. Use Feed posts for high-quality evergreen content, Stories for daily engagement and behind-the-scenes glimpses, Reels for short-form video content with viral potential, and Live for real-time fan interaction. Stories Highlights can organize content into categories like 'Studio Sessions' or 'Tour Life' for new followers to explore. Use a consistent aesthetic and consider creating content in batches to maintain a regular posting schedule. Instagram's algorithm favors accounts that use all of its features, so aim to incorporate each format into your strategy."
  },
  {
    id: 8,
    title: "Maximizing Merch Revenue",
    description: "Design merchandise that fans actually want to wear. Quality over quantity creates better brand ambassadors.",
    icon: <DollarSign className="h-5 w-5" />,
    color: "from-green-600 to-teal-500",
    category: "revenue",
    tags: ["Monetization", "Branding"],
    content: "Merchandise remains one of the most profitable revenue streams for artists at any level. Focus on creating high-quality items that fans will actually use and wear, rather than producing a wide variety of cheap products. Start with essentials like t-shirts, hoodies, and tote bags before expanding to more specialized items. Consider limited edition or exclusive merch for superfans. Your merchandise is walking advertisement for your brand, so invest in good design that represents your artistic identity. Set reasonable prices that balance profitability with affordability for fans. Consider bundling merch with digital music or tickets to increase average order value."
  },
  {
    id: 9,
    title: "Home Recording Studio Essentials",
    description: "You don't need expensive gear to create professional recordings. Focus on room treatment before buying equipment.",
    icon: <Mic className="h-5 w-5" />,
    color: "from-blue-600 to-cyan-500",
    category: "production",
    tags: ["Equipment", "Production"],
    content: "Building a home studio doesn't require a massive investment. Start with the essentials: a computer, audio interface, microphone, headphones, and DAW software. Room treatment has a bigger impact on recording quality than expensive gear - address acoustic issues with basic treatments like foam panels, bass traps, and diffusers. Position your setup properly, away from parallel walls if possible. For vocals, a dynamic microphone with a pop filter and reflection shield can yield professional results even in imperfect acoustic environments. Gradually upgrade your equipment as your skills improve and your needs evolve. Remember that many hit songs have been recorded with minimal equipment - technique and creativity matter more than gear."
  },
  {
    id: 10,
    title: "Twitter Growth Strategies",
    description: "Engage in music conversations and use Twitter to network with industry professionals and journalists.",
    icon: <Twitter className="h-5 w-5" />,
    color: "from-blue-400 to-blue-500",
    category: "social-media",
    tags: ["Networking", "Growth"],
    content: "Twitter remains valuable for artists as a networking tool rather than just a promotional platform. Use it to join conversations about music, connect with industry professionals, and engage with journalists and playlist curators. Create a content mix that includes industry insights, behind-the-scenes glimpses, and personal thoughts - not just promotional content. Participate in relevant hashtags and Twitter conversations about music trends or industry events. Twitter Spaces can be particularly effective for connecting directly with fans and industry figures in real-time discussions. Schedule tweets during high-engagement periods (typically 9am-3pm on weekdays) for maximum visibility."
  },
  {
    id: 11,
    title: "YouTube Channel Optimization",
    description: "Optimize video titles, descriptions and tags for search. Include timestamps for longer videos to improve engagement.",
    icon: <Youtube className="h-5 w-5" />,
    color: "from-red-500 to-red-600",
    category: "social-media",
    tags: ["SEO", "Growth"],
    content: "YouTube is both a social platform and the world's second-largest search engine, making SEO crucial. Research keywords related to your music style and include them in titles, descriptions, and tags. Create custom thumbnails with consistent branding to increase click-through rates. For longer videos, add timestamps in descriptions to help viewers navigate to specific sections. Create playlists that group similar content, which increases watch time. Encourage subscriptions and engagement explicitly in your videos. The YouTube algorithm values watch time above all metrics, so focus on creating compelling content that keeps viewers engaged throughout. Upload regularly on a consistent schedule and promote new videos across your other platforms."
  },
  {
    id: 12,
    title: "Release Strategy for Independent Artists",
    description: "Release singles consistently rather than albums to maintain regular engagement and maximize playlist opportunities.",
    icon: <TrendingUp className="h-5 w-5" />,
    color: "from-orange-500 to-red-500",
    category: "marketing",
    tags: ["Strategy", "Planning"],
    content: "In today's streaming economy, consistent single releases generally perform better than infrequent album drops for independent artists. Consider releasing a new single every 6-8 weeks to maintain algorithmic favor on streaming platforms and provide regular content for social media. Submit tracks to streaming platforms at least 3-4 weeks before release date to maximize pre-save campaigns and playlist consideration. Plan a content calendar around each release, including teasers, behind-the-scenes content, and follow-up engagement. Consider grouping 3-4 singles into an EP after their individual release cycles to create a larger body of work. Time releases strategically, avoiding major holidays and big release dates from major artists in your genre."
  },
  {
    id: 13,
    title: "DIY PR Strategy",
    description: "Build relationships with music bloggers and playlist curators before you need coverage for a release.",
    icon: <FileText className="h-5 w-5" />,
    color: "from-purple-500 to-indigo-500",
    category: "marketing",
    tags: ["PR", "Media"],
    content: "Effective PR requires relationship-building well before your release date. Start by researching blogs, podcasts, and playlist curators that feature artists at your level in your genre. Follow them on social media and engage meaningfully with their content. When reaching out, personalize each message to show you're familiar with their platform. Keep pitches concise, including a brief bio, links to your music, high-quality press photos, and a clear call to action. Follow up once after a week, but respect when outlets don't respond. Keep a spreadsheet tracking all your media contacts and communications. Consider targeting smaller outlets first to build a press kit before approaching larger publications."
  },
  {
    id: 14,
    title: "Fan Engagement Strategies",
    description: "Create opportunities for two-way interaction with fans. Respond to comments and create content that encourages participation.",
    icon: <Heart className="h-5 w-5" />,
    color: "from-pink-500 to-red-500",
    category: "marketing",
    tags: ["Engagement", "Community"],
    content: "Building an engaged fan community requires creating opportunities for genuine interaction. Respond to comments on social media posts and messages from fans whenever possible. Create content that invites participation, such as polls, questions, or challenges. Consider starting a private community space like a Discord server or membership program for superfans. Use live streaming to connect directly with fans in real-time. Show authentic appreciation for fan support by highlighting user-generated content and fan stories. Remember that cultivating a smaller, highly engaged audience is more valuable than a large but passive following. Engaged fans become advocates who promote your music to others."
  },
  {
    id: 15,
    title: "Metadata Optimization for Discoverability",
    description: "Properly format artist names, features, and producers in your music metadata. Consistency is key for platform algorithms.",
    icon: <Search className="h-5 w-5" />,
    color: "from-blue-500 to-cyan-500",
    category: "marketing",
    tags: ["SEO", "Streaming"],
    content: "Proper metadata is essential for discoverability on streaming platforms. Ensure consistent spelling and formatting of your artist name across all releases. Properly credit featured artists, producers, and songwriters in the correct metadata fields. Use genre tags strategically, considering both primary and secondary genres that might apply to your music. Include mood descriptors and instruments in your metadata when the platform allows it. For compositors and producers, ensure your performing rights organization (PRO) information is updated and accurate. Maintain a master document of all your metadata for reference and consistency. When working with a distributor, always double-check their metadata forms before final submission."
  },
  {
    id: 16,
    title: "Audience Analysis for Better Marketing",
    description: "Use platform analytics to understand your audience demographics and listening habits. Target marketing efforts accordingly.",
    icon: <TrendingUp className="h-5 w-5" />,
    color: "from-green-500 to-teal-600",
    category: "marketing",
    tags: ["Analytics", "Strategy"],
    content: "Understanding your audience is fundamental to effective marketing. Regularly review analytics across all platforms including streaming services, social media, and your website. Pay attention to demographics (age, location, gender), listening habits (time of day, devices), and engagement patterns (which content performs best). Use this data to inform decisions about release timing, tour routing, content creation, and advertising targeting. For example, if analytics show strong listenership in unexpected cities, consider targeting those areas for live performances or geo-targeted advertising. Create audience personas based on your data to help visualize who you're creating for. Most platforms offer free analytics tools, but consider using third-party services like Chartmetric for more comprehensive insights."
  },
  {
    id: 17,
    title: "Collaborative Playlist Strategy",
    description: "Create collaborative playlists with similar artists to cross-promote each other's music to new audiences.",
    icon: <Music className="h-5 w-5" />,
    color: "from-purple-500 to-violet-600",
    category: "marketing",
    tags: ["Streaming", "Collaboration"],
    content: "Collaborative playlists offer an effective way to reach new listeners. Connect with artists in your genre who have a similar audience size and create shared playlists featuring both your tracks. Promote these playlists across all participants' social channels for maximum reach. Consider themed playlists that serve a specific purpose, such as workout music, study sessions, or mood-based collections. Regularly update these playlists with new tracks to keep followers engaged. On Spotify, you can create literal collaborative playlists where multiple curators can add tracks. For other platforms, coordinate updates with your collaborators. Engage with listeners who follow these playlists by responding to comments and asking for suggestions."
  },
  {
    id: 18,
    title: "Copyright and Royalties Management",
    description: "Register your songs with performance rights organizations and publishing administrators to collect all royalties.",
    icon: <DollarSign className="h-5 w-5" />,
    color: "from-yellow-500 to-amber-600",
    category: "revenue",
    tags: ["Rights", "Royalties"],
    content: "Many independent artists leave money on the table by not properly registering their work. First, join a performing rights organization (PRO) like ASCAP, BMI, or SESAC to collect performance royalties when your music is played publicly. Consider using a publishing administrator like Songtrust or CD Baby Pro to collect mechanical royalties from streaming platforms. Register your recordings with SoundExchange to collect digital performance royalties from satellite radio and non-interactive streaming. Keep detailed records of all your song information, including co-writers, producers, and percentage splits. Understand the difference between master rights (recording) and publishing rights (composition) for your works. If collaborating, create split sheets before finalizing songs to avoid conflicts later."
  }
];

const TipDetails = ({ tip, onBack }) => {
  return (
    <div className="space-y-6">
      <button 
        onClick={onBack}
        className="text-zinc-400 hover:text-white flex items-center mb-2"
      >
        ← Back to tips
      </button>
      
      <div className="flex items-center gap-3 mb-2">
        <div className={`w-12 h-12 rounded-lg flex items-center justify-center bg-gradient-to-br ${tip.color}`}>
          {tip.icon}
        </div>
        <h2 className="text-2xl font-bold text-white">{tip.title}</h2>
      </div>
      
      <div className="flex flex-wrap gap-2 mb-6">
        {tip.tags.map((tag, i) => (
          <span key={i} className="px-3 py-1 bg-zinc-800 text-zinc-300 rounded-full text-sm">
            {tag}
          </span>
        ))}
      </div>
      
      <div className="bg-zinc-900 rounded-lg p-6 text-zinc-300 leading-relaxed">
        <p className="text-lg mb-4 text-zinc-200">{tip.description}</p>
        <p className="whitespace-pre-line">{tip.content}</p>
      </div>
      
      <div className="pt-6">
        <h3 className="text-xl font-medium text-white mb-4">Share this tip</h3>
        <div className="flex gap-3">
          <Button variant="outline" className="border-zinc-700 text-white hover:bg-zinc-800">
            <Twitter className="h-4 w-4 mr-2" /> Twitter
          </Button>
          <Button variant="outline" className="border-zinc-700 text-white hover:bg-zinc-800">
            <Facebook className="h-4 w-4 mr-2" /> Facebook
          </Button>
          <Button variant="outline" className="border-zinc-700 text-white hover:bg-zinc-800">
            <Mail className="h-4 w-4 mr-2" /> Email
          </Button>
        </div>
      </div>
    </div>
  );
};

// Facebook icon component (since it's not included in lucide-react)
const Facebook = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
  </svg>
);

// Feature card component
const TipCard = ({ tip, onClick }) => {
  return (
    <Card 
      className="bg-zinc-950 border-zinc-800 text-white h-full cursor-pointer hover:border-zinc-700 transition-colors"
      onClick={() => onClick(tip)}
    >
      <CardHeader className="pb-2">
        <div className={`w-12 h-12 rounded-lg flex items-center justify-center bg-gradient-to-br ${tip.color} mb-3`}>
          {tip.icon}
        </div>
        <CardTitle className="text-xl">{tip.title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-zinc-400">{tip.description}</p>
      </CardContent>
      <CardFooter className="pt-1">
        <div className="flex flex-wrap gap-1">
          {tip.tags.slice(0, 2).map((tag, i) => (
            <span key={i} className="px-2 py-0.5 bg-zinc-800 text-zinc-400 rounded-full text-xs">
              {tag}
            </span>
          ))}
        </div>
      </CardFooter>
    </Card>
  );
};

export default function TipsPage() {
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedTags, setSelectedTags] = useState([]);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedTip, setSelectedTip] = useState(null);
  
  // Filter tips based on selected category and tags
  const filteredTips = allTips.filter(tip => {
    const categoryMatch = selectedCategory === "all" || tip.category === selectedCategory;
    const tagsMatch = selectedTags.length === 0 || selectedTags.some(tag => tip.tags.includes(tag));
    return categoryMatch && tagsMatch;
  });
  
  const toggleTag = (tag) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter(t => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };
  
  const clearFilters = () => {
    setSelectedCategory("all");
    setSelectedTags([]);
  };
  
  if (selectedTip) {
    return (
      <Layout>
        <div className="container max-w-4xl mx-auto px-4 py-12">
          <TipDetails tip={selectedTip} onBack={() => setSelectedTip(null)} />
        </div>
      </Layout>
    );
  }
  
  return (
    <Layout>
      <div className="container max-w-7xl mx-auto px-4 py-12">
        {/* Hero section */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-extrabold text-white mb-6">Artist Quick Tips</h1>
          <p className="text-xl text-zinc-400 max-w-3xl mx-auto">
            Practical advice to help you grow your music career, one step at a time
          </p>
        </div>
        
        {/* Category filters */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
            <div className="px-3 py-2 bg-zinc-900 rounded-md">
              <div className="flex flex-wrap gap-2">
                {categories.map((category) => (
                  <button
                    key={category.id}
                    onClick={() => setSelectedCategory(category.id)}
                    className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                      selectedCategory === category.id
                        ? "bg-orange-600 text-white"
                        : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                    }`}
                  >
                    {category.label}
                  </button>
                ))}
              </div>
            </div>
            
            <Button 
              variant="outline" 
              className="border-zinc-700 text-white hover:bg-zinc-800"
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="h-4 w-4 mr-2" />
              {showFilters ? "Hide Filters" : "Show Filters"}
            </Button>
          </div>
          
          {/* Tag filters */}
          {showFilters && (
            <div className="bg-zinc-900 p-4 rounded-lg mb-4">
              <div className="flex flex-wrap gap-2 mb-4">
                {tags.map((tag, index) => (
                  <button
                    key={index}
                    onClick={() => toggleTag(tag)}
                    className={`px-3 py-1 rounded-full text-sm transition-colors ${
                      selectedTags.includes(tag)
                        ? "bg-orange-600 text-white"
                        : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                    }`}
                  >
                    <Tag className="h-3 w-3 inline mr-1" />
                    {tag}
                  </button>
                ))}
              </div>
              <div className="flex justify-between">
                <div className="text-zinc-400 text-sm">
                  {selectedTags.length > 0
                    ? `${selectedTags.length} tag${selectedTags.length > 1 ? "s" : ""} selected`
                    : "No tags selected"}
                </div>
                {(selectedCategory !== "all" || selectedTags.length > 0) && (
                  <Button 
                    variant="link" 
                    className="text-zinc-400 hover:text-white p-0 h-auto" 
                    onClick={clearFilters}
                  >
                    Clear all filters
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
        
        {/* Tips grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {filteredTips.map((tip) => (
            <TipCard key={tip.id} tip={tip} onClick={setSelectedTip} />
          ))}
        </div>
        
        {filteredTips.length === 0 && (
          <div className="text-center py-12">
            <h3 className="text-xl font-medium text-white mb-2">No tips match your filters</h3>
            <p className="text-zinc-400 mb-6">Try adjusting your category or tag selections</p>
            <Button onClick={clearFilters}>Clear all filters</Button>
          </div>
        )}
        
        {/* CTA section */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-xl p-8 text-center mt-16">
          <h2 className="text-3xl font-bold text-white mb-4">Need Personalized Guidance?</h2>
          <p className="text-white/90 max-w-2xl mx-auto mb-6">
            Get customized advice for your specific situation from our AI music industry advisors.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link href="/ai-advisors" className="inline-block">
              <div className="flex items-center justify-center h-10 px-4 py-2 bg-white text-indigo-700 font-medium rounded-md hover:bg-white/90 transition-colors">
                Talk to an Advisor <ArrowRight className="ml-2 h-4 w-4" />
              </div>
            </Link>
            <Link href="/resources" className="inline-block">
              <div className="flex items-center justify-center h-10 px-4 py-2 border border-white text-white rounded-md hover:bg-white/10 transition-colors">
                Explore More Resources
              </div>
            </Link>
          </div>
        </div>
      </div>
    </Layout>
  );
}