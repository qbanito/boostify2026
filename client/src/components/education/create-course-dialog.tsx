import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Textarea } from "../ui/textarea";
import { Sparkles, Loader2 } from "lucide-react";
import { useToast } from "../../hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";

interface CreateCourseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateCourseDialog({ open, onOpenChange }: CreateCourseDialogProps) {
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);
  const [formData, setFormData] = useState({
    topic: "",
    level: "Beginner" as "Beginner" | "Intermediate" | "Advanced",
    lessonsCount: "8",
    price: "0.00",
    dripStrategy: "sequential"
  });

  const handleGenerate = async () => {
    if (!formData.topic.trim()) {
      toast({
        title: "Topic required",
        description: "Please enter a course topic",
        variant: "destructive"
      });
      return;
    }

    setIsGenerating(true);
    try {
      const response = await apiRequest("/api/education/generate-course", {
        method: "POST",
        body: JSON.stringify({
          topic: formData.topic,
          level: formData.level,
          lessonsCount: parseInt(formData.lessonsCount),
          price: formData.price,
          dripStrategy: formData.dripStrategy
        })
      });

      toast({
        title: "🎉 Course Created!",
        description: `"${response.course.title}" has been generated with ${response.lessons.length} lessons. Content will be generated progressively as students advance.`,
      });

      queryClient.invalidateQueries({ queryKey: ["/api/education/courses"] });
      
      onOpenChange(false);
      
      setFormData({
        topic: "",
        level: "Beginner",
        lessonsCount: "8",
        price: "0.00",
        dripStrategy: "sequential"
      });
    } catch (error: any) {
      toast({
        title: "Generation Failed",
        description: error.message || "Failed to generate course",
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Generate AI Course
          </DialogTitle>
          <DialogDescription>
            Create a comprehensive course with AI-generated content, images, and quizzes.
            Content is generated progressively as students advance.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="topic">Course Topic *</Label>
            <Input
              id="topic"
              placeholder="e.g., Music Production Fundamentals"
              value={formData.topic}
              onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
              data-testid="input-course-topic"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="level">Level</Label>
              <Select value={formData.level} onValueChange={(value: any) => setFormData({ ...formData, level: value })}>
                <SelectTrigger data-testid="select-course-level">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Beginner">Beginner</SelectItem>
                  <SelectItem value="Intermediate">Intermediate</SelectItem>
                  <SelectItem value="Advanced">Advanced</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="lessonsCount">Lessons</Label>
              <Input
                id="lessonsCount"
                type="number"
                min="3"
                max="20"
                value={formData.lessonsCount}
                onChange={(e) => setFormData({ ...formData, lessonsCount: e.target.value })}
                data-testid="input-lessons-count"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="price">Price ($)</Label>
              <Input
                id="price"
                type="number"
                step="0.01"
                min="0"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                data-testid="input-course-price"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dripStrategy">Unlock Strategy</Label>
              <Select value={formData.dripStrategy} onValueChange={(value) => setFormData({ ...formData, dripStrategy: value })}>
                <SelectTrigger data-testid="select-drip-strategy">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sequential">Sequential (Complete previous)</SelectItem>
                  <SelectItem value="enrollment">Time-based (Days after enrollment)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isGenerating}
          >
            Cancel
          </Button>
          <Button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="gap-2"
            data-testid="button-generate-course"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Generate Course
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
