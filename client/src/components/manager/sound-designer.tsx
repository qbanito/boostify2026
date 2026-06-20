import { useState } from "react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../ui/dialog";
import { Volume2, ArrowRight, Loader2 } from "lucide-react";

export function SoundDesigner() {
  const [isLoading, setIsLoading] = useState(false);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Card className="p-4 sm:p-6 hover:shadow-lg transition-all duration-300 bg-gradient-to-br from-background to-orange-500/5">
          <Volume2 className="h-8 w-8 text-orange-500 mb-4" />
          <h3 className="text-lg sm:text-xl font-semibold mb-2">Sound Design</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Create custom sound effects for your productions
          </p>
          <Button className="w-full bg-orange-500 hover:bg-orange-600">
            Open Sound Designer
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </Card>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[800px]">
        <DialogHeader>
          <DialogTitle>Sound Design Studio</DialogTitle>
        </DialogHeader>
        <div className="grid gap-6 py-4">
          <div className="space-y-4">
            <div>
              <Label htmlFor="effect-name">Effect Name</Label>
              <Input id="effect-name" placeholder="Enter effect name..." />
            </div>
            <div>
              <Label htmlFor="category">Category</Label>
              <Input id="category" placeholder="e.g., Ambient, Impact, Foley..." />
            </div>
            <div>
              <Label>Studio Status</Label>
              <p className="text-sm text-muted-foreground">
                Coming soon! The Sound Design Studio will provide professional tools for creating and editing custom sound effects.
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
              "Launch Sound Design Studio"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
