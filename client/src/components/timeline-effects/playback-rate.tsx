import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export default function PlaybackRate({ 
  value, 
  onChange 
}: { 
  value: number; 
  onChange: (v: number) => void;
}) {
  const rates = [0.5, 1, 1.5, 2];

  return (
    <div className="flex flex-col gap-2 py-4">
      <Label className="font-sans text-xs font-semibold">Playback Speed</Label>
      <div className="grid grid-cols-2 gap-2">
        {rates.map((rate) => (
          <Button
            key={rate}
            variant={value === rate ? "default" : "outline"}
            onClick={() => onChange(rate)}
            className="min-h-[44px]"
            data-testid={`button-speed-${rate}`}
          >
            x{rate}
          </Button>
        ))}
      </div>
    </div>
  );
}
