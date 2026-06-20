import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { useEffect, useState } from "react";

const Volume = ({
  value,
  onChange
}: {
  value: number;
  onChange: (v: number) => void;
}) => {
  const [localValue, setLocalValue] = useState(value);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  return (
    <div className="flex gap-2">
      <div className="flex flex-1 items-center text-sm text-muted-foreground">
        Volume
      </div>
      <div
        className="w-32"
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 80px"
        }}
      >
        <Input
          className="h-8 w-11 px-2 text-center text-sm"
          type="number"
          onChange={(e) => {
            const newValue = Number(e.target.value);
            if (newValue >= 0 && newValue <= 100) {
              setLocalValue(newValue);
              onChange(newValue);
            }
          }}
          value={localValue}
        />
        <Slider
          id="volume"
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
          aria-label="Volume"
        />
      </div>
    </div>
  );
};

export default Volume;
