import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Globe, Check, ChevronDown } from "lucide-react";

type LanguageOption = {
  code: string;
  label: string;
  native: string;
  flag: string;
};

const LANGUAGES: LanguageOption[] = [
  { code: "en", label: "EN", native: "English", flag: "🇺🇸" },
  { code: "es", label: "ES", native: "Español", flag: "🇪🇸" },
  { code: "fr", label: "FR", native: "Français", flag: "🇫🇷" },
  { code: "pt", label: "PT", native: "Português", flag: "🇧🇷" },
];

interface LanguageSwitcherProps {
  accentColor?: string;
  className?: string;
}

/**
 * Compact glassmorphism language selector for the artist profile.
 * Supports English, Spanish, French and Portuguese via react-i18next.
 */
export default function LanguageSwitcher({ accentColor = "#ffffff", className = "" }: LanguageSwitcherProps) {
  const { i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const currentCode = (i18n.resolvedLanguage || i18n.language || "en").split("-")[0];
  const current = LANGUAGES.find((l) => l.code === currentCode) || LANGUAGES[0];

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  const handleSelect = (code: string) => {
    if (code !== currentCode) {
      i18n.changeLanguage(code);
    }
    setOpen(false);
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Select language"
        className="flex items-center gap-1.5 md:gap-2 px-3 md:px-4 py-2.5 md:py-3 rounded-2xl text-sm md:text-base font-semibold transition-all duration-300 backdrop-blur-xl bg-white/10 hover:bg-white/20 border border-white/20 hover:border-white/40 transform hover:scale-105 active:scale-95"
        style={{ color: accentColor }}
        data-testid="button-language-switcher"
      >
        <Globe className="h-4 w-4 md:h-5 md:w-5" />
        <span className="hidden sm:inline">{current.flag}</span>
        <span>{current.label}</span>
        <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute right-0 mt-2 w-44 rounded-2xl overflow-hidden backdrop-blur-xl bg-black/70 border border-white/15 shadow-2xl z-50 animate-in fade-in slide-in-from-top-2 duration-200"
        >
          {LANGUAGES.map((lang) => {
            const isActive = lang.code === currentCode;
            return (
              <button
                key={lang.code}
                type="button"
                role="option"
                aria-selected={isActive}
                onClick={() => handleSelect(lang.code)}
                className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-left transition-colors duration-150 ${
                  isActive ? "bg-white/15 text-white" : "text-white/80 hover:bg-white/10 hover:text-white"
                }`}
                data-testid={`option-language-${lang.code}`}
              >
                <span className="text-lg leading-none">{lang.flag}</span>
                <span className="flex-1">{lang.native}</span>
                {isActive && <Check className="h-4 w-4" style={{ color: accentColor }} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
