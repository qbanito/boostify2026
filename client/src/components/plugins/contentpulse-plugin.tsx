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
import { useState } from "react";
import { 
  Zap, 
  RefreshCcw, 
  Filter,
  Clock,
  Check,
  X,
  Edit,
  Trash,
  Music,
  PlusCircle,
  Download,
  Save
} from "lucide-react";

export function ContentPulsePlugin() {
  const [sources, setSources] = useState([
    { name: "Music Blogs", url: "https://api.musicblogs.com/content", enabled: true },
    { name: "YouTube", url: "https://api.youtube.com/music-content", enabled: true },
    { name: "Spotify", url: "https://api.spotify.com/featured", enabled: true },
    { name: "Music Industry News", url: "https://api.musicindustry.com/news", enabled: false }
  ]);
  
  const [contentItems, setContentItems] = useState([
    {
      id: "1",
      title: "10 Essential Music Production Tips for Beginners",
      source: "Music Blogs",
      type: "article",
      publishedAt: "2025-03-06T11:23:00Z",
      summary: "Learn the basics of music production with these essential tips for beginners.",
      status: "published"
    },
    {
      id: "2",
      title: "Interview with Grammy-Winning Producer on New Techniques",
      source: "YouTube",
      type: "video",
      publishedAt: "2025-03-05T16:45:00Z", 
      summary: "An exclusive interview with award-winning producer discussing innovative production techniques.",
      status: "curated"
    },
    {
      id: "3",
      title: "This Week's Top Indie Releases You Need to Hear",
      source: "Spotify",
      type: "playlist",
      publishedAt: "2025-03-05T09:12:00Z",
      summary: "A curated collection of the best indie releases from this week that deserves your attention.",
      status: "pending"
    }
  ]);

  const [activeTab, setActiveTab] = useState("all");

  // Simulate functions
  const handleRefresh = () => {
    logger.info("Refreshing content...");
  };

  const handleAddSource = () => {
    setSources([...sources, { name: "New Source", url: "https://api.example.com/content", enabled: true }]);
  };

  const handleSourceToggle = (index: number) => {
    const newSources = [...sources];
    newSources[index].enabled = !newSources[index].enabled;
    setSources(newSources);
  };

  const handleApproveContent = (id: string) => {
    setContentItems(contentItems.map(item => 
      item.id === id ? {...item, status: "published"} : item
    ));
  };

  const handleRejectContent = (id: string) => {
    setContentItems(contentItems.map(item => 
      item.id === id ? {...item, status: "rejected"} : item
    ));
  };

  // Format date function
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  // Filter content based on active tab
  const filteredContent = activeTab === "all" 
    ? contentItems 
    : contentItems.filter(item => item.status === activeTab);

  // Content type icon mapping
  const getContentTypeIcon = (type: string) => {
    switch(type) {
      case "article":
        return <div className="bg-blue-100 text-blue-800 p-1 rounded">Article</div>;
      case "video":
        return <div className="bg-red-100 text-red-800 p-1 rounded">Video</div>;
      case "playlist":
        return <div className="bg-green-100 text-green-800 p-1 rounded">Playlist</div>;
      default:
        return <div className="bg-gray-100 text-gray-800 p-1 rounded">{type}</div>;
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-1 space-y-6">
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center">
            <Zap className="w-5 h-5 mr-2 text-orange-500" />
            ContentPulse Configuration
          </h3>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="filter-keywords">Filter Keywords</Label>
              <Textarea 
                id="filter-keywords"
                placeholder="Enter keywords to filter content by, one per line..."
                className="min-h-[100px]"
                defaultValue="music production\nindependent artists\nnew release\nstudio techniques"
              />
              <p className="text-xs text-muted-foreground">
                Content matching these keywords will be prioritized.
              </p>
            </div>
            
            <div className="space-y-2">
              <Label>Content Types</Label>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center space-x-2">
                  <Switch id="articles" defaultChecked />
                  <Label htmlFor="articles">Articles</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch id="videos" defaultChecked />
                  <Label htmlFor="videos">Videos</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch id="playlists" defaultChecked />
                  <Label htmlFor="playlists">Playlists</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch id="interviews" defaultChecked />
                  <Label htmlFor="interviews">Interviews</Label>
                </div>
              </div>
            </div>
            
            <div className="pt-2">
              <div className="flex items-center justify-between mb-2">
                <Label>Content Sources</Label>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={handleAddSource}
                  className="h-8 px-2"
                >
                  <PlusCircle className="h-4 w-4 mr-1" />
                  Add
                </Button>
              </div>
              
              <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                {sources.map((source, index) => (
                  <div key={index} className="flex items-center justify-between rounded-md border p-2">
                    <div className="overflow-hidden">
                      <p className="font-medium truncate">{source.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{source.url}</p>
                    </div>
                    <Switch
                      checked={source.enabled}
                      onCheckedChange={() => handleSourceToggle(index)}
                    />
                  </div>
                ))}
              </div>
            </div>
            
            <div className="pt-2">
              <div className="flex items-center justify-between">
                <Label>Auto-Curation</Label>
                <Switch id="auto-curation" defaultChecked />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Automatically curate content based on engagement and relevance.
              </p>
            </div>
            
            <Button className="w-full">
              <Save className="h-4 w-4 mr-2" />
              Save Configuration
            </Button>
          </div>
        </Card>
      </div>
      
      <div className="lg:col-span-2 space-y-6">
        <Card className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold flex items-center">
              <Zap className="w-5 h-5 mr-2 text-orange-500" />
              Content Manager
            </h3>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleRefresh}>
                <RefreshCcw className="h-4 w-4 mr-1" />
                Refresh
              </Button>
              <Select defaultValue="relevance">
                <SelectTrigger className="w-[130px]">
                  <SelectValue placeholder="Sort By" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="relevance">Relevance</SelectItem>
                  <SelectItem value="date">Date</SelectItem>
                  <SelectItem value="source">Source</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-4">
              <TabsTrigger value="all">All Content</TabsTrigger>
              <TabsTrigger value="pending">Pending</TabsTrigger>
              <TabsTrigger value="curated">Curated</TabsTrigger>
              <TabsTrigger value="published">Published</TabsTrigger>
              <TabsTrigger value="rejected">Rejected</TabsTrigger>
            </TabsList>
            
            <TabsContent value={activeTab} className="m-0">
              <div className="space-y-4">
                {filteredContent.length > 0 ? (
                  filteredContent.map((item) => (
                    <Card key={item.id} className="p-4 hover:bg-accent transition-colors">
                      <div className="flex justify-between gap-4">
                        <div className="space-y-1 flex-grow">
                          <div className="flex items-center gap-2">
                            {getContentTypeIcon(item.type)}
                            <span className="text-sm text-muted-foreground">{item.source}</span>
                          </div>
                          <h4 className="font-medium">{item.title}</h4>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            <span>{formatDate(item.publishedAt)}</span>
                          </div>
                          <p className="text-sm mt-2">{item.summary}</p>
                        </div>
                        <div className="flex flex-col gap-2">
                          {item.status === "pending" && (
                            <>
                              <Button 
                                size="icon" 
                                variant="ghost" 
                                className="text-green-600"
                                onClick={() => handleApproveContent(item.id)}
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button 
                                size="icon" 
                                variant="ghost" 
                                className="text-red-600"
                                onClick={() => handleRejectContent(item.id)}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                          <Button size="icon" variant="ghost">
                            <Edit className="h-4 w-4" />
                          </Button>
                          {item.status === "published" && (
                            <Button size="icon" variant="ghost">
                              <Download className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                      {item.status === "published" && (
                        <div className="mt-3 pt-3 border-t text-sm">
                          <p className="text-muted-foreground">
                            Published to: <span className="font-medium text-foreground">Website, Social Media</span>
                          </p>
                        </div>
                      )}
                    </Card>
                  ))
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No content found in this category.
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </Card>
      </div>
    </div>
  );
}