import { useState } from "react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../ui/dialog";
import { ChartBar, ArrowRight, Loader2 } from "lucide-react";

export function VenuesReports() {
  const [isLoading, setIsLoading] = useState(false);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Card className="p-4 sm:p-6 hover:shadow-lg transition-all duration-300 bg-gradient-to-br from-background to-orange-500/5">
          <ChartBar className="h-8 w-8 text-orange-500 mb-4" />
          <h3 className="text-lg sm:text-xl font-semibold mb-2">Venues Reports</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Analytics and performance data
          </p>
          <Button className="w-full bg-orange-500 hover:bg-orange-600">
            View Reports
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </Card>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[800px]">
        <DialogHeader>
          <DialogTitle>Venue Analytics</DialogTitle>
        </DialogHeader>
        <div className="grid gap-6 py-4">
          <div className="space-y-4">
            <div>
              <Label htmlFor="date-range">Date Range</Label>
              <Input id="date-range" type="month" />
            </div>
            <div>
              <Label htmlFor="venue-select">Select Venue</Label>
              <Input id="venue-select" placeholder="Choose venue..." />
            </div>
            <div>
              <Label>Analytics Status</Label>
              <p className="text-sm text-muted-foreground">
                Coming soon! The Venues Reports will provide detailed analytics and performance metrics for your venues.
              </p>
            </div>
          </div>
          <Button disabled={isLoading} className="w-full">
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading Reports...
              </>
            ) : (
              "Generate Report"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
