import { useState } from "react";
import { Card } from "../ui/card";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { TabAiAssistant } from "./tab-ai-assistant";
import { useToast } from "../../hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import {
  Sparkles, Hash, Lightbulb, Clock, User, Copy, Check
} from "lucide-react";

interface AiToolsTabProps {
  artistId?: number;
  selectedArtist?: any;
  getInstagramData?: () => any;
}

export function AiToolsTab({ artistId, selectedArtist, getInstagramData }: AiToolsTabProps) {
  const { toast } = useToast();
  const [aiToolTab, setAiToolTab] = useState("captions");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Auto-fill from artist profile
  const artistGenre = selectedArtist?.genre || selectedArtist?.genres?.[0] || '';
  const artistName = selectedArtist?.artistName || selectedArtist?.firstName || '';

  // Caption states
  const [postTopic, setPostTopic] = useState("");
  const [tone, setTone] = useState("professional");
  const [targetAudience, setTargetAudience] = useState(() => artistGenre ? `${artistGenre} music fans` : "");
  const [includeEmojis, setIncludeEmojis] = useState(true);
  const [includeHashtags, setIncludeHashtags] = useState(true);
  const [captionResults, setCaptionResults] = useState<any>(null);

  // Hashtag states — auto-fill with artist genre
  const [hashtagNiche, setHashtagNiche] = useState(() => artistGenre || "");
  const [contentType, setContentType] = useState("");
  const [targetSize, setTargetSize] = useState("mixed");
  const [hashtagResults, setHashtagResults] = useState<any>(null);

  // Ideas states — auto-fill with artist genre
  const [ideasNiche, setIdeasNiche] = useState(() => artistGenre || "");
  const [goals, setGoals] = useState("");
  const [postingFrequency, setPostingFrequency] = useState("");
  const [contentIdeas, setContentIdeas] = useState<any>(null);

  // Timing states — auto-fill
  const [timeNiche, setTimeNiche] = useState(() => artistGenre || "");
  const [timeAudience, setTimeAudience] = useState(() => artistGenre ? `${artistGenre} music listeners` : "");
  const [timezone, setTimezone] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
  const [timeAnalysis, setTimeAnalysis] = useState<any>(null);

  // Bio states — auto-fill
  const [currentBio, setCurrentBio] = useState(() => selectedArtist?.biography || "");
  const [bioNiche, setBioNiche] = useState(() => artistGenre || "");
  const [bioGoals, setBioGoals] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState(() => selectedArtist?.website || "");
  const [bioResults, setBioResults] = useState<any>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    toast({ title: "Copied!" });
  };

  const makeMutation = (url: string, onSuccess: (data: any) => void) =>
    useMutation({
      mutationFn: async (data: any) => {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error((await res.json()).error || "Failed");
        return res.json();
      },
      onSuccess,
      onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
    });

  const captionMutation = makeMutation("/api/instagram/caption-generator", (d) => {
    setCaptionResults(d);
    toast({ title: "✅ Captions Generated", description: `${d.captions?.length || 0} options created` });
  });
  const hashtagMutation = makeMutation("/api/instagram/hashtag-generator", (d) => {
    setHashtagResults(d);
    toast({ title: "✅ Hashtags Generated" });
  });
  const ideasMutation = makeMutation("/api/instagram/content-ideas", (d) => {
    setContentIdeas(d);
    toast({ title: "✅ Ideas Generated", description: `${d.ideas?.length || 0} ideas` });
  });
  const timeMutation = makeMutation("/api/instagram/best-time-analyzer", (d) => {
    setTimeAnalysis(d);
    toast({ title: "✅ Analysis Complete" });
  });
  const bioMutation = makeMutation("/api/instagram/bio-optimizer", (d) => {
    setBioResults(d);
    toast({ title: "✅ Bio Optimized" });
  });

  return (
    <div className="space-y-5">
      <TabAiAssistant
        tabName="AI Tools"
        description="Ask AI to generate any content for your Instagram"
        artistId={artistId}
        context={`Sub-tool: ${aiToolTab}`}
        actions={[
          { label: "Generate Captions", action: "generate_captions", params: { tone: "engaging" }, icon: <Sparkles className="w-3.5 h-3.5" /> },
          { label: "30 Hashtags", action: "generate_hashtags", icon: <Hash className="w-3.5 h-3.5" /> },
          { label: "Week Content Plan", action: "generate_content_ideas", params: { goals: "grow engagement" }, icon: <Lightbulb className="w-3.5 h-3.5" /> },
          { label: "Optimize Bio", action: "optimize_bio", icon: <User className="w-3.5 h-3.5" /> },
          { label: "Best Post Times", action: "analyze_best_times", icon: <Clock className="w-3.5 h-3.5" /> },
        ]}
      />

      <Tabs value={aiToolTab} onValueChange={setAiToolTab} className="space-y-4">
        <TabsList className="grid grid-cols-5 w-full max-w-3xl mx-auto">
          <TabsTrigger value="captions" className="gap-1.5 text-xs sm:text-sm">
            <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">Captions</span>
          </TabsTrigger>
          <TabsTrigger value="hashtags" className="gap-1.5 text-xs sm:text-sm">
            <Hash className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">Hashtags</span>
          </TabsTrigger>
          <TabsTrigger value="ideas" className="gap-1.5 text-xs sm:text-sm">
            <Lightbulb className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">Ideas</span>
          </TabsTrigger>
          <TabsTrigger value="timing" className="gap-1.5 text-xs sm:text-sm">
            <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">Timing</span>
          </TabsTrigger>
          <TabsTrigger value="bio" className="gap-1.5 text-xs sm:text-sm">
            <User className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">Bio</span>
          </TabsTrigger>
        </TabsList>

        {/* Caption Generator */}
        <TabsContent value="captions" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="p-5">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-pink-500" />
                Generate Captions
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium mb-1 block">Post Topic <span className="text-red-500">*</span></label>
                  <Input placeholder="e.g., New single release, Behind the scenes" value={postTopic} onChange={(e) => setPostTopic(e.target.value)} />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Tone</label>
                  <select className="w-full p-2 rounded-lg border bg-background text-sm" value={tone} onChange={(e) => setTone(e.target.value)}>
                    <option value="professional">Professional</option>
                    <option value="casual">Casual</option>
                    <option value="funny">Funny</option>
                    <option value="inspirational">Inspirational</option>
                    <option value="educational">Educational</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Target Audience</label>
                  <Input placeholder="e.g., Gen Z, Music lovers" value={targetAudience} onChange={(e) => setTargetAudience(e.target.value)} />
                </div>
                <div className="flex gap-4 text-sm">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={includeEmojis} onChange={(e) => setIncludeEmojis(e.target.checked)} className="rounded" />
                    Include Emojis
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={includeHashtags} onChange={(e) => setIncludeHashtags(e.target.checked)} className="rounded" />
                    Include Hashtags
                  </label>
                </div>
                <Button
                  className="w-full bg-gradient-to-r from-pink-500 to-purple-500 hover:opacity-90 text-white"
                  onClick={() => captionMutation.mutate({ postTopic, tone, targetAudience, includeEmojis, includeHashtags })}
                  disabled={!postTopic || captionMutation.isPending}
                >
                  {captionMutation.isPending ? "Generating..." : "Generate Captions"}
                </Button>
              </div>
            </Card>

            {captionResults && (
              <Card className="p-5 max-h-[500px] overflow-y-auto">
                <h3 className="text-base font-semibold mb-3">Results ({captionResults.captions?.length || 0})</h3>
                <div className="space-y-3">
                  {captionResults.captions?.map((c: any, i: number) => (
                    <div key={i} className="p-3 bg-pink-500/5 rounded-lg border relative group">
                      <p className="text-sm pr-8">{c.text}</p>
                      {c.hashtags?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {c.hashtags.map((t: string, j: number) => (
                            <Badge key={j} variant="secondary" className="text-[10px]">#{t}</Badge>
                          ))}
                        </div>
                      )}
                      <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                        <span>{c.characterCount} chars</span>
                        <Badge variant="outline" className="text-[10px]">{c.engagementScore}/100</Badge>
                      </div>
                      <Button size="sm" variant="ghost" className="absolute top-2 right-2 h-7 w-7 p-0 opacity-0 group-hover:opacity-100" onClick={() => copyToClipboard(c.text + (c.hashtags ? "\n\n" + c.hashtags.map((t: string) => "#" + t).join(" ") : ""), `c-${i}`)}>
                        {copiedId === `c-${i}` ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      </Button>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Hashtag Generator */}
        <TabsContent value="hashtags" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="p-5">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Hash className="w-5 h-5 text-purple-500" />
                Generate Hashtags
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium mb-1 block">Niche <span className="text-red-500">*</span></label>
                  <Input placeholder="e.g., Music, Hip-Hop, EDM" value={hashtagNiche} onChange={(e) => setHashtagNiche(e.target.value)} />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Content Type</label>
                  <Input placeholder="e.g., Reel, Photo, Story" value={contentType} onChange={(e) => setContentType(e.target.value)} />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Competition Level</label>
                  <select className="w-full p-2 rounded-lg border bg-background text-sm" value={targetSize} onChange={(e) => setTargetSize(e.target.value)}>
                    <option value="mixed">Mixed Sizes</option>
                    <option value="high">High Competition</option>
                    <option value="medium">Medium Competition</option>
                    <option value="low">Low Competition</option>
                  </select>
                </div>
                <Button
                  className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:opacity-90 text-white"
                  onClick={() => hashtagMutation.mutate({ niche: hashtagNiche, contentType, targetSize })}
                  disabled={!hashtagNiche || hashtagMutation.isPending}
                >
                  {hashtagMutation.isPending ? "Generating..." : "Generate Hashtags"}
                </Button>
              </div>
            </Card>

            {hashtagResults && (
              <Card className="p-5 max-h-[500px] overflow-y-auto">
                <h3 className="text-base font-semibold mb-3">Hashtag Sets</h3>
                <div className="space-y-3">
                  {hashtagResults.hashtags?.highCompetition && (
                    <div className="p-3 bg-red-500/5 rounded-lg border">
                      <p className="font-medium text-sm mb-2">🔥 High Competition (1M+)</p>
                      <div className="flex flex-wrap gap-1">
                        {hashtagResults.hashtags.highCompetition.map((t: string, i: number) => (
                          <Badge key={i} variant="destructive" className="text-[10px] cursor-pointer" onClick={() => copyToClipboard(`#${t}`, `h-${i}`)}>#{t}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {hashtagResults.hashtags?.mediumCompetition && (
                    <div className="p-3 bg-yellow-500/5 rounded-lg border">
                      <p className="font-medium text-sm mb-2">⚡ Medium (100K-1M)</p>
                      <div className="flex flex-wrap gap-1">
                        {hashtagResults.hashtags.mediumCompetition.map((t: string, i: number) => (
                          <Badge key={i} variant="secondary" className="text-[10px] cursor-pointer" onClick={() => copyToClipboard(`#${t}`, `m-${i}`)}>#{t}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {hashtagResults.hashtags?.lowCompetition && (
                    <div className="p-3 bg-green-500/5 rounded-lg border">
                      <p className="font-medium text-sm mb-2">✨ Low Competition (&lt;100K)</p>
                      <div className="flex flex-wrap gap-1">
                        {hashtagResults.hashtags.lowCompetition.map((t: string, i: number) => (
                          <Badge key={i} className="text-[10px] bg-green-500 cursor-pointer" onClick={() => copyToClipboard(`#${t}`, `l-${i}`)}>#{t}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {hashtagResults.hashtags?.trending && (
                    <div className="p-3 bg-purple-500/5 rounded-lg border">
                      <p className="font-medium text-sm mb-2">📈 Trending</p>
                      <div className="flex flex-wrap gap-1">
                        {hashtagResults.hashtags.trending.map((t: string, i: number) => (
                          <Badge key={i} className="text-[10px] bg-purple-500 cursor-pointer" onClick={() => copyToClipboard(`#${t}`, `t-${i}`)}>#{t}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {hashtagResults.hashtags?.bestPractices && (
                    <div className="p-2.5 bg-blue-500/5 rounded-lg text-xs">
                      <p className="font-medium mb-1">💡 Tips:</p>
                      <p className="text-muted-foreground">{hashtagResults.hashtags.bestPractices}</p>
                    </div>
                  )}
                </div>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Content Ideas */}
        <TabsContent value="ideas" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="p-5">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Lightbulb className="w-5 h-5 text-yellow-500" />
                Content Ideas
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium mb-1 block">Niche <span className="text-red-500">*</span></label>
                  <Input placeholder="e.g., Music, Hip-Hop, Rock" value={ideasNiche} onChange={(e) => setIdeasNiche(e.target.value)} />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Goals</label>
                  <Input placeholder="e.g., Grow followers, Announce tour" value={goals} onChange={(e) => setGoals(e.target.value)} />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Posting Frequency</label>
                  <Input placeholder="e.g., 5 times/week" value={postingFrequency} onChange={(e) => setPostingFrequency(e.target.value)} />
                </div>
                <Button
                  className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 hover:opacity-90 text-white"
                  onClick={() => ideasMutation.mutate({ niche: ideasNiche, goals, postingFrequency })}
                  disabled={!ideasNiche || ideasMutation.isPending}
                >
                  {ideasMutation.isPending ? "Generating..." : "Generate Ideas"}
                </Button>
              </div>
            </Card>

            {contentIdeas && (
              <Card className="p-5 max-h-[500px] overflow-y-auto">
                <h3 className="text-base font-semibold mb-3">Ideas ({contentIdeas.ideas?.length || 0})</h3>
                <div className="space-y-3">
                  {contentIdeas.ideas?.map((idea: any, i: number) => (
                    <div key={i} className="p-3 bg-yellow-500/5 rounded-lg border">
                      <div className="flex items-center justify-between mb-1.5">
                        <Badge className="bg-orange-500 text-[10px]">{idea.contentType}</Badge>
                        <Badge variant={idea.engagementLevel === "high" ? "default" : "secondary"} className="text-[10px]">{idea.engagementLevel}</Badge>
                      </div>
                      <h4 className="font-medium text-sm">{idea.topic}</h4>
                      <p className="text-xs text-muted-foreground mt-1">{idea.description}</p>
                      <div className="flex items-center gap-3 text-[10px] text-muted-foreground mt-2">
                        <span>🕐 {idea.bestTimeToPost}</span>
                      </div>
                      {idea.formatTips && <p className="text-[10px] mt-2 p-2 bg-background rounded">💡 {idea.formatTips}</p>}
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Best Time Analyzer */}
        <TabsContent value="timing" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="p-5">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5 text-blue-500" />
                Best Time to Post
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium mb-1 block">Niche <span className="text-red-500">*</span></label>
                  <Input placeholder="e.g., Music, Business, Art" value={timeNiche} onChange={(e) => setTimeNiche(e.target.value)} />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Target Audience</label>
                  <Input placeholder="e.g., Young adults, Global" value={timeAudience} onChange={(e) => setTimeAudience(e.target.value)} />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Timezone</label>
                  <select className="w-full p-2 rounded-lg border bg-background text-sm" value={timezone} onChange={(e) => setTimezone(e.target.value)}>
                    <option value="UTC">UTC</option>
                    <option value="America/New_York">Eastern Time</option>
                    <option value="America/Chicago">Central Time</option>
                    <option value="America/Los_Angeles">Pacific Time</option>
                    <option value="Europe/London">London</option>
                    <option value="Europe/Madrid">Madrid</option>
                  </select>
                </div>
                <Button
                  className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 hover:opacity-90 text-white"
                  onClick={() => timeMutation.mutate({ niche: timeNiche, targetAudience: timeAudience, timezone })}
                  disabled={!timeNiche || timeMutation.isPending}
                >
                  {timeMutation.isPending ? "Analyzing..." : "Analyze Best Times"}
                </Button>
              </div>
            </Card>

            {timeAnalysis && (
              <Card className="p-5 max-h-[500px] overflow-y-auto">
                <h3 className="text-base font-semibold mb-3">Best Times</h3>
                <div className="space-y-3">
                  {timeAnalysis.weekdaySchedule && (
                    <div className="p-3 bg-blue-500/5 rounded-lg border">
                      <p className="font-medium text-sm mb-2">📅 Weekly Schedule</p>
                      <div className="space-y-1.5 text-xs">
                        {Object.entries(timeAnalysis.weekdaySchedule).map(([day, times]: [string, any]) => (
                          <div key={day} className="flex justify-between">
                            <span className="font-medium capitalize">{day}:</span>
                            <span className="text-muted-foreground">{times.join(", ")}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {timeAnalysis.peakEngagementHours && (
                    <div className="p-3 bg-green-500/5 rounded-lg border">
                      <p className="font-medium text-sm mb-2">🔥 Peak Hours</p>
                      <div className="flex flex-wrap gap-1.5">
                        {timeAnalysis.peakEngagementHours.map((h: string, i: number) => (
                          <Badge key={i} className="bg-green-500 text-[10px]">{h}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {timeAnalysis.recommendations && (
                    <div className="p-2.5 bg-purple-500/5 rounded-lg text-xs">
                      <p className="font-medium mb-1">💡 Tips:</p>
                      <p className="text-muted-foreground">{timeAnalysis.recommendations}</p>
                    </div>
                  )}
                </div>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Bio Optimizer */}
        <TabsContent value="bio" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="p-5">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <User className="w-5 h-5 text-green-500" />
                Optimize Bio
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium mb-1 block">Current Bio</label>
                  <textarea
                    className="w-full p-2.5 rounded-lg border bg-background min-h-[80px] text-sm"
                    placeholder="Paste your current bio..."
                    value={currentBio}
                    onChange={(e) => setCurrentBio(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Niche <span className="text-red-500">*</span></label>
                  <Input placeholder="e.g., Musician, Producer, DJ" value={bioNiche} onChange={(e) => setBioNiche(e.target.value)} />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Goals</label>
                  <Input placeholder="e.g., Get more streams, Build brand" value={bioGoals} onChange={(e) => setBioGoals(e.target.value)} />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Website URL</label>
                  <Input placeholder="https://..." value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} />
                </div>
                <Button
                  className="w-full bg-gradient-to-r from-green-500 to-emerald-500 hover:opacity-90 text-white"
                  onClick={() => bioMutation.mutate({ currentBio, niche: bioNiche, goals: bioGoals, websiteUrl })}
                  disabled={!bioNiche || bioMutation.isPending}
                >
                  {bioMutation.isPending ? "Optimizing..." : "Optimize Bio"}
                </Button>
              </div>
            </Card>

            {bioResults && (
              <Card className="p-5 max-h-[500px] overflow-y-auto">
                <h3 className="text-base font-semibold mb-3">Bio Options</h3>
                <div className="space-y-3">
                  {bioResults.optimization?.bios?.map((bio: any, i: number) => (
                    <div key={i} className="p-3 bg-green-500/5 rounded-lg border relative group">
                      <p className="text-sm pr-8">{bio.bio}</p>
                      {bio.keywords?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {bio.keywords.map((kw: string, j: number) => (
                            <Badge key={j} variant="outline" className="text-[10px]">{kw}</Badge>
                          ))}
                        </div>
                      )}
                      <Button size="sm" variant="ghost" className="absolute top-2 right-2 h-7 w-7 p-0 opacity-0 group-hover:opacity-100" onClick={() => copyToClipboard(bio.bio, `b-${i}`)}>
                        {copiedId === `b-${i}` ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      </Button>
                    </div>
                  ))}
                  {bioResults.optimization?.linkStrategy && (
                    <div className="p-2.5 bg-blue-500/5 rounded-lg text-xs">
                      <p className="font-medium mb-1">🔗 Link Strategy:</p>
                      <p className="text-muted-foreground">{bioResults.optimization.linkStrategy}</p>
                    </div>
                  )}
                </div>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
