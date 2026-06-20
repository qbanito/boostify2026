import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Card } from "../components/ui/card";
import { useState } from "react";
import { useAuth } from "../hooks/use-auth";
import { useToast } from "../hooks/use-toast";
import { 
  Loader2, Play, TrendingUp, Home, Key, Video, MessageSquare, 
  Eye, Database, Brain, FileText, Sparkles, CheckCircle, 
  AlertTriangle, Copy, X, Star, Lightbulb, Target, Award
} from "lucide-react";
import { motion } from "framer-motion";
import { Link } from "wouter";
import { SiYoutube } from "react-icons/si";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Textarea } from "../components/ui/textarea";
import { Users2 } from "lucide-react";
import { Header } from "../components/layout/header";
import { getAuthToken } from "../lib/firebase";
import { Progress } from "../components/ui/progress";
import { Badge } from "../components/ui/badge";

// Types
interface PreLaunchResult {
  score: number;
  prediction: string;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  estimatedViews: {
    '7days': number;
    '30days': number;
  };
  remaining: number;
}

interface Keyword {
  keyword: string;
  difficulty: 'easy' | 'medium' | 'hard';
  relevance: number;
  estimatedSearches: number;
  competition: 'low' | 'medium' | 'high';
}

interface TitleAnalysis {
  score: number;
  ctrScore: number;
  seoScore: number;
  emotionalScore: number;
  strengths: string[];
  issues: string[];
  suggestions: string[];
  improvedTitles: string[];
  remaining: number;
}

interface VideoIdea {
  title: string;
  description: string;
  targetAudience: string;
  difficulty: 'easy' | 'medium' | 'hard';
  estimatedViews: number;
  keywords: string[];
  hook: string;
}

export default function YoutubeViewsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("pre-launch");
  
  // Pre-Launch Score states
  const [preLaunchTitle, setPreLaunchTitle] = useState("");
  const [preLaunchDescription, setPreLaunchDescription] = useState("");
  const [preLaunchNiche, setPreLaunchNiche] = useState("");
  const [preLaunchKeywords, setPreLaunchKeywords] = useState("");
  const [preLaunchLoading, setPreLaunchLoading] = useState(false);
  const [preLaunchResult, setPreLaunchResult] = useState<PreLaunchResult | null>(null);
  
  // Keywords Generator states
  const [keywordTopic, setKeywordTopic] = useState("");
  const [keywordNiche, setKeywordNiche] = useState("");
  const [keywordsLoading, setKeywordsLoading] = useState(false);
  const [generatedKeywords, setGeneratedKeywords] = useState<Keyword[]>([]);
  const [trendingTags, setTrendingTags] = useState<string[]>([]);
  
  // Title Analyzer states
  const [titleToAnalyze, setTitleToAnalyze] = useState("");
  const [titleNiche, setTitleNiche] = useState("");
  const [titleLoading, setTitleLoading] = useState(false);
  const [titleResult, setTitleResult] = useState<TitleAnalysis | null>(null);
  
  // Content Ideas states
  const [contentNiche, setContentNiche] = useState("");
  const [contentIdeasCount, setContentIdeasCount] = useState(5);
  const [contentLoading, setContentLoading] = useState(false);
  const [videoIdeas, setVideoIdeas] = useState<VideoIdea[]>([]);
  const [contentGaps, setContentGaps] = useState<string[]>([]);
  const [trendingSubtopics, setTrendingSubtopics] = useState<string[]>([]);

  // 1. PRE-LAUNCH SCORE
  const handlePreLaunchScore = async () => {
    if (!preLaunchTitle || !preLaunchNiche) {
      toast({
        title: "Missing Information",
        description: "Please provide both title and niche",
        variant: "destructive"
      });
      return;
    }

    setPreLaunchLoading(true);
    setPreLaunchResult(null);

    try {
      const token = await getAuthToken();
      const response = await fetch('/api/youtube/pre-launch-score', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          title: preLaunchTitle,
          description: preLaunchDescription,
          keywords: preLaunchKeywords,
          niche: preLaunchNiche
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to analyze video');
      }

      setPreLaunchResult(data);
      toast({
        title: "Analysis Complete!",
        description: `Your video scored ${data.score}/100`,
      });
    } catch (error: any) {
      console.error('Pre-launch error:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to analyze video concept",
        variant: "destructive"
      });
    } finally {
      setPreLaunchLoading(false);
    }
  };

  // 2. KEYWORDS GENERATOR
  const handleGenerateKeywords = async () => {
    if (!keywordTopic) {
      toast({
        title: "Missing Information",
        description: "Please provide a topic",
        variant: "destructive"
      });
      return;
    }

    setKeywordsLoading(true);
    setGeneratedKeywords([]);

    try {
      const token = await getAuthToken();
      const response = await fetch('/api/youtube/generate-keywords', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          topic: keywordTopic,
          niche: keywordNiche
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate keywords');
      }

      setGeneratedKeywords(data.keywords);
      setTrendingTags(data.trendingTags);
      toast({
        title: "Keywords Generated!",
        description: `Found ${data.keywords.length} optimized keywords`,
      });
    } catch (error: any) {
      console.error('Keywords error:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to generate keywords",
        variant: "destructive"
      });
    } finally {
      setKeywordsLoading(false);
    }
  };

  // 3. TITLE ANALYZER
  const handleAnalyzeTitle = async () => {
    if (!titleToAnalyze) {
      toast({
        title: "Missing Information",
        description: "Please provide a title to analyze",
        variant: "destructive"
      });
      return;
    }

    setTitleLoading(true);
    setTitleResult(null);

    try {
      const token = await getAuthToken();
      const response = await fetch('/api/youtube/analyze-title', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          title: titleToAnalyze,
          niche: titleNiche
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to analyze title');
      }

      setTitleResult(data);
      toast({
        title: "Title Analyzed!",
        description: `Your title scored ${data.score}/100`,
      });
    } catch (error: any) {
      console.error('Title analysis error:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to analyze title",
        variant: "destructive"
      });
    } finally {
      setTitleLoading(false);
    }
  };

  // 4. CONTENT IDEAS GENERATOR
  const handleGenerateContentIdeas = async () => {
    if (!contentNiche) {
      toast({
        title: "Missing Information",
        description: "Please provide a niche",
        variant: "destructive"
      });
      return;
    }

    setContentLoading(true);
    setVideoIdeas([]);

    try {
      const token = await getAuthToken();
      const response = await fetch('/api/youtube/content-ideas', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          niche: contentNiche,
          count: contentIdeasCount
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate ideas');
      }

      setVideoIdeas(data.videoIdeas);
      setContentGaps(data.contentGaps);
      setTrendingSubtopics(data.trendingSubtopics);
      toast({
        title: "Ideas Generated!",
        description: `Found ${data.videoIdeas.length} video ideas`,
      });
    } catch (error: any) {
      console.error('Content ideas error:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to generate content ideas",
        variant: "destructive"
      });
    } finally {
      setContentLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: "Text copied to clipboard",
    });
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return 'text-green-500 bg-green-500/10';
      case 'medium': return 'text-yellow-500 bg-yellow-500/10';
      case 'hard': return 'text-red-500 bg-red-500/10';
      default: return 'text-gray-500 bg-gray-500/10';
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-500';
    if (score >= 60) return 'text-yellow-500';
    return 'text-red-500';
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1 space-y-8 p-4 md:p-8 pt-6">
        <div className="relative w-full h-[70vh] md:h-[90vh] overflow-hidden rounded-xl mb-12">
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{
              backgroundImage: "url('/assets/VzOu774PPeGzuzXmcP83y_5cd275d118e340239a4d0b6400689592.jpg')"
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/80 to-black/40" />
          <div className="relative h-full flex items-center justify-start px-4 md:px-12 pt-16 md:pt-0">
            <div className="max-w-2xl">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
              >
                <h1 className="text-3xl md:text-6xl font-bold text-white mb-4">
                  Master YouTube with{" "}
                  <span className="bg-gradient-to-r from-orange-500 to-orange-400 bg-clip-text text-transparent">
                    AI-Powered Tools
                  </span>
                </h1>
                <p className="text-base md:text-xl text-gray-200 mb-8">
                  Analyze, optimize, and grow your channel with cutting-edge AI technology powered by Gemini
                </p>
                <div className="flex flex-col sm:flex-row gap-4">
                  <Button
                    size="lg"
                    className="bg-orange-500 hover:bg-orange-600 text-white w-full sm:w-auto"
                    onClick={() => document.getElementById('tools')?.scrollIntoView({ behavior: 'smooth' })}
                  >
                    <Sparkles className="w-5 h-5 mr-2" />
                    Start Analyzing
                  </Button>
                  <Link href="/dashboard">
                    <Button
                      size="lg"
                      variant="outline"
                      className="bg-black/50 hover:bg-black/60 border-white/20 text-white w-full sm:w-auto"
                    >
                      <Home className="w-5 h-5 mr-2" />
                      Dashboard
                    </Button>
                  </Link>
                </div>
                <div className="mt-8 flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-8">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-orange-500/20 flex items-center justify-center">
                      <Brain className="w-6 h-6 text-orange-500" />
                    </div>
                    <div>
                      <p className="text-white font-semibold">Gemini AI</p>
                      <p className="text-gray-400 text-sm">Powered Analysis</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-orange-500/20 flex items-center justify-center">
                      <Users2 className="w-6 h-6 text-orange-500" />
                    </div>
                    <div>
                      <p className="text-white font-semibold">Real Data</p>
                      <p className="text-gray-400 text-sm">From YouTube</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </div>

        <motion.div
          id="tools"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col md:flex-row md:items-center justify-between gap-4"
        >
          <div className="flex items-center gap-4">
            <SiYoutube className="w-12 h-12 text-orange-500" />
            <div>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight bg-gradient-to-r from-orange-500 to-orange-500/70 bg-clip-text text-transparent">
                YouTube Growth Tools
              </h2>
              <p className="text-muted-foreground mt-2">
                Powered by Gemini AI + Apify scraping
              </p>
            </div>
          </div>
        </motion.div>

        <div className="container mx-auto">
          <Tabs defaultValue={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <TabsTrigger value="pre-launch" data-testid="tab-pre-launch" className="data-[state=active]:bg-orange-500">
                <Target className="w-4 h-4 mr-2" />
                Pre-Launch Score
              </TabsTrigger>
              <TabsTrigger value="keywords" data-testid="tab-keywords" className="data-[state=active]:bg-orange-500">
                <Key className="w-4 h-4 mr-2" />
                Keywords
              </TabsTrigger>
              <TabsTrigger value="title" data-testid="tab-title" className="data-[state=active]:bg-orange-500">
                <FileText className="w-4 h-4 mr-2" />
                Title Analyzer
              </TabsTrigger>
              <TabsTrigger value="content" data-testid="tab-content" className="data-[state=active]:bg-orange-500">
                <Lightbulb className="w-4 h-4 mr-2" />
                Content Ideas
              </TabsTrigger>
            </TabsList>

            {/* PRE-LAUNCH SCORE TAB */}
            <TabsContent value="pre-launch">
              <Card className="p-6">
                <div className="flex items-center gap-4 mb-6">
                  <div className="p-4 bg-orange-500/10 rounded-lg">
                    <Target className="h-8 w-8 text-orange-500" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-semibold">Pre-Launch Success Predictor</h3>
                    <p className="text-muted-foreground">
                      Analyze your video concept before publishing - powered by Gemini AI
                    </p>
                  </div>
                </div>

                <div className="space-y-4 mb-6">
                  <div>
                    <label className="block text-sm font-medium mb-2">Video Title *</label>
                    <Input
                      data-testid="input-pre-launch-title"
                      placeholder="Enter your video title..."
                      value={preLaunchTitle}
                      onChange={(e) => setPreLaunchTitle(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Niche/Category *</label>
                    <Input
                      data-testid="input-pre-launch-niche"
                      placeholder="e.g., Gaming, Tech Reviews, Cooking..."
                      value={preLaunchNiche}
                      onChange={(e) => setPreLaunchNiche(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Description (Optional)</label>
                    <Textarea
                      data-testid="input-pre-launch-description"
                      placeholder="Brief description of your video..."
                      value={preLaunchDescription}
                      onChange={(e) => setPreLaunchDescription(e.target.value)}
                      rows={3}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Keywords (Optional)</label>
                    <Input
                      data-testid="input-pre-launch-keywords"
                      placeholder="keyword1, keyword2, keyword3..."
                      value={preLaunchKeywords}
                      onChange={(e) => setPreLaunchKeywords(e.target.value)}
                    />
                  </div>
                  <Button
                    data-testid="button-analyze-pre-launch"
                    onClick={handlePreLaunchScore}
                    disabled={preLaunchLoading || !preLaunchTitle || !preLaunchNiche}
                    className="w-full bg-orange-500 hover:bg-orange-600"
                  >
                    {preLaunchLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Analyzing with Gemini AI...
                      </>
                    ) : (
                      <>
                        <Sparkles className="mr-2 h-4 w-4" />
                        Analyze Video Concept
                      </>
                    )}
                  </Button>
                </div>

                {preLaunchResult && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-6 mt-6 p-6 border rounded-lg bg-card"
                  >
                    <div className="text-center">
                      <h4 className="text-lg font-semibold mb-2">Success Score</h4>
                      <div className={`text-6xl font-bold ${getScoreColor(preLaunchResult.score)}`}>
                        {preLaunchResult.score}/100
                      </div>
                      <p className="text-muted-foreground mt-2">{preLaunchResult.prediction}</p>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <h5 className="font-semibold mb-2 flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-green-500" />
                          Strengths
                        </h5>
                        <ul className="space-y-1">
                          {preLaunchResult.strengths.map((strength, idx) => (
                            <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                              <span className="text-green-500 mt-0.5">•</span>
                              {strength}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <h5 className="font-semibold mb-2 flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-yellow-500" />
                          Weaknesses
                        </h5>
                        <ul className="space-y-1">
                          {preLaunchResult.weaknesses.map((weakness, idx) => (
                            <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                              <span className="text-yellow-500 mt-0.5">•</span>
                              {weakness}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    <div>
                      <h5 className="font-semibold mb-2">Recommendations</h5>
                      <div className="space-y-2">
                        {preLaunchResult.recommendations.map((rec, idx) => (
                          <div key={idx} className="p-3 bg-orange-500/5 rounded-lg text-sm">
                            <span className="text-orange-500 font-semibold mr-2">{idx + 1}.</span>
                            {rec}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4 pt-4 border-t">
                      <div className="text-center p-4 bg-muted rounded-lg">
                        <p className="text-sm text-muted-foreground mb-1">Estimated Views (7 days)</p>
                        <p className="text-2xl font-bold text-orange-500">
                          {preLaunchResult.estimatedViews['7days'].toLocaleString()}
                        </p>
                      </div>
                      <div className="text-center p-4 bg-muted rounded-lg">
                        <p className="text-sm text-muted-foreground mb-1">Estimated Views (30 days)</p>
                        <p className="text-2xl font-bold text-orange-500">
                          {preLaunchResult.estimatedViews['30days'].toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                )}
              </Card>
            </TabsContent>

            {/* KEYWORDS GENERATOR TAB */}
            <TabsContent value="keywords">
              <Card className="p-6">
                <div className="flex items-center gap-4 mb-6">
                  <div className="p-4 bg-orange-500/10 rounded-lg">
                    <Key className="h-8 w-8 text-orange-500" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-semibold">AI Keywords Generator</h3>
                    <p className="text-muted-foreground">
                      Discover optimized keywords based on trending YouTube data
                    </p>
                  </div>
                </div>

                <div className="space-y-4 mb-6">
                  <div>
                    <label className="block text-sm font-medium mb-2">Topic *</label>
                    <Input
                      data-testid="input-keyword-topic"
                      placeholder="What is your video about?"
                      value={keywordTopic}
                      onChange={(e) => setKeywordTopic(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Niche (Optional)</label>
                    <Input
                      data-testid="input-keyword-niche"
                      placeholder="e.g., Tech, Gaming, Lifestyle..."
                      value={keywordNiche}
                      onChange={(e) => setKeywordNiche(e.target.value)}
                    />
                  </div>
                  <Button
                    data-testid="button-generate-keywords"
                    onClick={handleGenerateKeywords}
                    disabled={keywordsLoading || !keywordTopic}
                    className="w-full bg-orange-500 hover:bg-orange-600"
                  >
                    {keywordsLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Generating Keywords with AI...
                      </>
                    ) : (
                      <>
                        <Sparkles className="mr-2 h-4 w-4" />
                        Generate Keywords
                      </>
                    )}
                  </Button>
                </div>

                {generatedKeywords.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-6"
                  >
                    <div>
                      <h4 className="font-semibold mb-4">Optimized Keywords ({generatedKeywords.length})</h4>
                      <div className="space-y-2">
                        {generatedKeywords.map((kw, idx) => (
                          <div key={idx} className="p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-3 mb-2">
                                  <span className="font-medium">{kw.keyword}</span>
                                  <Badge className={getDifficultyColor(kw.difficulty)}>
                                    {kw.difficulty}
                                  </Badge>
                                  <Badge variant="outline">{kw.competition} competition</Badge>
                                </div>
                                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                  <span>Relevance: {kw.relevance}/10</span>
                                  <span>~{kw.estimatedSearches.toLocaleString()} searches/month</span>
                                </div>
                              </div>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => copyToClipboard(kw.keyword)}
                                data-testid={`button-copy-keyword-${idx}`}
                              >
                                <Copy className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {trendingTags.length > 0 && (
                      <div>
                        <h4 className="font-semibold mb-4">Trending Tags in Niche</h4>
                        <div className="flex flex-wrap gap-2">
                          {trendingTags.map((tag, idx) => (
                            <Badge
                              key={idx}
                              variant="secondary"
                              className="cursor-pointer hover:bg-orange-500/20"
                              onClick={() => copyToClipboard(tag)}
                            >
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}
              </Card>
            </TabsContent>

            {/* TITLE ANALYZER TAB */}
            <TabsContent value="title">
              <Card className="p-6">
                <div className="flex items-center gap-4 mb-6">
                  <div className="p-4 bg-orange-500/10 rounded-lg">
                    <FileText className="h-8 w-8 text-orange-500" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-semibold">Title Analyzer</h3>
                    <p className="text-muted-foreground">
                      Optimize your video title for maximum clicks and SEO
                    </p>
                  </div>
                </div>

                <div className="space-y-4 mb-6">
                  <div>
                    <label className="block text-sm font-medium mb-2">Video Title *</label>
                    <Input
                      data-testid="input-title-analyze"
                      placeholder="Enter your video title..."
                      value={titleToAnalyze}
                      onChange={(e) => setTitleToAnalyze(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      {titleToAnalyze.length} characters (ideal: 50-70)
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Niche (Optional)</label>
                    <Input
                      data-testid="input-title-niche"
                      placeholder="e.g., Gaming, Tech, Cooking..."
                      value={titleNiche}
                      onChange={(e) => setTitleNiche(e.target.value)}
                    />
                  </div>
                  <Button
                    data-testid="button-analyze-title"
                    onClick={handleAnalyzeTitle}
                    disabled={titleLoading || !titleToAnalyze}
                    className="w-full bg-orange-500 hover:bg-orange-600"
                  >
                    {titleLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Analyzing Title...
                      </>
                    ) : (
                      <>
                        <Sparkles className="mr-2 h-4 w-4" />
                        Analyze Title
                      </>
                    )}
                  </Button>
                </div>

                {titleResult && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-6"
                  >
                    <div className="grid md:grid-cols-4 gap-4">
                      <div className="text-center p-4 border rounded-lg">
                        <p className="text-sm text-muted-foreground mb-1">Overall Score</p>
                        <p className={`text-3xl font-bold ${getScoreColor(titleResult.score)}`}>
                          {titleResult.score}
                        </p>
                      </div>
                      <div className="text-center p-4 border rounded-lg">
                        <p className="text-sm text-muted-foreground mb-1">CTR Score</p>
                        <p className={`text-3xl font-bold ${getScoreColor(titleResult.ctrScore)}`}>
                          {titleResult.ctrScore}
                        </p>
                      </div>
                      <div className="text-center p-4 border rounded-lg">
                        <p className="text-sm text-muted-foreground mb-1">SEO Score</p>
                        <p className={`text-3xl font-bold ${getScoreColor(titleResult.seoScore)}`}>
                          {titleResult.seoScore}
                        </p>
                      </div>
                      <div className="text-center p-4 border rounded-lg">
                        <p className="text-sm text-muted-foreground mb-1">Emotional</p>
                        <p className={`text-3xl font-bold ${getScoreColor(titleResult.emotionalScore)}`}>
                          {titleResult.emotionalScore}
                        </p>
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <h5 className="font-semibold mb-2 text-green-500">What Works</h5>
                        <ul className="space-y-1">
                          {titleResult.strengths.map((str, idx) => (
                            <li key={idx} className="text-sm flex items-start gap-2">
                              <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                              {str}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <h5 className="font-semibold mb-2 text-yellow-500">Needs Improvement</h5>
                        <ul className="space-y-1">
                          {titleResult.issues.map((issue, idx) => (
                            <li key={idx} className="text-sm flex items-start gap-2">
                              <AlertTriangle className="w-4 h-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                              {issue}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    <div>
                      <h5 className="font-semibold mb-2">Suggestions</h5>
                      <div className="space-y-2">
                        {titleResult.suggestions.map((sug, idx) => (
                          <div key={idx} className="p-3 bg-muted rounded-lg text-sm">
                            {sug}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h5 className="font-semibold mb-2">Alternative Titles</h5>
                      <div className="space-y-2">
                        {titleResult.improvedTitles.map((title, idx) => (
                          <div key={idx} className="p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                            <div className="flex items-center justify-between">
                              <span className="flex-1">{title}</span>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => copyToClipboard(title)}
                                data-testid={`button-copy-title-${idx}`}
                              >
                                <Copy className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
              </Card>
            </TabsContent>

            {/* CONTENT IDEAS TAB */}
            <TabsContent value="content">
              <Card className="p-6">
                <div className="flex items-center gap-4 mb-6">
                  <div className="p-4 bg-orange-500/10 rounded-lg">
                    <Lightbulb className="h-8 w-8 text-orange-500" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-semibold">Content Ideas Generator</h3>
                    <p className="text-muted-foreground">
                      Discover untapped video opportunities in your niche
                    </p>
                  </div>
                </div>

                <div className="space-y-4 mb-6">
                  <div>
                    <label className="block text-sm font-medium mb-2">Niche *</label>
                    <Input
                      data-testid="input-content-niche"
                      placeholder="e.g., Tech Tutorials, Cooking, Fitness..."
                      value={contentNiche}
                      onChange={(e) => setContentNiche(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Number of Ideas</label>
                    <Input
                      type="number"
                      min="1"
                      max="10"
                      value={contentIdeasCount}
                      onChange={(e) => setContentIdeasCount(parseInt(e.target.value) || 5)}
                    />
                  </div>
                  <Button
                    data-testid="button-generate-content-ideas"
                    onClick={handleGenerateContentIdeas}
                    disabled={contentLoading || !contentNiche}
                    className="w-full bg-orange-500 hover:bg-orange-600"
                  >
                    {contentLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Analyzing Content Gaps...
                      </>
                    ) : (
                      <>
                        <Sparkles className="mr-2 h-4 w-4" />
                        Generate Video Ideas
                      </>
                    )}
                  </Button>
                </div>

                {videoIdeas.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-6"
                  >
                    {contentGaps.length > 0 && (
                      <div className="p-4 bg-orange-500/5 border border-orange-500/20 rounded-lg">
                        <h5 className="font-semibold mb-2 text-orange-500">Content Gaps Discovered</h5>
                        <div className="space-y-1">
                          {contentGaps.map((gap, idx) => (
                            <p key={idx} className="text-sm">• {gap}</p>
                          ))}
                        </div>
                      </div>
                    )}

                    {trendingSubtopics.length > 0 && (
                      <div>
                        <h5 className="font-semibold mb-2">Trending Subtopics</h5>
                        <div className="flex flex-wrap gap-2">
                          {trendingSubtopics.map((topic, idx) => (
                            <Badge key={idx} variant="secondary">
                              {topic}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    <div>
                      <h5 className="font-semibold mb-4">Video Ideas ({videoIdeas.length})</h5>
                      <div className="space-y-4">
                        {videoIdeas.map((idea, idx) => (
                          <div key={idx} className="p-6 border rounded-lg hover:bg-muted/50 transition-colors">
                            <div className="flex items-start justify-between mb-3">
                              <h6 className="font-semibold text-lg flex-1">{idea.title}</h6>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => copyToClipboard(idea.title)}
                                data-testid={`button-copy-idea-${idx}`}
                              >
                                <Copy className="w-4 h-4" />
                              </Button>
                            </div>
                            <p className="text-sm text-muted-foreground mb-4">{idea.description}</p>
                            <div className="flex flex-wrap gap-2 mb-3">
                              <Badge className={getDifficultyColor(idea.difficulty)}>
                                {idea.difficulty}
                              </Badge>
                              <Badge variant="outline">
                                <TrendingUp className="w-3 h-3 mr-1" />
                                ~{idea.estimatedViews.toLocaleString()} views
                              </Badge>
                            </div>
                            <div className="text-sm">
                              <p className="text-muted-foreground mb-1">
                                <span className="font-medium">Target Audience:</span> {idea.targetAudience}
                              </p>
                              <p className="text-muted-foreground mb-2">
                                <span className="font-medium">Opening Hook:</span> "{idea.hook}"
                              </p>
                              <p className="font-medium mb-1">Keywords:</p>
                              <div className="flex flex-wrap gap-1">
                                {idea.keywords.map((kw, kidx) => (
                                  <Badge key={kidx} variant="secondary" className="text-xs">
                                    {kw}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}
