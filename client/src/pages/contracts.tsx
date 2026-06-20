import { useState, useEffect, useMemo, useRef } from "react";
import { logger } from "../lib/logger";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Header } from "../components/layout/header";
import { PlanTierGuard } from "../components/youtube-views/plan-tier-guard";
import { ArtistLandingPage } from "../components/artist/artist-landing-page";
import { isAdminEmail } from "../../../shared/constants";
import { useUser, useAuth } from "@clerk/clerk-react";
import { ContractForm, type ContractFormValues } from "../components/contracts/contract-form";
import { 
  generateContract, 
  analyzeContract,
  getContractTemplates,
  generateFromTemplate,
  saveContract, 
  getUserContracts, 
  deleteContract, 
  updateContract, 
  setContractsAuthToken,
  askLegalAssistant,
  getRiskShieldReport,
  type Contract,
  type ContractTemplate,
  type LegalAssistantResponse,
  type RiskShieldReport,
  type LegalRedFlag
} from "../lib/gemini-contracts";
import html2pdf from 'html2pdf.js';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../components/ui/alert-dialog";
import {
  FileText, Plus, Download, Edit, Trash2, Eye, MoreVertical, CheckCircle2,
  Clock, AlertCircle, FileDown, Brain, Scale, Sparkles, Shield, Users,
  Send, Loader2, ShieldAlert, ShieldCheck, ShieldQuestion, Lightbulb, Gavel, Globe2, Music2, AlertTriangle,
  Search, X, ChevronRight, Copy, PenLine, Star, ArrowUpDown, SlidersHorizontal, Filter
} from "lucide-react";
import { ScrollArea } from "../components/ui/scroll-area";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "../components/ui/dropdown-menu";
import { Badge } from "../components/ui/badge";
import { useToast } from "../hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Textarea } from "../components/ui/textarea";

export default function ContractsPage() {
  const { toast } = useToast();
  const { user: clerkUser, isSignedIn } = useUser();
  const { getToken } = useAuth();
  const [isGenerating, setIsGenerating] = useState(false);
  const [showNewContractDialog, setShowNewContractDialog] = useState(false);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
  const [editedContent, setEditedContent] = useState("");
  const [generatedContract, setGeneratedContract] = useState<string | null>(null);
  const [contractTitle, setContractTitle] = useState<string>("");
  const queryClient = useQueryClient();
  const [contractToAnalyze, setContractToAnalyze] = useState("");
  const [analysisResult, setAnalysisResult] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedTab, setSelectedTab] = useState("contracts");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [generatedContractType, setGeneratedContractType] = useState<string>("legal");
  type AnalysisData = { summary: string; risks: string[]; recommendations: string[]; keyTerms: { term: string; description: string }[] } | null;
  const [analysisData, setAnalysisData] = useState<AnalysisData>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // ─── Legal Shield AI ───
  type LegalChatTurn = { role: 'user' | 'assistant'; content: string; meta?: LegalAssistantResponse };
  const [legalQuestion, setLegalQuestion] = useState("");
  const [legalChat, setLegalChat] = useState<LegalChatTurn[]>([]);
  const [isAskingLegal, setIsAskingLegal] = useState(false);
  const [attachedContract, setAttachedContract] = useState<Contract | null>(null);
  const [shieldReport, setShieldReport] = useState<RiskShieldReport | null>(null);
  const [isAuditingShield, setIsAuditingShield] = useState(false);

  // Set up auth token for contracts API
  useEffect(() => {
    if (getToken) {
      setContractsAuthToken(getToken);
    }
  }, [getToken]);

  // Check if user is admin
  const userEmail = clerkUser?.primaryEmailAddress?.emailAddress || "";
  const isAdmin = isAdminEmail(userEmail);

  // Fetch contracts
  const { data: contracts = [], isLoading } = useQuery({
    queryKey: ['contracts'],
    queryFn: async () => {
      try {
        if (!isSignedIn) {
          throw new Error('User not authenticated');
        }
        return await getUserContracts();
      } catch (error) {
        logger.error('Error fetching contracts:', error);
        toast({
          title: "Error",
          description: "Could not load contracts. Please try again.",
          variant: "destructive",
        });
        return [];
      }
    },
    enabled: !!isSignedIn,
  });

  // Delete contract mutation
  const deleteContractMutation = useMutation({
    mutationFn: async (contractId: string) => {
      await deleteContract(contractId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      toast({
        title: "Success",
        description: "Contract deleted successfully",
      });
      setShowDeleteDialog(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Error deleting the contract",
        variant: "destructive",
      });
    },
  });

  // Update contract mutation
  const updateContractMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Contract> }) => {
      await updateContract(id, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      toast({
        title: "Success",
        description: "Contract updated successfully",
      });
      setShowEditDialog(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Error updating the contract",
        variant: "destructive",
      });
    },
  });

  // Handle view contract
  const handleViewContract = (contract: Contract) => {
    setSelectedContract(contract);
    setShowViewDialog(true);
  };

  // Handle edit contract
  const handleEditContract = (contract: Contract) => {
    setSelectedContract(contract);
    setEditedContent(contract.content);
    setShowEditDialog(true);
  };

  // Handle delete contract
  const handleDeleteContract = (contract: Contract) => {
    setSelectedContract(contract);
    setShowDeleteDialog(true);
  };

  // Handle download contract as PDF
  const handleDownloadPDF = async (contract: Contract) => {
    const contractContent = `
      <div style="padding: 20px; font-family: Arial, sans-serif;">
        <h1 style="color: #333; margin-bottom: 20px;">${contract.title}</h1>
        <div style="white-space: pre-wrap; font-family: monospace; font-size: 14px;">
          ${contract.content}
        </div>
      </div>
    `;

    const opt = {
      margin: 1,
      filename: `${contract.title}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' as "portrait" | "landscape" }
    };

    try {
      const element = document.createElement('div');
      element.innerHTML = contractContent;
      document.body.appendChild(element);
      await html2pdf().set(opt).from(element).save();
      document.body.removeChild(element);
    } catch (error) {
      logger.error('Error generating PDF:', error);
      toast({
        title: "Error",
        description: "Failed to generate PDF. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Handle download contract as text
  const handleDownloadText = (contract: Contract) => {
    const element = document.createElement("a");
    const file = new Blob([contract.content], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = `${contract.title}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  // Save contract mutation using Firestore
  const saveContractMutation = useMutation({
    mutationFn: async (contractData: {
      title: string;
      type: string;
      content: string;
      status: 'draft' | 'active' | 'signed' | 'expired';
    }) => {
      if (!isSignedIn) {
        throw new Error('Usuario no autenticado');
      }
      
      logger.info('Saving contract with data:', contractData);
      return await saveContract({
        title: contractData.title,
        content: contractData.content,
        contractType: contractData.type,
        status: contractData.status
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      toast({
        title: "Success",
        description: "Contract saved successfully",
      });
    },
    onError: (error: Error) => {
      logger.error('Error in saveContractMutation:', error);
      toast({
        title: "Error",
        description: error.message || "Error saving the contract. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleGenerateContract = async (values: ContractFormValues) => {
    setIsGenerating(true);
    try {
      const contract = await generateContract({
        contractType: values.type,
        artistName: values.artistName,
        clientName: values.otherParty,
        paymentTerms: values.terms,
        additionalClauses: values.additionalDetails
      });
      setGeneratedContract(contract);
      setGeneratedContractType(values.type);
      setContractTitle(`${values.type} Agreement - ${values.artistName}`);
      toast({
        title: "Contract Generated",
        description: "Your contract has been generated successfully.",
      });
    } catch (error) {
      logger.error('Error generating contract:', error);
      toast({
        title: "Error",
        description: "Failed to generate the contract. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveContract = async () => {
    if (!generatedContract || !contractTitle) {
      toast({
        title: "Error",
        description: "The contract title and content are required.",
        variant: "destructive",
      });
      return;
    }

    if (!isSignedIn) {
      toast({
        title: "Error",
        description: "You must be logged in to save contracts.",
        variant: "destructive",
      });
      return;
    }

    try {
      logger.info('Attempting to save contract...');
      await saveContractMutation.mutateAsync({
        title: contractTitle,
        type: "legal",
        content: generatedContract,
        status: "draft" as const
      });

      setGeneratedContract(null);
      setShowNewContractDialog(false);
      setContractTitle("");
    } catch (error) {
      logger.error('Error saving contract:', error);
    }
  };

  // Función para analizar contratos usando Gemini AI
  const analyzeContractFunction = async (contractText: string) => {
    setIsAnalyzing(true);
    setAnalysisData(null);
    setAnalysisResult("");
    try {
      const analysis = await analyzeContract(contractText);
      setAnalysisData(analysis);
      const formattedAnalysis = `
📊 RESUMEN:
${analysis.summary}

⚠️ RIESGOS IDENTIFICADOS:
${analysis.risks.map((risk, i) => `${i + 1}. ${risk}`).join('\n')}

💡 RECOMENDACIONES:
${analysis.recommendations.map((rec, i) => `${i + 1}. ${rec}`).join('\n')}

🔑 TÉRMINOS CLAVE:
${analysis.keyTerms.map((term, i) => `${i + 1}. ${term.term}: ${term.description}`).join('\n')}
`;
      setAnalysisResult(formattedAnalysis);
    } catch (error) {
      logger.error('Error analyzing contract:', error);
      toast({
        title: "Error",
        description: "Failed to analyze the contract. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  // ─── Legal Shield AI handlers ───
  const submitLegalQuestion = async (questionOverride?: string) => {
    const question = (questionOverride ?? legalQuestion).trim();
    if (!question || isAskingLegal) return;

    const newUserTurn: LegalChatTurn = { role: 'user', content: question };
    setLegalChat(prev => [...prev, newUserTurn]);
    setLegalQuestion("");
    setIsAskingLegal(true);

    try {
      const response = await askLegalAssistant({
        question,
        conversationHistory: legalChat.map(t => ({ role: t.role, content: t.content })),
        contractContext: attachedContract?.content,
        userProfile: {
          artistName: clerkUser?.firstName || clerkUser?.username || undefined,
          plan: undefined,
          hasContracts: contracts.length,
        },
      });
      setLegalChat(prev => [...prev, { role: 'assistant', content: response.answer, meta: response }]);
    } catch (error) {
      logger.error('[LegalShield] ask failed:', error);
      toast({
        title: "Legal Shield unavailable",
        description: error instanceof Error ? error.message : "Try again in a moment.",
        variant: "destructive",
      });
      setLegalChat(prev => prev.slice(0, -1)); // rollback user turn on error
    } finally {
      setIsAskingLegal(false);
    }
  };

  const runRiskShieldAudit = async () => {
    setIsAuditingShield(true);
    try {
      const report = await getRiskShieldReport();
      setShieldReport(report);
      toast({
        title: "Risk Shield audit complete",
        description: `Protection score: ${report.protectionScore}/100`,
      });
    } catch (error) {
      logger.error('[LegalShield] audit failed:', error);
      toast({
        title: "Audit failed",
        description: error instanceof Error ? error.message : "Try again later.",
        variant: "destructive",
      });
    } finally {
      setIsAuditingShield(false);
    }
  };

  const QUICK_LEGAL_PROMPTS: Array<{ icon: any; label: string; prompt: string }> = [
    { icon: FileText, label: "Copyright basics", prompt: "Explain the difference between composition copyright (publishing) and master recording copyright, and how I should register both as an independent artist." },
    { icon: Scale, label: "Royalty splits", prompt: "How should I structure royalty splits with collaborators (producer, featured artist, engineer) to avoid future disputes? Give me a sample split sheet." },
    { icon: Shield, label: "Spot a scam", prompt: "What are the top red flags in a record/management deal that signal a predatory contract or scam I should walk away from?" },
    { icon: Users, label: "Band agreement", prompt: "Draft the key clauses I need in a band agreement (decision-making, departing members, name ownership, song splits)." },
    { icon: Globe2, label: "International rights", prompt: "How do I protect my music when distributing internationally? Which PROs/CMOs should I register with and how do reciprocal agreements work?" },
    { icon: Music2, label: "Sync licensing", prompt: "Walk me through a fair sync license deal for placing my song in a film/TV/ad: scope, term, exclusivity, fees, and reversion." },
    { icon: Gavel, label: "DMCA takedown", prompt: "Someone is using my song without permission on YouTube/TikTok. Step-by-step DMCA takedown process and what NOT to claim to avoid perjury." },
    { icon: AlertTriangle, label: "AI music & rights", prompt: "What are the legal risks of using AI-generated voice/instrumentation in my music, and how do I disclose it on DSPs to avoid takedowns?" },
  ];

  const RISK_BADGE: Record<string, { color: string; icon: any; label: string }> = {
    none: { color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30", icon: ShieldCheck, label: "Safe" },
    low: { color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30", icon: ShieldCheck, label: "Low risk" },
    medium: { color: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30", icon: ShieldQuestion, label: "Medium risk" },
    high: { color: "bg-orange-500/10 text-orange-400 border-orange-500/30", icon: ShieldAlert, label: "High risk" },
    critical: { color: "bg-red-500/10 text-red-400 border-red-500/30", icon: ShieldAlert, label: "Critical risk" },
  };

  const SEV_COLOR: Record<string, string> = {
    CRITICAL: "bg-red-500/10 border-red-500/30 text-red-300",
    HIGH: "bg-orange-500/10 border-orange-500/30 text-orange-300",
    MEDIUM: "bg-yellow-500/10 border-yellow-500/30 text-yellow-300",
    LOW: "bg-blue-500/10 border-blue-500/30 text-blue-300",
  };

  const filteredContracts = useMemo(() => {
    let result = contracts;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(c =>
        c.title.toLowerCase().includes(q) ||
        (c.contractType || '').toLowerCase().includes(q)
      );
    }
    if (statusFilter !== 'all') {
      result = result.filter(c => c.status === statusFilter);
    }
    return result;
  }, [contracts, searchQuery, statusFilter]);

  const pageContent = (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1 pt-20 px-4 md:pt-24 md:px-10 pb-12">
        <div className="flex-1 space-y-8">

          {/* Hero Header */}
          <div className="relative rounded-2xl overflow-hidden border border-orange-500/20 bg-gradient-to-br from-orange-500/10 via-[#0d0d1a] to-transparent px-6 py-8 md:px-10">
            <div className="absolute inset-0 opacity-30" style={{ backgroundImage: 'radial-gradient(ellipse at 80% 50%, #ff640020 0%, transparent 70%)' }} />
            <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-xl bg-orange-500/15 border border-orange-500/20 shrink-0">
                  <Scale className="h-7 w-7 text-orange-500" />
                </div>
                <div>
                  <h2 className="text-3xl md:text-4xl font-bold tracking-tight bg-gradient-to-r from-orange-400 to-amber-300 bg-clip-text text-transparent">
                    Legal Contracts
                  </h2>
                  <p className="text-muted-foreground text-sm max-w-xl mt-1">
                    Create, analyze, and manage your professional agreements with AI assistance
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <div className="text-center px-4 py-2 rounded-lg bg-background/40 border border-white/10">
                  <p className="text-xl font-bold text-orange-400">{contracts.length}</p>
                  <p className="text-[11px] text-muted-foreground">Total</p>
                </div>
                <div className="text-center px-4 py-2 rounded-lg bg-background/40 border border-white/10">
                  <p className="text-xl font-bold text-emerald-400">{contracts.filter(c => c.status === 'active').length}</p>
                  <p className="text-[11px] text-muted-foreground">Active</p>
                </div>
                <div className="text-center px-4 py-2 rounded-lg bg-background/40 border border-white/10">
                  <p className="text-xl font-bold text-zinc-400">{contracts.filter(c => c.status === 'draft').length}</p>
                  <p className="text-[11px] text-muted-foreground">Drafts</p>
                </div>
                <div className="text-center px-4 py-2 rounded-lg bg-background/40 border border-white/10">
                  <p className="text-xl font-bold text-blue-400">{contracts.filter(c => c.status === 'signed').length}</p>
                  <p className="text-[11px] text-muted-foreground">Signed</p>
                </div>
              </div>
            </div>
          </div>

          <Tabs defaultValue={selectedTab} value={selectedTab} onValueChange={setSelectedTab} className="space-y-6">
            <div>
              <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 gap-2 p-1.5 bg-muted/40 backdrop-blur-sm rounded-xl border border-orange-500/20">
                {[
                  { value: "contracts", icon: FileText, label: "Contracts", shortLabel: "Docs" },
                  { value: "generator", icon: Sparkles, label: "AI Generator", shortLabel: "Generate" },
                  { value: "analyzer", icon: Scale, label: "Analyzer", shortLabel: "Analyze" },
                  { value: "ai-agent", icon: Brain, label: "Legal Shield", shortLabel: "AI" }
                ].map(tab => (
                  <TabsTrigger
                    key={tab.value}
                    value={tab.value}
                    className="gap-2 text-sm py-2.5 px-4 transition-all duration-200 data-[state=active]:bg-orange-500 data-[state=active]:text-white hover:bg-muted/80"
                  >
                    <tab.icon className="h-4 w-4" />
                    <span className="hidden md:inline">{tab.label}</span>
                    <span className="md:hidden">{tab.shortLabel}</span>
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            {/* Contracts Tab */}
            <TabsContent value="contracts">
              <div className="space-y-5">
                {/* Toolbar */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search contracts..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 bg-background/60 border-white/10 h-10"
                    />
                    {searchQuery && (
                      <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="default" className="gap-2 border-white/10 shrink-0 h-10">
                        <Filter className="h-4 w-4" />
                        {statusFilter === 'all' ? 'All Status' : statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {['all', 'draft', 'active', 'signed', 'expired'].map(s => (
                        <DropdownMenuItem key={s} onClick={() => setStatusFilter(s)} className={statusFilter === s ? 'text-orange-400' : ''}>
                          {s === 'all' ? 'All Status' : s.charAt(0).toUpperCase() + s.slice(1)}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button
                    onClick={() => setSelectedTab("generator")}
                    className="bg-orange-500 hover:bg-orange-600 gap-2 shrink-0 h-10"
                  >
                    <Plus className="h-4 w-4" />
                    New Contract
                  </Button>
                </div>

                {/* Contract Cards */}
                {isLoading ? (
                  <div className="py-20 flex flex-col items-center gap-3 text-muted-foreground">
                    <Loader2 className="h-8 w-8 text-orange-500 animate-spin" />
                    <p className="text-sm">Loading contracts...</p>
                  </div>
                ) : filteredContracts.length === 0 ? (
                  <div className="py-20 flex flex-col items-center gap-4 text-center">
                    <div className="p-4 rounded-full bg-orange-500/10 border border-orange-500/20">
                      <FileText className="h-10 w-10 text-orange-500/60" />
                    </div>
                    <div>
                      <p className="text-lg font-semibold">
                        {searchQuery || statusFilter !== 'all' ? 'No contracts match your filters' : 'No contracts yet'}
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {searchQuery || statusFilter !== 'all'
                          ? 'Try adjusting your search or filter'
                          : 'Generate your first contract using the AI Generator'}
                      </p>
                    </div>
                    {!searchQuery && statusFilter === 'all' && (
                      <Button onClick={() => setSelectedTab("generator")} className="bg-orange-500 hover:bg-orange-600 gap-2 mt-2">
                        <Sparkles className="h-4 w-4" /> Generate First Contract
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {filteredContracts.map((contract, index) => (
                      <div
                        key={contract.id}
                        className="group relative rounded-xl border border-white/10 bg-background/40 p-4 hover:border-orange-500/30 hover:bg-orange-500/5 transition-all duration-200"
                        style={{ animation: 'fadeSlideIn 0.2s ease both', animationDelay: `${Math.min(index * 50, 200)}ms` }}
                      >
                        <div className="flex items-start justify-between gap-2 mb-3">
                          <div className="flex items-start gap-2.5 min-w-0">
                            <div className="p-1.5 rounded-lg bg-orange-500/10 border border-orange-500/20 shrink-0 mt-0.5">
                              <FileText className="h-3.5 w-3.5 text-orange-500" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-sm leading-snug truncate" title={contract.title}>
                                {contract.title}
                              </p>
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 mt-1 border-white/20 text-muted-foreground">
                                {contract.contractType || 'Legal'}
                              </Badge>
                            </div>
                          </div>
                          <Badge className={`shrink-0 gap-1 text-[11px] px-2 py-0.5 ${getStatusColor(contract.status)}`}>
                            {getStatusIcon(contract.status)}
                            {contract.status.charAt(0).toUpperCase() + contract.status.slice(1)}
                          </Badge>
                        </div>

                        <p className="text-[11px] text-muted-foreground mb-3">
                          {new Date(contract.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                        </p>

                        <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                          <Button size="sm" variant="ghost" onClick={() => handleViewContract(contract)} className="h-7 px-2 text-xs gap-1 hover:bg-orange-500/10 hover:text-orange-400">
                            <Eye className="h-3 w-3" /> View
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => handleEditContract(contract)} className="h-7 px-2 text-xs gap-1 hover:bg-orange-500/10 hover:text-orange-400">
                            <PenLine className="h-3 w-3" /> Edit
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => handleDownloadPDF(contract)} className="h-7 px-2 text-xs gap-1 hover:bg-orange-500/10 hover:text-orange-400">
                            <FileDown className="h-3 w-3" /> PDF
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => handleDeleteContract(contract)} className="h-7 px-2 text-xs gap-1 hover:bg-red-500/10 hover:text-red-400 ml-auto">
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Generator Tab */}
            <TabsContent value="generator">
              <div className="grid lg:grid-cols-2 gap-6">
                <Card className="p-4 md:p-6">
                  <div className="flex items-center gap-3 mb-5">
                    <div className="p-2.5 bg-orange-500/10 rounded-lg border border-orange-500/20">
                      <Sparkles className="h-5 w-5 text-orange-500" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold">AI Contract Generator</h3>
                      <p className="text-xs text-muted-foreground">Fill out the form to generate a professional contract</p>
                    </div>
                  </div>
                  <ContractForm onSubmit={handleGenerateContract} isLoading={isGenerating} />
                </Card>

                {/* Generated contract preview */}
                <div className="space-y-4">
                  {isGenerating ? (
                    <div className="rounded-xl border border-orange-500/20 bg-orange-500/5 p-8 flex flex-col items-center gap-3 text-center">
                      <Loader2 className="h-8 w-8 text-orange-500 animate-spin" />
                      <p className="text-sm font-medium">Generating your contract...</p>
                      <p className="text-xs text-muted-foreground">Our AI is drafting a professional agreement</p>
                    </div>
                  ) : generatedContract ? (
                    <Card className="p-4 border-orange-500/20 bg-background/50">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                          <p className="text-sm font-semibold">Contract Ready</p>
                        </div>
                        <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-400">AI Generated</Badge>
                      </div>

                      <div className="mb-3">
                        <label className="text-xs text-muted-foreground mb-1 block">Contract Title</label>
                        <Input
                          value={contractTitle}
                          onChange={(e) => setContractTitle(e.target.value)}
                          className="h-8 text-sm bg-background/60"
                          placeholder="Contract title..."
                        />
                      </div>

                      <ScrollArea className="h-[280px] rounded-lg border border-white/10 bg-background/40 p-3 mb-3">
                        <pre className="whitespace-pre-wrap text-xs leading-relaxed text-white/80 font-mono">
                          {generatedContract}
                        </pre>
                      </ScrollArea>

                      <div className="flex gap-2">
                        <Button
                          onClick={handleSaveContract}
                          disabled={saveContractMutation.isPending}
                          className="flex-1 bg-orange-500 hover:bg-orange-600 gap-2 h-9 text-sm"
                        >
                          {saveContractMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                          {saveContractMutation.isPending ? 'Saving...' : 'Save Contract'}
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => handleDownloadPDF({ id: '', title: contractTitle, content: generatedContract, status: 'draft', contractType: generatedContractType, createdAt: new Date() })}
                          className="gap-2 h-9 text-sm border-white/10"
                        >
                          <FileDown className="h-4 w-4" /> PDF
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={() => { setGeneratedContract(null); setContractTitle(""); }}
                          className="h-9 text-sm text-muted-foreground"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </Card>
                  ) : (
                    <div className="rounded-xl border border-dashed border-white/15 p-8 flex flex-col items-center gap-3 text-center">
                      <div className="p-3 rounded-full bg-orange-500/10 border border-orange-500/20">
                        <FileText className="h-7 w-7 text-orange-500/60" />
                      </div>
                      <p className="text-sm font-medium">No contract generated yet</p>
                      <p className="text-xs text-muted-foreground">Fill out the form and click Generate to create your contract</p>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* Analyzer Tab */}
            <TabsContent value="analyzer">
              <div className="grid lg:grid-cols-2 gap-6">
                <Card className="p-4 md:p-6">
                  <div className="flex items-center gap-3 mb-5">
                    <div className="p-2.5 bg-orange-500/10 rounded-lg border border-orange-500/20">
                      <Scale className="h-5 w-5 text-orange-500" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold">Contract Analyzer</h3>
                      <p className="text-xs text-muted-foreground">Paste any contract and get AI-powered legal analysis</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <Textarea
                      placeholder="Paste your contract text here for analysis..."
                      value={contractToAnalyze}
                      onChange={(e) => setContractToAnalyze(e.target.value)}
                      className="min-h-[260px] text-sm bg-background/60 font-mono"
                    />
                    <Button
                      onClick={() => analyzeContractFunction(contractToAnalyze)}
                      disabled={isAnalyzing || !contractToAnalyze.trim()}
                      className="w-full bg-orange-500 hover:bg-orange-600 gap-2"
                    >
                      {isAnalyzing ? <><Loader2 className="h-4 w-4 animate-spin" />Analyzing…</> : <><Scale className="h-4 w-4" />Analyze Contract</>}
                    </Button>
                  </div>
                </Card>

                {/* Analysis results */}
                <div>
                  {isAnalyzing ? (
                    <div className="rounded-xl border border-orange-500/20 bg-orange-500/5 p-8 flex flex-col items-center gap-3 text-center">
                      <Loader2 className="h-8 w-8 text-orange-500 animate-spin" />
                      <p className="text-sm font-medium">Analyzing contract...</p>
                      <p className="text-xs text-muted-foreground">Reviewing clauses, risks, and terms</p>
                    </div>
                  ) : analysisData ? (
                    <div className="space-y-3">
                      {/* Summary */}
                      <Card className="p-4 border-white/10 bg-background/40">
                        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Summary</h4>
                        <p className="text-sm leading-relaxed">{analysisData.summary}</p>
                      </Card>
                      {/* Risks */}
                      {analysisData.risks.length > 0 && (
                        <Card className="p-4 border-red-500/20 bg-red-500/5">
                          <h4 className="text-xs font-semibold text-red-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                            <AlertTriangle className="h-3.5 w-3.5" /> Risks Identified
                          </h4>
                          <ul className="space-y-1.5">
                            {analysisData.risks.map((risk, i) => (
                              <li key={i} className="text-xs text-white/80 flex gap-2">
                                <span className="text-red-400 shrink-0">•</span>{risk}
                              </li>
                            ))}
                          </ul>
                        </Card>
                      )}
                      {/* Recommendations */}
                      {analysisData.recommendations.length > 0 && (
                        <Card className="p-4 border-emerald-500/20 bg-emerald-500/5">
                          <h4 className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                            <Lightbulb className="h-3.5 w-3.5" /> Recommendations
                          </h4>
                          <ul className="space-y-1.5">
                            {analysisData.recommendations.map((rec, i) => (
                              <li key={i} className="text-xs text-white/80 flex gap-2">
                                <span className="text-emerald-400 shrink-0">•</span>{rec}
                              </li>
                            ))}
                          </ul>
                        </Card>
                      )}
                      {/* Key Terms */}
                      {analysisData.keyTerms.length > 0 && (
                        <Card className="p-4 border-white/10 bg-background/40">
                          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                            <Star className="h-3.5 w-3.5 text-amber-400" /> Key Terms
                          </h4>
                          <dl className="space-y-2">
                            {analysisData.keyTerms.map((t, i) => (
                              <div key={i}>
                                <dt className="text-xs font-semibold text-orange-400">{t.term}</dt>
                                <dd className="text-xs text-white/70 mt-0.5">{t.description}</dd>
                              </div>
                            ))}
                          </dl>
                        </Card>
                      )}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-white/15 p-8 flex flex-col items-center gap-3 text-center">
                      <div className="p-3 rounded-full bg-orange-500/10 border border-orange-500/20">
                        <Scale className="h-7 w-7 text-orange-500/60" />
                      </div>
                      <p className="text-sm font-medium">No analysis yet</p>
                      <p className="text-xs text-muted-foreground">Paste a contract and click Analyze to get insights</p>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* AI Agent Tab */}
            <TabsContent value="ai-agent">
                <Card className="p-4 md:p-6">
                  <div className="flex flex-col md:flex-row items-start md:items-center gap-4 mb-6 md:mb-8">
                    <div className="p-3 md:p-4 bg-orange-500/10 rounded-lg">
                      <Brain className="h-6 w-6 md:h-8 md:w-8 text-orange-500" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xl md:text-2xl font-semibold flex items-center gap-2">
                        Boostify Legal Shield
                        <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-400 bg-emerald-500/5">AI POWERED</Badge>
                      </h3>
                      <p className="text-sm md:text-base text-muted-foreground">
                        Senior music-industry attorney AI — protects you and the platform from legal risk.
                      </p>
                    </div>
                    <Button
                      onClick={runRiskShieldAudit}
                      disabled={isAuditingShield}
                      className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white"
                    >
                      {isAuditingShield ? (
                        <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Auditing…</>
                      ) : (
                        <><Shield className="mr-2 h-4 w-4" />Run Risk Shield Audit</>
                      )}
                    </Button>
                  </div>

                  <div className="grid lg:grid-cols-3 gap-6">
                    {/* Chat column */}
                    <div className="lg:col-span-2 space-y-4">
                      <Card className="border-orange-500/20 bg-background/40 backdrop-blur">
                        <ScrollArea className="h-[420px] p-4">
                          {legalChat.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3">
                              <Brain className="h-10 w-10 text-orange-500/60" />
                              <h4 className="font-semibold">Ask anything about music law</h4>
                              <p className="text-xs text-muted-foreground max-w-sm">
                                Copyright, royalties, contract red flags, sync deals, scams, AI music, DMCA — your personal entertainment lawyer is on standby.
                              </p>
                              <p className="text-[11px] text-muted-foreground/70 max-w-sm italic">
                                Not a substitute for licensed legal counsel. Always confirm critical decisions with a real attorney.
                              </p>
                            </div>
                          ) : (
                            <div className="space-y-4">
                              {legalChat.map((turn, idx) => (
                                <div key={idx} className={`flex ${turn.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                  <div className={`max-w-[85%] rounded-2xl p-4 ${turn.role === 'user' ? 'bg-orange-500/15 border border-orange-500/30' : 'bg-muted/50 border border-white/10'}`}>
                                    <p className="text-sm whitespace-pre-wrap leading-relaxed">{turn.content}</p>
                                    {turn.meta && (
                                      <div className="mt-3 pt-3 border-t border-white/10 space-y-2">
                                        {turn.meta.riskLevel && turn.meta.riskLevel !== 'none' && (() => {
                                          const r = RISK_BADGE[turn.meta.riskLevel] || RISK_BADGE.none;
                                          const Ico = r.icon;
                                          return (
                                            <div className={`inline-flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-full border ${r.color}`}>
                                              <Ico className="h-3 w-3" />
                                              {r.label}
                                            </div>
                                          );
                                        })()}
                                        {turn.meta.redFlags?.length > 0 && (
                                          <div className="space-y-1.5">
                                            <p className="text-[11px] font-semibold text-red-300 flex items-center gap-1"><AlertTriangle className="h-3 w-3" />Red flags</p>
                                            {turn.meta.redFlags.map((f, i) => (
                                              <div key={i} className={`text-[11px] p-2 rounded border ${SEV_COLOR[String(f.severity).toUpperCase()] || SEV_COLOR.LOW}`}>
                                                <div className="font-semibold">{f.severity}: {f.issue}</div>
                                                {f.fix && <div className="opacity-80 mt-0.5">→ {f.fix}</div>}
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                        {turn.meta.actionableSteps?.length > 0 && (
                                          <div>
                                            <p className="text-[11px] font-semibold text-emerald-300 flex items-center gap-1"><Lightbulb className="h-3 w-3" />Action plan</p>
                                            <ol className="text-[11px] list-decimal list-inside space-y-0.5 text-white/70 mt-1">
                                              {turn.meta.actionableSteps.map((s, i) => <li key={i}>{s}</li>)}
                                            </ol>
                                          </div>
                                        )}
                                        {turn.meta.citations?.length > 0 && (
                                          <p className="text-[10px] text-white/40">
                                            Refs: {turn.meta.citations.join(' • ')}
                                          </p>
                                        )}
                                        {turn.meta.needsLawyer && (
                                          <div className="text-[11px] p-2 rounded bg-amber-500/10 border border-amber-500/30 text-amber-300 flex items-start gap-1.5">
                                            <Gavel className="h-3 w-3 mt-0.5 shrink-0" />
                                            <span>This issue warrants a licensed {turn.meta.lawyerSpecialty || 'entertainment'} attorney. Do not act on AI advice alone.</span>
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                              {isAskingLegal && (
                                <div className="flex justify-start">
                                  <div className="bg-muted/50 border border-white/10 rounded-2xl p-4 flex items-center gap-2 text-sm text-muted-foreground">
                                    <Loader2 className="h-4 w-4 animate-spin text-orange-500" />
                                    Analyzing your question…
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </ScrollArea>

                        {attachedContract && (
                          <div className="border-t border-orange-500/20 px-4 py-2 bg-orange-500/5 flex items-center justify-between">
                            <span className="text-xs text-orange-300 truncate flex items-center gap-1.5">
                              <FileText className="h-3 w-3" /> Context: {attachedContract.title}
                            </span>
                            <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => setAttachedContract(null)}>
                              Detach
                            </Button>
                          </div>
                        )}

                        <div className="border-t border-white/10 p-3 flex gap-2">
                          <Textarea
                            value={legalQuestion}
                            onChange={(e) => setLegalQuestion(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                submitLegalQuestion();
                              }
                            }}
                            placeholder="Ask the Legal Shield (Enter to send, Shift+Enter for newline)…"
                            rows={2}
                            disabled={isAskingLegal}
                            className="resize-none bg-background/60"
                          />
                          <div className="flex flex-col gap-1.5">
                            {contracts.length > 0 && !attachedContract && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="outline" size="sm" className="h-9 w-9 p-0" title="Attach a contract for context">
                                    <FileText className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="max-h-64 overflow-y-auto">
                                  {contracts.map(c => (
                                    <DropdownMenuItem key={c.id} onClick={() => setAttachedContract(c)} className="text-xs">
                                      {c.title}
                                    </DropdownMenuItem>
                                  ))}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                            <Button
                              onClick={() => submitLegalQuestion()}
                              disabled={isAskingLegal || !legalQuestion.trim()}
                              className="bg-orange-500 hover:bg-orange-600 h-9 w-9 p-0"
                              title="Send"
                            >
                              {isAskingLegal ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                            </Button>
                          </div>
                        </div>
                      </Card>

                      <div className="p-4 border border-white/10 rounded-lg bg-background/30">
                        <h4 className="font-medium mb-3 text-sm flex items-center gap-2">
                          <Sparkles className="h-4 w-4 text-orange-500" />
                          Quick legal questions
                        </h4>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                          {QUICK_LEGAL_PROMPTS.map(q => {
                            const Ico = q.icon;
                            return (
                              <Button
                                key={q.label}
                                variant="outline"
                                size="sm"
                                onClick={() => submitLegalQuestion(q.prompt)}
                                disabled={isAskingLegal}
                                className="justify-start text-xs h-auto py-2 px-3 border-white/10 hover:border-orange-500/30 hover:bg-orange-500/5"
                              >
                                <Ico className="mr-2 h-3.5 w-3.5 text-orange-500 shrink-0" />
                                <span className="truncate">{q.label}</span>
                              </Button>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {/* Risk Shield panel */}
                    <div className="space-y-4">
                      <Card className="p-4 border-orange-500/20 bg-gradient-to-b from-orange-500/5 to-transparent">
                        <h4 className="font-semibold mb-3 flex items-center gap-2 text-sm">
                          <Shield className="h-4 w-4 text-orange-500" />
                          Protection Score
                        </h4>
                        {!shieldReport ? (
                          <div className="text-center py-6">
                            <ShieldQuestion className="h-12 w-12 text-orange-500/40 mx-auto mb-3" />
                            <p className="text-xs text-muted-foreground mb-3">
                              Run an audit to scan all your saved contracts and get a consolidated protection score.
                            </p>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={runRiskShieldAudit}
                              disabled={isAuditingShield}
                              className="border-orange-500/30 text-orange-400 hover:bg-orange-500/10 text-xs"
                            >
                              {isAuditingShield ? <><Loader2 className="mr-2 h-3 w-3 animate-spin" />Auditing…</> : 'Start audit'}
                            </Button>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <div className="text-center">
                              <div className={`text-4xl font-black ${
                                shieldReport.protectionScore >= 80 ? 'text-emerald-400' :
                                shieldReport.protectionScore >= 60 ? 'text-yellow-400' :
                                'text-red-400'
                              }`}>
                                {shieldReport.protectionScore}
                                <span className="text-lg text-white/40">/100</span>
                              </div>
                              <p className="text-[11px] text-muted-foreground">across {shieldReport.totalContracts} contract{shieldReport.totalContracts !== 1 ? 's' : ''}</p>
                            </div>
                            <div className="grid grid-cols-3 gap-1.5 text-center">
                              <div className="p-2 rounded bg-red-500/5 border border-red-500/20">
                                <div className="text-base font-bold text-red-400">{shieldReport.criticalIssues}</div>
                                <div className="text-[9px] uppercase text-white/40">Critical</div>
                              </div>
                              <div className="p-2 rounded bg-orange-500/5 border border-orange-500/20">
                                <div className="text-base font-bold text-orange-400">{shieldReport.highIssues}</div>
                                <div className="text-[9px] uppercase text-white/40">High</div>
                              </div>
                              <div className="p-2 rounded bg-yellow-500/5 border border-yellow-500/20">
                                <div className="text-base font-bold text-yellow-400">{shieldReport.mediumIssues}</div>
                                <div className="text-[9px] uppercase text-white/40">Medium</div>
                              </div>
                            </div>
                            <div className="space-y-1.5">
                              {shieldReport.platformWideRecommendations.map((r, i) => (
                                <p key={i} className="text-[11px] text-white/70 leading-relaxed flex gap-1.5">
                                  <Lightbulb className="h-3 w-3 text-amber-400 mt-0.5 shrink-0" />
                                  <span>{r}</span>
                                </p>
                              ))}
                            </div>
                          </div>
                        )}
                      </Card>

                      {shieldReport && shieldReport.perContract.length > 0 && (
                        <Card className="p-4 border-white/10">
                          <h4 className="font-semibold mb-3 text-sm flex items-center gap-2">
                            <FileText className="h-4 w-4 text-orange-500" />
                            Per-contract breakdown
                          </h4>
                          <ScrollArea className="max-h-[280px] pr-2">
                            <div className="space-y-2">
                              {shieldReport.perContract.map(c => (
                                <div key={c.contractId} className="p-2.5 rounded border border-white/10 bg-background/40">
                                  <div className="flex items-center justify-between gap-2 mb-1.5">
                                    <span className="text-xs font-medium truncate">{c.contractTitle}</span>
                                    <Badge variant="outline" className={`text-[10px] ${
                                      c.score >= 80 ? 'border-emerald-500/30 text-emerald-400' :
                                      c.score >= 60 ? 'border-yellow-500/30 text-yellow-400' :
                                      'border-red-500/30 text-red-400'
                                    }`}>{c.score}/100</Badge>
                                  </div>
                                  {c.topIssues.slice(0, 2).map((issue, i) => (
                                    <div key={i} className="text-[10px] text-white/60 mt-1 leading-snug">
                                      <span className={`font-semibold ${
                                        String(issue.severity).toUpperCase() === 'CRITICAL' ? 'text-red-400' :
                                        String(issue.severity).toUpperCase() === 'HIGH' ? 'text-orange-400' :
                                        'text-yellow-400'
                                      }`}>{issue.severity}:</span> {issue.issue}
                                    </div>
                                  ))}
                                </div>
                              ))}
                            </div>
                          </ScrollArea>
                        </Card>
                      )}

                      <Card className="p-4 border-white/10 bg-background/30">
                        <h4 className="font-semibold mb-2 text-sm flex items-center gap-2">
                          <Brain className="h-4 w-4 text-orange-500" />
                          What the Shield protects
                        </h4>
                        <ul className="text-[11px] text-white/60 space-y-1.5">
                          <li className="flex gap-1.5"><CheckCircle2 className="h-3 w-3 text-emerald-500 mt-0.5 shrink-0" /> Predatory clauses (perpetual assignment, hidden fees)</li>
                          <li className="flex gap-1.5"><CheckCircle2 className="h-3 w-3 text-emerald-500 mt-0.5 shrink-0" /> Royalty rights & audit access</li>
                          <li className="flex gap-1.5"><CheckCircle2 className="h-3 w-3 text-emerald-500 mt-0.5 shrink-0" /> Master vs publishing ownership</li>
                          <li className="flex gap-1.5"><CheckCircle2 className="h-3 w-3 text-emerald-500 mt-0.5 shrink-0" /> Termination & reversion rights</li>
                          <li className="flex gap-1.5"><CheckCircle2 className="h-3 w-3 text-emerald-500 mt-0.5 shrink-0" /> AI music disclosure & DMCA exposure</li>
                          <li className="flex gap-1.5"><CheckCircle2 className="h-3 w-3 text-emerald-500 mt-0.5 shrink-0" /> Platform liability & user-generated content</li>
                        </ul>
                      </Card>
                    </div>
                  </div>
                </Card>
              </TabsContent>

          </Tabs>
          {/* View Dialog */}
          <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
            <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-lg font-bold">
                  <FileText className="h-5 w-5 text-orange-500 shrink-0" />
                  {selectedContract?.title}
                </DialogTitle>
                <DialogDescription className="flex items-center gap-3">
                  <span>Created on {selectedContract?.createdAt.toLocaleDateString()}</span>
                  {selectedContract && (
                    <Badge className={`text-[10px] gap-1 ${getStatusColor(selectedContract.status)}`}>
                      {getStatusIcon(selectedContract.status)}
                      {selectedContract.status.charAt(0).toUpperCase() + selectedContract.status.slice(1)}
                    </Badge>
                  )}
                </DialogDescription>
              </DialogHeader>
              <div className="flex-1 min-h-0">
                <ScrollArea className="h-full">
                  <div className="p-4 bg-background/40 rounded-lg border border-white/10">
                    <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-white/85">
                      {selectedContract?.content}
                    </pre>
                  </div>
                </ScrollArea>
              </div>
              <div className="flex justify-between gap-2 pt-4">
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 border-white/10 text-xs"
                    onClick={() => {
                      if (selectedContract?.content) {
                        navigator.clipboard.writeText(selectedContract.content);
                        toast({ title: "Copied", description: "Contract text copied to clipboard" });
                      }
                    }}
                  >
                    <Copy className="h-3.5 w-3.5" /> Copy
                  </Button>
                  {selectedContract && (
                    <>
                      <Button variant="outline" size="sm" className="gap-2 border-white/10 text-xs" onClick={() => handleDownloadPDF(selectedContract)}>
                        <FileDown className="h-3.5 w-3.5" /> PDF
                      </Button>
                      <Button variant="outline" size="sm" className="gap-2 border-white/10 text-xs" onClick={() => handleDownloadText(selectedContract)}>
                        <Download className="h-3.5 w-3.5" /> TXT
                      </Button>
                    </>
                  )}
                </div>
                <Button variant="outline" size="sm" onClick={() => setShowViewDialog(false)}>
                  Close
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Edit Dialog */}
          <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
            <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <PenLine className="h-4 w-4 text-orange-500" /> Edit Contract
                </DialogTitle>
                <DialogDescription>
                  Make changes to your contract content below
                </DialogDescription>
              </DialogHeader>
              <div className="flex-1 space-y-3 min-h-0">
                <Textarea
                  value={editedContent}
                  onChange={(e) => setEditedContent(e.target.value)}
                  className="w-full min-h-[400px] font-mono text-xs leading-relaxed bg-background/60 border-white/10 resize-none"
                />
                <div className="flex justify-end gap-3">
                  <Button variant="outline" onClick={() => setShowEditDialog(false)} className="border-white/10">
                    Cancel
                  </Button>
                  <Button
                    onClick={() => {
                      if (selectedContract) {
                        updateContractMutation.mutate({
                          id: selectedContract.id,
                          updates: { content: editedContent }
                        });
                      }
                    }}
                    disabled={updateContractMutation.isPending}
                    className="bg-orange-500 hover:bg-orange-600 gap-2"
                  >
                    {updateContractMutation.isPending ? <><Loader2 className="h-4 w-4 animate-spin" />Saving…</> : 'Save Changes'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Delete Dialog */}
          <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
            <AlertDialogContent className="border-red-500/20">
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                  <Trash2 className="h-4 w-4 text-red-400" /> Delete Contract?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete "<strong>{selectedContract?.title}</strong>". This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="border-white/10">Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    if (selectedContract) {
                      deleteContractMutation.mutate(selectedContract.id);
                    }
                  }}
                  className="bg-destructive hover:bg-destructive/90"
                >
                  {deleteContractMutation.isPending ? "Deleting..." : "Delete"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </main>
    </div>
  );

  // If not logged in, show landing page
  if (!isSignedIn) {
    return <ArtistLandingPage />;
  }

  // If admin, return content directly; otherwise wrap with PlanTierGuard
  if (isAdmin) {
    return pageContent;
  }

  return (
    <PlanTierGuard requiredPlan="Premium">
      {pageContent}
    </PlanTierGuard>
  );
}

function getStatusColor(status: string) {
  switch (status) {
    case "active":
      return "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20";
    case "signed":
      return "bg-blue-500/10 text-blue-400 border-blue-500/30 hover:bg-blue-500/20";
    case "pending":
      return "bg-yellow-500/10 text-yellow-400 border-yellow-500/30 hover:bg-yellow-500/20";
    case "draft":
      return "bg-zinc-500/10 text-zinc-400 border-zinc-500/30 hover:bg-zinc-500/20";
    case "expired":
      return "bg-red-500/10 text-red-400 border-red-500/30 hover:bg-red-500/20";
    default:
      return "bg-zinc-500/10 text-zinc-400 border-zinc-500/30";
  }
}

function getStatusIcon(status: string) {
  switch (status) {
    case "active":
      return <CheckCircle2 className="h-3.5 w-3.5" />;
    case "signed":
      return <CheckCircle2 className="h-3.5 w-3.5" />;
    case "pending":
      return <Clock className="h-3.5 w-3.5" />;
    case "draft":
      return <AlertCircle className="h-3.5 w-3.5" />;
    case "expired":
      return <AlertCircle className="h-3.5 w-3.5" />;
    default:
      return null;
  }
}