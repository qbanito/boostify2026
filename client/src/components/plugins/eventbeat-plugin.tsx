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
import { Badge } from "../ui/badge";
import { useState } from "react";
import { 
  Calendar, 
  RefreshCcw, 
  MapPin,
  Music,
  Ticket,
  Users,
  Star,
  Clock,
  Plus,
  ExternalLink,
  Filter,
  ArrowUpDown,
  Heart,
  Download,
  Search
} from "lucide-react";

export function EventBeatPlugin() {
  const [events, setEvents] = useState([
    { 
      id: "1", 
      name: "Summer Music Festival 2025", 
      venue: "Central Park Amphitheater",
      location: "New York, NY",
      date: "2025-07-15T18:00:00Z",
      type: "festival",
      price: "$45 - $120",
      capacity: 3500,
      featured: true,
      rating: 4.8,
      attendees: 215,
      description: "Annual summer music festival featuring top indie and alternative artists across three stages."
    },
    { 
      id: "2", 
      name: "Jazz Night at Blue Note", 
      venue: "Blue Note Jazz Club",
      location: "Chicago, IL",
      date: "2025-03-20T20:00:00Z",
      type: "concert",
      price: "$25 - $60",
      capacity: 200,
      featured: false,
      rating: 4.5,
      attendees: 45,
      description: "Weekly jazz performance featuring local and visiting jazz musicians in an intimate setting."
    },
    { 
      id: "3", 
      name: "Electronic Music Summit", 
      venue: "Tech Convention Center",
      location: "San Francisco, CA",
      date: "2025-05-05T10:00:00Z",
      type: "conference",
      price: "$85 - $200",
      capacity: 1200,
      featured: true,
      rating: 4.6,
      attendees: 320,
      description: "Annual conference for electronic music producers and fans featuring workshops, panels, and performances."
    },
    { 
      id: "4", 
      name: "Album Release Party", 
      venue: "The Record Shop",
      location: "Austin, TX",
      date: "2025-04-02T19:30:00Z",
      type: "release",
      price: "$15",
      capacity: 150,
      featured: false,
      rating: 4.2,
      attendees: 28,
      description: "Exclusive album release party for indie band 'Lunar Tides' with live performance and album signing."
    }
  ]);
  
  const [activeTab, setActiveTab] = useState("upcoming");
  const [searchQuery, setSearchQuery] = useState("");
  const [locationFilter, setLocationFilter] = useState("all");

  // Simulate functions
  const handleRefresh = () => {
    logger.info("Refreshing events...");
  };

  const handleAttend = (eventId: string) => {
    setEvents(events.map(event => 
      event.id === eventId ? {...event, attendees: event.attendees + 1} : event
    ));
  };

  // Format date function
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  // Get event type badge
  const getEventTypeBadge = (type: string) => {
    let bgColor = "";
    let textColor = "";
    
    switch(type) {
      case "festival":
        bgColor = "bg-purple-100";
        textColor = "text-purple-800";
        break;
      case "concert":
        bgColor = "bg-blue-100";
        textColor = "text-blue-800";
        break;
      case "conference":
        bgColor = "bg-amber-100";
        textColor = "text-amber-800";
        break;
      case "release":
        bgColor = "bg-green-100";
        textColor = "text-green-800";
        break;
      default:
        bgColor = "bg-gray-100";
        textColor = "text-gray-800";
    }
    
    return (
      <Badge variant="outline" className={`${bgColor} ${textColor} border-0`}>
        {type.charAt(0).toUpperCase() + type.slice(1)}
      </Badge>
    );
  };

  // Filter events based on active tab, search query, and location filter
  const filteredEvents = events
    .filter(event => {
      const isUpcoming = new Date(event.date) > new Date();
      if (activeTab === "upcoming" && !isUpcoming) return false;
      if (activeTab === "past" && isUpcoming) return false;
      if (activeTab === "featured" && !event.featured) return false;
      
      const matchesSearch = 
        searchQuery === "" ||
        event.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        event.venue.toLowerCase().includes(searchQuery.toLowerCase()) ||
        event.description.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesLocation = 
        locationFilter === "all" || 
        event.location.includes(locationFilter);
      
      return matchesSearch && matchesLocation;
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Extract unique locations for filter
  const locations = Array.from(new Set(events.map(event => event.location.split(',')[0].trim())));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-1 space-y-6">
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center">
            <Calendar className="w-5 h-5 mr-2 text-orange-500" />
            EventBeat Configuration
          </h3>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="api-key">API Key</Label>
              <Input 
                id="api-key"
                type="password"
                placeholder="Enter your EventBeat API key..."
                defaultValue="••••••••••••••••"
              />
              <p className="text-xs text-muted-foreground">
                Your API key for accessing event data sources.
              </p>
            </div>
            
            <div className="space-y-2">
              <Label>Event Sources</Label>
              <div className="space-y-2">
                <div className="flex items-center justify-between rounded-md border p-2">
                  <div>
                    <p className="font-medium">Ticketmaster</p>
                    <p className="text-xs text-muted-foreground">Global event ticketing platform</p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between rounded-md border p-2">
                  <div>
                    <p className="font-medium">Eventbrite</p>
                    <p className="text-xs text-muted-foreground">Self-published and local events</p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between rounded-md border p-2">
                  <div>
                    <p className="font-medium">SongKick</p>
                    <p className="text-xs text-muted-foreground">Concert and music festival database</p>
                  </div>
                  <Switch defaultChecked />
                </div>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Event Types</Label>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center space-x-2">
                  <Switch id="concerts" defaultChecked />
                  <Label htmlFor="concerts">Concerts</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch id="festivals" defaultChecked />
                  <Label htmlFor="festivals">Festivals</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch id="conferences" defaultChecked />
                  <Label htmlFor="conferences">Conferences</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch id="releases" defaultChecked />
                  <Label htmlFor="releases">Releases</Label>
                </div>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="default-location">Default Location</Label>
              <Select defaultValue="New York, NY">
                <SelectTrigger>
                  <SelectValue placeholder="Select a location" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="New York, NY">New York, NY</SelectItem>
                  <SelectItem value="Los Angeles, CA">Los Angeles, CA</SelectItem>
                  <SelectItem value="Chicago, IL">Chicago, IL</SelectItem>
                  <SelectItem value="San Francisco, CA">San Francisco, CA</SelectItem>
                  <SelectItem value="Austin, TX">Austin, TX</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="auto-attend">Auto-Attend Recommendations</Label>
                <Switch id="auto-attend" defaultChecked />
              </div>
              <p className="text-xs text-muted-foreground">
                Automatically suggest events based on your music preferences.
              </p>
            </div>
            
            <Button className="w-full" variant="default">
              <RefreshCcw className="h-4 w-4 mr-2" />
              Update Events
            </Button>
          </div>
        </Card>
      </div>
      
      <div className="lg:col-span-2 space-y-6">
        <Card className="p-6">
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <h3 className="text-lg font-semibold flex items-center">
                <Calendar className="w-5 h-5 mr-2 text-orange-500" />
                Music Events
              </h3>
              
              <div className="flex gap-2 w-full sm:w-auto">
                <div className="relative flex-grow sm:flex-grow-0">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input 
                    type="search" 
                    placeholder="Search events..." 
                    className="pl-8"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <Select 
                  value={locationFilter} 
                  onValueChange={setLocationFilter}
                >
                  <SelectTrigger className="w-[130px]">
                    <SelectValue placeholder="Location" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Locations</SelectItem>
                    {locations.map(location => (
                      <SelectItem key={location} value={location}>{location}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <Tabs defaultValue="upcoming" value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="mb-4">
                <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
                <TabsTrigger value="featured">Featured</TabsTrigger>
                <TabsTrigger value="past">Past Events</TabsTrigger>
              </TabsList>
              
              <TabsContent value={activeTab} className="m-0">
                <div className="space-y-4">
                  {filteredEvents.length > 0 ? (
                    filteredEvents.map((event) => (
                      <Card key={event.id} className="p-4 overflow-hidden hover:bg-accent transition-colors">
                        <div className="flex flex-col md:flex-row gap-4">
                          <div className="md:w-32 lg:w-40 flex-shrink-0">
                            <div className="bg-orange-500/10 rounded-md p-4 flex items-center justify-center h-full">
                              <div className="text-center">
                                <p className="text-lg font-semibold">{new Date(event.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
                                <p className="text-sm text-muted-foreground">{new Date(event.date).toLocaleDateString('en-US', { weekday: 'short' })}</p>
                                <p className="text-xs mt-1">{new Date(event.date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</p>
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex-grow space-y-2">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div>
                                <div className="flex items-center gap-2">
                                  {getEventTypeBadge(event.type)}
                                  {event.featured && (
                                    <Badge variant="outline" className="bg-orange-100 text-orange-800 border-0">
                                      Featured
                                    </Badge>
                                  )}
                                </div>
                                <h4 className="font-semibold mt-1">{event.name}</h4>
                              </div>
                              <div className="flex items-center text-sm">
                                <Star className="h-4 w-4 text-orange-500 mr-1" />
                                <span>{event.rating}</span>
                                <span className="mx-1">•</span>
                                <Users className="h-4 w-4 mr-1" />
                                <span>{event.attendees}</span>
                              </div>
                            </div>
                            
                            <div className="flex items-start gap-1 text-sm text-muted-foreground">
                              <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                              <div>
                                <p>{event.venue}</p>
                                <p>{event.location}</p>
                              </div>
                            </div>
                            
                            <p className="text-sm">{event.description}</p>
                            
                            <div className="flex flex-wrap gap-2 justify-between items-center mt-2 pt-2 border-t">
                              <div className="text-sm">
                                <span className="font-medium">{event.price}</span>
                                <span className="mx-2">•</span>
                                <span className="text-muted-foreground">Capacity: {event.capacity}</span>
                              </div>
                              <div className="flex gap-2">
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => handleAttend(event.id)}
                                >
                                  <Heart className="h-4 w-4 mr-1" />
                                  Attend
                                </Button>
                                <Button variant="outline" size="sm">
                                  <Ticket className="h-4 w-4 mr-1" />
                                  Get Tickets
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </Card>
                    ))
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      No events found matching your criteria.
                    </div>
                  )}
                </div>
                
                {filteredEvents.length > 0 && (
                  <div className="flex justify-center mt-6">
                    <Button variant="outline">
                      <Plus className="h-4 w-4 mr-2" />
                      Load More Events
                    </Button>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </Card>
      </div>
    </div>
  );
}