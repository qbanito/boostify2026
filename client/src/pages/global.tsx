// Importaciones estandarizadas usando rutas absolutas con alias @/
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { ScrollArea } from "../components/ui/scroll-area";
import { Header } from "../components/layout/header";
import { Activity, Globe, Map, Flag, Users, TrendingUp, Music2, Radio } from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  BarChart,
  Bar
} from 'recharts';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";

const COLORS = ['#f97316', '#ea580c', '#c2410c', '#9a3412'];

const regionData = [
  { name: 'North America', value: 35 },
  { name: 'Europe', value: 30 },
  { name: 'Asia Pacific', value: 25 },
  { name: 'Latin America', value: 10 },
];

const platformData = [
  { platform: 'Spotify', streams: 8500 },
  { platform: 'Apple Music', streams: 6200 },
  { platform: 'YouTube Music', streams: 4800 },
  { platform: 'Amazon Music', streams: 3500 },
];

const monthlyGrowth = Array.from({ length: 12 }, (_, i) => ({
  month: new Date(2025, i).toLocaleString('default', { month: 'short' }),
  listeners: Math.floor(Math.random() * 50000 + 10000),
  engagement: Math.floor(Math.random() * 30000 + 5000),
}));

export default function GlobalPage() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <ScrollArea className="flex-1">
        <div className="container mx-auto px-4 py-6 pt-20">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-orange-500 to-orange-500/70">
                Global Reach
              </h1>
              <p className="text-muted-foreground mt-2">
                Monitor your worldwide audience and impact
              </p>
            </div>
            <div className="flex items-center gap-4">
              <Select defaultValue="all">
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Select Region" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Regions</SelectItem>
                  <SelectItem value="na">North America</SelectItem>
                  <SelectItem value="eu">Europe</SelectItem>
                  <SelectItem value="ap">Asia Pacific</SelectItem>
                  <SelectItem value="la">Latin America</SelectItem>
                </SelectContent>
              </Select>
              <Button className="bg-orange-500 hover:bg-orange-600">
                <Globe className="mr-2 h-4 w-4" />
                Global Overview
              </Button>
            </div>
          </div>

          {/* Global Stats Cards */}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <Card className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-orange-500/10 rounded-lg">
                  <Users className="h-6 w-6 text-orange-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Monthly Listeners</p>
                  <p className="text-2xl font-bold">2.5M</p>
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-orange-500/10 rounded-lg">
                  <Globe className="h-6 w-6 text-orange-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Active Countries</p>
                  <p className="text-2xl font-bold">85+</p>
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-orange-500/10 rounded-lg">
                  <Music2 className="h-6 w-6 text-orange-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Streams</p>
                  <p className="text-2xl font-bold">12.8M</p>
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-orange-500/10 rounded-lg">
                  <Radio className="h-6 w-6 text-orange-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Radio Plays</p>
                  <p className="text-2xl font-bold">450K</p>
                </div>
              </div>
            </Card>
          </div>

          {/* Charts Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card className="p-6">
              <div className="mb-6">
                <h3 className="text-xl font-semibold">Monthly Growth</h3>
                <p className="text-sm text-muted-foreground">
                  Track listener and engagement trends
                </p>
              </div>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={monthlyGrowth}>
                    <defs>
                      <linearGradient id="colorGrowth" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(24, 95%, 53%)" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="hsl(24, 95%, 53%)" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="month" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--background))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="listeners"
                      name="Listeners"
                      stroke="hsl(24, 95%, 53%)"
                      fillOpacity={1}
                      fill="url(#colorGrowth)"
                    />
                    <Area
                      type="monotone"
                      dataKey="engagement"
                      name="Engagement"
                      stroke="hsl(24, 95%, 53%)"
                      fillOpacity={0.5}
                      fill="url(#colorGrowth)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card className="p-6">
              <div className="mb-6">
                <h3 className="text-xl font-semibold">Regional Distribution</h3>
                <p className="text-sm text-muted-foreground">
                  Audience distribution by region
                </p>
              </div>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={regionData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {regionData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card className="p-6">
              <div className="mb-6">
                <h3 className="text-xl font-semibold">Platform Performance</h3>
                <p className="text-sm text-muted-foreground">
                  Streaming performance by platform
                </p>
              </div>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={platformData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="platform" />
                    <YAxis />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--background))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                    <Bar dataKey="streams" fill="hsl(24, 95%, 53%)" />
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