import { useState } from "react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { 
  Calendar as CalendarIcon, 
  Download, 
  Loader2, 
  Eye, 
  Plus, 
  Clock, 
  Calendar as CalendarIconFull,
  ListTodo,
  Edit,
  Trash2
} from "lucide-react";
import { Calendar } from "../ui/calendar";
import { managerToolsService } from "../../lib/services/managertoolsopenrouter";
import { useToast } from "../../hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from "../ui/dialog";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Input } from "../ui/input";
import { useAuth } from "../../hooks/use-auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { VisuallyHidden } from "../ui/visually-hidden";
import { format } from "date-fns";
import { downloadTextFile } from "../../lib/download-helper";

interface CalendarDocument {
  id: string;
  content: string;
  createdAt: any;
}

export function CalendarSection() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [isGenerating, setIsGenerating] = useState(false);
  const [details, setDetails] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [scheduleType, setScheduleType] = useState("event");
  const [selectedDocument, setSelectedDocument] = useState<CalendarDocument | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editContent, setEditContent] = useState("");

  const { data: calendarDocuments = [], isLoading } = useQuery({
    queryKey: ['calendar', user?.uid],
    queryFn: async () => {
      if (!user?.uid) return [];
      const data = await managerToolsService.getFromFirestore(user.uid, 'calendar');
      return data as CalendarDocument[];
    },
    enabled: !!user
  });

  const generatePreviewMutation = useMutation({
    mutationFn: async (details: string) => {
      if (!user?.uid) throw new Error("User not authenticated");
      const prompt = `Create a ${scheduleType} schedule plan for: ${details}. Include timeline, key milestones, responsibilities, and detailed breakdown of activities. Format the response with clear sections and time-based organization.`;
      const content = await managerToolsService.generateWithAI(prompt, 'calendar');
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

  const generateCalendarMutation = useMutation({
    mutationFn: async (details: string) => {
      if (!user?.uid) throw new Error("User not authenticated");
      return managerToolsService.generateContentByType('calendar', `${scheduleType}: ${details}`, user.uid);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar', user?.uid] });
      toast({
        title: "Success",
        description: "Schedule plan generated successfully"
      });
      setIsDialogOpen(false);
      setDetails("");
      setPreviewContent(null);
      setIsPreviewMode(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to generate schedule plan",
        variant: "destructive"
      });
    }
  });

  const deleteDocumentMutation = useMutation({
    mutationFn: async (docId: string) => {
      await managerToolsService.deleteDocument(docId, 'calendar');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar', user?.uid] });
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
      await managerToolsService.updateDocument(docId, 'calendar', { content });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar', user?.uid] });
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

  const handlePreviewSchedule = async () => {
    if (!details.trim()) {
      toast({
        title: "Error",
        description: "Please enter the schedule details",
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

  const handleGenerateSchedule = async () => {
    try {
      setIsGenerating(true);
      await generateCalendarMutation.mutateAsync(details);
    } catch (error) {
      console.error("Error generating schedule plan:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = async (doc: CalendarDocument) => {
    try {
      const filename = `schedule-plan-${new Date(doc.createdAt.toDate()).toISOString().split('T')[0]}.txt`;
      await downloadTextFile(doc.content, filename);
      
      toast({
        title: "Success",
        description: "Schedule plan downloaded successfully"
      });
    } catch (error) {
      console.error("Error downloading document:", error);
      toast({
        title: "Error",
        description: "Failed to download schedule plan",
        variant: "destructive"
      });
    }
  };

  const handleViewDocument = (doc: CalendarDocument) => {
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
        {/* Template 1: Concert Tour Schedule */}
        <Card className="p-6 hover:shadow-lg transition-all">
          <div className="flex flex-col items-center text-center mb-6">
            <div className="p-4 bg-orange-500/10 rounded-full mb-4">
              <CalendarIcon className="h-8 w-8 text-orange-500" />
            </div>
            <h3 className="text-xl font-semibold">Concert Tour</h3>
            <p className="text-muted-foreground text-sm mt-2">
              Comprehensive day-by-day tour schedule with travel, sound checks, and performances.
            </p>
          </div>
          <Button 
            variant="outline" 
            className="w-full"
            onClick={() => {
              setScheduleType("event");
              setDetails("Create a detailed 10-day tour schedule for a 5-piece rock band touring the East Coast. Include daily timeline for travel between cities, hotel check-in/out times, venue load-in, sound check, doors open, show time, meet & greet sessions, and load-out times. The tour begins in Boston and ends in Miami, with shows in New York, Philadelphia, Baltimore, and Atlanta in between.");
              setIsDialogOpen(true);
            }}
          >
            Use Template
          </Button>
        </Card>

        {/* Template 2: Album Production Schedule */}
        <Card className="p-6 hover:shadow-lg transition-all">
          <div className="flex flex-col items-center text-center mb-6">
            <div className="p-4 bg-orange-500/10 rounded-full mb-4">
              <Clock className="h-8 w-8 text-orange-500" />
            </div>
            <h3 className="text-xl font-semibold">Album Production</h3>
            <p className="text-muted-foreground text-sm mt-2">
              Detailed project schedule for album recording, production, and release activities.
            </p>
          </div>
          <Button 
            variant="outline" 
            className="w-full"
            onClick={() => {
              setScheduleType("project");
              setDetails("Create a comprehensive 3-month album production schedule for a 10-track album. Include pre-production phase (song selection, arrangement finalization, demo recording), recording phase (tracking drums, bass, guitars, keyboards, vocals, additional instruments), post-production (editing, mixing, mastering), and release preparation (artwork creation, distribution setup, press kit development, and marketing activities). Include specific timelines and milestone dates for each phase.");
              setIsDialogOpen(true);
            }}
          >
            Use Template
          </Button>
        </Card>

        {/* Template 3: Music Video Production */}
        <Card className="p-6 hover:shadow-lg transition-all">
          <div className="flex flex-col items-center text-center mb-6">
            <div className="p-4 bg-orange-500/10 rounded-full mb-4">
              <ListTodo className="h-8 w-8 text-orange-500" />
            </div>
            <h3 className="text-xl font-semibold">Music Video</h3>
            <p className="text-muted-foreground text-sm mt-2">
              Complete production schedule for a music video from pre-production through final delivery.
            </p>
          </div>
          <Button 
            variant="outline" 
            className="w-full"
            onClick={() => {
              setScheduleType("project");
              setDetails("Generate a detailed 6-week music video production schedule. Include pre-production phase (concept development, location scouting, casting, crew hiring, shot list creation), production phase (detailed shooting schedule for a 2-day shoot across 3 locations with call times for crew, talent, and equipment), and post-production (editing timeline, VFX integration, color grading, client review cycles, and final delivery). Include specific deadlines for all deliverables.");
              setIsDialogOpen(true);
            }}
          >
            Use Template
          </Button>
        </Card>
      </div>

      {/* Current Calendar */}
      <Card className="p-6 hover:shadow-lg transition-all">
        <div className="flex items-center gap-4 mb-4">
          <div className="p-4 bg-orange-500/10 rounded-xl">
            <CalendarIconFull className="h-8 w-8 text-orange-500" />
          </div>
          <div>
            <h3 className="text-2xl font-semibold">Current Calendar</h3>
            <p className="text-muted-foreground">
              Plan and manage your event schedule
            </p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <Calendar
            mode="single"
            selected={date}
            onSelect={setDate}
            className="rounded-md border self-start"
          />
          
          <div>
            <h4 className="font-semibold text-lg mb-3">Create Custom Schedule</h4>
            <p className="text-muted-foreground mb-4">Generate a detailed schedule plan for any type of music industry event or project.</p>
            <Button 
              className="w-full bg-orange-500 hover:bg-orange-600"
              onClick={() => setIsDialogOpen(true)}
            >
              <Plus className="mr-2 h-5 w-5" />
              Generate Schedule Plan
            </Button>
          </div>
        </div>
      </Card>

      {/* My Schedule Documents */}
      <Card className="p-6 hover:shadow-lg transition-all">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="p-4 bg-orange-500/10 rounded-xl">
              <Clock className="h-8 w-8 text-orange-500" />
            </div>
            <div>
              <h3 className="text-2xl font-semibold">My Schedule Documents</h3>
              <p className="text-muted-foreground">
                View and download your saved schedule plans
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-orange-500" />
            </div>
          ) : calendarDocuments.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
              {calendarDocuments.map((doc: CalendarDocument) => (
                <div key={doc.id} className="p-4 rounded-xl bg-orange-500/5 hover:bg-orange-500/10 transition-colors border border-transparent hover:border-orange-200">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="font-medium">Schedule Plan</p>
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
              <Clock className="h-10 w-10 text-muted-foreground/50 mx-auto mb-2" />
              <p>No schedule plans generated yet</p>
              <Button 
                variant="link" 
                onClick={() => setIsDialogOpen(true)}
                className="mt-2"
              >
                Create your first schedule plan
              </Button>
            </div>
          )}
        </div>
      </Card>

      {/* Schedule Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[800px]">
          <DialogHeader>
            <DialogTitle>Generate Schedule Plan</DialogTitle>
            <DialogDescription>
              Enter details to generate a comprehensive schedule plan for your event or project.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Schedule Type</Label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  <Button
                    type="button"
                    variant={scheduleType === "event" ? "default" : "outline"}
                    className={scheduleType === "event" ? "bg-orange-500" : ""}
                    onClick={() => setScheduleType("event")}
                  >
                    <CalendarIconFull className="mr-2 h-4 w-4" />
                    Event
                  </Button>
                  <Button
                    type="button"
                    variant={scheduleType === "project" ? "default" : "outline"}
                    className={scheduleType === "project" ? "bg-orange-500" : ""}
                    onClick={() => setScheduleType("project")}
                  >
                    <ListTodo className="mr-2 h-4 w-4" />
                    Project
                  </Button>
                </div>
              </div>
              <div>
                <Label htmlFor="event-date">Start Date</Label>
                <Input
                  id="event-date"
                  type="date"
                  className="mt-1"
                  defaultValue={format(new Date(), "yyyy-MM-dd")}
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="details">Schedule Details</Label>
              <Textarea
                id="details"
                placeholder={scheduleType === "event" ? 
                  "Enter event name, type, location, expected attendance, requirements..." : 
                  "Enter project name, goals, team size, timeline requirements..."}
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
                onClick={handlePreviewSchedule}
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
                    Preview Schedule
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
                  onClick={handleGenerateSchedule}
                  disabled={generateCalendarMutation.isPending}
                  className="flex-1 bg-orange-500 hover:bg-orange-600"
                >
                  {generateCalendarMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    "Save Schedule Plan"
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
            <DialogTitle>{isEditMode ? 'Edit Schedule Plan' : 'Schedule Plan'}</DialogTitle>
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