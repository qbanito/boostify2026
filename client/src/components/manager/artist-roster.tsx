import { useState } from "react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../ui/dialog";
import { Users, ArrowRight, Loader2 } from "lucide-react";

export function ArtistRoster() {
  const [isLoading, setIsLoading] = useState(false);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Card className="p-4 sm:p-6 hover:shadow-lg transition-all duration-300 bg-gradient-to-br from-background to-orange-500/5">
          <Users className="h-8 w-8 text-orange-500 mb-4" />
          <h3 className="text-lg sm:text-xl font-semibold mb-2">Your Artists</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Manage your artist roster
          </p>
          <Button className="w-full bg-orange-500 hover:bg-orange-600">
            View Artists
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </Card>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[800px]">
        <DialogHeader>
          <DialogTitle>Artist Management</DialogTitle>
        </DialogHeader>
        <div className="grid gap-6 py-4">
          <div className="space-y-4">
            <div>
              <Label htmlFor="search-artist">Search Artists</Label>
              <Input id="search-artist" placeholder="Search by name..." />
            </div>
            <div>
              <Label htmlFor="filter-genre">Filter by Genre</Label>
              <Input id="filter-genre" placeholder="Select genre..." />
            </div>
            <div>
              <Label>Roster Status</Label>
              <p className="text-sm text-muted-foreground">
                Coming soon! The Artist Roster will allow you to manage and monitor your artists' activities.
              </p>
            </div>
          </div>
          <Button disabled={isLoading} className="w-full">
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading Artists...
              </>
            ) : (
              "View All Artists"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
