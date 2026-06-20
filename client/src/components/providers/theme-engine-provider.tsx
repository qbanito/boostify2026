/**
 * ThemeEngineProvider
 * 
 * Reads the active preset from the settings store and injects CSS variables
 * into document.documentElement.style. When preset is "default", all inline
 * styles are REMOVED so the original index.css values take over (zero breakage).
 *
 * Also adds/removes the preset's htmlClass on <html> for preset-specific
 * CSS rules (e.g. .theme-minimal button styles).
 */

import { createContext, useContext, useEffect, useCallback, useRef, type ReactNode } from "react";
import { useSettingsStore } from "../../store/settings-store";
import { getPreset, MANAGED_CSS_VARS, themePresets, type PresetId, type ThemePreset } from "../../lib/theme-presets";
import { useBehaviorTracker } from "../../lib/behavior-tracker";

interface ThemeEngineContextValue {
  /** Currently active preset ID */
  currentPreset: PresetId;
  /** Switch to a different preset (persists to store) */
  setPreset: (id: PresetId) => void;
  /** Temporarily preview a preset without saving */
  previewPreset: (id: PresetId | null) => void;
  /** Reset to "default" — removes all injected styles */
  resetToDefault: () => void;
  /** Whether currently in preview mode */
  isPreviewing: boolean;
}

const ThemeEngineContext = createContext<ThemeEngineContextValue | null>(null);

export function useThemeEngine() {
  const ctx = useContext(ThemeEngineContext);
  if (!ctx) {
    console.warn("useThemeEngine called outside ThemeEngineProvider — returning safe defaults");
    return {
      currentPreset: "default" as PresetId,
      setPreset: () => {},
      previewPreset: () => {},
      resetToDefault: () => {},
      isPreviewing: false,
    };
  }
  return ctx;
}

/** All htmlClasses we might add (for cleanup) */
const ALL_HTML_CLASSES = Object.values(themePresets)
  .map((p) => p.htmlClass)
  .filter(Boolean);

/** Guard to prevent MutationObserver → applyPresetVariables → class change → observer infinite loop */
let _applying = false;

function applyPresetVariables(preset: ThemePreset, _modeHint: "light" | "dark") {
  if (_applying) return; // re-entrant call from MutationObserver — skip
  _applying = true;

  try {
    const root = document.documentElement;

    // ── Determine effective mode based on preset's forceMode ──
    let effectiveMode: "light" | "dark";
    if (preset.forceMode === "light") {
      effectiveMode = "light";
      if (root.classList.contains("dark")) root.classList.remove("dark");
    } else if (preset.forceMode === "dark") {
      effectiveMode = "dark";
      if (!root.classList.contains("dark")) root.classList.add("dark");
    } else {
      // null / default → keep current class, restore "dark" if it was removed by a previous preset
      if (preset.id === "default" && !root.classList.contains("dark")) {
        root.classList.add("dark"); // restore original hardcoded state
      }
      effectiveMode = root.classList.contains("dark") ? "dark" : "light";
    }

    const vars = effectiveMode === "dark" ? preset.variables.dark : preset.variables.light;

    if (preset.id === "default") {
      // Remove ALL inline CSS vars → fallback to index.css originals
      MANAGED_CSS_VARS.forEach((v) => root.style.removeProperty(v));
    } else {
      // Inject preset variables as inline styles (override index.css)
      for (const [key, value] of Object.entries(vars)) {
        root.style.setProperty(key, value);
      }
    }

    // Manage htmlClass — only touch DOM if actually needed
    const currentThemeClass = ALL_HTML_CLASSES.find((cls) => root.classList.contains(cls));
    const targetClass = preset.htmlClass || null;

    if (currentThemeClass !== targetClass) {
      if (currentThemeClass) root.classList.remove(currentThemeClass);
      if (targetClass) root.classList.add(targetClass);
    }

    // ── Manage density class for layout simplification ──
    const densityClasses = ["density-full", "density-clean", "density-minimal"];
    const targetDensity = preset.id === "default" ? null : `density-${preset.density ?? "full"}`;
    const currentDensity = densityClasses.find((cls) => root.classList.contains(cls));

    if (currentDensity !== targetDensity) {
      if (currentDensity) root.classList.remove(currentDensity);
      if (targetDensity) root.classList.add(targetDensity);
    }
  } finally {
    // Release guard after the current microtask so observer callbacks are also blocked
    queueMicrotask(() => { _applying = false; });
  }
}

function getCurrentMode(): "light" | "dark" {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

export function ThemeEngineProvider({ children }: { children: ReactNode }) {
  const activePreset = useSettingsStore((s) => s.style?.activePreset ?? "default");
  const updateStyle = useSettingsStore((s) => s.updateStyle);
  const previewRef = useRef<PresetId | null>(null);
  const isPreviewingRef = useRef(false);
  const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Mount behavior tracker (passive, only active when autoAdapt is on)
  useBehaviorTracker();

  // ── Hydrate: on mount, fetch server-saved preference and merge into local store ──
  useEffect(() => {
    fetch("/api/ui-style/preferences")
      .then((r) => r.json())
      .then((data) => {
        if (data.success && data.data?.activePreset) {
          const serverPreset = data.data.activePreset as string;
          const localPreset = useSettingsStore.getState().style?.activePreset ?? "default";
          // Only override local if local is still "default" and server has a real preference
          if (localPreset === "default" && serverPreset !== "default") {
            updateStyle({ activePreset: serverPreset as PresetId });
          }
        }
      })
      .catch(() => {}); // silently fail — localStorage is the primary source
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Apply preset whenever activePreset changes
  useEffect(() => {
    if (isPreviewingRef.current) return; // don't override preview
    const preset = getPreset(activePreset);
    const mode = getCurrentMode();
    applyPresetVariables(preset, mode);
  }, [activePreset]);

  // Watch for dark/light mode class changes and re-apply
  useEffect(() => {
    const observer = new MutationObserver(() => {
      const id = isPreviewingRef.current ? previewRef.current : activePreset;
      const preset = getPreset(id);
      const mode = getCurrentMode();
      applyPresetVariables(preset, mode);
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => observer.disconnect();
  }, [activePreset]);

  // Cleanup preview timer on unmount
  useEffect(() => {
    return () => {
      if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
    };
  }, []);

  const setPreset = useCallback(
    (id: PresetId) => {
      // Cancel any pending preview to avoid it overriding this click
      if (previewTimerRef.current) {
        clearTimeout(previewTimerRef.current);
        previewTimerRef.current = null;
      }
      isPreviewingRef.current = false;
      previewRef.current = null;
      updateStyle({ activePreset: id });
      // Immediately apply (store update will also trigger useEffect)
      const preset = getPreset(id);
      applyPresetVariables(preset, getCurrentMode());
      // Persist to server (fire & forget)
      fetch("/api/ui-style/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activePreset: id }),
      }).catch(() => {}); // fail silently — localStorage is source of truth
    },
    [updateStyle]
  );

  const previewPreset = useCallback(
    (id: PresetId | null) => {
      // Cancel any pending preview to avoid stacking
      if (previewTimerRef.current) {
        clearTimeout(previewTimerRef.current);
        previewTimerRef.current = null;
      }

      if (id === null) {
        // End preview → restore active preset from current store state (not stale closure)
        isPreviewingRef.current = false;
        previewRef.current = null;
        const current = (useSettingsStore.getState().style?.activePreset ?? "default") as PresetId;
        const preset = getPreset(current);
        applyPresetVariables(preset, getCurrentMode());
      } else {
        // Debounce preview to avoid rapid DOM mutations when moving mouse across buttons
        previewTimerRef.current = setTimeout(() => {
          isPreviewingRef.current = true;
          previewRef.current = id;
          const preset = getPreset(id);
          applyPresetVariables(preset, getCurrentMode());
        }, 80);
      }
    },
    [] // no dependency on activePreset — reads fresh from store
  );

  const resetToDefault = useCallback(() => {
    setPreset("default");
  }, [setPreset]);

  const value: ThemeEngineContextValue = {
    currentPreset: activePreset as PresetId,
    setPreset,
    previewPreset,
    resetToDefault,
    isPreviewing: isPreviewingRef.current,
  };

  return (
    <ThemeEngineContext.Provider value={value}>
      {children}
    </ThemeEngineContext.Provider>
  );
}
