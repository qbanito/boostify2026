import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { MusicianBookingForm } from "./musician-booking-form";
import type { MusicianService } from "../pages/producer-tools";

interface BookingDialogProps {
  musician: MusicianService;
  trigger?: React.ReactNode;
}

export function BookingDialog({ musician, trigger }: BookingDialogProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger || (
          <Button className="w-full bg-orange-500 hover:bg-orange-600">
            Book Session
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-[95vw] sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg sm:text-xl">Book a Session</DialogTitle>
          <DialogDescription className="text-sm">
            Complete the form below to book a session with {musician.title}
          </DialogDescription>
        </DialogHeader>
        <MusicianBookingForm
          musician={musician}
          onClose={() => {
            const closeButton = document.querySelector('[aria-label="Close"]');
            if (closeButton instanceof HTMLElement) {
              closeButton.click();
            }
          }}
        />
      </DialogContent>
    </Dialog>
  );
}