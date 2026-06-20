import { Card } from "../ui/card";
import { Brain, Wand2, Calculator, ChartBar, ArrowRight, Loader2, MessageSquare, Download, Sparkles, Edit, Trash2, Eye } from "lucide-react";
import { Button } from "../ui/button";
import { useState } from "react";
import { Textarea } from "../ui/textarea";
import { useAuth } from "../../hooks/use-auth";
import { useToast } from "../../hooks/use-toast";
import { managerToolsService } from "../../lib/services/managertoolsopenrouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { VisuallyHidden } from "../ui/visually-hidden";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../ui/dialog";
import { Label } from "../ui/label";

interface AIResponse {
  id: string;
  content: string;
  prompt: string;
  createdAt: any;
}

export function AIToolsSection() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedResponse, setSelectedResponse] = useState<AIResponse | null>(null);
  const [selectedDocument, setSelectedDocument] = useState<AIResponse | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editContent, setEditContent] = useState("");

  const { data: aiResponses = [], isLoading } = useQuery({
    queryKey: ['ai_tools', user?.uid],
    queryFn: async () => {
      if (!user?.uid) return [];
      const data = await managerToolsService.getFromFirestore(user.uid, 'ai');
      return data as AIResponse[];
    },
    enabled: !!user
  });

  const generateMutation = useMutation({
    mutationFn: async (prompt: string) => {
      if (!user?.uid) throw new Error("User not authenticated");
      const result = await managerToolsService.generateWithAI(prompt, 'ai');
      
      // Save the response to Firestore
      await managerToolsService.saveToFirestore({
        type: 'ai',
        content: result,
        prompt: prompt,
        userId: user.uid,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai_tools', user?.uid] });
      toast({
        title: "Success",
        description: "AI response generated successfully"
      });
      setPrompt("");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to generate response",
        variant: "destructive"
      });
    }
  });

  const deleteDocumentMutation = useMutation({
    mutationFn: async (docId: string) => {
      await managerToolsService.deleteDocument(docId, 'ai');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai_tools', user?.uid] });
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
      await managerToolsService.updateDocument(docId, 'ai', { content });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai_tools', user?.uid] });
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

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast({
        title: "Error",
        description: "Please enter your question or request",
        variant: "destructive"
      });
      return;
    }

    try {
      setIsGenerating(true);
      await generateMutation.mutateAsync(prompt);
    } catch (error) {
      console.error("Error generating response:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = async (response: AIResponse) => {
    try {
      const content = `Question: ${response.prompt}\n\nAnswer: ${response.content}`;
      const blob = new Blob([content], { type: 'text/plain' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `ai-response-${new Date(response.createdAt.toDate()).toISOString().split('T')[0]}.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast({
        title: "Success",
        description: "AI response downloaded successfully"
      });
    } catch (error) {
      console.error("Error downloading response:", error);
      toast({
        title: "Error",
        description: "Failed to download AI response",
        variant: "destructive"
      });
    }
  };

  const handleActionClick = (actionPrompt: string) => {
    setPrompt(actionPrompt);
    setTimeout(() => {
      handleGenerate();
    }, 100);
  };

  const handleViewDocument = (doc: AIResponse) => {
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
    <div className="grid gap-8 md:grid-cols-2">
      {/* AI Assistant Card */}
      <Card className="p-6 hover:shadow-lg transition-all">
        <div className="flex items-center gap-4 mb-6">
          <div className="p-4 bg-orange-500/10 rounded-xl">
            <Brain className="h-8 w-8 text-orange-500" />
          </div>
          <div>
            <h3 className="text-2xl font-semibold">AI Assistant</h3>
            <p className="text-muted-foreground">
              Get AI-powered insights and recommendations
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="p-4 rounded-xl border border-orange-500/20 hover:border-orange-500/40 hover:bg-orange-500/5 transition-all">
            <h4 className="font-medium mb-4">Ask AI Assistant</h4>
            <Textarea
              className="mb-4 min-h-[120px]"
              placeholder="Ask about management strategies, technical requirements, or get recommendations..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            />
            <Button 
              className="w-full bg-orange-500 hover:bg-orange-600"
              onClick={handleGenerate}
              disabled={isGenerating || !prompt.trim()}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  Get AI Response
                  <Sparkles className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </div>

        <div className="mt-6">
          <h4 className="font-medium mb-4">Quick Actions</h4>
          <div className="grid gap-3">
            {[
              { icon: Calculator, text: "Budget Analysis", prompt: "Analyze my event budget and provide cost-saving recommendations" },
              { icon: ChartBar, text: "Performance Insights", prompt: "Analyze recent performance metrics and suggest improvements" },
              { icon: MessageSquare, text: "Marketing Ideas", prompt: "Generate creative marketing ideas for my next music event" }
            ].map((action, index) => (
              <Button
                key={index}
                variant="outline"
                className="h-auto py-3 px-4 flex items-center justify-start gap-3 hover:bg-orange-500/5"
                onClick={() => handleActionClick(action.prompt)}
              >
                <action.icon className="h-5 w-5 text-orange-500 flex-shrink-0" />
                <span className="text-left">{action.text}</span>
              </Button>
            ))}
          </div>
        </div>
      </Card>

      {/* Response History Card */}
      <Card className="p-6 hover:shadow-lg transition-all">
        <div className="flex items-center gap-4 mb-6">
          <div className="p-4 bg-orange-500/10 rounded-xl">
            <MessageSquare className="h-8 w-8 text-orange-500" />
          </div>
          <div>
            <h3 className="text-2xl font-semibold">Response History</h3>
            <p className="text-muted-foreground">
              View past AI assistant responses
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-orange-500" />
            </div>
          ) : aiResponses.length > 0 ? (
            aiResponses.map((response: AIResponse) => (
              <div key={response.id} className="p-4 rounded-xl bg-orange-500/5 hover:bg-orange-500/10 transition-colors">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="font-medium line-clamp-1">{response.prompt}</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(response.createdAt.toDate()).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="mt-2 mb-4">
                  <p className="text-sm line-clamp-3">{response.content}</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleViewDocument(response)}
                    className="flex-1"
                    data-testid={`button-view-${response.id}`}
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    View
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDownload(response)}
                    data-testid={`button-download-${response.id}`}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeleteDocument(response.id)}
                    data-testid={`button-delete-${response.id}`}
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center text-muted-foreground py-8">
              No AI responses yet. Ask a question to get started!
            </div>
          )}
        </div>
      </Card>

      {/* View/Edit Document Dialog */}
      <Dialog open={!!selectedDocument} onOpenChange={(open) => !open && setSelectedDocument(null)}>
        <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isEditMode ? 'Edit AI Response' : 'AI Response'}</DialogTitle>
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