import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useState } from "react";

export default function Flip({
  value,
  onChange
}: {
  value: { horizontal: boolean; vertical: boolean };
  onChange: (v: { horizontal: boolean; vertical: boolean }) => void;
}) {
  const [flip, setFlip] = useState(value);

  const handleFlip = (direction: 'horizontal' | 'vertical') => {
    const newFlip = direction === 'horizontal' 
      ? { ...flip, horizontal: !flip.horizontal }
      : { ...flip, vertical: !flip.vertical };
    
    setFlip(newFlip);
    onChange(newFlip);
  };

  return (
    <div className="flex flex-col gap-2 py-4">
      <Label className="font-sans text-xs font-semibold">Flip</Label>
      <div className="flex gap-2">
        <Button 
          variant="outline" 
          onClick={() => handleFlip('horizontal')}
          className="flex-1 min-h-[44px]"
          data-testid="button-flip-horizontal"
        >
          Flip Horizontal
        </Button>
        <Button 
          variant="outline" 
          onClick={() => handleFlip('vertical')}
          className="flex-1 min-h-[44px]"
          data-testid="button-flip-vertical"
        >
          Flip Vertical
        </Button>
      </div>
    </div>
  );
}
