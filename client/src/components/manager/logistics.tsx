import { useState } from "react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Truck, Download, Loader2, ChevronRight, Eye, Upload, CalendarDays, MapPin, Edit, Trash2 } from "lucide-react";
import { managerToolsService } from "../../lib/services/managertoolsopenrouter";
import { useToast } from "../../hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from "../ui/dialog";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { useAuth } from "../../hooks/use-auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { VisuallyHidden } from "../ui/visually-hidden";
import { downloadTextFile } from "../../lib/download-helper";

interface LogisticsDocument {
  id: string;
  content: string;
  createdAt: any;
}

export function LogisticsSection() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isGenerating, setIsGenerating] = useState(false);
  const [details, setDetails] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<LogisticsDocument | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editContent, setEditContent] = useState("");

  const { data: logisticsDocuments = [], isLoading } = useQuery({
    queryKey: ['logistics', user?.uid],
    queryFn: async () => {
      if (!user?.uid) return [];
      const data = await managerToolsService.getFromFirestore(user.uid, 'logistics');
      return data as LogisticsDocument[];
    },
    enabled: !!user
  });

  const generatePreviewMutation = useMutation({
    mutationFn: async (details: string) => {
      if (!user?.uid) throw new Error("User not authenticated");
      const prompt = `Create a detailed logistics plan for this event/tour: ${details}. Include transportation, accommodation, equipment handling, and timeline. Format as a comprehensive plan with clear sections for each aspect of logistics management.`;
      const content = await managerToolsService.generateWithAI(prompt, 'logistics');
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

  const generateLogisticsMutation = useMutation({
    mutationFn: async (details: string) => {
      if (!user?.uid) throw new Error("User not authenticated");
      return managerToolsService.generateContentByType('logistics', details, user.uid);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['logistics', user?.uid] });
      toast({
        title: "Success",
        description: "Logistics plan generated successfully"
      });
      setIsDialogOpen(false);
      setDetails("");
      setPreviewContent(null);
      setIsPreviewMode(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to generate logistics plan",
        variant: "destructive"
      });
    }
  });

  const deleteDocumentMutation = useMutation({
    mutationFn: async (docId: string) => {
      await managerToolsService.deleteDocument(docId, 'logistics');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['logistics', user?.uid] });
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
      await managerToolsService.updateDocument(docId, 'logistics', { content });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['logistics', user?.uid] });
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

  const handlePreviewLogistics = async () => {
    if (!details.trim()) {
      toast({
        title: "Error",
        description: "Please enter the event/tour details",
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

  const handleGenerateLogistics = async () => {
    try {
      setIsGenerating(true);
      await generateLogisticsMutation.mutateAsync(details);
    } catch (error) {
      console.error("Error generating logistics plan:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = async (doc: LogisticsDocument) => {
    try {
      const filename = `logistics-plan-${new Date(doc.createdAt.toDate()).toISOString().split('T')[0]}.txt`;
      await downloadTextFile(doc.content, filename);
      
      toast({
        title: "Success",
        description: "Logistics plan downloaded successfully"
      });
    } catch (error) {
      console.error("Error downloading document:", error);
      toast({
        title: "Error",
        description: "Failed to download logistics plan",
        variant: "destructive"
      });
    }
  };

  const handleViewDocument = (doc: LogisticsDocument) => {
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
        {/* Template 1: Tour Logistics */}
        <Card className="p-6 hover:shadow-lg transition-all">
          <div className="flex flex-col items-center text-center mb-6">
            <div className="p-4 bg-orange-500/10 rounded-full mb-4">
              <Truck className="h-8 w-8 text-orange-500" />
            </div>
            <h3 className="text-xl font-semibold">Tour Logistics</h3>
            <p className="text-muted-foreground text-sm mt-2">
              Comprehensive logistics plan for multi-city tours including transportation, equipment, and timeline.
            </p>
          </div>
          <Button 
            variant="outline" 
            className="w-full"
            onClick={() => {
              setDetails("Create a complete logistics plan for a 12-city North American tour with a 5-piece band and 4 crew members. The tour spans 3 weeks and requires transportation of musical equipment (drums, guitars, keyboards, amplifiers), lighting equipment, and merchandise. Include detailed transportation scheduling (flights, tour bus routes), equipment loading/unloading procedures, venue arrival times, and sound check scheduling.");
              setIsDialogOpen(true);
            }}
          >
            Use Template
          </Button>
        </Card>

        {/* Template 2: Festival Logistics */}
        <Card className="p-6 hover:shadow-lg transition-all">
          <div className="flex flex-col items-center text-center mb-6">
            <div className="p-4 bg-orange-500/10 rounded-full mb-4">
              <MapPin className="h-8 w-8 text-orange-500" />
            </div>
            <h3 className="text-xl font-semibold">Festival Logistics</h3>
            <p className="text-muted-foreground text-sm mt-2">
              Detailed logistics plan for participating in a major music festival with quick equipment changeovers.
            </p>
          </div>
          <Button 
            variant="outline" 
            className="w-full"
            onClick={() => {
              setDetails("Create a logistics plan for a band performing at a major 3-day music festival with an allocated 45-minute set. Include detailed scheduling for equipment load-in, stage setup (30-minute changeover time), performance, and load-out. Address transportation of band and equipment to and from the festival grounds, backline sharing with other artists, and coordination with festival stage managers and sound engineers. Include contingency plans for weather-related delays.");
              setIsDialogOpen(true);
            }}
          >
            Use Template
          </Button>
        </Card>

        {/* Template 3: Video Shoot Logistics */}
        <Card className="p-6 hover:shadow-lg transition-all">
          <div className="flex flex-col items-center text-center mb-6">
            <div className="p-4 bg-orange-500/10 rounded-full mb-4">
              <CalendarDays className="h-8 w-8 text-orange-500" />
            </div>
            <h3 className="text-xl font-semibold">Video Shoot</h3>
            <p className="text-muted-foreground text-sm mt-2">
              Complete logistics plan for a multi-location music video production with equipment and personnel.
            </p>
          </div>
          <Button 
            variant="outline" 
            className="w-full"
            onClick={() => {
              setDetails("Develop a comprehensive logistics plan for a 3-day music video shoot across 4 different locations in Los Angeles. The production includes a 6-person band, 15-person film crew, camera and lighting equipment, wardrobe, and props. Include detailed scheduling for each location, transportation between sites, equipment setup and breakdown, meals and craft services, talent call times, and contingency plans for potential issues (weather, location access, equipment failure).");
              setIsDialogOpen(true);
            }}
          >
            Use Template
          </Button>
        </Card>
      </div>

      {/* Custom Logistics Creator */}
      <Card className="p-6 hover:shadow-lg transition-all mt-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="p-4 bg-orange-500/10 rounded-xl">
            <Truck className="h-8 w-8 text-orange-500" />
          </div>
          <div>
            <h3 className="text-2xl font-semibold">Custom Logistics Plan</h3>
            <p className="text-muted-foreground">
              Generate detailed logistics plans tailored to your specific needs
            </p>
          </div>
        </div>

        <Button 
          className="w-full bg-orange-500 hover:bg-orange-600"
          onClick={() => setIsDialogOpen(true)}
        >
          <Truck className="mr-2 h-5 w-5" />
          Create Logistics Plan
        </Button>
      </Card>

      {/* My Logistics Documents */}
      <Card className="p-6 hover:shadow-lg transition-all">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="p-4 bg-orange-500/10 rounded-xl">
              <MapPin className="h-8 w-8 text-orange-500" />
            </div>
            <div>
              <h3 className="text-2xl font-semibold">My Logistics Documents</h3>
              <p className="text-muted-foreground">
                View and download your saved logistics plans
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-orange-500" />
            </div>
          ) : logisticsDocuments.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
              {logisticsDocuments.map((doc: LogisticsDocument) => (
                <div key={doc.id} className="p-4 rounded-xl bg-orange-500/5 hover:bg-orange-500/10 transition-colors border border-transparent hover:border-orange-200">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="font-medium">Logistics Plan</p>
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
              <Truck className="h-10 w-10 text-muted-foreground/50 mx-auto mb-2" />
              <p>No logistics plans generated yet</p>
              <Button 
                variant="link" 
                onClick={() => setIsDialogOpen(true)}
                className="mt-2"
              >
                Create your first logistics plan
              </Button>
            </div>
          )}
        </div>
      </Card>

      {/* Logistics Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[800px]">
          <DialogHeader>
            <DialogTitle>Generate Logistics Plan</DialogTitle>
            <DialogDescription>
              Enter event/tour details to generate a comprehensive logistics plan for smooth operations.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="details">Event/Tour Details</Label>
              <Textarea
                id="details"
                placeholder="Enter event name, location, date, type, number of personnel, equipment needs, special requirements..."
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
                onClick={handlePreviewLogistics}
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
                    Preview Plan
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
                  onClick={handleGenerateLogistics}
                  disabled={generateLogisticsMutation.isPending}
                  className="flex-1 bg-orange-500 hover:bg-orange-600"
                >
                  {generateLogisticsMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    "Save Logistics Plan"
                  )}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View/Edit Dialog */}
      <Dialog open={!!selectedDocument} onOpenChange={() => setSelectedDocument(null)}>
        <DialogContent className="sm:max-w-[800px]">
          <DialogHeader>
            <DialogTitle>
              {isEditMode ? "Edit Logistics Plan" : "View Logistics Plan"}
            </DialogTitle>
            <DialogDescription>
              {isEditMode 
                ? "Make changes to your logistics plan below"
                : "Review your logistics plan details"
              }
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {selectedDocument && (
              <div className="space-y-2">
                <Label>Content</Label>
                {isEditMode ? (
                  <Textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="min-h-[400px] font-mono text-sm"
                  />
                ) : (
                  <div className="p-4 rounded-lg bg-muted/50 whitespace-pre-line max-h-[400px] overflow-y-auto">
                    {selectedDocument.content}
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter className="flex gap-2">
            {isEditMode ? (
              <>
                <Button
                  variant="outline"
                  onClick={() => setIsEditMode(false)}
                  disabled={updateDocumentMutation.isPending}
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
                  onClick={() => setSelectedDocument(null)}
                >
                  Close
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
