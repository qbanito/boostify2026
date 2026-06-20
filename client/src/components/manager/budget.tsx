import { useState } from "react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { DollarSign, Download, Loader2, ChevronRight, Eye, Upload, Calculator, Edit, Trash2 } from "lucide-react";
import { managerToolsService } from "../../lib/services/managertoolsopenrouter";
import { useToast } from "../../hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from "../ui/dialog";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { useAuth } from "../../hooks/use-auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { VisuallyHidden } from "../ui/visually-hidden";

interface BudgetDocument {
  id: string;
  content: string;
  createdAt: any;
}

export function BudgetSection() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isGenerating, setIsGenerating] = useState(false);
  const [details, setDetails] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<BudgetDocument | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editContent, setEditContent] = useState("");

  const { data: budgetDocuments = [], isLoading } = useQuery({
    queryKey: ['budgets', user?.uid],
    queryFn: async () => {
      if (!user?.uid) return [];
      const data = await managerToolsService.getFromFirestore(user.uid, 'budget');
      return data as BudgetDocument[];
    },
    enabled: !!user
  });

  const generatePreviewMutation = useMutation({
    mutationFn: async (details: string) => {
      if (!user?.uid) throw new Error("User not authenticated");
      const prompt = `Create a detailed budget breakdown for this project: ${details}. Include all expected costs, contingencies, and potential revenue streams. Format the response with clear categories, line items, and totals.`;
      const content = await managerToolsService.generateWithAI(prompt, 'budget');
      return content;
    },
    onSuccess: (content) => {
      setPreviewContent(content);
      setIsPreviewMode(true);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to generate preview",
        variant: "destructive"
      });
    }
  });

  const generateBudgetMutation = useMutation({
    mutationFn: async (details: string) => {
      if (!user?.uid) throw new Error("User not authenticated");
      return managerToolsService.generateContentByType('budget', details, user.uid);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets', user?.uid] });
      toast({
        title: "Success",
        description: "Budget document generated successfully"
      });
      setIsDialogOpen(false);
      setDetails("");
      setPreviewContent(null);
      setIsPreviewMode(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to generate budget document",
        variant: "destructive"
      });
    }
  });

  const deleteDocumentMutation = useMutation({
    mutationFn: async (docId: string) => {
      await managerToolsService.deleteDocument(docId, 'budget');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets', user?.uid] });
      toast({
        title: "Success",
        description: "Document deleted successfully"
      });
      setSelectedDocument(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete document",
        variant: "destructive"
      });
    }
  });

  const updateDocumentMutation = useMutation({
    mutationFn: async ({ docId, content }: { docId: string; content: string }) => {
      await managerToolsService.updateDocument(docId, 'budget', { content });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets', user?.uid] });
      toast({
        title: "Success",
        description: "Document updated successfully"
      });
      setIsEditMode(false);
      setSelectedDocument(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update document",
        variant: "destructive"
      });
    }
  });

  const handlePreviewBudget = async () => {
    if (!details.trim()) {
      toast({
        title: "Error",
        description: "Please enter the project details",
        variant: "destructive"
      });
      return;
    }

    try {
      await generatePreviewMutation.mutateAsync(details);
    } catch (error) {
      console.error("Error generating preview:", error);
    }
  };

  const handleGenerateBudget = async () => {
    try {
      setIsGenerating(true);
      await generateBudgetMutation.mutateAsync(details);
    } catch (error) {
      console.error("Error generating budget:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = async (doc: BudgetDocument) => {
    try {
      const blob = new Blob([doc.content], { type: 'text/plain' });
      const url = window.URL.createObjectURL(blob);
      const link = window.document.createElement('a');
      link.href = url;
      link.download = `budget-plan-${new Date(doc.createdAt.toDate()).toISOString().split('T')[0]}.txt`;
      window.document.body.appendChild(link);
      link.click();
      window.document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast({
        title: "Success",
        description: "Budget document downloaded successfully"
      });
    } catch (error) {
      console.error("Error downloading document:", error);
      toast({
        title: "Error",
        description: "Failed to download budget document",
        variant: "destructive"
      });
    }
  };

  const handleViewDocument = (doc: BudgetDocument) => {
    setSelectedDocument(doc);
    setEditContent(doc.content);
    setIsEditMode(false);
  };

  const handleEditDocument = () => {
    if (!selectedDocument) return;
    setIsEditMode(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedDocument) return;
    await updateDocumentMutation.mutateAsync({
      docId: selectedDocument.id,
      content: editContent
    });
  };

  const handleDeleteDocument = async (docId: string) => {
    if (confirm('Are you sure you want to delete this document?')) {
      await deleteDocumentMutation.mutateAsync(docId);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-3">
        {/* Template 1: Tour Budget */}
        <Card className="p-6 hover:shadow-lg transition-all">
          <div className="flex flex-col items-center text-center mb-6">
            <div className="p-4 bg-orange-500/10 rounded-full mb-4">
              <DollarSign className="h-8 w-8 text-orange-500" />
            </div>
            <h3 className="text-xl font-semibold">Tour Budget</h3>
            <p className="text-muted-foreground text-sm mt-2">
              Comprehensive budget for multi-city tours including venue costs, travel, and personnel.
            </p>
          </div>
          <Button 
            variant="outline" 
            className="w-full"
            onClick={() => {
              setDetails("Create a detailed budget for a 10-city North American tour for a 5-piece band with 3 crew members. Include venue fees, transportation (tour bus rental), accommodations, per diems, equipment rental, marketing expenses, merchandise production, and contingency funds.");
              setIsDialogOpen(true);
            }}
          >
            Use Template
          </Button>
        </Card>

        {/* Template 2: Music Video Budget */}
        <Card className="p-6 hover:shadow-lg transition-all">
          <div className="flex flex-col items-center text-center mb-6">
            <div className="p-4 bg-orange-500/10 rounded-full mb-4">
              <Calculator className="h-8 w-8 text-orange-500" />
            </div>
            <h3 className="text-xl font-semibold">Music Video Budget</h3>
            <p className="text-muted-foreground text-sm mt-2">
              Budget breakdown for professional music video production with full crew and equipment.
            </p>
          </div>
          <Button 
            variant="outline" 
            className="w-full"
            onClick={() => {
              setDetails("Generate a detailed music video production budget with the following components: Pre-production (location scouting, casting, storyboarding), Production (director fee, cinematographer, camera equipment rental, lighting, crew, location fees, wardrobe, makeup, catering), and Post-production (editing, color grading, visual effects, music licensing). Budget should be for a professional-quality video with a 2-day shoot.");
              setIsDialogOpen(true);
            }}
          >
            Use Template
          </Button>
        </Card>

        {/* Template 3: Album Recording Budget */}
        <Card className="p-6 hover:shadow-lg transition-all">
          <div className="flex flex-col items-center text-center mb-6">
            <div className="p-4 bg-orange-500/10 rounded-full mb-4">
              <ChevronRight className="h-8 w-8 text-orange-500" />
            </div>
            <h3 className="text-xl font-semibold">Album Recording</h3>
            <p className="text-muted-foreground text-sm mt-2">
              Complete budget for studio album recording including production, mixing, and mastering costs.
            </p>
          </div>
          <Button 
            variant="outline" 
            className="w-full"
            onClick={() => {
              setDetails("Create a comprehensive budget for recording a 10-track album. Include studio rental costs (15 days of recording), producer fees, session musicians, engineer fees, equipment rental, mixing costs (per track), mastering costs, album artwork design, and miscellaneous expenses like catering and transportation.");
              setIsDialogOpen(true);
            }}
          >
            Use Template
          </Button>
        </Card>
      </div>

      {/* Custom Budget Creator */}
      <Card className="p-6 hover:shadow-lg transition-all mt-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="p-4 bg-orange-500/10 rounded-xl">
            <DollarSign className="h-8 w-8 text-orange-500" />
          </div>
          <div>
            <h3 className="text-2xl font-semibold">Custom Budget Plan</h3>
            <p className="text-muted-foreground">
              Generate detailed project budgets tailored to your specific needs
            </p>
          </div>
        </div>

        <Button 
          className="w-full bg-orange-500 hover:bg-orange-600"
          onClick={() => setIsDialogOpen(true)}
        >
          <Calculator className="mr-2 h-5 w-5" />
          Create Budget Plan
        </Button>
      </Card>

      {/* My Budget Documents */}
      <Card className="p-6 hover:shadow-lg transition-all">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="p-4 bg-orange-500/10 rounded-xl">
              <Calculator className="h-8 w-8 text-orange-500" />
            </div>
            <div>
              <h3 className="text-2xl font-semibold">My Budget Documents</h3>
              <p className="text-muted-foreground">
                View and download your saved budget plans
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-orange-500" />
            </div>
          ) : budgetDocuments.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
              {budgetDocuments.map((doc: BudgetDocument) => (
                <div key={doc.id} className="p-4 rounded-xl bg-orange-500/5 hover:bg-orange-500/10 transition-colors border border-transparent hover:border-orange-200">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="font-medium">Budget Plan</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(doc.createdAt.toDate()).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="mt-2 mb-4">
                    <p className="text-sm line-clamp-3">{doc.content}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleViewDocument(doc)}
                      className="flex-1"
                      data-testid={`button-view-${doc.id}`}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      View
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownload(doc)}
                      data-testid={`button-download-${doc.id}`}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteDocument(doc.id)}
                      data-testid={`button-delete-${doc.id}`}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-muted-foreground py-8 border rounded-lg bg-muted/20">
              <Calculator className="h-10 w-10 text-muted-foreground/50 mx-auto mb-2" />
              <p>No budget documents generated yet</p>
              <Button 
                variant="link" 
                onClick={() => setIsDialogOpen(true)}
                className="mt-2"
              >
                Create your first budget plan
              </Button>
            </div>
          )}
        </div>
      </Card>

      {/* Budget Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[800px]">
          <DialogHeader>
            <DialogTitle>Generate Budget Plan</DialogTitle>
            <DialogDescription>
              Enter your project details to generate a comprehensive budget breakdown.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="details">Project Details</Label>
              <Textarea
                id="details"
                placeholder="Enter project name, type, scale, duration, location, and special requirements..."
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                className="min-h-[200px]"
              />
            </div>
            {isPreviewMode && previewContent && (
              <div className="space-y-2">
                <Label>Preview</Label>
                <div className="p-4 rounded-lg bg-muted/50 whitespace-pre-line max-h-[300px] overflow-y-auto">
                  {previewContent}
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="flex gap-2">
            {!isPreviewMode ? (
              <Button
                onClick={handlePreviewBudget}
                disabled={generatePreviewMutation.isPending || !details.trim()}
                className="w-full"
              >
                {generatePreviewMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating Preview...
                  </>
                ) : (
                  <>
                    <Eye className="mr-2 h-4 w-4" />
                    Preview Budget
                  </>
                )}
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={() => setIsPreviewMode(false)}
                  className="flex-1"
                >
                  Edit Details
                </Button>
                <Button
                  onClick={handleGenerateBudget}
                  disabled={generateBudgetMutation.isPending}
                  className="flex-1 bg-orange-500 hover:bg-orange-600"
                >
                  {generateBudgetMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    "Save Budget Plan"
                  )}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View/Edit Document Dialog */}
      <Dialog open={!!selectedDocument} onOpenChange={(open) => !open && setSelectedDocument(null)}>
        <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isEditMode ? 'Edit Budget Plan' : 'Budget Plan'}</DialogTitle>
            <DialogDescription>
              {selectedDocument && new Date(selectedDocument.createdAt.toDate()).toLocaleDateString()}
            </DialogDescription>
          </DialogHeader>
          
          {isEditMode ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-content">Content</Label>
                <Textarea
                  id="edit-content"
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="min-h-[400px] font-mono text-sm"
                  data-testid="textarea-edit-content"
                />
              </div>
            </div>
          ) : (
            <div className="whitespace-pre-line p-4 rounded bg-muted/30 font-mono text-sm max-h-[400px] overflow-y-auto">
              {selectedDocument?.content}
            </div>
          )}
          
          <DialogFooter className="flex gap-2 sm:space-x-0">
            {isEditMode ? (
              <>
                <Button
                  variant="outline"
                  onClick={() => setIsEditMode(false)}
                  data-testid="button-cancel-edit"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveEdit}
                  disabled={updateDocumentMutation.isPending}
                  className="bg-orange-500 hover:bg-orange-600"
                  data-testid="button-save-edit"
                >
                  {updateDocumentMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save Changes'
                  )}
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={handleEditDocument}
                  data-testid="button-edit-document"
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </Button>
                <Button
                  variant="outline"
                  onClick={() => selectedDocument && handleDownload(selectedDocument)}
                  data-testid="button-download-document"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
