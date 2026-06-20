import { useState } from "react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../ui/dialog";
import { Clock, ArrowRight, Loader2 } from "lucide-react";

export function TimelineEditor() {
  const [isLoading, setIsLoading] = useState(false);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Card className="p-4 sm:p-6 hover:shadow-lg transition-all duration-300 bg-gradient-to-br from-background to-orange-500/5">
          <Clock className="h-8 w-8 text-orange-500 mb-4" />
          <h3 className="text-lg sm:text-xl font-semibold mb-2">Timeline Editor</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Sync music to video timeline with precision
          </p>
          <Button className="w-full bg-orange-500 hover:bg-orange-600">
            Open Timeline Editor
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </Card>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[800px]">
        <DialogHeader>
          <DialogTitle>Timeline Editor Studio</DialogTitle>
        </DialogHeader>
        <div className="grid gap-6 py-4">
          <div className="space-y-4">
            <div>
              <Label htmlFor="project-name">Project Name</Label>
              <Input id="project-name" placeholder="Enter project name..." />
            </div>
            <div>
              <Label htmlFor="video-file">Video File</Label>
              <Input id="video-file" type="file" accept="video/*" />
            </div>
            <div>
              <Label>Editor Status</Label>
              <p className="text-sm text-muted-foreground">
                Coming soon! The Timeline Editor will allow you to precisely sync your music with video content.
              </p>
            </div>
          </div>
          <Button disabled={isLoading} className="w-full">
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading Editor...
              </>
            ) : (
              "Launch Timeline Editor"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
