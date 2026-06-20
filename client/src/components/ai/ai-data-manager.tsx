import { useState } from "react";
import { logger } from "@/lib/logger";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../../hooks/use-auth";
import { useToast } from "../../hooks/use-toast";
import { db } from "../../lib/firebase";
import { collection, query, where, getDocs, deleteDoc, doc } from "firebase/firestore";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell, LineChart, Line, AreaChart, Area } from 'recharts';
import html2pdf from 'html2pdf.js';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { ScrollArea } from "../ui/scroll-area";

const AI_COLLECTIONS = [
  { id: 'Video_Director_AI', name: 'Video Director', color: '#FF6B6B' },
  { id: 'AI_Music_Composer', name: 'Music Composer', color: '#4ECDC4' },
  { id: 'Strategic_Marketing_AI', name: 'Marketing Strategy', color: '#45B7D1' },
  { id: 'Social_Media_AI', name: 'Social Media', color: '#96CEB4' },
  { id: 'Merchandise_Designer_AI', name: 'Merchandise Design', color: '#FFEEAD' },
  { id: 'Manager_AI', name: 'Career Manager', color: '#D4A5A5' }
];

const COLORS = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEEAD', '#D4A5A5'];

const CustomLabel = ({ x, y, name, value }) => {
  return (
    <text x={x} y={y} fill="#888" fontSize={12} textAnchor="middle">
      {`${name}: ${value}`}
    </text>
  );
};

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-background/95 backdrop-blur-sm border p-2 rounded-lg shadow-lg">
        <p className="text-sm font-medium">{`${label}`}</p>
        <p className="text-sm text-muted-foreground">{`Value: ${payload[0].value}`}</p>
      </div>
    );
  }
  return null;
};

export function AIDataManager() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedCollection, setSelectedCollection] = useState(AI_COLLECTIONS[0].id);

  // Fetch data from all collections
  const fetchCollectionData = async (collectionId: string) => {
    if (!user) return [];
    const collectionRef = collection(db, collectionId);
    const q = query(collectionRef, where("userId", "==", user.uid));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      collectionId,
      ...doc.data(),
    }));
  };

  // Fetch all AI data
  const { data: allAiData = [], isLoading } = useQuery({
    queryKey: ['all-ai-data', user?.uid],
    queryFn: async () => {
      if (!user) return [];
      const allData = await Promise.all(
        AI_COLLECTIONS.map(col => fetchCollectionData(col.id))
      );
      return allData.flat();
    },
    enabled: !!user
  });

  // Filtered data for selected collection
  const aiData = allAiData.filter(item => item.collectionId === selectedCollection);

  // Data processing for charts
  const usageByDate = allAiData.reduce((acc: any[], item) => {
    const date = new Date(item.timestamp?.seconds * 1000).toLocaleDateString();
    const existing = acc.find(x => x.date === date);
    if (existing) {
      existing.interactions++;
    } else {
      acc.push({ date, interactions: 1 });
    }
    return acc;
  }, []);

  // Distribution by AI type
  const distributionData = AI_COLLECTIONS.map(collection => ({
    name: collection.name,
    value: allAiData.filter(item => item.collectionId === collection.id).length,
    color: collection.color
  }));

  // Usage by hour
  const hourlyUsage = allAiData.reduce((acc: any[], item) => {
    const hour = new Date(item.timestamp?.seconds * 1000).getHours();
    const existing = acc.find(x => x.hour === hour);
    if (existing) {
      existing.count++;
    } else {
      acc.push({ hour, count: 1 });
    }
    return acc.sort((a, b) => a.hour - b.hour);
  }, []);

  // Weekly trend
  const weeklyTrend = usageByDate.slice(-7);

  const handleDownload = async (item: any) => {
    const contentTypeLabel = selectedCollection === 'Video_Director_AI' ? 'Script' :
      selectedCollection === 'AI_Music_Composer' ? 'Music & Lyrics' :
      selectedCollection === 'Strategic_Marketing_AI' ? 'Strategy' :
      selectedCollection === 'Social_Media_AI' ? 'Content' :
      selectedCollection === 'Merchandise_Designer_AI' ? 'Design' : 'Advice';

    const content = document.createElement('div');
    content.innerHTML = `
      <div style="font-family: Arial, sans-serif; color: #000000; background-color: #ffffff; padding: 40px; max-width: 800px; margin: 0 auto;">
        <div style="border-bottom: 2px solid #f97316; padding-bottom: 20px; margin-bottom: 30px;">
          <h1 style="color: #000000; font-size: 24px; margin: 0;">${AI_COLLECTIONS.find(c => c.id === selectedCollection)?.name}</h1>
          <p style="color: #666666; margin: 10px 0 0 0;">Generated on: ${new Date(item.timestamp?.seconds * 1000).toLocaleString()}</p>
        </div>
        <div style="margin-bottom: 30px;">
          <h2 style="color: #000000; font-size: 20px; margin: 0 0 15px 0;">${contentTypeLabel}</h2>
          <div style="background-color: #f8f9fa; border: 1px solid #e9ecef; padding: 20px; border-radius: 6px;">
            <pre style="white-space: pre-wrap; font-family: 'Courier New', monospace; font-size: 14px; line-height: 1.5; color: #000000; margin: 0;">
${item.script || item.strategy || item.content || item.design || item.advice || 'No content available'}
            </pre>
          </div>
        </div>
        <div style="color: #666666; font-size: 12px; text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e9ecef;">
          Generated by ${AI_COLLECTIONS.find(c => c.id === selectedCollection)?.name} - AI Assistant
        </div>
      </div>
    `;

    const opt = {
      margin: 1,
      filename: `${selectedCollection}_${item.id}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { 
        scale: 2,
        backgroundColor: '#ffffff'
      },
      jsPDF: { 
        unit: 'in', 
        format: 'letter', 
        orientation: 'portrait',
        putOnlyUsedFonts: true
      }
    };

    try {
      document.body.appendChild(content);
      await html2pdf().set(opt).from(content).save();
      document.body.removeChild(content);

      toast({
        title: "Success",
        description: "PDF downloaded successfully",
      });
    } catch (error) {
      logger.error('Error generating PDF:', error);
      toast({
        title: "Error",
        description: "Failed to generate PDF. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, selectedCollection, id));
      toast({
        title: "Content Deleted",
        description: "The content has been successfully deleted.",
      });
      //refetch(); //Removed refetch as it's handled by useQuery's automatic refetch on data change.
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete content. Please try again.",
        variant: "destructive",
      });
    }
  };

  if (!user) {
    return (
      <div className="p-4">
        <h2 className="text-xl font-bold">Please log in to view your AI content.</h2>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-0">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold">AI Content Manager</h1>
        <Select
          value={selectedCollection}
          onValueChange={setSelectedCollection}
        >
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Select AI Type" />
          </SelectTrigger>
          <SelectContent>
            {AI_COLLECTIONS.map((collection) => (
              <SelectItem key={collection.id} value={collection.id}>
                {collection.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center min-h-[200px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
            <Card className="p-4 sm:p-6 bg-black/20 backdrop-blur">
              <h3 className="text-base sm:text-lg font-semibold mb-2">Total Items</h3>
              <p className="text-2xl sm:text-3xl font-bold text-orange-500">{allAiData.length}</p>
            </Card>
            <Card className="p-4 sm:p-6 bg-black/20 backdrop-blur">
              <h3 className="text-base sm:text-lg font-semibold mb-2">Last Creation</h3>
              <p className="text-xs sm:text-sm text-muted-foreground">
                {allAiData[0]?.timestamp ? new Date(allAiData[0].timestamp.seconds * 1000).toLocaleDateString() : 'N/A'}
              </p>
            </Card>
            <Card className="p-4 sm:p-6 bg-black/20 backdrop-blur sm:col-span-2 md:col-span-1">
              <h3 className="text-base sm:text-lg font-semibold mb-2">Usage Today</h3>
              <p className="text-2xl sm:text-3xl font-bold text-orange-500">
                {usageByDate.find(item => item.date === new Date().toLocaleDateString())?.interactions || 0}
              </p>
            </Card>
          </div>

          <div className="grid gap-6">
            <Card className="overflow-hidden border-none shadow-xl">
              <div className="p-4 sm:p-6">
                <h2 className="text-lg sm:text-xl font-semibold mb-4">Usage Analytics</h2>
                <div className="w-full h-[200px] sm:h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={usageByDate} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorUv" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f97316" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="#f97316" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="date" 
                        tick={{ fontSize: 10 }}
                        interval="preserveStartEnd"
                        angle={-45}
                        textAnchor="end"
                        height={50}
                      />
                      <YAxis tick={{ fontSize: 10 }} width={30} />
                      <Tooltip content={<CustomTooltip />} />
                      <Area 
                        type="monotone" 
                        dataKey="interactions" 
                        stroke="#f97316" 
                        fillOpacity={1} 
                        fill="url(#colorUv)" 
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </Card>

            <div className="grid gap-6 sm:grid-cols-2">
              <Card className="overflow-hidden border-none shadow-xl">
                <div className="p-4 sm:p-6">
                  <h2 className="text-lg sm:text-xl font-semibold mb-4">Content Distribution</h2>
                  <div className="w-full h-[200px] sm:h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                        <Pie
                          data={distributionData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name.split(' ')[0]} ${(percent * 100).toFixed(0)}%`}
                          outerRadius={({ cy }) => Math.min(cy * 0.8, 80)}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {distributionData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </Card>

              <Card className="overflow-hidden border-none shadow-xl">
                <div className="p-4 sm:p-6">
                  <h2 className="text-lg sm:text-xl font-semibold mb-4">Usage by Hour</h2>
                  <div className="w-full h-[200px] sm:h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={hourlyUsage} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis 
                          dataKey="hour" 
                          tick={{ fontSize: 10 }}
                          ticks={[0,4,8,12,16,20,23]}
                        />
                        <YAxis tick={{ fontSize: 10 }} width={30} />
                        <Tooltip content={<CustomTooltip />} />
                        <Line 
                          type="monotone" 
                          dataKey="count" 
                          stroke="#f97316" 
                          strokeWidth={2}
                          dot={{ r: 2 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </Card>
            </div>
          </div>

          <Card className="overflow-hidden border-none shadow-xl">
            <div className="p-4 sm:p-6">
              <h2 className="text-lg sm:text-xl font-semibold mb-4">Content List</h2>
              <ScrollArea className="h-[400px] sm:h-[500px]">
                <div className="space-y-4">
                  {aiData.map((item: any) => (
                    <Card key={item.id} className="p-3 sm:p-4 bg-black/20 backdrop-blur hover:bg-black/30 transition-colors">
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4">
                        <div className="space-y-2 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs sm:text-sm text-muted-foreground">
                              {new Date(item.timestamp?.seconds * 1000).toLocaleString()}
                            </span>
                          </div>
                          <div className="prose prose-invert max-w-none">
                            <pre className="whitespace-pre-wrap text-xs sm:text-sm bg-transparent">
                              {item.script || item.strategy || item.content || item.design || item.advice}
                            </pre>
                          </div>
                        </div>
                        <div className="flex sm:flex-col gap-2">
                          <Button
                            onClick={() => handleDownload(item)}
                            variant="outline"
                            size="sm"
                            className="flex-1 sm:flex-none text-xs sm:text-sm py-1 h-8"
                          >
                            Download
                          </Button>
                          <Button
                            onClick={() => handleDelete(item.id)}
                            variant="destructive"
                            size="sm"
                            className="flex-1 sm:flex-none text-xs sm:text-sm py-1 h-8"
                          >
                            Delete
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}