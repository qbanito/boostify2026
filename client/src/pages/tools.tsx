import React, { useState, useEffect } from "react";
import { Link } from "wouter";
import Layout from "../components/layout";
import {
  Calculator,
  Calendar,
  ChevronRight,
  ListChecks,
  Music,
  PenTool,
  PlayCircle
} from "lucide-react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Slider } from "../components/ui/slider";
import { Checkbox } from "../components/ui/checkbox";
import { Textarea } from "../components/ui/textarea";

// Tool data for the cards
const tools = [
  {
    id: "royalty-calculator",
    title: "Royalty Calculator",
    description: "Estimate your streaming revenue across different platforms based on play counts.",
    icon: Calculator,
    color: "bg-blue-600",
    buttonText: "Calculate Royalties"
  },
  {
    id: "press-kit",
    title: "Press Kit Generator",
    description: "Create a professional electronic press kit with our simple template builder.",
    icon: PenTool,
    color: "bg-purple-600",
    buttonText: "Create Press Kit"
  },
  {
    id: "release-planner",
    title: "Release Planner",
    description: "Step-by-step checklist for planning your next music release for maximum impact.",
    icon: Calendar,
    color: "bg-orange-600",
    buttonText: "Plan Your Release"
  },
  {
    id: "playlist-submission",
    title: "Playlist Submission Tool",
    description: "Submit your music to curated playlists that match your genre and style.",
    icon: PlayCircle,
    color: "bg-green-600",
    buttonText: "Submit Music"
  }
];

// Streaming platform data for the royalty calculator
const platforms = [
  { 
    id: "spotify", 
    name: "Spotify", 
    rate: 0.00318, 
    streams: 10000,
    color: "bg-green-500" 
  },
  { 
    id: "apple", 
    name: "Apple Music", 
    rate: 0.00675,
    streams: 10000, 
    color: "bg-red-500" 
  },
  { 
    id: "amazon", 
    name: "Amazon Music", 
    rate: 0.00402,
    streams: 10000, 
    color: "bg-blue-500" 
  },
  { 
    id: "youtube", 
    name: "YouTube Music", 
    rate: 0.00069,
    streams: 10000, 
    color: "bg-red-600" 
  },
  { 
    id: "tidal", 
    name: "Tidal", 
    rate: 0.01284,
    streams: 10000, 
    color: "bg-blue-600" 
  },
  { 
    id: "deezer", 
    name: "Deezer", 
    rate: 0.00599,
    streams: 10000, 
    color: "bg-purple-500" 
  }
];

// Release checklist items
const releaseChecklist = [
  {
    phase: "Pre-Production",
    tasks: [
      { id: "mastering", name: "Finalize mixing and mastering", completed: false },
      { id: "artwork", name: "Create cover artwork", completed: false },
      { id: "metadata", name: "Prepare song metadata (ISRC, credits, etc.)", completed: false },
      { id: "budget", name: "Set marketing budget", completed: false }
    ]
  },
  {
    phase: "6-8 Weeks Before Release",
    tasks: [
      { id: "distributor", name: "Submit to distributor", completed: false },
      { id: "presave", name: "Set up pre-save campaign", completed: false },
      { id: "teasers", name: "Create teaser content", completed: false },
      { id: "press", name: "Prepare press release", completed: false },
      { id: "influencers", name: "Identify influencers to contact", completed: false }
    ]
  },
  {
    phase: "3-4 Weeks Before Release",
    tasks: [
      { id: "playlist-pitch", name: "Submit for playlist consideration", completed: false },
      { id: "social-plan", name: "Schedule social media posts", completed: false },
      { id: "email", name: "Draft email newsletter", completed: false },
      { id: "blog-outreach", name: "Contact blogs and media", completed: false }
    ]
  },
  {
    phase: "1-2 Weeks Before Release",
    tasks: [
      { id: "verify", name: "Verify distribution to all platforms", completed: false },
      { id: "remind", name: "Send reminders to your audience", completed: false },
      { id: "ads", name: "Set up ad campaigns", completed: false },
      { id: "content-schedule", name: "Finalize content schedule", completed: false }
    ]
  },
  {
    phase: "Release Day",
    tasks: [
      { id: "announce", name: "Announce release across all channels", completed: false },
      { id: "share", name: "Share links to all platforms", completed: false },
      { id: "engage", name: "Engage with fan comments", completed: false },
      { id: "track", name: "Begin tracking performance", completed: false }
    ]
  },
  {
    phase: "Post-Release",
    tasks: [
      { id: "follow-up", name: "Follow up with media and playlist curators", completed: false },
      { id: "content", name: "Share behind-the-scenes content", completed: false },
      { id: "analyze", name: "Analyze performance data", completed: false },
      { id: "next-steps", name: "Plan next release based on learnings", completed: false }
    ]
  }
];

// Press kit sections
const pressKitSections = [
  { id: "bio", label: "Biography", placeholder: "Write a compelling artist biography..." },
  { id: "achievements", label: "Notable Achievements", placeholder: "List awards, significant performances, or milestones..." },
  { id: "music", label: "Featured Music", placeholder: "Add links to your best tracks or latest release..." },
  { id: "quotes", label: "Press Quotes", placeholder: "Include quotes from reviews or media coverage..." },
  { id: "contact", label: "Contact Information", placeholder: "Your management/booking contact details..." },
  { id: "social", label: "Social Media", placeholder: "List all your social media profiles..." }
];

// Playlist submission genres
const genres = [
  "Pop", "Hip-Hop/Rap", "R&B", "Rock", "Electronic/Dance", 
  "Indie", "Alternative", "Folk", "Country", "Jazz",
  "Classical", "Latin", "Metal", "Blues", "Reggae",
  "World", "New Age", "Funk", "Soul", "Ambient"
];

// Moods for playlist matching
const moods = [
  "Upbeat", "Relaxed", "Energetic", "Reflective", "Happy",
  "Melancholic", "Romantic", "Aggressive", "Dreamy", "Hopeful"
];

// Tool Card Component
interface ToolCardProps {
  tool: {
    id: string;
    title: string;
    description: string;
    icon: any; // Using any to fix type issue with createElement
    color: string;
    buttonText: string;
  };
  onClick: (toolId: string) => void;
}

const ToolCard = ({ tool, onClick }: ToolCardProps) => {
  const handleButtonClick = () => {
    // Actualiza la URL y luego llama al callback
    window.history.pushState({}, '', `/tools/${tool.id}`);
    onClick(tool.id);
  };

  return (
    <Card className="relative bg-zinc-900/60 backdrop-blur-xl border-white/10 text-white hover:border-orange-500/40 transition-all duration-300 shadow-lg shadow-black/20 hover:shadow-xl hover:shadow-orange-500/10 rounded-2xl overflow-hidden group hover:-translate-y-1">
      <div className="absolute inset-0 bg-gradient-to-b from-orange-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
      <CardHeader className="relative">
        <div className={`w-12 h-12 rounded-xl ${tool.color} flex items-center justify-center mb-3 shadow-lg`}>
          {React.createElement(tool.icon, { className: "h-6 w-6 text-white" })}
        </div>
        <CardTitle className="text-xl">{tool.title}</CardTitle>
        <CardDescription className="text-white/50">{tool.description}</CardDescription>
      </CardHeader>
      <CardFooter className="relative">
        <Button 
          className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-semibold shadow-lg shadow-orange-500/20 hover:shadow-orange-500/40 transition-all duration-300"
          onClick={handleButtonClick}
        >
          {tool.buttonText}
        </Button>
      </CardFooter>
    </Card>
  );
};

// Royalty Calculator Tool
const RoyaltyCalculator = ({ onBack }: { onBack: () => void }) => {
  const [streamingData, setStreamingData] = useState(platforms);
  
  const updateStreamCount = (id: string, streams: number) => {
    setStreamingData(
      streamingData.map(platform => 
        platform.id === id ? { ...platform, streams } : platform
      )
    );
  };
  
  const calculateTotal = () => {
    return streamingData.reduce((sum, platform) => {
      return sum + (platform.streams * platform.rate);
    }, 0);
  };
  
  return (
    <div className="space-y-6">
      <button 
        onClick={onBack}
        className="text-zinc-400 hover:text-white flex items-center mb-4"
      >
        <ChevronRight className="mr-2 h-4 w-4 rotate-180" /> Back to tools
      </button>
      
      <div className="bg-zinc-900 rounded-xl overflow-hidden border border-zinc-800 p-6">
        <h2 className="text-2xl font-bold text-white mb-4">Royalty Calculator</h2>
        <p className="text-zinc-400 mb-6">
          Estimate your potential earnings from streaming platforms based on the number of streams.
          Adjust the stream counts below to see estimated payouts.
        </p>
        
        <div className="space-y-4 mb-8">
          {streamingData.map((platform) => (
            <div key={platform.id} className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="sm:w-1/3">
                <div className="flex items-center">
                  <div className={`w-3 h-3 rounded-full ${platform.color} mr-2`}></div>
                  <span className="font-medium text-white">{platform.name}</span>
                </div>
                <div className="text-xs text-zinc-400 mt-1">
                  ${platform.rate.toFixed(5)} per stream
                </div>
              </div>
              
              <div className="sm:w-2/3">
                <div className="flex items-center gap-3">
                  <Input
                    type="number"
                    value={platform.streams}
                    onChange={(e) => updateStreamCount(platform.id, parseInt(e.target.value) || 0)}
                    className="bg-zinc-800 border-zinc-700 text-white"
                  />
                  <div className="min-w-[100px] text-right">
                    <div className="font-medium text-white">
                      ${(platform.streams * platform.rate).toFixed(2)}
                    </div>
                    <div className="text-xs text-zinc-400">
                      estimated revenue
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
        
        <div className="border-t border-zinc-800 pt-6 flex justify-between items-center">
          <div>
            <div className="text-zinc-400">Estimated Total Revenue</div>
            <div className="text-3xl font-bold text-white">${calculateTotal().toFixed(2)}</div>
          </div>
          
          <Button>
            Download as PDF
          </Button>
        </div>
        
        <div className="mt-6 text-sm text-zinc-500">
          Note: These calculations are estimates based on average per-stream rates. 
          Actual payouts may vary based on subscription tiers, geographic location of listeners, 
          and other factors specific to each platform.
        </div>
      </div>
    </div>
  );
};

// Press Kit Generator Tool
const PressKitGenerator = ({ onBack }: { onBack: () => void }) => {
  const [kitData, setKitData] = useState({
    artistName: "",
    tagline: "",
    photo: "",
    sections: pressKitSections.map(section => ({
      ...section,
      content: ""
    }))
  });
  
  const updateSection = (id: string, content: string) => {
    setKitData({
      ...kitData,
      sections: kitData.sections.map(section =>
        section.id === id ? { ...section, content } : section
      )
    });
  };
  
  return (
    <div className="space-y-6">
      <button 
        onClick={onBack}
        className="text-zinc-400 hover:text-white flex items-center mb-4"
      >
        <ChevronRight className="mr-2 h-4 w-4 rotate-180" /> Back to tools
      </button>
      
      <div className="bg-zinc-900 rounded-xl overflow-hidden border border-zinc-800 p-6">
        <h2 className="text-2xl font-bold text-white mb-4">Press Kit Generator</h2>
        <p className="text-zinc-400 mb-6">
          Create a professional press kit that you can share with media, venues, and industry professionals.
          Fill out the form below to generate your custom press kit.
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <Label htmlFor="artistName" className="text-white mb-2 block">Artist/Band Name</Label>
            <Input
              id="artistName"
              value={kitData.artistName}
              onChange={(e) => setKitData({ ...kitData, artistName: e.target.value })}
              placeholder="Enter your artist or band name"
              className="bg-zinc-800 border-zinc-700 text-white"
            />
          </div>
          
          <div>
            <Label htmlFor="tagline" className="text-white mb-2 block">Tagline/One-liner</Label>
            <Input
              id="tagline"
              value={kitData.tagline}
              onChange={(e) => setKitData({ ...kitData, tagline: e.target.value })}
              placeholder="A brief description of your music/brand"
              className="bg-zinc-800 border-zinc-700 text-white"
            />
          </div>
        </div>
        
        <div className="mb-6">
          <Label htmlFor="photo" className="text-white mb-2 block">Press Photo URL</Label>
          <Input
            id="photo"
            value={kitData.photo}
            onChange={(e) => setKitData({ ...kitData, photo: e.target.value })}
            placeholder="Link to your high-resolution press photo"
            className="bg-zinc-800 border-zinc-700 text-white"
          />
        </div>
        
        <div className="space-y-6 mb-8">
          {kitData.sections.map((section) => (
            <div key={section.id}>
              <Label htmlFor={section.id} className="text-white mb-2 block">{section.label}</Label>
              <Textarea
                id={section.id}
                value={section.content}
                onChange={(e) => updateSection(section.id, e.target.value)}
                placeholder={section.placeholder}
                className="min-h-[100px] bg-zinc-800 border-zinc-700 text-white"
              />
            </div>
          ))}
        </div>
        
        <div className="border-t border-zinc-800 pt-6 flex flex-col sm:flex-row gap-4 justify-end">
          <Button variant="outline" className="border-zinc-700 text-white">
            Preview Press Kit
          </Button>
          <Button>
            Generate & Download Kit
          </Button>
        </div>
      </div>
    </div>
  );
};

// Release Planner Tool
const ReleasePlanner = ({ onBack }: { onBack: () => void }) => {
  const [checklist, setChecklist] = useState(releaseChecklist);
  const [releaseDate, setReleaseDate] = useState("");
  
  const toggleTask = (phaseIndex: number, taskId: string) => {
    const updatedChecklist = [...checklist];
    const phase = updatedChecklist[phaseIndex];
    
    phase.tasks = phase.tasks.map(task => 
      task.id === taskId ? { ...task, completed: !task.completed } : task
    );
    
    setChecklist(updatedChecklist);
  };
  
  const calculateProgress = () => {
    const totalTasks = checklist.reduce((sum, phase) => sum + phase.tasks.length, 0);
    const completedTasks = checklist.reduce((sum, phase) => 
      sum + phase.tasks.filter(task => task.completed).length, 0
    );
    
    return {
      percentage: totalTasks ? Math.round((completedTasks / totalTasks) * 100) : 0,
      completed: completedTasks,
      total: totalTasks
    };
  };
  
  const progress = calculateProgress();
  
  return (
    <div className="space-y-6">
      <button 
        onClick={onBack}
        className="text-zinc-400 hover:text-white flex items-center mb-4"
      >
        <ChevronRight className="mr-2 h-4 w-4 rotate-180" /> Back to tools
      </button>
      
      <div className="bg-zinc-900 rounded-xl overflow-hidden border border-zinc-800 p-6">
        <h2 className="text-2xl font-bold text-white mb-4">Release Planner</h2>
        <p className="text-zinc-400 mb-6">
          Plan and track all the necessary tasks for your next music release with this step-by-step checklist.
        </p>
        
        <div className="mb-8">
          <Label htmlFor="releaseDate" className="text-white mb-2 block">Release Date</Label>
          <Input
            id="releaseDate"
            type="date"
            value={releaseDate}
            onChange={(e) => setReleaseDate(e.target.value)}
            className="max-w-xs bg-zinc-800 border-zinc-700 text-white"
          />
        </div>
        
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium text-white">Release Checklist</h3>
            <p className="text-zinc-400">Complete {progress.completed} of {progress.total} tasks</p>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="w-[100px] h-2 bg-zinc-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-blue-600 rounded-full"
                style={{ width: `${progress.percentage}%` }}
              ></div>
            </div>
            <span className="text-white font-medium">{progress.percentage}%</span>
          </div>
        </div>
        
        <div className="space-y-6 mb-8">
          {checklist.map((phase, phaseIndex) => (
            <div key={phase.phase} className="border border-zinc-800 rounded-lg overflow-hidden">
              <div className="bg-zinc-800 p-3 font-medium text-white">
                {phase.phase}
              </div>
              <div className="p-3 space-y-2">
                {phase.tasks.map((task) => (
                  <div key={task.id} className="flex items-center space-x-3">
                    <Checkbox 
                      id={task.id} 
                      checked={task.completed}
                      onCheckedChange={() => toggleTask(phaseIndex, task.id)}
                    />
                    <label 
                      htmlFor={task.id}
                      className={`text-sm ${task.completed ? 'text-zinc-500 line-through' : 'text-white'}`}
                    >
                      {task.name}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        
        <div className="border-t border-zinc-800 pt-6 flex flex-col sm:flex-row gap-4 justify-end">
          <Button variant="outline" className="border-zinc-700 text-white">
            Reset Checklist
          </Button>
          <Button>
            Export Plan as PDF
          </Button>
        </div>
      </div>
    </div>
  );
};

// Playlist Submission Tool
const PlaylistSubmission = ({ onBack }: { onBack: () => void }) => {
  const [formData, setFormData] = useState({
    artistName: "",
    trackTitle: "",
    releaseDate: "",
    streamingLink: "",
    genre: "",
    subgenre: "",
    mood: [],
    similar: "",
    description: ""
  });
  
  const handleChange = (field: string, value: any) => {
    setFormData({
      ...formData,
      [field]: value
    });
  };
  
  return (
    <div className="space-y-6">
      <button 
        onClick={onBack}
        className="text-zinc-400 hover:text-white flex items-center mb-4"
      >
        <ChevronRight className="mr-2 h-4 w-4 rotate-180" /> Back to tools
      </button>
      
      <div className="bg-zinc-900 rounded-xl overflow-hidden border border-zinc-800 p-6">
        <h2 className="text-2xl font-bold text-white mb-4">Playlist Submission Tool</h2>
        <p className="text-zinc-400 mb-6">
          Submit your music to curated playlists that match your genre and style.
          Complete the form below to find the best playlist matches for your track.
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <Label htmlFor="artistName" className="text-white mb-2 block">Artist Name</Label>
            <Input
              id="artistName"
              value={formData.artistName}
              onChange={(e) => handleChange("artistName", e.target.value)}
              placeholder="Your artist or band name"
              className="bg-zinc-800 border-zinc-700 text-white"
            />
          </div>
          
          <div>
            <Label htmlFor="trackTitle" className="text-white mb-2 block">Track Title</Label>
            <Input
              id="trackTitle"
              value={formData.trackTitle}
              onChange={(e) => handleChange("trackTitle", e.target.value)}
              placeholder="Title of the track you're submitting"
              className="bg-zinc-800 border-zinc-700 text-white"
            />
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <Label htmlFor="releaseDate" className="text-white mb-2 block">Release Date</Label>
            <Input
              id="releaseDate"
              type="date"
              value={formData.releaseDate}
              onChange={(e) => handleChange("releaseDate", e.target.value)}
              className="bg-zinc-800 border-zinc-700 text-white"
            />
          </div>
          
          <div>
            <Label htmlFor="streamingLink" className="text-white mb-2 block">Streaming Link</Label>
            <Input
              id="streamingLink"
              value={formData.streamingLink}
              onChange={(e) => handleChange("streamingLink", e.target.value)}
              placeholder="Spotify, Apple Music, or private streaming link"
              className="bg-zinc-800 border-zinc-700 text-white"
            />
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <Label htmlFor="genre" className="text-white mb-2 block">Primary Genre</Label>
            <Select 
              value={formData.genre}
              onValueChange={(value) => handleChange("genre", value)}
            >
              <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white">
                <SelectValue placeholder="Select a genre" />
              </SelectTrigger>
              <SelectContent>
                {genres.map((genre) => (
                  <SelectItem key={genre} value={genre.toLowerCase()}>
                    {genre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <Label htmlFor="subgenre" className="text-white mb-2 block">Subgenre/Style</Label>
            <Input
              id="subgenre"
              value={formData.subgenre}
              onChange={(e) => handleChange("subgenre", e.target.value)}
              placeholder="e.g. Trap, Dream Pop, Progressive, etc."
              className="bg-zinc-800 border-zinc-700 text-white"
            />
          </div>
        </div>
        
        <div className="mb-6">
          <Label className="text-white mb-2 block">Track Mood (select up to 3)</Label>
          <div className="flex flex-wrap gap-2">
            {moods.map((mood) => (
              <button
                key={mood}
                type="button"
                onClick={() => {
                  const currentMoods = formData.mood as string[];
                  if (currentMoods.includes(mood)) {
                    handleChange("mood", currentMoods.filter(m => m !== mood));
                  } else if (currentMoods.length < 3) {
                    handleChange("mood", [...currentMoods, mood]);
                  }
                }}
                className={`px-3 py-1 rounded-full text-sm ${
                  (formData.mood as string[]).includes(mood)
                    ? "bg-blue-600 text-white"
                    : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                }`}
              >
                {mood}
              </button>
            ))}
          </div>
        </div>
        
        <div className="mb-6">
          <Label htmlFor="similar" className="text-white mb-2 block">Similar Artists</Label>
          <Input
            id="similar"
            value={formData.similar}
            onChange={(e) => handleChange("similar", e.target.value)}
            placeholder="Artists that your music sounds similar to"
            className="bg-zinc-800 border-zinc-700 text-white"
          />
        </div>
        
        <div className="mb-8">
          <Label htmlFor="description" className="text-white mb-2 block">Track Description</Label>
          <Textarea
            id="description"
            value={formData.description}
            onChange={(e) => handleChange("description", e.target.value)}
            placeholder="Describe your track, its story, and what makes it unique (150 words max)"
            className="min-h-[100px] bg-zinc-800 border-zinc-700 text-white"
          />
        </div>
        
        <div className="border-t border-zinc-800 pt-6 flex justify-end">
          <Button>
            Find Matching Playlists
          </Button>
        </div>
      </div>
    </div>
  );
};

// Main Tools Page
export default function ToolsPage() {
  const [location] = useState<string>(window.location.pathname);
  const [selectedTool, setSelectedTool] = useState<string | null>(null);
  
  // Detectar la herramienta seleccionada de la URL
  useEffect(() => {
    const toolPath = location.split('/');
    if (toolPath.length > 2 && toolPath[1] === 'tools') {
      const toolId = toolPath[2];
      if (['royalty-calculator', 'press-kit', 'release-planner', 'playlist-submission'].includes(toolId)) {
        setSelectedTool(toolId);
      }
    }
  }, [location]);
  
  const handleToolClick = (toolId: string) => {
    setSelectedTool(toolId);
  };
  
  const handleBack = () => {
    // Redirigir a la página principal de herramientas
    window.history.pushState({}, '', '/tools');
    setSelectedTool(null);
  };
  
  // Render the selected tool or the tool grid
  const renderContent = () => {
    switch (selectedTool) {
      case "royalty-calculator":
        return <RoyaltyCalculator onBack={handleBack} />;
      case "press-kit":
        return <PressKitGenerator onBack={handleBack} />;
      case "release-planner":
        return <ReleasePlanner onBack={handleBack} />;
      case "playlist-submission":
        return <PlaylistSubmission onBack={handleBack} />;
      default:
        return (
          <>
            <div className="text-center mb-12">
              <h1 className="text-4xl md:text-5xl font-extrabold text-white mb-6">Music Industry Tools</h1>
              <p className="text-xl text-zinc-400 max-w-3xl mx-auto">
                Practical tools to help independent artists manage their careers more effectively
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
              {tools.map((tool) => (
                <ToolCard key={tool.id} tool={tool} onClick={handleToolClick} />
              ))}
            </div>
            
            <div className="flex items-center justify-between text-zinc-400 text-sm mt-8">
              <div className="flex items-center">
                <Link href="/resources" className="hover:text-white">
                  Resources
                </Link>
                <ChevronRight className="h-4 w-4 mx-1" />
                <span className="text-white">Tools</span>
              </div>
              <Link href="/ai-advisors" className="hover:text-white flex items-center">
                Try AI Advisors <ChevronRight className="ml-1 h-4 w-4" />
              </Link>
            </div>
          </>
        );
    }
  };
  
  return (
    <Layout>
      <div className="container max-w-7xl mx-auto px-4 py-12">
        {renderContent()}
      </div>
    </Layout>
  );
}