import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { RotateCw } from "lucide-react";
import { useState } from "react";

export interface TransformValue {
  scale: number;
  x: number;
  y: number;
  rotation: number;
}

const Transform = ({
  value,
  onChange
}: {
  value: TransformValue;
  onChange: (v: TransformValue) => void;
}) => {
  const [localValue, setLocalValue] = useState<TransformValue>(value);

  const handleReset = (prop: keyof TransformValue) => {
    const defaults: TransformValue = { scale: 1, x: 0, y: 0, rotation: 0 };
    const newValue = { ...localValue, [prop]: defaults[prop] };
    setLocalValue(newValue);
    onChange(newValue);
  };

  return (
    <div className="flex flex-col gap-4 py-4">
      <Label className="font-sans text-xs font-semibold">Transform</Label>
      
      <div className="flex flex-col gap-2">
        <div className="text-sm text-muted-foreground">Scale</div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 40px 24px",
            gap: "4px"
          }}
        >
          <Slider
            id="scale"
            value={[localValue.scale]}
            min={0.1}
            max={3}
            step={0.1}
            onValueChange={(v) => {
              const newValue = { ...localValue, scale: v[0] };
              setLocalValue(newValue);
              onChange(newValue);
            }}
            aria-label="Scale"
          />
          <Input 
            className="w-11 px-2 text-center text-sm" 
            type="number"
            value={localValue.scale.toFixed(1)}
            onChange={(e) => {
              const newValue = { ...localValue, scale: Number(e.target.value) };
              setLocalValue(newValue);
              onChange(newValue);
            }}
          />
          <div className="flex items-center">
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6 text-muted-foreground"
              onClick={() => handleReset('scale')}
            >
              <RotateCw size={14} />
            </Button>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="text-sm text-muted-foreground">Position</div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 24px",
            gap: "4px"
          }}
        >
          <div className="relative">
            <Input 
              className="px-2 text-sm" 
              type="number"
              value={localValue.x}
              onChange={(e) => {
                const newValue = { ...localValue, x: Number(e.target.value) };
                setLocalValue(newValue);
                onChange(newValue);
              }}
            />
            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 transform text-xs text-muted-foreground">
              x
            </div>
          </div>
          <div className="relative">
            <Input 
              className="px-2 text-sm" 
              type="number"
              value={localValue.y}
              onChange={(e) => {
                const newValue = { ...localValue, y: Number(e.target.value) };
                setLocalValue(newValue);
                onChange(newValue);
              }}
            />
            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 transform text-xs text-muted-foreground">
              y
            </div>
          </div>
          <div className="flex items-center">
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6 text-muted-foreground"
              onClick={() => {
                handleReset('x');
                handleReset('y');
              }}
            >
              <RotateCw size={14} />
            </Button>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="text-sm text-muted-foreground">Rotation</div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 24px",
            gap: "4px"
          }}
        >
          <Input 
            className="px-2 text-sm" 
            type="number"
            value={localValue.rotation}
            onChange={(e) => {
              const newValue = { ...localValue, rotation: Number(e.target.value) };
              setLocalValue(newValue);
              onChange(newValue);
            }}
          />
          <div />
          <div className="flex items-center">
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6 text-muted-foreground"
              onClick={() => handleReset('rotation')}
            >
              <RotateCw size={14} />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Transform;
