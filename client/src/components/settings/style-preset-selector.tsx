/**
 * Style Preset Selector — User-facing UI for choosing visual style
 * Renders inside Settings > Appearance tab
 */

import { useState } from "react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Switch } from "../ui/switch";
import { Label } from "../ui/label";
import { themePresets, presetIds, type PresetId } from "../../lib/theme-presets";
import { useThemeEngine } from "../providers/theme-engine-provider";
import { Check, RotateCcw, Sparkles } from "lucide-react";

export function StylePresetSelector() {
  const { currentPreset, setPreset, previewPreset, resetToDefault } = useThemeEngine();
  const [hoveredPreset, setHoveredPreset] = useState<PresetId | null>(null);

  const handleMouseEnter = (id: PresetId) => {
    setHoveredPreset(id);
    previewPreset(id);
  };

  const handleMouseLeave = () => {
    setHoveredPreset(null);
    previewPreset(null); // restore active preset
  };

  const handleSelect = (id: PresetId) => {
    setPreset(id); // persists to localStorage + server via ThemeEngineProvider
    setHoveredPreset(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-medium">Visual Style</h4>
          <p className="text-xs text-muted-foreground mt-0.5">
            Choose your preferred look. Hover to preview, click to apply.
          </p>
        </div>
        {currentPreset !== "default" && (
          <Button variant="ghost" size="sm" onClick={resetToDefault} className="text-xs gap-1.5">
            <RotateCcw className="w-3 h-3" /> Reset
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {presetIds.map((id) => {
          const preset = themePresets[id];
          const isActive = currentPreset === id;
          const isHovered = hoveredPreset === id;

          return (
            <button
              key={id}
              onMouseEnter={() => handleMouseEnter(id)}
              onMouseLeave={handleMouseLeave}
              onClick={() => handleSelect(id)}
              className={`relative rounded-lg border p-3 text-left transition-all duration-200 ${
                isActive
                  ? "border-primary ring-1 ring-primary/30 bg-primary/5"
                  : isHovered
                    ? "border-primary/50 bg-card/80"
                    : "border-border hover:border-primary/30 bg-card/50"
              }`}
            >
              {/* Preview bar */}
              <div className="flex gap-1.5 mb-2.5">
                <div
                  className="h-8 flex-1 rounded-md border border-white/5"
                  style={{ backgroundColor: preset.preview.bg }}
                >
                  <div className="flex gap-1 p-1.5 h-full items-end">
                    <div
                      className="w-3 h-3 rounded-sm"
                      style={{ backgroundColor: preset.preview.primary }}
                    />
                    <div
                      className="w-3 h-2 rounded-sm"
                      style={{ backgroundColor: preset.preview.card }}
                    />
                    <div
                      className="w-2 h-2.5 rounded-sm"
                      style={{ backgroundColor: preset.preview.accent }}
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-sm">{preset.emoji}</span>
                <span className="text-sm font-medium">{preset.name}</span>
              </div>
              <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">
                {preset.description}
              </p>

              {isActive && (
                <Badge className="absolute top-2 right-2 text-[9px] bg-primary/20 text-primary border-primary/30 px-1.5">
                  <Check className="w-2.5 h-2.5 mr-0.5" />
                </Badge>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
