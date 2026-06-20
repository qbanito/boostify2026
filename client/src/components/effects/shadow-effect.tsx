import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { useState, useEffect } from "react";

export interface ShadowValue {
  x: number;
  y: number;
  blur: number;
  color: string;
}

interface ShadowEffectProps {
  value: ShadowValue;
  onChange: (value: ShadowValue) => void;
}

export default function ShadowEffect({ value, onChange }: ShadowEffectProps) {
  const [localValue, setLocalValue] = useState(value);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleChange = (field: keyof ShadowValue, newValue: string | number) => {
    const updated = { ...localValue, [field]: newValue };
    setLocalValue(updated);
    onChange(updated);
  };

  return (
    <div className="flex flex-col gap-3 py-2">
      <Label className="text-sm font-medium">Shadow</Label>
      
      <div className="flex gap-2 items-center py-1">
        <div className="flex flex-1 items-center text-sm text-muted-foreground min-w-[80px]">
          X Offset
        </div>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Input
            className="h-10 w-16 px-2 text-center text-sm flex-shrink-0 touch-manipulation"
            type="number"
            value={localValue.x}
            onChange={(e) => handleChange('x', Number(e.target.value))}
            data-testid="input-shadow-x"
          />
          <Slider
            value={[localValue.x]}
            onValueChange={(e) => setLocalValue({ ...localValue, x: e[0] })}
            onValueCommit={() => onChange(localValue)}
            min={-50}
            max={50}
            step={1}
            className="flex-1 cursor-pointer touch-manipulation"
          />
        </div>
      </div>

      <div className="flex gap-2 items-center py-1">
        <div className="flex flex-1 items-center text-sm text-muted-foreground min-w-[80px]">
          Y Offset
        </div>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Input
            className="h-10 w-16 px-2 text-center text-sm flex-shrink-0 touch-manipulation"
            type="number"
            value={localValue.y}
            onChange={(e) => handleChange('y', Number(e.target.value))}
            data-testid="input-shadow-y"
          />
          <Slider
            value={[localValue.y]}
            onValueChange={(e) => setLocalValue({ ...localValue, y: e[0] })}
            onValueCommit={() => onChange(localValue)}
            min={-50}
            max={50}
            step={1}
            className="flex-1 cursor-pointer touch-manipulation"
          />
        </div>
      </div>

      <div className="flex gap-2 items-center py-1">
        <div className="flex flex-1 items-center text-sm text-muted-foreground min-w-[80px]">
          Blur
        </div>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Input
            className="h-10 w-16 px-2 text-center text-sm flex-shrink-0 touch-manipulation"
            type="number"
            value={localValue.blur}
            onChange={(e) => handleChange('blur', Number(e.target.value))}
            data-testid="input-shadow-blur"
          />
          <Slider
            value={[localValue.blur]}
            onValueChange={(e) => setLocalValue({ ...localValue, blur: e[0] })}
            onValueCommit={() => onChange(localValue)}
            min={0}
            max={50}
            step={1}
            className="flex-1 cursor-pointer touch-manipulation"
          />
        </div>
      </div>

      <div className="flex gap-2 items-center py-1">
        <div className="flex flex-1 items-center text-sm text-muted-foreground min-w-[80px]">
          Color
        </div>
        <div className="flex-1 min-w-0">
          <Input
            type="color"
            value={localValue.color}
            onChange={(e) => handleChange('color', e.target.value)}
            className="h-12 w-full cursor-pointer touch-manipulation"
            data-testid="input-shadow-color"
          />
        </div>
      </div>
    </div>
  );
}
