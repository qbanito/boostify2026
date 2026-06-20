import { Card } from "../components/ui/card";
import { logger } from "../lib/logger";
import { Button } from "../components/ui/button";
import { ScrollArea } from "../components/ui/scroll-area";
import { Header } from "../components/layout/header";
import { Activity, Calendar, MapPin, Users, Clock, Plus, Trash2 } from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart as RePieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { format } from "date-fns";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "../hooks/use-toast";
import { apiRequest } from "../lib/queryClient";

// Keep the sample events as a fallback
const majorEventsData: any[] = [
  {
    id: 1,
    title: "The 67th Annual Grammy Awards",
    description: "Music's Biggest Night celebrating the best in music across all genres",
    date: "2025-02-02",
    time: "20:00",
    location: "Crypto.com Arena, Los Angeles",
    attendees: 18000,
    maxCapacity: 20000,
    image: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&h=600&q=80",
    type: "awards",
    registrationLink: "https://www.grammy.com/tickets"
  },
  {
    id: 2,
    title: "Billboard Music Awards 2025",
    description: "Annual music awards ceremony celebrating chart success",
    date: "2025-05-15",
    time: "19:00",
    location: "MGM Grand Garden Arena, Las Vegas",
    attendees: 15000,
    maxCapacity: 17000,
    image: "https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?w=800&h=600&q=80",
    type: "awards",
    registrationLink: "https://www.billboard.com/awards"
  },
  {
    id: 3,
    title: "Coachella Valley Music and Arts Festival",
    description: "The world's most iconic music festival",
    date: "2025-04-11",
    time: "12:00",
    location: "Empire Polo Club, Indio, California",
    attendees: 125000,
    maxCapacity: 125000,
    image: "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=800&h=600&q=80",
    type: "festival",
    registrationLink: "https://www.coachella.com/tickets"
  },
  {
    id: 4,
    title: "MTV Video Music Awards 2025",
    description: "Celebrating the best music videos of the year",
    date: "2025-08-25",
    time: "20:00",
    location: "Barclays Center, Brooklyn",
    attendees: 19000,
    maxCapacity: 19000,
    image: "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=800&h=600&q=80",
    type: "awards",
    registrationLink: "https://www.mtv.com/vma/tickets"
  },
  {
    id: 5,
    title: "Glastonbury Festival 2025",
    description: "The largest greenfield music festival in the world",
    date: "2025-06-25",
    time: "09:00",
    location: "Worthy Farm, Somerset, UK",
    attendees: 210000,
    maxCapacity: 210000,
    image: "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=800&h=600&q=80",
    type: "festival",
    registrationLink: "https://www.glastonburyfestivals.co.uk"
  },
  {
    id: 6,
    title: "American Music Awards 2025",
    description: "The world's largest fan-voted awards show",
    date: "2025-11-20",
    time: "20:00",
    location: "Microsoft Theater, Los Angeles",
    attendees: 7100,
    maxCapacity: 7100,
    image: "https://images.unsplash.com/photo-1524368535928-5b5e00ddc76b?w=800&h=600&q=80",
    type: "awards",
    registrationLink: "https://www.theamas.com/tickets"
  },
  {
    id: 7,
    title: "iHeartRadio Music Festival 2025",
    description: "Two-day music festival featuring the biggest names in music",
    date: "2025-09-19",
    time: "19:00",
    location: "T-Mobile Arena, Las Vegas",
    attendees: 16800,
    maxCapacity: 20000,
    image: "https://images.unsplash.com/photo-1506157786151-b8491531f063?w=800&h=600&q=80",
    type: "festival",
    registrationLink: "https://www.iheart.com/festival"
  },
  {
    id: 8,
    title: "Latin Grammy Awards 2025",
    description: "Celebrating excellence in Latin music",
    date: "2025-11-14",
    time: "20:00",
    location: "Miami-Dade Arena, Miami",
    attendees: 19000,
    maxCapacity: 19000,
    image: "https://images.unsplash.com/photo-1598387993441-a364f854c3e1?w=800&h=600&q=80",
    type: "awards",
    registrationLink: "https://www.latingrammy.com/tickets"
  },
  {
    id: 9,
    title: "Ultra Music Festival 2025",
    description: "Premier electronic music festival",
    date: "2025-03-28",
    time: "16:00",
    location: "Bayfront Park, Miami",
    attendees: 165000,
    maxCapacity: 165000,
    image: "https://images.unsplash.com/photo-1598488035139-bdaa7543d5d6?w=800&h=600&q=80",
    type: "festival",
    registrationLink: "https://ultramusicfestival.com/tickets"
  },
  {
    id: 10,
    title: "BRIT Awards 2025",
    description: "The British Phonographic Industry's annual popular music awards",
    date: "2025-02-20",
    time: "20:00",
    location: "The O2 Arena, London",
    attendees: 20000,
    maxCapacity: 20000,
    image: "https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=800&h=600&q=80",
    type: "awards",
    registrationLink: "https://www.brits.co.uk/tickets"
  },
  {
    id: 11,
    title: "EDC Las Vegas 2025",
    description: "The largest electronic dance music festival in North America",
    date: "2025-05-16",
    time: "19:00",
    location: "Las Vegas Motor Speedway, Nevada",
    attendees: 165000,
    maxCapacity: 165000,
    image: "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=800&h=600&q=80",
    type: "festival",
    registrationLink: "https://www.edc.com/tickets"
  },
  {
    id: 12,
    title: "Rock & Roll Hall of Fame Ceremony 2025",
    description: "Annual ceremony honoring music's most influential artists",
    date: "2025-04-10",
    time: "19:30",
    location: "Barclays Center, Brooklyn",
    attendees: 18000,
    maxCapacity: 19000,
    image: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=800&h=600&q=80",
    type: "awards",
    registrationLink: "https://www.rockhall.com/tickets"
  },
  {
    id: 13,
    title: "Tomorrowland 2025",
    description: "World's premier electronic music festival",
    date: "2025-07-18",
    time: "12:00",
    location: "Boom, Belgium",
    attendees: 400000,
    maxCapacity: 400000,
    image: "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=800&h=600&q=80",
    type: "festival",
    registrationLink: "https://www.tomorrowland.com/tickets"
  },
  {
    id: 14,
    title: "ASCAP Music Awards 2025",
    description: "Celebrating excellence in music composition and songwriting",
    date: "2025-05-28",
    time: "20:00",
    location: "Dolby Theatre, Hollywood",
    attendees: 3400,
    maxCapacity: 3400,
    image: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&h=600&q=80",
    type: "awards",
    registrationLink: "https://www.ascap.com/awards"
  },
  {
    id: 15,
    title: "Global Music Business Summit 2025",
    description: "Leading conference for music industry professionals",
    date: "2025-09-05",
    time: "09:00",
    location: "Javits Center, New York",
    attendees: 25000,
    maxCapacity: 30000,
    image: "https://images.unsplash.com/photo-1531058020387-3be344556be6?w=800&h=600&q=80",
    type: "conference",
    registrationLink: "https://www.musicbusinesssummit.com"
  },
  {
    id: 16,
    title: "Rolling Loud Festival 2025",
    description: "World's largest hip-hop music festival",
    date: "2025-07-24",
    time: "14:00",
    location: "Hard Rock Stadium, Miami",
    attendees: 180000,
    maxCapacity: 180000,
    image: "https://images.unsplash.com/photo-1509824227185-9c5a01ceba0d?w=800&h=600&q=80",
    type: "festival",
    registrationLink: "https://www.rollingloud.com/tickets"
  },
  {
    id: 17,
    title: "Music Tech Innovation Forum",
    description: "Exploring the future of music technology",
    date: "2025-10-15",
    time: "10:00",
    location: "Moscone Center, San Francisco",
    attendees: 12000,
    maxCapacity: 15000,
    image: "https://images.unsplash.com/photo-1598387993441-a364f854c3e1?w=800&h=600&q=80",
    type: "conference",
    registrationLink: "https://www.musictechforum.com"
  },
  {
    id: 18,
    title: "Classical Music Awards 2025",
    description: "Honoring excellence in classical music performance",
    date: "2025-11-30",
    time: "19:00",
    location: "Carnegie Hall, New York",
    attendees: 2800,
    maxCapacity: 2800,
    image: "https://images.unsplash.com/photo-1520523839897-bd0b52f945a0?w=800&h=600&q=80",
    type: "awards",
    registrationLink: "https://www.classicalawards.com"
  },
  {
    id: 19,
    title: "Global DJ Expo 2025",
    description: "International gathering of DJs and electronic music producers",
    date: "2025-08-20",
    time: "11:00",
    location: "RAI Amsterdam, Netherlands",
    attendees: 45000,
    maxCapacity: 50000,
    image: "https://images.unsplash.com/photo-1571266028243-e4733261f025?w=800&h=600&q=80",
    type: "conference",
    registrationLink: "https://www.djexpo.com"
  },
  {
    id: 20,
    title: "Songwriters Hall of Fame 2025",
    description: "Annual induction ceremony for legendary songwriters",
    date: "2025-06-12",
    time: "20:00",
    location: "Marriott Marquis, New York",
    attendees: 1200,
    maxCapacity: 1500,
    image: "https://images.unsplash.com/photo-1507838153414-b4b713384a76?w=800&h=600&q=80",
    type: "awards",
    registrationLink: "https://www.songhall.org"
  }
];

interface Event {
  id: number;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  location: string;
  type: "concert" | "release" | "promotion" | "other";
  status: "upcoming" | "ongoing" | "completed" | "cancelled";
  createdAt: string;
  updatedAt: string;
  registrationLink?: string; 
}

export default function EventsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showCreateEventDialog, setShowCreateEventDialog] = useState(false);
  const [newEvent, setNewEvent] = useState({
    title: '',
    description: '',
    startDate: '',
    endDate: '',
    location: '',
    type: 'other' as const,
    status: 'upcoming' as const,
  });

  // Fetch events from the database
  const { data: dbEvents, isLoading } = useQuery<Event[]>({
    queryKey: ['events'],
    queryFn: async () => {
      const response = await fetch('/api/events');
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch events');
      }
      return response.json();
    }
  });

  // Create event mutation
  const createEventMutation = useMutation({
    mutationFn: async (eventData: typeof newEvent) => {
      logger.info('Creating event with data:', eventData);
      try {
        const response = await fetch('/api/events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...eventData,
            startDate: new Date(eventData.startDate).toISOString(),
            endDate: new Date(eventData.endDate).toISOString(),
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to create event');
        }

        const data = await response.json();
        return data;
      } catch (error) {
        logger.error('Event creation error:', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      setShowCreateEventDialog(false);
      toast({
        title: "Event Created",
        description: "Your event has been created successfully.",
      });
      setNewEvent({
        title: '',
        description: '',
        startDate: '',
        endDate: '',
        location: '',
        type: 'other',
        status: 'upcoming',
      });
    },
    onError: (error: Error) => {
      logger.error('Error creating event:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to create event. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Delete event mutation
  const deleteEventMutation = useMutation({
    mutationFn: async (eventId: number) => {
      const response = await fetch(`/api/events/${eventId}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete event');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      toast({
        title: "Event Deleted",
        description: "The event has been deleted successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to delete event. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleCreateEvent = async () => {
    if (!newEvent.title || !newEvent.startDate || !newEvent.endDate) {
      toast({
        title: "Missing Fields",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    try {
      await createEventMutation.mutateAsync(newEvent);
    } catch (error) {
      logger.error('Error in handleCreateEvent:', error);
    }
  };

  const handleDeleteEvent = async (eventId: number) => {
    if (window.confirm('Are you sure you want to delete this event?')) {
      deleteEventMutation.mutate(eventId);
    }
  };

  // Combine sample events with database events
  const allEvents = [
    ...(dbEvents || []),
    ...majorEventsData.map(event => ({
      ...event,
      startDate: event.date,
      endDate: event.date,
      type: 'other' as const,
      status: 'upcoming' as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }))
  ];

  const chartData = {
    monthlyAttendance: Array.from({ length: 12 }, (_, month) => ({
      month: new Date(2025, month).toLocaleString('default', { month: 'short' }),
      attendance: Math.floor(Math.random() * 50000 + 10000),
    })),
    eventTypes: [
      { name: 'Awards Shows', value: 45 },
      { name: 'Music Festivals', value: 30 },
      { name: 'Conferences', value: 15 },
      { name: 'Industry Events', value: 10 },
    ],
    venueCapacity: [
      { venue: 'Crypto.com Arena', capacity: 20000 },
      { venue: 'O2 Arena', capacity: 20000 },
      { venue: 'Madison Square Garden', capacity: 18000 },
      { venue: 'Barclays Center', capacity: 19000 },
    ]
  };

  const COLORS = ['#f97316', '#ea580c', '#c2410c', '#9a3412'];

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <ScrollArea className="flex-1">
        <div className="container mx-auto px-4 py-6 pt-20">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-orange-500 to-orange-500/70">
                Industry Events
              </h1>
              <p className="text-muted-foreground mt-2">
                Discover and manage major music industry events
              </p>
            </div>
            <Dialog open={showCreateEventDialog} onOpenChange={setShowCreateEventDialog}>
              <DialogTrigger asChild>
                <Button className="bg-orange-500 hover:bg-orange-600">
                  <Plus className="mr-2 h-4 w-4" />
                  Create Event
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New Event</DialogTitle>
                  <DialogDescription>
                    Fill in the details below to create a new event.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="title">Event Title *</Label>
                    <Input
                      id="title"
                      value={newEvent.title}
                      onChange={(e) => setNewEvent({...newEvent, title: e.target.value})}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={newEvent.description}
                      onChange={(e) => setNewEvent({...newEvent, description: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label htmlFor="startDate">Start Date *</Label>
                    <Input
                      id="startDate"
                      type="datetime-local"
                      value={newEvent.startDate}
                      onChange={(e) => setNewEvent({...newEvent, startDate: e.target.value})}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="endDate">End Date *</Label>
                    <Input
                      id="endDate"
                      type="datetime-local"
                      value={newEvent.endDate}
                      onChange={(e) => setNewEvent({...newEvent, endDate: e.target.value})}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="location">Location *</Label>
                    <Input
                      id="location"
                      value={newEvent.location}
                      onChange={(e) => setNewEvent({...newEvent, location: e.target.value})}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="type">Event Type</Label>
                    <select
                      id="type"
                      className="w-full rounded-md border border-input bg-background px-3 py-2"
                      value={newEvent.type}
                      onChange={(e) => setNewEvent({...newEvent, type: e.target.value as any})}
                    >
                      <option value="concert">Concert</option>
                      <option value="release">Release</option>
                      <option value="promotion">Promotion</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <Button 
                    className="w-full bg-orange-500 hover:bg-orange-600"
                    onClick={handleCreateEvent}
                    disabled={createEventMutation.isPending}
                  >
                    {createEventMutation.isPending ? 'Creating...' : 'Create Event'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <Tabs defaultValue="upcoming" className="w-full mb-8">
            <TabsList className="mb-4">
              <TabsTrigger value="upcoming">Upcoming Events</TabsTrigger>
              <TabsTrigger value="past">Past Events</TabsTrigger>
              <TabsTrigger value="my-events">My Events</TabsTrigger>
            </TabsList>

            <TabsContent value="upcoming">
              <div className="grid gap-6">
                {isLoading ? (
                  <div>Loading events...</div>
                ) : (
                  allEvents.map((event) => (
                    <Card key={event.id} className="p-6">
                      <div className="flex flex-col md:flex-row gap-6">
                        <div className="flex-1">
                          <div className="flex justify-between items-start">
                            <div>
                              <h3 className="text-xl font-semibold mb-2">{event.title}</h3>
                              <p className="text-muted-foreground mb-4">{event.description}</p>
                            </div>
                            <div className="flex gap-2">
                              {event.registrationLink && (
                                <Button 
                                  variant="outline"
                                  onClick={() => window.open(event.registrationLink, '_blank')}
                                >
                                  Register
                                </Button>
                              )}
                              {event.type !== 'other' && (
                                <Button 
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => handleDeleteEvent(event.id)}
                                  disabled={deleteEventMutation.isPending}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-muted-foreground">
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4" />
                              {format(new Date(event.startDate), 'MM/dd/yyyy')}
                            </div>
                            <div className="flex items-center gap-2">
                              <Clock className="h-4 w-4" />
                              {format(new Date(event.startDate), 'HH:mm')}
                            </div>
                            <div className="flex items-center gap-2">
                              <MapPin className="h-4 w-4" />
                              {event.location}
                            </div>
                            <div className="flex items-center gap-2">
                              <Activity className="h-4 w-4" />
                              {event.type}
                            </div>
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))
                )}
              </div>
            </TabsContent>

            <TabsContent value="my-events">
              <div className="grid gap-6">
                {isLoading ? (
                  <div>Loading your events...</div>
                ) : (
                  (dbEvents || []).map((event) => (
                    <Card key={event.id} className="p-6">
                      <div className="flex flex-col md:flex-row gap-6">
                        <div className="flex-1">
                          <div className="flex justify-between items-start">
                            <div>
                              <h3 className="text-xl font-semibold mb-2">{event.title}</h3>
                              <p className="text-muted-foreground mb-4">{event.description}</p>
                            </div>
                            <Button 
                              variant="destructive"
                              size="sm"
                              onClick={() => handleDeleteEvent(event.id)}
                              disabled={deleteEventMutation.isPending}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-muted-foreground">
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4" />
                              {format(new Date(event.startDate), 'MM/dd/yyyy')}
                            </div>
                            <div className="flex items-center gap-2">
                              <Clock className="h-4 w-4" />
                              {format(new Date(event.startDate), 'HH:mm')}
                            </div>
                            <div className="flex items-center gap-2">
                              <MapPin className="h-4 w-4" />
                              {event.location}
                            </div>
                            <div className="flex items-center gap-2">
                              <Activity className="h-4 w-4" />
                              {event.type}
                            </div>
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))
                )}
              </div>
            </TabsContent>
          </Tabs>

          {/* Analytics Section */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card className="p-6">
              <h3 className="text-xl font-semibold mb-4">Monthly Attendance</h3>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData.monthlyAttendance}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip 
                      contentStyle={{
                        backgroundColor: 'hsl(var(--background))',
                        border: '1px solid hsl(var(--border))',
                      }}
                    />
                    <Bar dataKey="attendance" fill="hsl(24, 95%, 53%)" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card className="p-6">
              <h3 className="text-xl font-semibold mb-4">Event Distribution</h3>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <RePieChart>
                    <Pie
                      data={chartData.eventTypes}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {chartData.eventTypes.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </RePieChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card className="p-6">
              <h3 className="text-xl font-semibold mb-4">Venue Capacities</h3>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData.venueCapacity} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="venue" type="category" width={100} />
                    <Tooltip                      contentStyle={{
                        backgroundColor: 'hsl(var(--background))',
                        border: '1px solid hsl(var(--border))',
                      }}
                    />
                    <Bar dataKey="capacity" fill="hsl(24, 95%, 53%)" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}