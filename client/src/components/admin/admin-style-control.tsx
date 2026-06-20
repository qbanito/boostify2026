/**
 * Admin Default Style Control
 * Allows the admin to set which style preset new/default users will see.
 * Also applies the style live so admin can preview.
 */

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { themePresets, presetIds, type PresetId } from "../../lib/theme-presets";
import { useThemeEngine } from "../providers/theme-engine-provider";
import { Loader2, Check, Palette, Eye } from "lucide-react";

export function AdminStyleControl() {
  const { currentPreset, setPreset, previewPreset } = useThemeEngine();
  const [platformDefault, setPlatformDefault] = useState<string>("default");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/ui-style/default-preset")
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setPlatformDefault(data.data.preset);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const applyAndSetDefault = async (presetId: PresetId) => {
    // 1. Apply the style LOCALLY immediately (visual change)
    setPreset(presetId);

    // 2. Also save as platform default on server (fire & forget)
    setSaving(true);
    setStatusMsg(null);
    try {
      const res = await fetch("/api/ui-style/default-preset", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preset: presetId }),
      });
      const data = await res.json();
      if (data.success) {
        setPlatformDefault(presetId);
        setStatusMsg(`✅ "${themePresets[presetId]?.name}" applied & set as default`);
      } else {
        // Still applied locally even if server fails
        setStatusMsg(`⚠️ Applied locally. Server: ${data.error || "unknown error"}`);
      }
    } catch {
      setStatusMsg(`⚠️ Applied locally. Could not save to server.`);
    }
    setSaving(false);
    setTimeout(() => setStatusMsg(null), 4000);
  };

  if (loading) {
    return (
      <Card className="bg-card/50 border border-primary/20">
        <CardContent className="py-8 flex justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card/50 border border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Palette className="w-4 h-4 text-primary" />
          Platform Default Style
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          Click a style to apply it live and set it as the default for new users. Hover to preview.
        </p>
        {statusMsg && (
          <p className="text-xs mt-2 px-2 py-1 rounded bg-muted/50 border border-border">
            {statusMsg}
          </p>
        )}
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {presetIds.map((id) => {
            const preset = themePresets[id];
            const isActive = currentPreset === id;
            return (
              <button
                key={id}
                onClick={() => applyAndSetDefault(id)}
                onMouseEnter={() => previewPreset(id)}
                onMouseLeave={() => previewPreset(null)}
                disabled={saving}
                className={`relative rounded-lg border p-3 text-left transition-all hover:scale-[1.02] ${
                  isActive
                    ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                    : "border-border hover:border-primary/30 bg-card/50"
                }`}
              >
                {/* Color swatches */}
                <div className="flex gap-1 mb-2">
                  <div
                    className="w-5 h-5 rounded-full border border-white/10"
                    style={{ backgroundColor: preset.preview.primary }}
                  />
                  <div
                    className="w-5 h-5 rounded-full border border-white/10"
                    style={{ backgroundColor: preset.preview.bg }}
                  />
                  <div
                    className="w-5 h-5 rounded-full border border-white/10"
                    style={{ backgroundColor: preset.preview.card }}
                  />
                </div>
                <p className="text-sm font-medium">
                  {preset.emoji} {preset.name}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">
                  {preset.description}
                </p>
                {isActive && (
                  <Badge className="absolute top-2 right-2 text-[9px] bg-primary/20 text-primary border-primary/30">
                    <Check className="w-2.5 h-2.5 mr-0.5" /> Active
                  </Badge>
                )}
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
