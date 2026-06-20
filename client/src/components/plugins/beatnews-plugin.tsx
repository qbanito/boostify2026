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
import { Slider } from "../ui/slider";
import { useState } from "react";
import { 
  Newspaper, 
  RefreshCcw, 
  Settings,
  Play,
  Pause,
  ExternalLink,
  Save,
  PlusCircle
} from "lucide-react";

export function BeatNewsPlugin() {
  const [sources, setSources] = useState([
    { name: "Billboard", url: "https://api.billboard.com/news", enabled: true },
    { name: "Rolling Stone", url: "https://api.rollingstone.com/news", enabled: true },
    { name: "Pitchfork", url: "https://api.pitchfork.com/news", enabled: false },
    { name: "NME", url: "https://api.nme.com/news", enabled: true }
  ]);
  
  const [interval, setInterval] = useState(60);
  const [isRunning, setIsRunning] = useState(false);
  const [newsItems, setNewsItems] = useState([
    {
      id: "1",
      title: "BTS Announces New World Tour",
      source: "Billboard",
      publishedAt: "2025-03-06T14:23:00Z",
      summary: "K-pop sensation BTS has announced dates for their upcoming world tour starting next month."
    },
    {
      id: "2",
      title: "Taylor Swift Breaks Record With Latest Single",
      source: "Rolling Stone",
      publishedAt: "2025-03-06T10:15:00Z", 
      summary: "Taylor Swift's new single has broken streaming records, becoming the most streamed song in a single day."
    },
    {
      id: "3",
      title: "Indie Band 'Electric Harmony' Releases Surprise Album",
      source: "Pitchfork",
      publishedAt: "2025-03-05T22:47:00Z",
      summary: "The critically acclaimed indie band has released a surprise album with no prior marketing."
    }
  ]);

  // Simulación de funciones
  const handleStartStop = () => {
    setIsRunning(!isRunning);
  };

  const handleAddSource = () => {
    setSources([...sources, { name: "New Source", url: "https://api.example.com/news", enabled: true }]);
  };

  const handleSourceToggle = (index: number) => {
    const newSources = [...sources];
    newSources[index].enabled = !newSources[index].enabled;
    setSources(newSources);
  };

  const handleRefresh = () => {
    // Simular carga de noticias
    logger.info("Refreshing news...");
  };

  // Format date function
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-1 space-y-6">
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center">
            <Newspaper className="w-5 h-5 mr-2 text-orange-500" />
            BeatNews Configuration
          </h3>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="plugin-status">Plugin Status</Label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  {isRunning ? "Running" : "Stopped"}
                </span>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleStartStop}
                >
                  {isRunning ? (
                    <Pause className="h-4 w-4 mr-1" />
                  ) : (
                    <Play className="h-4 w-4 mr-1" />
                  )}
                  {isRunning ? "Stop" : "Start"}
                </Button>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="update-interval">Update Interval (seconds)</Label>
              <div className="flex items-center gap-2">
                <Slider 
                  id="update-interval"
                  value={[interval]} 
                  min={10} 
                  max={300} 
                  step={10}
                  onValueChange={(vals) => setInterval(vals[0])}
                  className="flex-1"
                />
                <span className="text-sm w-8 text-right">{interval}</span>
              </div>
            </div>
            
            <div className="pt-2">
              <div className="flex items-center justify-between mb-2">
                <Label>News Sources</Label>
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
          </div>
        </Card>
      </div>
      
      <div className="lg:col-span-2 space-y-6">
        <Card className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold flex items-center">
              <Newspaper className="w-5 h-5 mr-2 text-orange-500" />
              Latest Music News
            </h3>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleRefresh}>
                <RefreshCcw className="h-4 w-4 mr-1" />
                Refresh
              </Button>
              <Select defaultValue="all">
                <SelectTrigger className="w-[130px]">
                  <SelectValue placeholder="Filter by Source" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sources</SelectItem>
                  {sources.map((source, index) => (
                    <SelectItem key={index} value={source.name}>{source.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="space-y-4">
            {newsItems.map((item) => (
              <Card key={item.id} className="p-4 hover:bg-accent transition-colors">
                <div className="flex justify-between items-start gap-4">
                  <div className="space-y-1">
                    <h4 className="font-medium">{item.title}</h4>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>{item.source}</span>
                      <span>•</span>
                      <span>{formatDate(item.publishedAt)}</span>
                    </div>
                    <p className="text-sm mt-2">{item.summary}</p>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Button size="icon" variant="ghost">
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost">
                      <Save className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </Card>
        
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center">
            <Settings className="w-5 h-5 mr-2 text-orange-500" />
            Post Template
          </h3>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="post-template">Template for Social Media Posts</Label>
              <Textarea 
                id="post-template"
                placeholder="Enter your template here..."
                className="mt-1 min-h-[100px]"
                defaultValue="🎵 Latest Music News from [source]: [title] #MusicNews #Boostify"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Use [title], [source], [summary] as placeholders for dynamic content.
              </p>
            </div>
            
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Switch id="auto-post" defaultChecked />
                <Label htmlFor="auto-post" className="cursor-pointer">Auto-post to social media</Label>
              </div>
              <Button variant="default" size="sm">
                <Save className="h-4 w-4 mr-1" />
                Save Settings
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}