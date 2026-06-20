import { useState } from "react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../ui/dialog";
import { Calendar as CalendarIcon, ArrowRight, Loader2 } from "lucide-react";

export function VenuesBooking() {
  const [isLoading, setIsLoading] = useState(false);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Card className="p-4 sm:p-6 hover:shadow-lg transition-all duration-300 bg-gradient-to-br from-background to-orange-500/5">
          <CalendarIcon className="h-8 w-8 text-orange-500 mb-4" />
          <h3 className="text-lg sm:text-xl font-semibold mb-2">Venues Booking</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Schedule and manage bookings
          </p>
          <Button className="w-full bg-orange-500 hover:bg-orange-600">
            Book Now
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </Card>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[800px]">
        <DialogHeader>
          <DialogTitle>Book a Venue</DialogTitle>
        </DialogHeader>
        <div className="grid gap-6 py-4">
          <div className="space-y-4">
            <div>
              <Label htmlFor="venue">Venue Name</Label>
              <Input id="venue" placeholder="Select a venue..." />
            </div>
            <div>
              <Label htmlFor="date">Event Date</Label>
              <Input id="date" type="date" />
            </div>
            <div>
              <Label>Booking Status</Label>
              <p className="text-sm text-muted-foreground">
                Coming soon! The Venues Booking system will allow you to schedule and manage venue reservations.
              </p>
            </div>
          </div>
          <Button disabled={isLoading} className="w-full">
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing Booking...
              </>
            ) : (
              "Book Venue"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
