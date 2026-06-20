import { useState } from "react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Users, Download, Loader2, ChevronRight, Eye, FileText, UserPlus, Edit, Trash2 } from "lucide-react";
import { managerToolsService } from "../../lib/services/managertoolsopenrouter";
import { useToast } from "../../hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from "../ui/dialog";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { useAuth } from "../../hooks/use-auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { VisuallyHidden } from "../ui/visually-hidden";
import { downloadTextFile } from "../../lib/download-helper";

interface HiringDocument {
  id: string;
  content: string;
  createdAt: any;
}

export function HiringSection() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isGenerating, setIsGenerating] = useState(false);
  const [positions, setPositions] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<HiringDocument | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editContent, setEditContent] = useState("");

  const { data: hiringDocuments = [], isLoading } = useQuery({
    queryKey: ['hiring', user?.uid],
    queryFn: async () => {
      if (!user?.uid) return [];
      const data = await managerToolsService.getFromFirestore(user.uid, 'hiring');
      return data as HiringDocument[];
    },
    enabled: !!user
  });

  const generatePreviewMutation = useMutation({
    mutationFn: async (positions: string) => {
      if (!user?.uid) throw new Error("User not authenticated");
      const prompt = `Create detailed job descriptions and requirements for these positions: ${positions}. Include responsibilities, qualifications, experience needed, and any specific music industry skills required. Format each position with clear sections.`;
      const content = await managerToolsService.generateWithAI(prompt, 'hiring');
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

  const generateHiringMutation = useMutation({
    mutationFn: async (positions: string) => {
      if (!user?.uid) throw new Error("User not authenticated");
      return managerToolsService.generateContentByType('hiring', positions, user.uid);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hiring', user?.uid] });
      toast({
        title: "Success",
        description: "Job descriptions generated successfully"
      });
      setIsDialogOpen(false);
      setPositions("");
      setPreviewContent(null);
      setIsPreviewMode(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to generate job descriptions",
        variant: "destructive"
      });
    }
  });

  const deleteDocumentMutation = useMutation({
    mutationFn: async (docId: string) => {
      await managerToolsService.deleteDocument(docId, 'hiring');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hiring', user?.uid] });
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
      await managerToolsService.updateDocument(docId, 'hiring', { content });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hiring', user?.uid] });
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

  const handlePreviewPositions = async () => {
    if (!positions.trim()) {
      toast({
        title: "Error",
        description: "Please enter the position details",
        variant: "destructive"
      });
      return;
    }

    try {
      await generatePreviewMutation.mutateAsync(positions);
    } catch (error) {
      console.error("Error generating preview:", error);
    }
  };

  const handleGeneratePositions = async () => {
    try {
      setIsGenerating(true);
      await generateHiringMutation.mutateAsync(positions);
    } catch (error) {
      console.error("Error generating job descriptions:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = async (doc: HiringDocument) => {
    try {
      const filename = `job-descriptions-${new Date(doc.createdAt.toDate()).toISOString().split('T')[0]}.txt`;
      await downloadTextFile(doc.content, filename);
      
      toast({
        title: "Success",
        description: "Job descriptions downloaded successfully"
      });
    } catch (error) {
      console.error("Error downloading document:", error);
      toast({
        title: "Error",
        description: "Failed to download job descriptions",
        variant: "destructive"
      });
    }
  };

  const handleViewDocument = (doc: HiringDocument) => {
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
        {/* Template 1: Tour Staff */}
        <Card className="p-6 hover:shadow-lg transition-all">
          <div className="flex flex-col items-center text-center mb-6">
            <div className="p-4 bg-orange-500/10 rounded-full mb-4">
              <Users className="h-8 w-8 text-orange-500" />
            </div>
            <h3 className="text-xl font-semibold">Tour Staff</h3>
            <p className="text-muted-foreground text-sm mt-2">
              Job descriptions for essential tour personnel including technical, management, and support roles.
            </p>
          </div>
          <Button 
            variant="outline" 
            className="w-full"
            onClick={() => {
              setPositions("Create detailed job descriptions for the following tour staff positions: Tour Manager (responsible for overall tour coordination), Front of House Sound Engineer (5+ years experience, knowledge of digital consoles), Monitor Engineer, Lighting Designer/Operator, Guitar/Backline Technician, Drum Technician, Stage Manager, and Tour Coordinator (logistics, accommodations, transportation).");
              setIsDialogOpen(true);
            }}
          >
            Use Template
          </Button>
        </Card>

        {/* Template 2: Studio Team */}
        <Card className="p-6 hover:shadow-lg transition-all">
          <div className="flex flex-col items-center text-center mb-6">
            <div className="p-4 bg-orange-500/10 rounded-full mb-4">
              <FileText className="h-8 w-8 text-orange-500" />
            </div>
            <h3 className="text-xl font-semibold">Studio Team</h3>
            <p className="text-muted-foreground text-sm mt-2">
              Comprehensive job descriptions for recording studio personnel and production professionals.
            </p>
          </div>
          <Button 
            variant="outline" 
            className="w-full"
            onClick={() => {
              setPositions("Generate detailed job descriptions for a professional recording studio team: Head Recording Engineer (10+ years experience with major label credits), Assistant Engineers (2), Pro Tools Operator/Editor (expert level with extensive plugin knowledge), Studio Manager, Booking Coordinator, Session Musicians Coordinator, and Maintenance Technician (experienced with vintage and modern recording equipment).");
              setIsDialogOpen(true);
            }}
          >
            Use Template
          </Button>
        </Card>

        {/* Template 3: Event Production Team */}
        <Card className="p-6 hover:shadow-lg transition-all">
          <div className="flex flex-col items-center text-center mb-6">
            <div className="p-4 bg-orange-500/10 rounded-full mb-4">
              <ChevronRight className="h-8 w-8 text-orange-500" />
            </div>
            <h3 className="text-xl font-semibold">Event Production</h3>
            <p className="text-muted-foreground text-sm mt-2">
              Job descriptions for a complete event production team for concerts, festivals and special events.
            </p>
          </div>
          <Button 
            variant="outline" 
            className="w-full"
            onClick={() => {
              setPositions("Create comprehensive job descriptions for the following event production positions: Production Manager, Stage Manager, FOH Audio Engineer, Monitor Engineer, Lighting Designer, Video Director, Backline Manager, Rigger, Set Construction Manager, Event Safety Officer, Artist Relations Coordinator, Catering Manager, and Volunteer Coordinator. Include experience requirements, responsibilities, and necessary certifications for each role.");
              setIsDialogOpen(true);
            }}
          >
            Use Template
          </Button>
        </Card>
      </div>

      {/* Custom Job Descriptions Creator */}
      <Card className="p-6 hover:shadow-lg transition-all mt-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="p-4 bg-orange-500/10 rounded-xl">
            <Users className="h-8 w-8 text-orange-500" />
          </div>
          <div>
            <h3 className="text-2xl font-semibold">Custom Job Descriptions</h3>
            <p className="text-muted-foreground">
              Generate tailored job descriptions for any music industry position
            </p>
          </div>
        </div>

        <Button 
          className="w-full bg-orange-500 hover:bg-orange-600"
          onClick={() => setIsDialogOpen(true)}
        >
          <UserPlus className="mr-2 h-5 w-5" />
          Create Job Descriptions
        </Button>
      </Card>

      {/* My Job Descriptions */}
      <Card className="p-6 hover:shadow-lg transition-all">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="p-4 bg-orange-500/10 rounded-xl">
              <FileText className="h-8 w-8 text-orange-500" />
            </div>
            <div>
              <h3 className="text-2xl font-semibold">My Job Descriptions</h3>
              <p className="text-muted-foreground">
                View and download your saved job descriptions
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-orange-500" />
            </div>
          ) : hiringDocuments.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
              {hiringDocuments.map((doc: HiringDocument) => (
                <div key={doc.id} className="p-4 rounded-xl bg-orange-500/5 hover:bg-orange-500/10 transition-colors border border-transparent hover:border-orange-200">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="font-medium">Job Descriptions</p>
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
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      <span className="hidden sm:inline">View</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownload(doc)}
                      className="flex-1"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      <span className="hidden sm:inline">Download</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteDocument(doc.id)}
                      className="flex-1"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      <span className="hidden sm:inline">Delete</span>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-muted-foreground py-8 border rounded-lg bg-muted/20">
              <Users className="h-10 w-10 text-muted-foreground/50 mx-auto mb-2" />
              <p>No job descriptions generated yet</p>
              <Button 
                variant="link" 
                onClick={() => setIsDialogOpen(true)}
                className="mt-2"
              >
                Create your first job descriptions
              </Button>
            </div>
          )}
        </div>
      </Card>

      {/* Hiring Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[800px]">
          <DialogHeader>
            <DialogTitle>Generate Job Descriptions</DialogTitle>
            <DialogDescription>
              Enter the positions you need to fill and their requirements to generate comprehensive job descriptions.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="positions">Position Details</Label>
              <Textarea
                id="positions"
                placeholder="Enter positions (e.g., Sound Engineer, Stage Manager, etc.), experience level, and any specific requirements..."
                value={positions}
                onChange={(e) => setPositions(e.target.value)}
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
                onClick={handlePreviewPositions}
                disabled={generatePreviewMutation.isPending || !positions.trim()}
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
                    Preview Descriptions
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
                  onClick={handleGeneratePositions}
                  disabled={generateHiringMutation.isPending}
                  className="flex-1 bg-orange-500 hover:bg-orange-600"
                >
                  {generateHiringMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    "Save Job Descriptions"
                  )}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View/Edit Document Dialog */}
      <Dialog open={!!selectedDocument} onOpenChange={(open) => !open && setSelectedDocument(null)}>
        <DialogContent className="sm:max-w-[800px]">
          <DialogHeader>
            <DialogTitle>
              {isEditMode ? "Edit Job Descriptions" : "View Job Descriptions"}
            </DialogTitle>
            <VisuallyHidden>
              <DialogDescription>
                {isEditMode ? "Edit your job descriptions document" : "View your job descriptions document"}
              </DialogDescription>
            </VisuallyHidden>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {selectedDocument && (
              <>
                <div className="text-sm text-muted-foreground">
                  Created: {new Date(selectedDocument.createdAt.toDate()).toLocaleDateString()}
                </div>
                {isEditMode ? (
                  <div className="space-y-2">
                    <Label htmlFor="edit-content">Content</Label>
                    <Textarea
                      id="edit-content"
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      className="min-h-[400px] font-mono text-sm"
                    />
                  </div>
                ) : (
                  <div className="p-4 rounded-lg bg-muted/50 whitespace-pre-line max-h-[500px] overflow-y-auto">
                    {selectedDocument.content}
                  </div>
                )}
              </>
            )}
          </div>
          <DialogFooter className="flex gap-2">
            {isEditMode ? (
              <>
                <Button
                  variant="outline"
                  onClick={() => setIsEditMode(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveEdit}
                  disabled={updateDocumentMutation.isPending}
                  className="bg-orange-500 hover:bg-orange-600"
                >
                  {updateDocumentMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Changes"
                  )}
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={() => selectedDocument && handleDownload(selectedDocument)}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download
                </Button>
                <Button
                  onClick={handleEditDocument}
                  className="bg-orange-500 hover:bg-orange-600"
                >
                  <Edit className="mr-2 h-4 w-4" />
                  Edit
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}