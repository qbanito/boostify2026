import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useEffect, useState } from "react";
import ColorPicker from "@/components/color-picker";

export interface BoxShadow {
  x: number;
  y: number;
  blur: number;
  color: string;
}

function Shadow({
  label,
  value,
  onChange
}: {
  label: string;
  value: BoxShadow;
  onChange: (v: BoxShadow) => void;
}) {
  const [localValue, setLocalValue] = useState<BoxShadow>(value);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  return (
    <div className="flex flex-col gap-2 py-4">
      <Label className="font-sans text-xs font-semibold">{label}</Label>

      <div className="flex gap-2">
        <div className="flex flex-1 items-center text-sm text-muted-foreground">
          Color
        </div>
        <div className="relative w-32">
          <Popover>
            <PopoverTrigger asChild>
              <div className="flex h-8 items-center gap-2 rounded-md border border-input bg-background px-2 cursor-pointer hover:bg-accent">
                <div
                  style={{ backgroundColor: localValue.color }}
                  className="h-5 w-5 rounded border border-border"
                />
                <span className="text-xs font-mono">{localValue.color}</span>
              </div>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-3" align="start">
              <ColorPicker
                value={localValue.color}
                onChange={(color) => {
                  const newValue = { ...localValue, color };
                  setLocalValue(newValue);
                  onChange(newValue);
                }}
                solid={true}
                gradient={false}
                format="hex"
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <div className="flex gap-2">
        <div className="flex flex-1 items-center text-sm text-muted-foreground">
          X
        </div>
        <div className="relative w-32">
          <Input
            className="h-8"
            type="number"
            value={localValue.x}
            onChange={(e) => {
              const newValue = { ...localValue, x: Number(e.target.value) };
              setLocalValue(newValue);
              onChange(newValue);
            }}
          />
        </div>
      </div>

      <div className="flex gap-2">
        <div className="flex flex-1 items-center text-sm text-muted-foreground">
          Y
        </div>
        <div className="relative w-32">
          <Input
            className="h-8"
            type="number"
            value={localValue.y}
            onChange={(e) => {
              const newValue = { ...localValue, y: Number(e.target.value) };
              setLocalValue(newValue);
              onChange(newValue);
            }}
          />
        </div>
      </div>

      <div className="flex gap-2">
        <div className="flex flex-1 items-center text-sm text-muted-foreground">
          Blur
        </div>
        <div className="relative w-32">
          <Input
            className="h-8"
            type="number"
            value={localValue.blur}
            onChange={(e) => {
              const newValue = { ...localValue, blur: Number(e.target.value) };
              setLocalValue(newValue);
              onChange(newValue);
            }}
          />
        </div>
      </div>
    </div>
  );
}

export default Shadow;
