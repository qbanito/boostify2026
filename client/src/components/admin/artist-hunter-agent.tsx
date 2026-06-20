import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Badge } from "../ui/badge";
import { Textarea } from "../ui/textarea";
import { ScrollArea } from "../ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../ui/dialog";
import { useToast } from "../../hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "../../lib/queryClient";
import { 
  Upload, Users, Search, BarChart3, CheckCircle, XCircle, 
  FileJson, Globe, Loader2, Download, Shield, Music,
  Guitar, Drum, Piano, Mic2, Headphones
} from "lucide-react";

const INSTRUMENT_ICONS: Record<string, any> = {
  Guitar, Drums: Drum, Piano, Vocals: Mic2, Production: Headphones, Bass: Guitar,
};

const SAMPLE_CSV_DATA = `name,instrument,category,price,genres,city,country,description,rating
John Mayer Jr,Guitar,Guitar,150,"Blues;Rock;Pop",Los Angeles,USA,Session guitarist with 10 years of studio experience,4.8
Maria Drums,Drums,Drums,120,"Latin;Jazz;Funk",Miami,USA,Latin percussion specialist with Berklee degree,4.7
Chen Wei Piano,Piano,Piano,180,"Classical;Jazz;Film Score",New York,USA,Concert pianist and film composer,4.9`;

export function ArtistHunterAgent() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [importTab, setImportTab] = useState("json");
  const [jsonInput, setJsonInput] = useState("");
  const [csvInput, setCsvInput] = useState("");

  // Fetch stats
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["/api/service-requests/admin/musicians/stats"],
    queryFn: () => apiRequest("GET", "/api/service-requests/admin/musicians/stats"),
  });

  // Fetch import history
  const { data: imports } = useQuery({
    queryKey: ["/api/service-requests/admin/musicians/imports"],
    queryFn: () => apiRequest("GET", "/api/service-requests/admin/musicians/imports"),
  });

  // Fetch all musicians
  const { data: musiciansData, isLoading: musiciansLoading } = useQuery({
    queryKey: ["/api/musicians"],
    queryFn: () => apiRequest("GET", "/api/musicians?isActive=all"),
  });

  // Import mutation
  const importMutation = useMutation({
    mutationFn: (data: { musicians: any[]; source: string }) =>
      apiRequest("POST", "/api/service-requests/admin/musicians/import", data),
    onSuccess: (result: any) => {
      toast({
        title: "Import Complete",
        description: `${result.data?.imported || 0} musicians imported, ${result.data?.errors || 0} errors`,
      });
      queryClient.invalidateQueries({
        predicate: (q) => {
          const k = String(q.queryKey?.[0] || '');
          return k === '/api/musicians' || k.startsWith('/api/service-requests/admin/musicians');
        },
      });
      setJsonInput("");
      setCsvInput("");
    },
    onError: (error: any) => {
      toast({ title: "Import Failed", description: error.message, variant: "destructive" });
    },
  });

  // Verify mutation
  const verifyMutation = useMutation({
    mutationFn: (musicianId: number) =>
      apiRequest("PATCH", `/api/service-requests/admin/musicians/${musicianId}/verify`),
    onSuccess: () => {
      toast({ title: "Musician Verified" });
      queryClient.invalidateQueries({
        predicate: (q) => {
          const k = String(q.queryKey?.[0] || '');
          return k === '/api/musicians' || k === '/api/service-requests/admin/musicians/stats';
        },
      });
    },
  });

  const handleJsonImport = () => {
    try {
      const parsed = JSON.parse(jsonInput);
      const musiciansList = Array.isArray(parsed) ? parsed : [parsed];
      importMutation.mutate({ musicians: musiciansList, source: "json" });
    } catch {
      toast({ title: "Invalid JSON", description: "Please check your JSON format", variant: "destructive" });
    }
  };

  const handleCsvImport = () => {
    try {
      const lines = csvInput.trim().split("\n");
      if (lines.length < 2) throw new Error("Need header + at least 1 row");
      
      const headers = lines[0].split(",").map(h => h.trim());
      const musiciansList = lines.slice(1).map(line => {
        const values = line.split(",").map(v => v.trim().replace(/^"|"$/g, ""));
        const obj: any = {};
        headers.forEach((h, i) => {
          if (h === "genres") {
            obj[h] = values[i]?.split(";").map((g: string) => g.trim()) || [];
          } else if (h === "price" || h === "rating") {
            obj[h] = parseFloat(values[i]) || 0;
          } else {
            obj[h] = values[i] || "";
          }
        });
        return obj;
      });
      
      importMutation.mutate({ musicians: musiciansList, source: "csv" });
    } catch (err: any) {
      toast({ title: "CSV Parse Error", description: err.message, variant: "destructive" });
    }
  };

  const statsData = stats?.data;
  const allMusicians = musiciansData?.data || [];
  const importHistory = imports?.data || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-orange-400 flex items-center gap-2">
            <Search className="h-5 w-5 sm:h-6 sm:w-6" />
            <span className="hidden sm:inline">Boostify Artist Hunter Agent</span>
            <span className="sm:hidden">Artist Hunter</span>
          </h2>
          <p className="text-slate-400 text-xs sm:text-sm mt-1">
            Import, manage, and verify real musicians for the Producer Tools marketplace
          </p>
        </div>
      </div>

      {/* Stats Dashboard */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
        {[
          { label: "Total Musicians", value: statsData?.totalMusicians || 0, icon: Users, color: "text-blue-400" },
          { label: "Active", value: statsData?.activeMusicians || 0, icon: CheckCircle, color: "text-green-400" },
          { label: "Verified", value: statsData?.verifiedMusicians || 0, icon: Shield, color: "text-yellow-400" },
          { label: "Open Requests", value: statsData?.openRequests || 0, icon: Music, color: "text-purple-400" },
          { label: "Total Requests", value: statsData?.totalRequests || 0, icon: BarChart3, color: "text-orange-400" },
          { label: "Total Bids", value: statsData?.totalBids || 0, icon: Globe, color: "text-cyan-400" },
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label} className="bg-slate-800/50 border-slate-700">
              <CardContent className="pt-4 pb-3 px-3">
                <div className="flex items-center gap-2 mb-1">
                  <Icon className={`h-4 w-4 ${stat.color}`} />
                  <span className="text-xs text-slate-400">{stat.label}</span>
                </div>
                <p className="text-xl font-bold text-white">
                  {statsLoading ? "..." : stat.value}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Category Breakdown */}
      {statsData?.byCategory && (
        <Card className="bg-slate-900/80 border-orange-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-400">Musicians by Category</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {statsData.byCategory.map((cat: any) => (
                <Badge key={cat.category} variant="outline" className="border-orange-500/30 text-orange-300">
                  {cat.category}: {cat.count}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Import Section */}
      <Card className="bg-slate-900/80 border-orange-500/20">
        <CardHeader>
          <CardTitle className="text-orange-400 flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Import Musicians Database
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={importTab} onValueChange={setImportTab}>
            <TabsList className="bg-slate-800">
              <TabsTrigger value="json" className="data-[state=active]:bg-orange-500 data-[state=active]:text-white">
                <FileJson className="h-4 w-4 mr-1" /> JSON
              </TabsTrigger>
              <TabsTrigger value="csv" className="data-[state=active]:bg-orange-500 data-[state=active]:text-white">
                <Download className="h-4 w-4 mr-1" /> CSV
              </TabsTrigger>
            </TabsList>

            <TabsContent value="json" className="space-y-3">
              <Label>Paste JSON array of musicians</Label>
              <Textarea
                value={jsonInput}
                onChange={(e) => setJsonInput(e.target.value)}
                placeholder={`[{\n  "name": "John Smith",\n  "instrument": "Guitar",\n  "category": "Guitar",\n  "price": 120,\n  "genres": ["Rock", "Blues"],\n  "city": "Los Angeles",\n  "country": "USA",\n  "description": "Session guitarist",\n  "rating": 4.8\n}]`}
                className="h-48 font-mono text-xs bg-slate-800 border-slate-600"
              />
              <Button
                onClick={handleJsonImport}
                disabled={importMutation.isPending || !jsonInput.trim()}
                className="bg-orange-500 hover:bg-orange-600"
              >
                {importMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                Import JSON
              </Button>
            </TabsContent>

            <TabsContent value="csv" className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Paste CSV data (with headers)</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCsvInput(SAMPLE_CSV_DATA)}
                  className="text-xs text-orange-400"
                >
                  Load Sample
                </Button>
              </div>
              <Textarea
                value={csvInput}
                onChange={(e) => setCsvInput(e.target.value)}
                placeholder="name,instrument,category,price,genres,city,country,description,rating"
                className="h-48 font-mono text-xs bg-slate-800 border-slate-600"
              />
              <Button
                onClick={handleCsvImport}
                disabled={importMutation.isPending || !csvInput.trim()}
                className="bg-orange-500 hover:bg-orange-600"
              >
                {importMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                Import CSV
              </Button>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Import History */}
      {importHistory.length > 0 && (
        <Card className="bg-slate-900/80 border-orange-500/20">
          <CardHeader>
            <CardTitle className="text-sm text-slate-400">Import History</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-48">
              <div className="space-y-2">
                {importHistory.map((imp: any) => (
                  <div key={imp.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1 sm:gap-0 p-2 bg-slate-800/50 rounded border border-slate-700">
                    <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                      <Badge variant={imp.status === "completed" ? "default" : "destructive"} className="text-xs">
                        {imp.status}
                      </Badge>
                      <span className="text-sm text-white">{imp.source.toUpperCase()}</span>
                      <span className="text-xs text-slate-400">
                        {imp.successCount}/{imp.totalRecords} imported
                      </span>
                    </div>
                    <span className="text-xs text-slate-500">
                      {new Date(imp.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Musicians List */}
      <Card className="bg-slate-900/80 border-orange-500/20">
        <CardHeader>
          <CardTitle className="text-orange-400 flex items-center gap-2">
            <Users className="h-5 w-5" />
            All Musicians ({allMusicians.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {musiciansLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-orange-400" />
            </div>
          ) : (
            <ScrollArea className="h-[400px]">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {allMusicians.map((m: any) => (
                  <div key={m.id} className="p-3 bg-slate-800/50 rounded-lg border border-slate-700 flex gap-3">
                    <img
                      src={m.photo}
                      alt={m.name}
                      className="w-12 h-12 rounded-full object-cover flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white truncate">{m.name}</span>
                        {m.isVerified && <Shield className="h-3 w-3 text-yellow-400" />}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-xs border-slate-600">{m.category}</Badge>
                        <span className="text-xs text-slate-400">${m.price}</span>
                        <span className="text-xs text-yellow-400">⭐ {m.rating}</span>
                      </div>
                      <div className="flex gap-1 mt-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 text-xs text-green-400 hover:text-green-300"
                          onClick={() => verifyMutation.mutate(m.id)}
                        >
                          <Shield className="h-3 w-3 mr-1" /> Verify
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
