import { Card } from "../ui/card";
import { logger } from "@/lib/logger";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Switch } from "../ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import { useState } from "react";
import { 
  Share, 
  RefreshCcw, 
  Clock,
  Twitter,
  Instagram,
  Facebook,
  Youtube,
  Send,
  Copy,
  Calendar,
  CheckCircle2,
  XCircle,
  BarChart,
  ExternalLink,
  BookOpen,
  Save
} from "lucide-react";

export function SocialSyncPlugin() {
  const [platforms, setPlatforms] = useState([
    { name: "Twitter", connected: true, icon: <Twitter className="h-4 w-4" />, lastSync: "2025-03-06T08:30:00Z" },
    { name: "Instagram", connected: true, icon: <Instagram className="h-4 w-4" />, lastSync: "2025-03-06T07:15:00Z" },
    { name: "Facebook", connected: true, icon: <Facebook className="h-4 w-4" />, lastSync: "2025-03-06T08:30:00Z" },
    { name: "YouTube", connected: false, icon: <Youtube className="h-4 w-4" />, lastSync: null }
  ]);
  
  const [postHistory] = useState([
    { 
      id: "1", 
      content: "New release alert! Check out our latest article on music production techniques for beginners #MusicProduction #Boostify", 
      platforms: ["Twitter", "Facebook"],
      status: "published",
      engagement: { likes: 28, shares: 12, comments: 5 },
      publishedAt: "2025-03-06T08:30:00Z"
    },
    { 
      id: "2", 
      content: "Exciting interview with Grammy-winning producer on innovative techniques that are changing the industry. Watch now on Boostify!", 
      platforms: ["Twitter", "Facebook", "Instagram"],
      status: "published",
      engagement: { likes: 45, shares: 23, comments: 8 },
      publishedAt: "2025-03-05T14:20:00Z"
    },
    { 
      id: "3", 
      content: "This week's top indie releases curated for your listening pleasure. Discover new artists on Boostify now! #IndieMusic #NewReleases", 
      platforms: ["Twitter"],
      status: "scheduled",
      engagement: null,
      publishedAt: "2025-03-07T10:00:00Z"
    }
  ]);
  
  const [activeTab, setActiveTab] = useState("publish");
  const [newPostContent, setNewPostContent] = useState("");
  const [selectedPlatforms, setSelectedPlatforms] = useState(["Twitter", "Facebook", "Instagram"]);

  // Simulate functions
  const handleTogglePlatform = (platformName: string) => {
    setSelectedPlatforms(prev => 
      prev.includes(platformName)
        ? prev.filter(p => p !== platformName)
        : [...prev, platformName]
    );
  };

  const handleConnect = (platformName: string) => {
    setPlatforms(platforms.map(p => 
      p.name === platformName ? {...p, connected: true} : p
    ));
  };

  const handlePublishNow = () => {
    logger.info("Publishing to platforms:", selectedPlatforms);
    logger.info("Content:", newPostContent);
    setNewPostContent("");
  };

  const handleSchedule = () => {
    logger.info("Scheduling post for platforms:", selectedPlatforms);
  };

  // Format date function
  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Never";
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  // Get platform badge with appropriate color
  const getPlatformBadge = (platformName: string) => {
    let bgColor = "bg-gray-100 text-gray-800";
    
    switch(platformName) {
      case "Twitter":
        bgColor = "bg-blue-100 text-blue-800";
        break;
      case "Instagram":
        bgColor = "bg-pink-100 text-pink-800";
        break;
      case "Facebook":
        bgColor = "bg-indigo-100 text-indigo-800";
        break;
      case "YouTube":
        bgColor = "bg-red-100 text-red-800";
        break;
    }
    
    return (
      <span className={`text-xs px-2 py-1 rounded-full ${bgColor}`}>
        {platformName}
      </span>
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-1 space-y-6">
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center">
            <Share className="w-5 h-5 mr-2 text-orange-500" />
            Connected Platforms
          </h3>
          
          <div className="space-y-4">
            {platforms.map((platform) => (
              <div key={platform.name} className="flex justify-between items-center p-3 rounded-md border">
                <div className="flex items-center gap-3">
                  <div className="bg-orange-500/10 p-2 rounded-full">
                    {platform.icon}
                  </div>
                  <div>
                    <p className="font-medium">{platform.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {platform.connected 
                        ? `Last synced: ${formatDate(platform.lastSync)}` 
                        : "Not connected"}
                    </p>
                  </div>
                </div>
                
                {platform.connected ? (
                  <Switch 
                    checked={selectedPlatforms.includes(platform.name)}
                    onCheckedChange={() => handleTogglePlatform(platform.name)}
                  />
                ) : (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => handleConnect(platform.name)}
                  >
                    Connect
                  </Button>
                )}
              </div>
            ))}
            
            <div className="pt-2">
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => logger.info("Sync all platforms")}
              >
                <RefreshCcw className="h-4 w-4 mr-2" />
                Sync All Platforms
              </Button>
            </div>
          </div>
        </Card>
        
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center">
            <BookOpen className="w-5 h-5 mr-2 text-orange-500" />
            Content Library
          </h3>
          
          <div className="space-y-4">
            <div className="text-center p-6 text-sm text-muted-foreground">
              <p>Access pre-made templates and content ideas for your social media posts.</p>
              <Button className="mt-4" variant="outline">
                Browse Templates
              </Button>
            </div>
          </div>
        </Card>
      </div>
      
      <div className="lg:col-span-2 space-y-6">
        <Tabs defaultValue="publish" value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full mb-6">
            <TabsTrigger value="publish" className="flex-1">Publish</TabsTrigger>
            <TabsTrigger value="history" className="flex-1">Post History</TabsTrigger>
            <TabsTrigger value="analytics" className="flex-1">Analytics</TabsTrigger>
          </TabsList>
          
          <TabsContent value="publish" className="m-0">
            <Card className="p-6">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="post-content">Post Content</Label>
                  <Textarea 
                    id="post-content"
                    placeholder="Write your post content here..."
                    className="mt-1 min-h-[150px]"
                    value={newPostContent}
                    onChange={(e) => setNewPostContent(e.target.value)}
                  />
                  <div className="mt-1 flex justify-between text-xs text-muted-foreground">
                    <span>Add #hashtags and @mentions for better reach</span>
                    <span>{newPostContent.length} / 280</span>
                  </div>
                </div>
                
                <div>
                  <Label>Upload Media</Label>
                  <div className="mt-1 border-2 border-dashed rounded-md p-6 flex flex-col items-center justify-center">
                    <p className="text-sm text-muted-foreground">
                      Drag and drop image or video files, or
                    </p>
                    <Button variant="outline" className="mt-2">
                      Browse Files
                    </Button>
                  </div>
                </div>
                
                <div className="pt-2 border-t">
                  <p className="text-sm font-medium mb-2">Publishing Options</p>
                  <div className="flex flex-wrap gap-2">
                    <Button 
                      variant="default" 
                      disabled={!newPostContent || selectedPlatforms.length === 0}
                      onClick={handlePublishNow}
                    >
                      <Send className="h-4 w-4 mr-2" />
                      Publish Now
                    </Button>
                    <Button 
                      variant="outline" 
                      disabled={!newPostContent || selectedPlatforms.length === 0}
                      onClick={handleSchedule}
                    >
                      <Calendar className="h-4 w-4 mr-2" />
                      Schedule
                    </Button>
                    <Button variant="outline">
                      <Save className="h-4 w-4 mr-2" />
                      Save Draft
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          </TabsContent>
          
          <TabsContent value="history" className="m-0">
            <Card className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Post History</h3>
                <div className="flex gap-2">
                  <Select defaultValue="all">
                    <SelectTrigger className="w-[150px]">
                      <SelectValue placeholder="Filter by Platform" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Platforms</SelectItem>
                      {platforms.map(p => (
                        <SelectItem key={p.name} value={p.name.toLowerCase()}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="sm">
                    <RefreshCcw className="h-4 w-4 mr-1" />
                    Refresh
                  </Button>
                </div>
              </div>
              
              <div className="space-y-4">
                {postHistory.map((post) => (
                  <Card key={post.id} className="p-4 hover:bg-accent transition-colors">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>{formatDate(post.publishedAt)}</span>
                        <span className="ml-auto">
                          {post.status === "published" ? (
                            <span className="flex items-center text-green-600">
                              <CheckCircle2 className="h-3 w-3 mr-1" /> Published
                            </span>
                          ) : (
                            <span className="flex items-center text-amber-600">
                              <Calendar className="h-3 w-3 mr-1" /> Scheduled
                            </span>
                          )}
                        </span>
                      </div>
                      
                      <p className="text-sm">{post.content}</p>
                      
                      <div className="flex flex-wrap gap-1 mt-1">
                        {post.platforms.map(platform => (
                          <span key={platform}>{getPlatformBadge(platform)}</span>
                        ))}
                      </div>
                      
                      {post.engagement && (
                        <div className="flex gap-4 text-xs text-muted-foreground pt-2 mt-2 border-t">
                          <div className="flex items-center">
                            <span className="font-medium mr-1">{post.engagement.likes}</span> Likes
                          </div>
                          <div className="flex items-center">
                            <span className="font-medium mr-1">{post.engagement.shares}</span> Shares
                          </div>
                          <div className="flex items-center">
                            <span className="font-medium mr-1">{post.engagement.comments}</span> Comments
                          </div>
                        </div>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            </Card>
          </TabsContent>
          
          <TabsContent value="analytics" className="m-0">
            <Card className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold flex items-center">
                  <BarChart className="w-5 h-5 mr-2 text-orange-500" />
                  Social Media Performance
                </h3>
                <Select defaultValue="last7days">
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Time Period" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="today">Today</SelectItem>
                    <SelectItem value="last7days">Last 7 Days</SelectItem>
                    <SelectItem value="last30days">Last 30 Days</SelectItem>
                    <SelectItem value="last3months">Last 3 Months</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <Card className="p-4">
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground">Total Engagement</p>
                      <p className="text-3xl font-bold">328</p>
                    </div>
                  </Card>
                  <Card className="p-4">
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground">Posts Published</p>
                      <p className="text-3xl font-bold">12</p>
                    </div>
                  </Card>
                  <Card className="p-4">
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground">Avg. Engagement</p>
                      <p className="text-3xl font-bold">27.3</p>
                    </div>
                  </Card>
                </div>
                
                <div className="border rounded-md">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Platform</TableHead>
                        <TableHead>Posts</TableHead>
                        <TableHead>Likes</TableHead>
                        <TableHead>Shares</TableHead>
                        <TableHead>Engagement Rate</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <Twitter className="h-4 w-4 text-blue-500" />
                            Twitter
                          </div>
                        </TableCell>
                        <TableCell>8</TableCell>
                        <TableCell>143</TableCell>
                        <TableCell>62</TableCell>
                        <TableCell>2.8%</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <Instagram className="h-4 w-4 text-pink-500" />
                            Instagram
                          </div>
                        </TableCell>
                        <TableCell>5</TableCell>
                        <TableCell>98</TableCell>
                        <TableCell>18</TableCell>
                        <TableCell>3.2%</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <Facebook className="h-4 w-4 text-blue-700" />
                            Facebook
                          </div>
                        </TableCell>
                        <TableCell>6</TableCell>
                        <TableCell>87</TableCell>
                        <TableCell>35</TableCell>
                        <TableCell>2.1%</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
                
                <div className="text-center mt-4">
                  <Button variant="outline">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    View Detailed Report
                  </Button>
                </div>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}