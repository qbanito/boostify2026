import { useState } from "react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../ui/dialog";
import { Music4, ArrowRight, Loader2 } from "lucide-react";

export function ScoreCreator() {
  const [isLoading, setIsLoading] = useState(false);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Card className="p-4 sm:p-6 hover:shadow-lg transition-all duration-300 bg-gradient-to-br from-background to-orange-500/5">
          <Music4 className="h-8 w-8 text-orange-500 mb-4" />
          <h3 className="text-lg sm:text-xl font-semibold mb-2">Score Creator</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Create and edit movie scores with advanced tools
          </p>
          <Button className="w-full bg-orange-500 hover:bg-orange-600">
            Launch Score Creator
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </Card>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[800px]">
        <DialogHeader>
          <DialogTitle>Score Creator Studio</DialogTitle>
        </DialogHeader>
        <div className="grid gap-6 py-4">
          <div className="space-y-4">
            <div>
              <Label htmlFor="project-name">Project Name</Label>
              <Input id="project-name" placeholder="Enter project name..." />
            </div>
            <div>
              <Label htmlFor="tempo">Tempo (BPM)</Label>
              <Input id="tempo" type="number" placeholder="120" />
            </div>
            <div>
              <Label>Project Status</Label>
              <p className="text-sm text-muted-foreground">
                This feature is coming soon! Score Creator will allow you to compose and edit movie scores with a professional suite of tools.
              </p>
            </div>
          </div>
          <Button disabled={isLoading} className="w-full">
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading Studio...
              </>
            ) : (
              "Open Score Creator Studio"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
