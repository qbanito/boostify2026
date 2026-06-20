import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { useToast } from "../../hooks/use-toast";
import { useAuth } from "../../hooks/use-auth";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { recordLabelService } from "../../lib/services/record-label-service";

interface ServiceDialogProps {
  type: 'remix' | 'mastering' | 'video';
  title: string;
  description: string;
  children: React.ReactNode;
}

export function ServiceDialog({ type, title, description, children }: ServiceDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState({
    track: '',
    style: '',
    reference: ''
  });

  const mutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (!user?.uid) throw new Error("User not authenticated");
      
      switch (type) {
        case 'remix':
          return recordLabelService.generateRemix(data.track, data.style, user.uid);
        case 'mastering':
          return recordLabelService.generateMaster(data.track, data.reference, user.uid);
        case 'video':
          return recordLabelService.generateMusicVideo(data.track, data.style, user.uid);
        default:
          throw new Error(`Unknown service type: ${type}`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['record-label-services'] });
      toast({
        title: "Success",
        description: "Service request generated successfully"
      });
      setIsOpen(false);
      setFormData({ track: '', style: '', reference: '' });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to generate service request",
        variant: "destructive"
      });
    }
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await mutation.mutateAsync(formData);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="track">Track Name or URL</Label>
            <Input
              id="track"
              value={formData.track}
              onChange={(e) => setFormData(prev => ({ ...prev, track: e.target.value }))}
              placeholder="Enter track name or URL"
            />
          </div>
          {type !== 'mastering' && (
            <div className="grid gap-2">
              <Label htmlFor="style">Style</Label>
              <Input
                id="style"
                value={formData.style}
                onChange={(e) => setFormData(prev => ({ ...prev, style: e.target.value }))}
                placeholder={`Enter desired ${type} style`}
              />
            </div>
          )}
          {type === 'mastering' && (
            <div className="grid gap-2">
              <Label htmlFor="reference">Reference Track</Label>
              <Input
                id="reference"
                value={formData.reference}
                onChange={(e) => setFormData(prev => ({ ...prev, reference: e.target.value }))}
                placeholder="Enter reference track"
              />
            </div>
          )}
        </form>
        <DialogFooter>
          <Button
            type="submit"
            onClick={handleSubmit}
            disabled={mutation.isPending || !formData.track || (!formData.style && !formData.reference)}
          >
            {mutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              "Generate"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
