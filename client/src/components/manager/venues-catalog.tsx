import { useState } from "react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../ui/dialog";
import { MapPin, ArrowRight, Loader2 } from "lucide-react";

export function VenuesCatalog() {
  const [isLoading, setIsLoading] = useState(false);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Card className="p-4 sm:p-6 hover:shadow-lg transition-all duration-300 bg-gradient-to-br from-background to-orange-500/5">
          <MapPin className="h-8 w-8 text-orange-500 mb-4" />
          <h3 className="text-lg sm:text-xl font-semibold mb-2">Venues Catalog</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Find perfect venues for your events
          </p>
          <Button className="w-full bg-orange-500 hover:bg-orange-600">
            Find Venues
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </Card>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[800px]">
        <DialogHeader>
          <DialogTitle>Venue Search</DialogTitle>
        </DialogHeader>
        <div className="grid gap-6 py-4">
          <div className="space-y-4">
            <div>
              <Label htmlFor="location">Location</Label>
              <Input id="location" placeholder="Enter city or region..." />
            </div>
            <div>
              <Label htmlFor="capacity">Capacity</Label>
              <Input id="capacity" type="number" placeholder="Minimum capacity..." />
            </div>
            <div>
              <Label>Venue Status</Label>
              <p className="text-sm text-muted-foreground">
                Coming soon! The Venues Catalog will provide a comprehensive database of performance venues.
              </p>
            </div>
          </div>
          <Button disabled={isLoading} className="w-full">
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Searching Venues...
              </>
            ) : (
              "Search Venues"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
