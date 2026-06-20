import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { useState, useEffect } from "react";

interface OpacityEffectProps {
  value: number;
  onChange: (value: number) => void;
}

export default function OpacityEffect({ value, onChange }: OpacityEffectProps) {
  const [localValue, setLocalValue] = useState(value);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  return (
    <div className="flex gap-2 items-center py-1">
      <div className="flex flex-1 items-center text-sm text-muted-foreground min-w-[80px]">
        Opacity
      </div>
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <Input
          max={100}
          className="h-10 w-16 px-2 text-center text-sm flex-shrink-0 touch-manipulation"
          type="number"
          onChange={(e) => {
            const newValue = Number(e.target.value);
            if (newValue >= 0 && newValue <= 100) {
              setLocalValue(newValue);
              onChange(newValue);
            }
          }}
          value={localValue}
          data-testid="input-opacity-value"
        />
        <Slider
          value={[localValue]}
          onValueChange={(e) => {
            setLocalValue(e[0]);
          }}
          onValueCommit={() => {
            onChange(localValue);
          }}
          min={0}
          max={100}
          step={1}
          className="flex-1 cursor-pointer touch-manipulation"
          aria-label="Opacity"
        />
      </div>
    </div>
  );
}
