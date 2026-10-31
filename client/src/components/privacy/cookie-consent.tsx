import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type ConsentCategory = "preferences" | "analytics" | "marketing";
export type ConsentChoices = Record<ConsentCategory, boolean>;

type StoredConsent = {
  version: 1;
  choices: ConsentChoices;
  updatedAt: string;
  source: "user" | "global-privacy-control";
};

type ConsentContextValue = {
  choices: ConsentChoices;
  hasSavedChoice: boolean;
  isGpcEnabled: boolean;
  hasConsent: (category: ConsentCategory) => boolean;
  acceptAll: () => void;
  rejectOptional: () => void;
  saveChoices: (next: ConsentChoices) => void;
  openPreferences: () => void;
};

const STORAGE_KEY = "boostify-cookie-consent-v1";
const OFF: ConsentChoices = { preferences: false, analytics: false, marketing: false };
const ConsentContext = createContext<ConsentContextValue | null>(null);

function hasGpcSignal() {
  return typeof navigator !== "undefined" && (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true;
}

function readConsent(): StoredConsent | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    if (!value) return null;
    const parsed = JSON.parse(value) as StoredConsent;
    if (parsed.version !== 1 || !parsed.choices || typeof parsed.updatedAt !== "string") return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeConsent(choices: ConsentChoices, source: StoredConsent["source"]) {
  const record: StoredConsent = { version: 1, choices, updatedAt: new Date().toISOString(), source };
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(record)); } catch { /* Storage may be disabled; keep the in-memory choice. */ }
}

export function useCookieConsent() {
  const value = useContext(ConsentContext);
  if (!value) throw new Error("useCookieConsent must be used inside CookieConsentProvider");
  return value;
}

export function CookieConsentProvider({ children }: { children: React.ReactNode }) {
  const gpcAtLoad = hasGpcSignal();
  const [stored, setStored] = useState<StoredConsent | null>(() => readConsent());
  const [isGpcEnabled, setIsGpcEnabled] = useState(gpcAtLoad);
  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState<ConsentChoices>(() => readConsent()?.choices ?? OFF);
  const choices = useMemo(() => {
    const saved = stored?.choices ?? OFF;
    return isGpcEnabled ? { ...saved, marketing: false } : saved;
  }, [stored, isGpcEnabled]);

  useEffect(() => {
    const gpc = hasGpcSignal();
    setIsGpcEnabled(gpc);
    const existing = readConsent();
    if (gpc && existing?.choices.marketing) {
      const updated = { ...existing.choices, marketing: false };
      writeConsent(updated, "global-privacy-control");
      setStored({ ...existing, choices: updated, updatedAt: new Date().toISOString(), source: "global-privacy-control" });
    }
    const openSettings = () => {
      setDraft(readConsent()?.choices ?? OFF);
      setIsOpen(true);
    };
    window.addEventListener("boostify:open-cookie-settings", openSettings);
    return () => window.removeEventListener("boostify:open-cookie-settings", openSettings);
  }, []);

  const persist = useCallback((next: ConsentChoices, source: StoredConsent["source"] = "user") => {
    const safeChoices = isGpcEnabled ? { ...next, marketing: false } : next;
    writeConsent(safeChoices, source);
    setStored({ version: 1, choices: safeChoices, updatedAt: new Date().toISOString(), source });
    setDraft(safeChoices);
    setIsOpen(false);
  }, [isGpcEnabled]);

  const value = useMemo<ConsentContextValue>(() => ({
    choices,
    hasSavedChoice: stored !== null,
    isGpcEnabled,
    hasConsent: (category) => choices[category],
    acceptAll: () => persist({ preferences: true, analytics: true, marketing: true }),
    rejectOptional: () => persist(OFF),
    saveChoices: (next) => persist(next),
    openPreferences: () => { setDraft(choices); setIsOpen(true); },
  }), [choices, stored, isGpcEnabled, persist]);

  return (
    <ConsentContext.Provider value={value}>
      {children}
      {!stored && !isOpen && <CookieBanner isGpcEnabled={isGpcEnabled} onAccept={value.acceptAll} onReject={value.rejectOptional} onCustomize={() => { setDraft(choices); setIsOpen(true); }} />}
      {stored && !isOpen && <button type="button" onClick={value.openPreferences} className="fixed bottom-3 right-3 z-[90] hidden min-h-10 items-center rounded-full border border-white/10 bg-[#101016]/80 px-3 text-[11px] text-white/60 backdrop-blur-md transition hover:border-white/25 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 md:inline-flex">Privacy choices</button>}
      {isOpen && <PreferencesDialog
        draft={draft}
        isGpcEnabled={isGpcEnabled}
        onChange={(category, checked) => setDraft((current) => ({ ...current, [category]: checked }))}
        onAcceptAll={value.acceptAll}
        onReject={value.rejectOptional}
        onSave={() => value.saveChoices(draft)}
        onClose={() => setIsOpen(false)}
      />}
    </ConsentContext.Provider>
  );
}

function CookieBanner({ isGpcEnabled, onAccept, onReject, onCustomize }: { isGpcEnabled: boolean; onAccept: () => void; onReject: () => void; onCustomize: () => void }) {
  return (
    <section aria-label="Cookie choices" className="fixed inset-x-0 bottom-0 z-[100] border-t border-white/10 bg-[#101016]/95 p-4 text-white shadow-[0_-20px_70px_rgba(0,0,0,.45)] backdrop-blur-xl sm:p-6">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold">Your privacy, your call</p>
          <p className="mt-1 text-sm leading-6 text-white/65">Boostify uses essential storage to run your account and features you choose to use. Optional personalization tools, analytics, and marketing storage stay off unless you choose to enable them.</p>
          {isGpcEnabled && <p className="mt-1 text-sm text-emerald-200">Global Privacy Control is active. Marketing and attribution will stay off.</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={onReject} className="rounded-xl border border-white/15 px-4 py-2.5 text-sm font-medium text-white/85 transition hover:bg-white/10">Reject optional</button>
          <button onClick={onCustomize} className="rounded-xl border border-white/15 px-4 py-2.5 text-sm font-medium text-white/85 transition hover:bg-white/10">Customize</button>
          <button onClick={onAccept} className="rounded-xl bg-gradient-to-r from-violet-500 to-pink-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110">Accept all</button>
        </div>
      </div>
    </section>
  );
}

function PreferencesDialog({ draft, isGpcEnabled, onChange, onAcceptAll, onReject, onSave, onClose }: {
  draft: ConsentChoices;
  isGpcEnabled: boolean;
  onChange: (category: ConsentCategory, checked: boolean) => void;
  onAcceptAll: () => void;
  onReject: () => void;
  onSave: () => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const items: { id: ConsentCategory; title: string; description: string }[] = [
    { id: "preferences", title: "Optional personalization", description: "Allows optional personalization tools beyond settings needed to run a feature you choose to use." },
    { id: "analytics", title: "Analytics", description: "Allows analytics tools to measure how the platform is used and help us improve it." },
    { id: "marketing", title: "Marketing and attribution", description: "Allows marketing, advertising, or referral tools to measure campaigns across services." },
  ];

  return (
    <div className="fixed inset-0 z-[110] flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-5" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="cookie-settings-title" className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-t-3xl border border-white/10 bg-[#12121a] p-6 text-white shadow-2xl sm:rounded-3xl sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div><p className="text-xs font-semibold uppercase tracking-[.2em] text-violet-300">Privacy center</p><h2 id="cookie-settings-title" className="mt-2 text-2xl font-semibold">Cookie preferences</h2></div>
          <button onClick={onClose} aria-label="Close preferences" className="rounded-lg px-3 py-1 text-xl text-white/60 hover:bg-white/10 hover:text-white">×</button>
        </div>
        <p className="mt-3 text-sm leading-6 text-white/65">Essential storage is always active so sign-in, security, and core platform features work. Choose whether Boostify may use optional categories.</p>
        {isGpcEnabled && <p className="mt-3 rounded-xl border border-emerald-300/20 bg-emerald-300/10 p-3 text-sm text-emerald-100">Global Privacy Control is enabled in this browser. Marketing and attribution remain off.</p>}
        <div className="mt-6 divide-y divide-white/10 rounded-2xl border border-white/10 px-4">
          <div className="flex items-start justify-between gap-4 py-4">
            <div><p className="font-medium">Essential</p><p className="mt-1 text-sm text-white/55">Authentication, session, security, and core functionality.</p></div>
            <span className="shrink-0 rounded-full bg-white/10 px-2.5 py-1 text-xs text-white/65">Always on</span>
          </div>
          {items.map((item) => <label key={item.id} className="flex cursor-pointer items-start justify-between gap-4 py-4">
            <span><span className="block font-medium">{item.title}</span><span className="mt-1 block text-sm leading-5 text-white/55">{item.description}</span></span>
            <input type="checkbox" checked={item.id === "marketing" && isGpcEnabled ? false : draft[item.id]} disabled={item.id === "marketing" && isGpcEnabled} onChange={(event) => onChange(item.id, event.target.checked)} className="mt-1 h-5 w-5 shrink-0 accent-violet-500" />
          </label>)}
        </div>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button onClick={onReject} className="rounded-xl border border-white/15 px-4 py-2.5 text-sm font-medium hover:bg-white/10">Reject optional</button>
          <button onClick={onSave} className="rounded-xl border border-white/15 px-4 py-2.5 text-sm font-medium hover:bg-white/10">Save choices</button>
          <button onClick={onAcceptAll} className="rounded-xl bg-gradient-to-r from-violet-500 to-pink-500 px-4 py-2.5 text-sm font-semibold hover:brightness-110">Accept all</button>
        </div>
      </section>
    </div>
  );
}

/** Mount optional vendor scripts only after the matching category is allowed. */
export function ConsentScript({ src, category, async = true, crossOrigin }: { src: string; category: ConsentCategory; async?: boolean; crossOrigin?: "anonymous" | "use-credentials" }) {
  const { hasConsent } = useCookieConsent();
  useEffect(() => {
    if (!hasConsent(category)) return;
    const script = document.createElement("script");
    script.src = src;
    script.async = async;
    if (crossOrigin) script.crossOrigin = crossOrigin;
    script.dataset.consentCategory = category;
    document.head.appendChild(script);
    return () => { script.remove(); };
  }, [src, category, async, crossOrigin, hasConsent]);
  return null;
}
