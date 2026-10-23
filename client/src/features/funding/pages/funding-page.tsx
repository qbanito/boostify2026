import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowDown, ArrowLeft, ArrowRight, ChevronRight, CircleHelp, LockKeyhole, MessageCircle, Music2, ShieldCheck, Sparkles, WalletCards, X } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { fundingRules, getReadinessScore, scoreLabel } from "../config/fundingRules";
import heroImage from "../assets/funding-hero.png";
import meetingImage from "../assets/funding-meeting.png";
import rightsReviewImage from "../assets/funding-rights-review.png";
import "../funding.css";

type FundingForm = {
  profileType: string; artistName: string; country: string; entityType: string; yearsActive: string;
  releasedSongs: string; catalogYears: string; distributor: string;
  masterOwnership: string; publishingOwnership: string; hasAdvance: string; musicRevenueStatus: string;
  existingObligations: string; rightsRegistered: string; splitsOrganized: string;
  monthlyRevenue: string; monthsHistory: string; growth: string;
  amount: string; purpose: string;
};

const initialForm: FundingForm = {
  profileType: "", artistName: "", country: "", entityType: "", yearsActive: "", releasedSongs: "", catalogYears: "", distributor: "",
  masterOwnership: "", publishingOwnership: "", hasAdvance: "", musicRevenueStatus: "", existingObligations: "", rightsRegistered: "", splitsOrganized: "",
  monthlyRevenue: "", monthsHistory: "", growth: "", amount: "", purpose: "",
};

const fundingFormFields = Object.keys(initialForm) as (keyof FundingForm)[];
const normalizeFundingForm = (value: unknown): FundingForm => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return initialForm;
  const source = value as Record<string, unknown>;
  return Object.fromEntries(fundingFormFields.map(field => [field, typeof source[field] === "string" ? source[field] : ""])) as FundingForm;
};
const mergeFundingForms = (preferred: FundingForm, fallback: FundingForm): FundingForm =>
  Object.fromEntries(fundingFormFields.map(field => [field, preferred[field] || fallback[field]])) as FundingForm;
const countFundingAnswers = (value: FundingForm) => fundingFormFields.filter(field => value[field].trim()).length;

const steps = ["Profile", "Catalog", "Rights", "Revenue", "Request"];
const profileOptions = ["Artist", "Songwriter / Composer", "Producer", "Independent Label", "Catalog Owner", "Publisher"];
const profileGuidance: Record<string, { headline: string; detail: string; purpose: string }> = {
  Artist: { headline: "Turn your music's performance into room to grow.", detail: "Share revenue and catalog details to explore growth capital for releases, marketing, videos, touring, equipment or expansion.", purpose: "Growth capital for my music career" },
  "Songwriter / Composer": { headline: "Your songs can create value beyond the stage.", detail: "Tell us about your royalties, publishing, splits and compositions so your catalog can be reviewed in context.", purpose: "Explore my songwriting catalog" },
  Producer: { headline: "Bring your points and royalty shares into focus.", detail: "Organize your participation in masters and compositions as part of your music finance profile.", purpose: "Evaluate my producer rights" },
  "Independent Label": { headline: "Fund roster growth without slowing releases.", detail: "Build a business profile around your catalog, royalty flow and plans for artist development and marketing.", purpose: "Grow my label and roster" },
  "Catalog Owner": { headline: "Understand the value and options for your catalog.", detail: "Share a high-level view of ownership and revenue to prepare for a catalog review.", purpose: "Request a catalog review" },
  Publisher: { headline: "Explore capital opportunities around your rights pipeline.", detail: "Organize publishing ownership, royalty history and the catalog opportunities you manage.", purpose: "Explore publishing opportunities" },
};
const documents = ["Distributor statements", "Royalty statements", "Publishing statements", "Catalog ownership documents"];
const FUNDING_BOOKING_URL = import.meta.env.VITE_FUNDING_BOOKING_URL || "https://calendly.com/convoycubano/boostify-funding-artist-consultation";

function NumberInput({ label, value, onChange, prefix, suffix, min = 0, max }: { label: string; value: string; onChange: (value: string) => void; prefix?: string; suffix?: string; min?: number; max?: number }) {
  return <label className="block space-y-2"><span className="text-sm text-slate-300">{label}</span><span className="flex items-center rounded-xl border border-white/10 bg-white/[0.035] px-4 focus-within:border-orange-400/70">{prefix && <span className="text-slate-500">{prefix}</span>}<input className="w-full bg-transparent py-3 text-white outline-none placeholder:text-slate-600" type="number" min={min} max={max} value={value} onChange={e => onChange(e.target.value)} placeholder="0" />{suffix && <span className="text-slate-500">{suffix}</span>}</span></label>;
}

export default function FundingPage() {
  const { user, isAuthenticated } = useAuth();
  const [location, setLocation] = useLocation();
  const storageScope = user?.clerkId || (user?.id ? String(user.id) : "guest");
  const draftStorageKey = `boostify-funding-draft:${storageScope}`;
  const statusStorageKey = `boostify-funding-status:${storageScope}`;
  const [form, setForm] = useState<FundingForm>(() => {
    try { return { ...initialForm, ...JSON.parse(sessionStorage.getItem(draftStorageKey) || "{}") }; } catch { return initialForm; }
  });
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [step, setStep] = useState(0);
  const [consented, setConsented] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [showAssistant, setShowAssistant] = useState(false);
  const [question, setQuestion] = useState("");
  const [assistantReply, setAssistantReply] = useState("");
  const [requestBusy, setRequestBusy] = useState(false);
  const [requestNotice, setRequestNotice] = useState("");
  const [showMeetingRequest, setShowMeetingRequest] = useState(false);
  const [meetingTopic, setMeetingTopic] = useState("Funding readiness and next steps");
  const [meetingAvailability, setMeetingAvailability] = useState("");
  const [meetingNotice, setMeetingNotice] = useState("");
  const [audienceFocus, setAudienceFocus] = useState("Artist");
  const hydrationRun = useRef(0);
  useEffect(() => {
    if (!isAuthenticated) return;
    const run = ++hydrationRun.current;
    let active = true;
    setDraftLoaded(false);
    const restoreSessionDraft = () => {
      try {
        const drafts: FundingForm[] = [];
        for (let index = 0; index < sessionStorage.length; index += 1) {
          const key = sessionStorage.key(index);
          if (!key || !/funding.*draft|draft.*funding/i.test(key)) continue;
          const stored = sessionStorage.getItem(key);
          if (!stored) continue;
          const parsed = normalizeFundingForm(JSON.parse(stored));
          if (countFundingAnswers(parsed)) drafts.push(parsed);
        }
        drafts.sort((a, b) => countFundingAnswers(b) - countFundingAnswers(a));
        return drafts[0] ?? null;
      } catch { return null; }
    };
    apiRequest("/api/funding/draft")
      .then(async result => {
        if (!active || hydrationRun.current !== run) return;
        const sessionDraft = restoreSessionDraft();
        if (result.form) {
          const accountDraft = normalizeFundingForm(result.form);
          const restored = sessionDraft ? mergeFundingForms(accountDraft, sessionDraft) : accountDraft;
          setForm(restored);
          try { sessionStorage.setItem(draftStorageKey, JSON.stringify(restored)); } catch { /* Account copy is primary. */ }
          const merged = sessionDraft && countFundingAnswers(restored) > countFundingAnswers(accountDraft);
          setSaved(!merged);
          setSaveError(false);
          if (merged) await apiRequest("/api/funding/draft", "PUT", { form: restored });
          return;
        }
        if (sessionDraft) {
          setForm(sessionDraft);
          try { sessionStorage.setItem(draftStorageKey, JSON.stringify(sessionDraft)); } catch { /* Cloud save below is primary. */ }
          await apiRequest("/api/funding/draft", "PUT", { form: sessionDraft });
          if (active && hydrationRun.current === run) setSaved(true);
        }
      })
      .catch(() => {
        if (!active || hydrationRun.current !== run) return;
        const sessionDraft = restoreSessionDraft();
        if (sessionDraft) setForm(sessionDraft);
        setSaveError(true);
      })
      .finally(() => {
        if (active && hydrationRun.current === run) setDraftLoaded(true);
      });
    return () => { active = false; };
  }, [isAuthenticated, user?.clerkId, draftStorageKey]);

  useEffect(() => {
    if (!isAuthenticated || !draftLoaded) return;
    const timer = window.setTimeout(async () => {
      try { sessionStorage.setItem(draftStorageKey, JSON.stringify(form)); } catch { /* Account save is primary. */ }
      try {
        await apiRequest("/api/funding/draft", "PUT", { form });
        setSaved(true);
        setSaveError(false);
      } catch {
        setSaved(false);
        setSaveError(true);
      }
    }, 450);
    return () => window.clearTimeout(timer);
  }, [form, isAuthenticated, draftLoaded, draftStorageKey]);

  useEffect(() => {
    if (!isAuthenticated || !draftLoaded) return;
    const flushDraft = () => {
      try { sessionStorage.setItem(draftStorageKey, JSON.stringify(form)); } catch { /* Keep the account copy as primary. */ }
      void fetch("/api/funding/draft", {
        method: "PUT",
        credentials: "include",
        keepalive: true,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ form }),
      });
    };
    window.addEventListener("pagehide", flushDraft);
    return () => window.removeEventListener("pagehide", flushDraft);
  }, [form, isAuthenticated, draftLoaded, draftStorageKey]);

  const update = (key: keyof FundingForm, value: string) => setForm(current => {
    const next = { ...current, [key]: value };
    try { sessionStorage.setItem(draftStorageKey, JSON.stringify(next)); } catch { /* Continue with account autosave. */ }
    setSaved(false);
    return next;
  });
  const score = useMemo(() => getReadinessScore({
    monthlyRevenue: form.musicRevenueStatus === "Not yet" ? 0 : Number(form.monthlyRevenue) || 0, monthsHistory: Number(form.monthsHistory) || 0,
    growth: Number(form.growth) || 0, hasGrowthData: form.growth !== "", masterOwnership: Number(form.masterOwnership) || 0,
    publishingOwnership: Number(form.publishingOwnership) || 0, catalogYears: Number(form.catalogYears) || 0,
    hasCatalogAge: form.catalogYears !== "",
    completedFields: [form.profileType, form.artistName, form.country, form.releasedSongs, form.monthlyRevenue, form.masterOwnership, form.purpose].filter(Boolean).length,
    hasAdvance: (Boolean(form.hasAdvance) && form.hasAdvance.toLowerCase() !== "no") || (Boolean(form.existingObligations) && form.existingObligations.toLowerCase() !== "no"),
  }), [form]);
  const selectedProfile = profileGuidance[form.profileType] || profileGuidance.Artist;
  const readinessNextSteps = [
    Number(form.monthlyRevenue) > 0 ? "Keep royalty and distributor statements together." : "Add a recent estimate of music revenue when available.",
    Number(form.masterOwnership) > 0 || Number(form.publishingOwnership) > 0 ? "Keep split sheets and ownership records organized." : "Confirm your ownership and publishing splits.",
    form.rightsRegistered === "No" ? "Register eligible works and rights with the relevant organizations." : null,
    form.splitsOrganized === "No" ? "Organize split agreements and contributor details." : null,
    form.monthsHistory && Number(form.monthsHistory) < 12 ? "Build a consistent revenue history and update your profile over time." : null,
  ].filter(Boolean) as string[];
  const setField = (key: keyof FundingForm) => (value: string) => update(key, value);
  const startCheck = () => {
    if (!isAuthenticated) { setLocation("/login?redirect_url=%2Ffunding%2Feligibility"); return; }
    setLocation("/funding/eligibility");
    setTimeout(() => document.getElementById("eligibility")?.scrollIntoView({ behavior: "smooth" }), 80);
  };
  const submitDraft = async () => {
    if (!consented) return;
    setRequestBusy(true);
    setRequestNotice("");
    try {
      const result = await apiRequest("/api/funding/application-request", "POST", {
        artistName: form.artistName || user?.artistName || user?.firstName || "Artist",
        country: form.country, amount: form.amount, purpose: form.purpose, readinessScore: score,
        agreementsReviewed: false, form,
      });
      sessionStorage.setItem(statusStorageKey, result.status || "awaiting_agreements");
      setSaved(false);
      setRequestNotice(result.emailSent
        ? "Your private review request was saved and confirmation emails were sent. No details were shared with a funding partner."
        : "Your private review request was saved. Email delivery is unavailable; Boostify needs to check its mail configuration.");
      setLocation("/funding/status");
    } catch (error) {
      setRequestNotice(error instanceof Error ? error.message : "We couldn't send your review request. Please try again.");
    } finally { setRequestBusy(false); }
  };
  const requestMeeting = async () => {
    if (!meetingAvailability.trim()) return;
    setRequestBusy(true);
    setMeetingNotice("");
    try {
      const result = await apiRequest("/api/funding/meeting-request", "POST", {
        artistName: form.artistName || user?.artistName || user?.firstName || "Artist",
        topic: meetingTopic, availability: meetingAvailability,
      });
      setMeetingNotice(result.emailSent
        ? "Request sent. We emailed you and the Boostify team; your time will be confirmed by email."
        : "Request saved. Email delivery is unavailable, so Boostify needs to check its mail configuration.");
      setMeetingAvailability("");
    } catch (error) {
      setMeetingNotice(error instanceof Error ? error.message : "We couldn't send your meeting request. Please try again.");
    } finally { setRequestBusy(false); }
  };
  const section = location.split("/")[2] || "overview";
  const isDashboard = isAuthenticated && (section === "overview" || section === "dashboard" || section === "offers");
  const isWizard = isAuthenticated && (section === "eligibility" || section === "application" || section === "documents");
  const isStatus = isAuthenticated && section === "status";

  useEffect(() => {
    if (section === "application" || section === "documents") setStep(4);
    if (section === "eligibility") setStep(0);
  }, [section]);

  const askAssistant = () => {
    const text = question.toLowerCase();
    setAssistantReply(text.includes("document") ? "Funding partners may request royalty statements or proof of ownership during a later review. For now, do not upload sensitive files here." : text.includes("master") || text.includes("publishing") ? "Master rights relate to the recording; publishing relates to the composition. Enter only ownership percentages you can verify." : text.includes("score") || text.includes("eligible") ? "This readiness estimate is based on your answers. It is not an approval or a partner underwriting decision." : "Music catalog reviews often consider income, ownership, existing advances and other obligations. Terms vary by partner and review.");
  };

  return <main className="funding-shell min-h-screen overflow-hidden bg-[#080b12] text-white">
    <div className="pointer-events-none fixed inset-0 funding-grain opacity-[0.12]" />
    <div className="relative mx-auto max-w-[1240px] px-5 pb-28 pt-8 sm:px-8 lg:px-12">
      <header className="mb-10 flex items-center justify-between">
        <Link href="/funding" className="flex items-center gap-3" aria-label="Boostify Funding home"><span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-orange-500 text-black"><Music2 size={22} /></span><span className="text-[15px] font-semibold tracking-wide">BOOSTIFY <span className="text-orange-400">CAPITAL</span></span></Link>
        <div className="flex items-center gap-5"><Link href="/messages" className="hidden items-center gap-2 text-sm text-slate-300 hover:text-white sm:flex"><MessageCircle size={16} /> Support</Link>{isAuthenticated ? <span className="hidden text-sm text-slate-400 sm:block">{user?.firstName ? `Hi, ${user.firstName}` : "Your funding workspace"}</span> : <Link href="/login?redirect_url=%2Ffunding" className="text-sm text-slate-300 hover:text-white">Sign in</Link>}<button onClick={() => setShowAssistant(true)} className="flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm text-slate-200 hover:border-orange-400/60"><CircleHelp size={16} /> <span className="hidden sm:inline">Ask Boostify</span></button></div>
      </header>

      {isStatus ? <section className="mx-auto max-w-3xl py-16 text-center"><div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-orange-500/10 text-orange-300"><ShieldCheck size={30}/></div><h1 className="text-4xl font-semibold">Your request is with Boostify</h1><p className="mx-auto mt-4 max-w-xl text-slate-400">Your information is private and waiting for required agreements and verified e-signatures. Nothing has been sent to a funding partner.</p>{requestNotice&&<p role="status" className="mx-auto mt-5 max-w-2xl rounded-2xl border border-orange-300/20 bg-orange-300/5 p-4 text-left text-sm leading-6 text-orange-100">{requestNotice}</p>}<div className="mt-10 rounded-3xl border border-white/10 bg-white/[0.035] p-6 text-left"><div className="flex items-center justify-between"><div><p className="text-sm text-slate-400">Internal readiness estimate</p><p className="mt-2 text-3xl font-semibold">{score} <span className="text-base font-normal text-slate-500">/ 100</span></p></div><span className="rounded-full bg-orange-400/10 px-3 py-1.5 text-xs text-orange-200">{scoreLabel(score)}</span></div><div className="mt-5 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-orange-500 to-amber-300 transition-all" style={{width:`${score}%`}}/></div><p className="mt-4 text-xs leading-5 text-slate-500">This score is a configurable readiness estimate only. Partner criteria pending confirmation.</p></div><div className="mt-8 flex flex-wrap justify-center gap-3"><button onClick={() => { setStep(4); setLocation("/funding/application"); }} className="rounded-full bg-orange-500 px-6 py-3 font-medium text-black hover:bg-orange-400">Continue application <ArrowRight size={16} className="ml-2 inline"/></button><Link href="/messages" className="rounded-full border border-white/15 px-6 py-3 text-slate-200 hover:border-white/30">Contact us</Link></div></section> : <>

      {!isWizard && !isDashboard && <>
        <section className="funding-hero relative isolate overflow-hidden rounded-[32px] border border-white/10 bg-[#0b1019] shadow-[0_30px_100px_-50px_rgba(249,115,22,.3)]">
          <div className="absolute inset-0 -z-10"><img src={heroImage} alt="Luminous soundwave circling a vinyl record" className="h-full w-full object-cover object-center opacity-70"/><div className="absolute inset-0 bg-gradient-to-r from-[#080b12] via-[#080b12]/90 to-[#080b12]/10"/><div className="absolute inset-0 bg-gradient-to-t from-[#080b12]/80 via-transparent to-transparent"/></div>
          <div className="grid min-h-[580px] items-center gap-8 px-6 py-12 sm:px-10 lg:grid-cols-[1.1fr_.9fr] lg:px-16">
            <div className="max-w-2xl">
              <p className="inline-flex items-center gap-2 rounded-full border border-orange-300/25 bg-orange-300/[0.08] px-3 py-1.5 text-xs font-medium uppercase tracking-[.15em] text-orange-200"><Sparkles size={14}/> Music finance, made clearer</p>
              <h1 className="mt-6 max-w-[660px] text-[clamp(2.75rem,6vw,5.6rem)] font-semibold leading-[.96] tracking-[-.06em]">Turn music value<br/><span className="text-orange-400">into room to grow.</span></h1>
              <p className="mt-6 max-w-xl text-base leading-7 text-slate-300 sm:text-lg">Organize your catalog, rights and revenue story in one private workspace. Boostify helps you understand your readiness and explore funding pathways with a network of music finance partners.</p>
              <div className="mt-8 flex flex-wrap gap-3"><button onClick={startCheck} className="rounded-full bg-orange-500 px-6 py-3.5 font-semibold text-black shadow-lg shadow-orange-950/30 transition hover:-translate-y-0.5 hover:bg-orange-400">Build my music profile <ArrowRight size={17} className="ml-2 inline"/></button><a href="#how-it-works" className="rounded-full border border-white/20 bg-white/[0.04] px-6 py-3.5 font-medium text-white transition hover:bg-white/10">Explore the process <ArrowDown size={16} className="ml-2 inline"/></a></div>
              <p className="mt-6 max-w-xl text-xs leading-5 text-slate-400">Your profile is private to Boostify while you prepare it. Funding decisions, terms and eligibility are determined by partners and can vary.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:pl-8">
              {[["01","Catalog context","Releases, catalog age and distribution"],["02","Rights clarity","Ownership, splits and existing advances"],["03","Revenue picture","Royalty streams and income history"],["04","Growth plans","What you want capital to help unlock"]].map(([n,title,copy])=><div key={n} className="rounded-2xl border border-white/10 bg-[#0a0f18]/75 p-4 backdrop-blur-md transition hover:border-orange-300/30 sm:p-5"><span className="text-xs font-semibold tracking-widest text-orange-300">{n} / PROFILE</span><h2 className="mt-3 font-medium text-white">{title}</h2><p className="mt-1 text-sm leading-5 text-slate-400">{copy}</p></div>)}
              <div className="rounded-2xl border border-orange-300/20 bg-orange-300/[0.08] p-4 sm:col-span-2 sm:p-5"><div className="flex items-center gap-2 text-sm font-medium text-orange-100"><LockKeyhole size={16}/> Private by design</div><p className="mt-2 text-sm leading-6 text-slate-300">Applications stay in Boostify for review. Partner sharing remains locked until the required agreements are reviewed and verified signatures are in place.</p></div>
            </div>
          </div>
        </section>

        <section className="grid gap-5 py-16 md:grid-cols-[1.2fr_0.8fr] md:items-stretch"><div className="relative min-h-[320px] overflow-hidden rounded-[28px] border border-white/10"><img src={meetingImage} alt="Artist and music advisor talking in a recording studio" className="absolute inset-0 h-full w-full object-cover"/><div className="absolute inset-0 bg-gradient-to-t from-[#080b12]/90 via-[#080b12]/15 to-transparent"/><div className="absolute bottom-0 p-6 sm:p-8"><span className="text-xs uppercase tracking-[0.18em] text-orange-300">Human support</span><h3 className="mt-2 max-w-lg text-2xl font-semibold">A real conversation about your next move.</h3><p className="mt-2 max-w-lg text-sm leading-6 text-slate-200">Book a 30-minute virtual consultation. Calendly confirms your selected slot and sends the calendar invite.</p><a href={FUNDING_BOOKING_URL} target="_blank" rel="noreferrer" className="mt-5 inline-flex items-center rounded-full bg-orange-500 px-5 py-3 text-sm font-semibold text-black">Book a 30-minute consultation <ArrowRight className="ml-2" size={15}/></a></div></div><div className="relative min-h-[320px] overflow-hidden rounded-[28px] border border-white/10"><img src={rightsReviewImage} alt="Independent musician reviewing catalog and rights information in a studio" className="absolute inset-0 h-full w-full object-cover"/><div className="absolute inset-0 bg-gradient-to-t from-[#080b12]/90 via-[#080b12]/20 to-transparent"/><div className="absolute bottom-0 p-6"><span className="text-xs uppercase tracking-[0.18em] text-orange-300">Your catalog, your control</span><h3 className="mt-2 text-xl font-semibold">Understand the terms before sharing details.</h3><p className="mt-2 text-sm leading-6 text-slate-200">Every application stays private until agreements and verified signatures are in place.</p></div></div></section>        <section className="grid gap-10 py-20 lg:grid-cols-[0.8fr_1.2fr] lg:items-end"><div><p className="text-xs uppercase tracking-[0.2em] text-orange-300">Built around your catalog</p><h2 className="mt-4 max-w-lg text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">Your music has a story. Start with the numbers.</h2></div><p className="max-w-2xl text-base leading-7 text-slate-400">Explore catalog financing, royalty advances and growth capital pathways through participating funding partners. Your readiness profile is a starting point, not a promise of approval.</p></section>

        <section id="how-it-works" className="border-y border-white/10 py-14"><div className="mb-8 flex items-end justify-between gap-4"><div><h2 className="text-2xl font-semibold">A clear path, one step at a time</h2><p className="mt-2 text-sm text-slate-400">Start with what you know. You can save your progress as you go.</p></div><span className="hidden text-sm text-slate-500 sm:block">01 — 04</span></div><div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">{[["01","Tell us about your music","A few details about you and your catalog."],["02","Add revenue context","Share the income history you can verify."],["03","Review your readiness","See an internal estimate and next steps."],["04","Explore partner options","Partner reviews and requirements vary."]].map(([n,title,copy])=><div key={n} className="relative border-l border-white/10 pl-5"><span className="text-sm font-medium text-orange-300">{n}</span><h3 className="mt-5 text-lg font-medium">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-400">{copy}</p></div>)}</div></section>

        <section className="grid gap-10 py-20 lg:grid-cols-[1fr_0.85fr] lg:items-center"><div><h2 className="max-w-xl text-3xl font-semibold tracking-tight sm:text-4xl">Made for the people behind the music.</h2><p className="mt-4 max-w-lg leading-7 text-slate-400">Artists, songwriters, producers, independent labels, catalog owners and publishers can organize the information partners may ask for, all within Boostify.</p><button onClick={startCheck} className="mt-7 text-sm font-medium text-orange-300 hover:text-orange-200">Start your readiness check <ArrowRight className="ml-2 inline" size={16}/></button></div><div className="grid grid-cols-2 gap-x-8 gap-y-7 border-l border-white/10 pl-8"><div><Music2 className="text-orange-300" size={20}/><h3 className="mt-4 font-medium">Catalog financing</h3></div><div><WalletCards className="text-orange-300" size={20}/><h3 className="mt-4 font-medium">Royalty advances</h3></div><div><Sparkles className="text-orange-300" size={20}/><h3 className="mt-4 font-medium">Growth capital</h3></div><div><ShieldCheck className="text-orange-300" size={20}/><h3 className="mt-4 font-medium">Rights aware</h3></div></div></section>
        <section className="rounded-[30px] border border-white/10 bg-gradient-to-br from-white/[0.045] to-transparent p-6 sm:p-9">
          <div className="grid gap-8 lg:grid-cols-[.75fr_1.25fr] lg:items-end"><div><p className="text-xs uppercase tracking-[.2em] text-orange-300">A path for your role</p><h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Different catalogs.<br/>A profile that fits.</h2><p className="mt-4 text-sm leading-6 text-slate-400">Choose a starting point to see what your music finance profile can help organize.</p></div><div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{profileOptions.map((profile,index)=><button key={profile} onClick={()=>setAudienceFocus(profile)} aria-pressed={audienceFocus===profile} className={`rounded-xl border px-3 py-3 text-left text-sm transition ${audienceFocus===profile?"border-orange-300/40 bg-orange-300/10 text-orange-100":"border-white/10 bg-black/10 text-slate-300 hover:border-white/25"}`}><span className="mr-2 text-xs text-orange-300">0{index+1}</span>{profile}</button>)}</div></div>
          <div className="mt-7 grid gap-5 rounded-2xl border border-orange-300/15 bg-[#090d14]/80 p-5 sm:grid-cols-[1fr_auto] sm:items-center sm:p-7"><div><h3 className="text-xl font-semibold">{profileGuidance[audienceFocus]?.headline}</h3><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">{profileGuidance[audienceFocus]?.detail}</p><p className="mt-4 flex items-center gap-2 text-xs text-slate-500"><ShieldCheck size={14} className="text-orange-300"/> No approval promises; partner review and terms vary.</p></div><button onClick={startCheck} className="inline-flex items-center justify-center rounded-full bg-orange-500 px-5 py-3 text-sm font-semibold text-black">Build this profile <ArrowRight size={15} className="ml-2"/></button></div>
        </section>
        <section className="grid gap-4 py-16 sm:grid-cols-2 lg:grid-cols-4">{[["Catalog financing","Explore options that consider the performance and rights around an established catalog."],["Royalty advances","Organize royalty history and ownership details for a conversation about future cash flow."],["Release and growth","Describe plans for marketing, touring, recording, equipment or business growth."],["Portfolio review","Bring together multiple works, entities or revenue sources in one clear profile."]].map(([title,copy],i)=><article key={title} className="funding-info-card rounded-2xl border border-white/10 bg-white/[0.025] p-5"><span className="text-xs font-semibold uppercase tracking-[.16em] text-orange-300">0{i+1} / pathway</span><h3 className="mt-4 text-lg font-medium">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-400">{copy}</p></article>)}</section>
        <PartnerCard onContact={() => setLocation("/messages")} onStart={startCheck}/>
      </>}

      {isDashboard && <section className="mx-auto max-w-6xl py-5">
        <div className="funding-dashboard-hero relative overflow-hidden rounded-[30px] border border-white/10 p-6 sm:p-9 lg:p-11"><div className="pointer-events-none absolute -right-8 -top-24 h-72 w-72 rounded-full bg-orange-400/15 blur-3xl"/><div className="relative flex flex-wrap items-end justify-between gap-6"><div><p className="inline-flex items-center gap-2 rounded-full border border-orange-300/20 bg-orange-300/[.07] px-3 py-1.5 text-xs uppercase tracking-[.16em] text-orange-200"><Sparkles size={13}/> Your music finance workspace</p><h1 className="mt-5 text-4xl font-semibold tracking-tight sm:text-5xl">Welcome{user?.firstName ? `, ${user.firstName}` : " back"}.</h1><p className="mt-3 max-w-xl text-base leading-7 text-slate-300">Your catalog story, readiness and next steps — together in one private place.</p></div><button onClick={()=>{setLocation("/funding/eligibility");setStep(0);}} className="rounded-full bg-orange-500 px-5 py-3.5 text-sm font-semibold text-black shadow-lg shadow-orange-950/30 transition hover:-translate-y-0.5 hover:bg-orange-400">{countFundingAnswers(form)?"Continue my profile":"Build my music profile"}<ArrowRight className="ml-2 inline" size={15}/></button></div>
          <div className="relative mt-8 grid gap-3 sm:grid-cols-3"><div className="rounded-2xl border border-white/10 bg-[#080b12]/55 p-4 backdrop-blur"><p className="text-xs uppercase tracking-wider text-slate-500">Profile progress</p><div className="mt-2 flex items-end gap-2"><span className="text-3xl font-semibold">{Math.round(countFundingAnswers(form)/fundingFormFields.length*100)}%</span><span className="pb-1 text-xs text-slate-500">{countFundingAnswers(form)} of {fundingFormFields.length} fields</span></div><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-orange-500 to-amber-300 transition-all" style={{width:`${Math.round(countFundingAnswers(form)/fundingFormFields.length*100)}%`}}/></div></div><div className="rounded-2xl border border-white/10 bg-[#080b12]/55 p-4 backdrop-blur"><p className="text-xs uppercase tracking-wider text-slate-500">Your focus</p><p className="mt-3 flex items-center gap-2 text-lg font-medium"><Music2 size={17} className="text-orange-300"/>{form.profileType||"Music profile"}</p><p className="mt-1 text-sm text-slate-400">{form.artistName||"Add an artist, writer or business name"}</p></div><div className="rounded-2xl border border-white/10 bg-[#080b12]/55 p-4 backdrop-blur"><p className="text-xs uppercase tracking-wider text-slate-500">Readiness snapshot</p>{countFundingAnswers(form)?<><p className="mt-2 text-xl font-semibold">{score}<span className="ml-1 text-sm font-normal text-slate-500">/ 100</span></p><p className="mt-1 text-sm text-orange-200">{scoreLabel(score)}</p></>:<><p className="mt-3 text-base font-medium">Ready when you are</p><p className="mt-1 text-sm text-slate-400">Complete a few profile fields to see your snapshot.</p></>}</div></div>
        </div>
        <div className="mt-6 grid gap-4 lg:grid-cols-[1.1fr_.9fr]"><article className="rounded-3xl border border-white/10 bg-white/[.035] p-6 sm:p-8"><p className="flex items-center gap-2 text-xs uppercase tracking-[.17em] text-orange-300"><ArrowRight size={14}/> Recommended next step</p><h2 className="mt-4 text-2xl font-semibold">{countFundingAnswers(form)?"Keep your catalog story moving":"Start with the essentials"}</h2><p className="mt-2 max-w-xl text-sm leading-6 text-slate-400">{countFundingAnswers(form)?"Add the details you can verify about releases, rights and revenue. You can save your progress and return whenever you need.":"Choose your music role, then add a few basics about your catalog. Your answers are saved to your account as you go."}</p><button onClick={()=>{setLocation("/funding/eligibility");setStep(0);}} className="mt-6 rounded-full border border-orange-300/30 bg-orange-300/[.08] px-5 py-3 text-sm font-medium text-orange-100 transition hover:bg-orange-300/[.14]">{countFundingAnswers(form)?"Continue profile":"Open readiness profile"}<ArrowRight size={15} className="ml-2 inline"/></button><p className="mt-5 text-xs leading-5 text-slate-500">Your readiness snapshot is an internal guide, not approval, an offer or a partner underwriting decision.</p></article>
          <article className="rounded-3xl border border-white/10 bg-gradient-to-br from-orange-300/[.07] to-white/[.02] p-6 sm:p-8"><p className="flex items-center gap-2 text-xs uppercase tracking-[.17em] text-orange-300"><LockKeyhole size={14}/> Your data, your control</p><h2 className="mt-4 text-2xl font-semibold">Private while you prepare.</h2><p className="mt-2 text-sm leading-6 text-slate-400">Build a clear picture of your music, catalog and goals. Applications remain in Boostify for review until required agreements and verified signatures are in place.</p><div className="mt-5 flex flex-wrap gap-3"><button onClick={()=>setShowMeetingRequest(true)} className="rounded-full bg-white/10 px-4 py-2.5 text-sm text-white hover:bg-white/15">Request a conversation</button><Link href="/messages" className="rounded-full border border-white/10 px-4 py-2.5 text-sm text-slate-200 hover:border-white/25">Message support</Link></div></article></div>
        <div className="mt-8"><PartnerCard onContact={()=>setLocation("/messages")} onStart={()=>{setLocation("/funding/eligibility");setStep(0);}}/></div>
        <section className="grid gap-4 pb-8 sm:grid-cols-3"><article className="funding-info-card rounded-2xl border border-white/10 bg-white/[.025] p-5"><Music2 size={20} className="text-orange-300"/><h3 className="mt-4 font-medium">Build a complete picture</h3><p className="mt-2 text-sm leading-6 text-slate-400">Bring catalog details, ownership and revenue history together at your pace.</p></article><article className="funding-info-card rounded-2xl border border-white/10 bg-white/[.025] p-5"><ShieldCheck size={20} className="text-orange-300"/><h3 className="mt-4 font-medium">Understand the process</h3><p className="mt-2 text-sm leading-6 text-slate-400">See your readiness snapshot and know what may come next before a partner review.</p></article><article className="funding-info-card rounded-2xl border border-white/10 bg-white/[.025] p-5"><MessageCircle size={20} className="text-orange-300"/><h3 className="mt-4 font-medium">Talk it through</h3><p className="mt-2 text-sm leading-6 text-slate-400">Ask Boostify for help or schedule a conversation when you want a human guide.</p></article></section>
      </section>}

      {isWizard && <section id="eligibility" className="mx-auto max-w-4xl py-4"><button onClick={() => setLocation("/funding")} className="mb-8 flex items-center gap-2 text-sm text-slate-400 hover:text-white"><ArrowLeft size={16}/> Funding overview</button><div className="mb-8 flex items-center justify-between gap-4"><div><p className="text-sm text-orange-300">Funding readiness</p><h1 className="mt-2 text-3xl font-semibold">Tell us about your music.</h1><p className="mt-2 text-slate-400">Your progress saves to your account as you go. You can return any time.</p></div><span className="text-sm text-slate-500">{step+1} / {steps.length}</span></div><div className="mb-8 flex gap-1.5">{steps.map((name,index)=><div key={name} className="flex-1"><div className={`h-1 rounded-full ${index <= step ? "bg-orange-400" : "bg-white/10"}`}/><span className={`mt-2 block text-[10px] sm:text-xs ${index===step?"text-orange-200":"text-slate-500"}`}>{name}</span></div>)}</div><fieldset disabled={!draftLoaded} className="rounded-3xl border border-white/10 bg-white/[0.035] p-5 sm:p-8">
        {step===0&&<div className="grid gap-5 sm:grid-cols-2"><div className="sm:col-span-2"><SelectField label="Which best describes your role?" value={form.profileType} onChange={setField("profileType")} options={profileOptions}/>{form.profileType&&<div className="mt-3 rounded-2xl border border-orange-300/20 bg-orange-300/[0.05] p-4"><p className="font-medium text-orange-100">{selectedProfile.headline}</p><p className="mt-1 text-sm leading-6 text-slate-300">{selectedProfile.detail}</p></div>}</div><Field label={form.profileType==="Independent Label"?"Label or business name":"Artist, writer or business name"} value={form.artistName} onChange={setField("artistName")} placeholder={form.profileType==="Independent Label"?"Your label name":"Your name or professional name"}/><Field label="Country" value={form.country} onChange={setField("country")} placeholder="Country of residence"/><SelectField label="Entity type" value={form.entityType} onChange={setField("entityType")} options={["Individual","LLC","Corporation","Label","Other"]}/><NumberInput label="Years active" value={form.yearsActive} onChange={setField("yearsActive")} suffix="years" min={0}/></div>}
        {step===1&&<div className="grid gap-5 sm:grid-cols-2"><NumberInput label="Released songs" value={form.releasedSongs} onChange={setField("releasedSongs")}/><NumberInput label="Catalog age" value={form.catalogYears} onChange={setField("catalogYears")} suffix="years"/><Field label="Distributor" value={form.distributor} onChange={setField("distributor")} placeholder="e.g. DistroKid"/><div className="rounded-2xl border border-white/10 p-4 text-sm leading-6 text-slate-400 sm:col-span-2">Include only information you can verify. Streaming and publishing revenue may be treated differently by each partner.</div></div>}
        {step===2&&<div className="grid gap-5 sm:grid-cols-2"><NumberInput label="Master ownership" value={form.masterOwnership} onChange={setField("masterOwnership")} suffix="%" max={100}/><NumberInput label="Publishing ownership" value={form.publishingOwnership} onChange={setField("publishingOwnership")} suffix="%" max={100}/><SelectField label="Are your rights registered?" value={form.rightsRegistered} onChange={setField("rightsRegistered")} options={["Yes","Some are","No","Not sure"]}/><SelectField label="Are your splits documented and organized?" value={form.splitsOrganized} onChange={setField("splitsOrganized")} options={["Yes","Some are","No","Not sure"]}/><SelectField label="Existing royalty advance?" value={form.hasAdvance} onChange={setField("hasAdvance")} options={["No","Yes","Not sure"]}/><SelectField label="Other obligations against music income?" value={form.existingObligations} onChange={setField("existingObligations")} options={["No","Yes","Not sure"]}/><div className="flex items-start gap-3 rounded-xl border border-white/10 p-4 text-sm leading-6 text-slate-400 sm:col-span-2"><LockKeyhole className="mt-0.5 shrink-0 text-orange-300" size={17}/>Rights details are used only for this readiness estimate. No partner receives your information from this page.</div></div>}
        {step===3&&<div className="grid gap-5 sm:grid-cols-2"><SelectField label="Does your music currently generate income?" value={form.musicRevenueStatus} onChange={setField("musicRevenueStatus")} options={["Yes","Not yet","Not sure"]}/><NumberInput label="Average monthly music revenue" value={form.monthlyRevenue} onChange={setField("monthlyRevenue")} prefix="$"/><NumberInput label="Revenue history" value={form.monthsHistory} onChange={setField("monthsHistory")} suffix="months" max={120}/><NumberInput label="Year over year growth" value={form.growth} onChange={setField("growth")} suffix="%" min={-100}/><div className="rounded-xl border border-white/10 p-4 text-sm text-slate-400">Share total music revenue only. This estimate does not assume each revenue source qualifies.</div><div className="rounded-2xl border border-orange-300/20 bg-orange-300/[0.05] p-5 sm:col-span-2"><div className="flex items-start justify-between gap-3"><div><p className="text-xs uppercase tracking-widest text-orange-300">Your readiness snapshot</p><p className="mt-2 text-lg font-semibold">{scoreLabel(score)}</p><p className="mt-1 text-sm leading-6 text-slate-300">{selectedProfile.detail}</p></div><span className="text-3xl font-semibold text-orange-200">{score}<span className="text-sm text-slate-400">/100</span></span></div><p className="mt-4 text-sm font-medium text-slate-200">Useful next steps</p><ul className="mt-2 grid gap-2 text-sm text-slate-400 sm:grid-cols-2">{readinessNextSteps.map(item=><li key={item} className="flex gap-2"><span className="text-orange-300">·</span>{item}</li>)}</ul><p className="mt-4 text-xs leading-5 text-slate-500">This is an internal readiness estimate, not approval or an offer. Your profile can improve as your income, rights records and catalog information grow.</p></div></div>}
        {step===4&&<div className="grid gap-6"><div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4"><p className="text-xs uppercase tracking-widest text-orange-300">{form.profileType||"Music"} profile</p><p className="mt-2 font-medium">{selectedProfile.headline}</p><p className="mt-1 text-sm leading-6 text-slate-400">{selectedProfile.detail}</p></div><div className="grid gap-5 sm:grid-cols-2"><NumberInput label="Capital amount you're exploring" value={form.amount} onChange={setField("amount")} prefix="$"/><SelectField label="What would capital help you do?" value={form.purpose} onChange={setField("purpose")} options={["Marketing","Recording","Touring","Catalog acquisition","Team expansion","Release campaign","Business growth",selectedProfile.purpose,"Other"]}/></div><div><h3 className="mb-2 font-medium">Funding agreement pack</h3><p className="mb-4 text-sm leading-6 text-slate-400">Review the draft artist referral and limited-data authorization, partner confidentiality and referral agreement, and data security addendum. These are counsel-review drafts with open deal terms, not documents ready for signature.</p><div className="grid gap-2 sm:grid-cols-3">{[["Artist referral & data authorization","artist-referral-data-authorization"],["Partner confidentiality & referral","partner-confidentiality-referral"],["Data security addendum","data-security-addendum"]].map(([title,file])=><a key={file} href={`/funding/agreements/${file}.md`} target="_blank" rel="noreferrer" className="rounded-xl border border-white/10 p-3 text-sm text-orange-200 hover:border-orange-300/40">Review draft <span className="mt-1 block text-xs text-slate-400">{title} ↗</span></a>)}</div></div><div className="rounded-2xl border border-amber-300/20 bg-amber-300/[0.05] p-4"><p className="font-medium text-amber-100">Partner sharing is locked</p><p className="mt-2 text-sm leading-6 text-slate-300">Boostify has no configured e-signature provider or executed funding partner agreement. This request goes to Boostify for review only; applications and financial details are not shared with our funding partner network unless the applicable agreements are reviewed, signed and verified.</p></div><div><h3 className="mb-3 font-medium">Documents to prepare</h3><p className="mb-4 text-sm text-slate-400">Secure uploads will be enabled after private storage and partner requirements are configured. Please don't attach sensitive documents here.</p><div className="grid gap-2 sm:grid-cols-2">{documents.map(doc=><div key={doc} className="rounded-xl border border-white/10 p-3 text-sm text-slate-300">{doc}</div>)}</div></div><label className="flex items-start gap-3 border-t border-white/10 pt-5 text-sm leading-6 text-slate-300"><input type="checkbox" className="mt-1 accent-orange-500" checked={consented} onChange={e=>setConsented(e.target.checked)}/><span>I understand this is a private request to Boostify for review only. It does not authorize sharing my application or documents with any funding partner.</span></label><button disabled={!consented||requestBusy} onClick={submitDraft} className="justify-self-start rounded-full bg-orange-500 px-6 py-3 font-semibold text-black disabled:cursor-not-allowed disabled:opacity-40">{requestBusy?"Sending request…":"Send private review request"} <ArrowRight className="ml-2 inline" size={16}/></button>{requestNotice&&<p role="status" className="text-sm text-orange-200">{requestNotice}</p>}<div className="flex flex-wrap gap-3"><a href={FUNDING_BOOKING_URL} target="_blank" rel="noreferrer" className="justify-self-start rounded-full border border-orange-300/35 bg-orange-300/5 px-5 py-3 text-sm text-orange-100 hover:border-orange-300/70">Choose a meeting time <ChevronRight className="ml-1 inline" size={15}/></a><button type="button" onClick={()=>setShowMeetingRequest(true)} className="justify-self-start rounded-full border border-white/15 px-5 py-3 text-sm text-white hover:border-orange-300/50">Ask Boostify for another time</button></div></div>}
        <div className="mt-8 flex items-center justify-between border-t border-white/10 pt-5"><span className="text-xs text-slate-500">{saved?"Saved securely to your account":saveError?"Sync issue · draft remains in this tab":"Saving securely to your account…"}</span><div className="flex gap-2">{step>0&&<button onClick={()=>setStep(step-1)} className="rounded-full border border-white/15 px-5 py-2.5 text-sm text-slate-200">Back</button>}{step<4&&<button onClick={()=>setStep(step+1)} className="rounded-full bg-orange-500 px-5 py-2.5 text-sm font-semibold text-black">Continue <ArrowRight className="ml-1 inline" size={15}/></button>}</div></div>
        </fieldset><p className="mt-5 text-center text-xs leading-5 text-slate-500">Boostify Funding Readiness Score is an internal readiness estimate based on information provided. It is not an approval, offer or underwriting decision.</p></section>}
      </>}
      <footer className="mt-12 flex flex-col justify-between gap-4 border-t border-white/10 pt-6 text-xs text-slate-500 sm:flex-row"><span>© Boostify Music · Funding opportunities are subject to partner underwriting.</span><div className="flex gap-5"><Link href="/messages" className="hover:text-slate-300">Funding support</Link><Link href="/privacy" className="hover:text-slate-300">Privacy</Link></div></footer>
    </div>
    {showAssistant&&<div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 p-4 sm:items-center" onClick={()=>setShowAssistant(false)}><div className="w-full max-w-lg rounded-3xl border border-white/10 bg-[#111722] p-6 shadow-2xl" onClick={e=>e.stopPropagation()}><div className="mb-5 flex items-center justify-between"><div><p className="font-semibold">Funding assistant</p><p className="mt-1 text-sm text-slate-400">Answers about the readiness flow</p></div><button onClick={()=>setShowAssistant(false)} aria-label="Close assistant"><X size={18}/></button></div><div className="mb-4 rounded-2xl bg-white/[0.04] p-4 text-sm leading-6 text-slate-300">{assistantReply||"Ask about your readiness score, catalog rights or documents. I can't confirm partner approval or criteria."}</div><div className="flex gap-2"><input value={question} onChange={e=>setQuestion(e.target.value)} onKeyDown={e=>e.key==="Enter"&&askAssistant()} placeholder="What documents do I need?" className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none focus:border-orange-400/60"/><button onClick={askAssistant} className="rounded-xl bg-orange-500 px-4 text-sm font-semibold text-black">Ask</button></div><Link href="/messages" className="mt-4 inline-flex items-center gap-2 text-sm text-orange-300">Talk to Boostify support <ChevronRight size={15}/></Link></div></div>}
    {showMeetingRequest&&<div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 p-4 sm:items-center" onClick={()=>setShowMeetingRequest(false)}><div role="dialog" aria-modal="true" aria-labelledby="funding-meeting-title" className="w-full max-w-lg rounded-3xl border border-white/10 bg-[#111722] p-6 shadow-2xl" onClick={e=>e.stopPropagation()}><div className="mb-5 flex items-start justify-between"><div><p className="text-xs uppercase tracking-widest text-orange-300">Funding consultation</p><h2 id="funding-meeting-title" className="mt-2 text-xl font-semibold">Request a meeting</h2><p className="mt-2 text-sm text-slate-400">Book directly through Calendly for an instant confirmation, or request a different time below.</p><a href={FUNDING_BOOKING_URL} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center rounded-full bg-orange-500 px-4 py-2.5 text-sm font-semibold text-black">Choose an available slot <ArrowRight className="ml-2" size={14}/></a></div><button onClick={()=>setShowMeetingRequest(false)} aria-label="Close meeting request"><X size={18}/></button></div><label className="mb-4 block space-y-2 text-sm text-slate-300">What would you like to discuss?<input value={meetingTopic} onChange={e=>setMeetingTopic(e.target.value)} maxLength={500} className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none focus:border-orange-400/60"/></label><label className="block space-y-2 text-sm text-slate-300">Your availability and timezone<textarea required value={meetingAvailability} onChange={e=>setMeetingAvailability(e.target.value)} maxLength={500} rows={3} placeholder="For example, Tue/Thu 2–5 pm ET" className="w-full resize-none rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none focus:border-orange-400/60"/></label><button disabled={!meetingAvailability.trim()||requestBusy} onClick={requestMeeting} className="mt-4 rounded-full bg-orange-500 px-5 py-3 text-sm font-semibold text-black disabled:opacity-40">{requestBusy?"Sending…":"Send meeting request"}</button>{meetingNotice&&<p role="status" className="mt-4 text-sm leading-6 text-orange-200">{meetingNotice}</p>}</div></div>}
  </main>;
}

function Field({label,value,onChange,placeholder}:{label:string;value:string;onChange:(value:string)=>void;placeholder:string}){return <label className="block space-y-2"><span className="text-sm text-slate-300">{label}</span><input className="w-full rounded-xl border border-white/10 bg-white/[0.035] px-4 py-3 text-white outline-none placeholder:text-slate-600 focus:border-orange-400/70" value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}/></label>}
function SelectField({label,value,onChange,options}:{label:string;value:string;onChange:(value:string)=>void;options:string[]}){return <label className="block space-y-2"><span className="text-sm text-slate-300">{label}</span><select value={value} onChange={e=>onChange(e.target.value)} className="w-full rounded-xl border border-white/10 bg-[#111722] px-4 py-3 text-white outline-none focus:border-orange-400/70"><option value="">Select one</option>{options.map(x=><option key={x} value={x}>{x}</option>)}</select></label>}
function PartnerCard({onContact,onStart}:{onContact:()=>void;onStart:()=>void}){return <section className="mb-10 rounded-[28px] border border-orange-300/15 bg-gradient-to-br from-orange-400/[0.09] via-white/[0.025] to-transparent p-7 sm:p-9"><div className="grid gap-8 md:grid-cols-[1fr_auto] md:items-center"><div><p className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-orange-300"><ShieldCheck size={14}/> Funding partner network</p><h2 className="mt-4 text-3xl font-semibold">Funding options for your catalog</h2><p className="mt-2 max-w-xl leading-7 text-slate-400">Boostify works with a network of funding partners. Prepare your catalog profile and our team will guide you through the next steps.</p></div><div className="flex flex-wrap gap-3"><button onClick={onStart} className="rounded-full bg-orange-500 px-5 py-3 text-sm font-semibold text-black">Check readiness <ArrowRight className="ml-2 inline" size={15}/></button><button onClick={onContact} className="rounded-full border border-white/15 px-5 py-3 text-sm text-white">Ask Boostify <MessageCircle className="ml-2 inline" size={15}/></button></div></div></section>}
