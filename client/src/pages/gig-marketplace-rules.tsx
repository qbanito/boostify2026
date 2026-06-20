import { useState, useEffect } from "react";
import { Header } from "../components/layout/header";
import {
  Shield,
  DollarSign,
  FileText,
  HelpCircle,
  Lock,
  CheckCircle,
  AlertTriangle,
  ArrowRight,
  Headphones,
  Download,
  Clock,
  RefreshCw,
  Scale,
  CreditCard,
  Users,
  ChevronDown,
  ChevronUp,
  Coins,
  Eye,
} from "lucide-react";

type Tab = "contracts" | "payment" | "protections" | "faq";

interface ContractTerms {
  paymentRules: any;
  deliveryRules: any;
  serviceContract: any;
  faq: Array<{ q: string; a: string }>;
}

export default function GigMarketplaceRulesPage() {
  const [activeTab, setActiveTab] = useState<Tab>("contracts");
  const [terms, setTerms] = useState<ContractTerms | null>(null);
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/gig-escrow/contract-terms")
      .then((r) => r.json())
      .then(setTerms)
      .catch(console.error);
  }, []);

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "contracts", label: "Contracts", icon: <FileText className="w-4 h-4" /> },
    { id: "payment", label: "Payment Rules", icon: <DollarSign className="w-4 h-4" /> },
    { id: "protections", label: "Protections", icon: <Shield className="w-4 h-4" /> },
    { id: "faq", label: "FAQ", icon: <HelpCircle className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-16 pt-24">
        <div className="max-w-4xl mx-auto">
          {/* Hero */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/10 border border-amber-500/30 mb-4">
              <Shield className="w-5 h-5 text-amber-400" />
              <span className="text-amber-400 font-semibold text-sm">Marketplace Protection</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-white via-amber-200 to-amber-400 bg-clip-text text-transparent">
              Gig Marketplace Rules
            </h1>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Everything you need to know about contracts, payments, protections, and how we keep
              every transaction safe for both clients and musicians.
            </p>
          </div>

          {/* Tabs */}
          <div className="flex flex-wrap gap-2 justify-center mb-10">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium transition-all ${
                  activeTab === tab.id
                    ? "bg-amber-500 text-black shadow-lg shadow-amber-500/25"
                    : "bg-white/5 text-white/70 hover:bg-white/10 hover:text-white border border-white/10"
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          {/* Content */}
          {activeTab === "contracts" && <ContractsSection terms={terms} />}
          {activeTab === "payment" && <PaymentRulesSection terms={terms} />}
          {activeTab === "protections" && <ProtectionsSection terms={terms} />}
          {activeTab === "faq" && (
            <FAQSection
              faq={terms?.faq || []}
              expandedFaq={expandedFaq}
              setExpandedFaq={setExpandedFaq}
            />
          )}
        </div>
      </main>
    </div>
  );
}

/* ═══════════════════════════════════════════
   CONTRACTS TAB
   ═══════════════════════════════════════════ */

function ContractsSection({ terms }: { terms: ContractTerms | null }) {
  const contract = terms?.serviceContract;
  return (
    <div className="space-y-8">
      {/* Main agreement card */}
      <div className="rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-500/5 to-transparent p-8">
        <div className="flex items-center gap-3 mb-6">
          <FileText className="w-7 h-7 text-amber-400" />
          <h2 className="text-2xl font-bold">{contract?.title || "BOOSTIFY Marketplace Service Agreement"}</h2>
        </div>

        <p className="text-muted-foreground mb-6">
          This agreement governs all service transactions between clients (buyers) and musicians
          (sellers) on the BOOSTIFY marketplace. By using the marketplace, both parties agree to
          these terms.
        </p>

        {/* Parties */}
        <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Users className="w-5 h-5 text-amber-400" />
          Parties Involved
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {[
            { role: "Client", desc: "The person or entity posting the service request and funding payment.", color: "blue" },
            { role: "Musician", desc: "The person submitting a bid and performing the musical service.", color: "green" },
            { role: "Platform", desc: "BOOSTIFY — the marketplace operator that manages escrow and disputes.", color: "amber" },
          ].map((p) => (
            <div
              key={p.role}
              className={`rounded-xl border border-${p.color}-500/20 bg-${p.color}-500/5 p-4`}
            >
              <h4 className={`font-bold text-${p.color}-400 mb-1`}>{p.role}</h4>
              <p className="text-sm text-muted-foreground">{p.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Obligations */}
      <div className="space-y-6">
        <h3 className="text-xl font-bold flex items-center gap-2">
          <CheckCircle className="w-5 h-5 text-green-400" />
          Obligations & Responsibilities
        </h3>

        {[
          {
            title: "Client Obligations",
            items: contract?.obligations?.client || [
              "Provide clear and complete service requirements in the request.",
              "Fund escrow before work begins.",
              "Review deliverables within 72 hours of delivery.",
              "Communicate feedback constructively via platform messaging.",
              "Approve delivery to release payment or request revision within revision limits.",
            ],
            color: "blue",
          },
          {
            title: "Musician Obligations",
            items: contract?.obligations?.musician || [
              "Deliver original work that matches the service request specifications.",
              "Deliver within the estimated timeframe specified in the bid.",
              "Provide high-quality files in industry-standard formats.",
              "Address revision requests within 48 hours.",
              "Not reuse or resell delivered work without client consent.",
              "Maintain professional communication throughout the project.",
            ],
            color: "green",
          },
          {
            title: "Platform Obligations",
            items: contract?.obligations?.platform || [
              "Hold payments securely in Stripe-powered escrow.",
              "Protect both parties' intellectual property.",
              "Provide dispute resolution within 48 hours.",
              "Maintain file streaming protection (no downloads until approved).",
              "Process payouts within 3-5 business days after approval.",
            ],
            color: "amber",
          },
        ].map((section) => (
          <div
            key={section.title}
            className={`rounded-xl border border-${section.color}-500/20 bg-${section.color}-500/5 p-6`}
          >
            <h4 className={`font-bold text-${section.color}-400 mb-3`}>{section.title}</h4>
            <ul className="space-y-2">
              {section.items.map((item: string, i: number) => (
                <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <CheckCircle className={`w-4 h-4 text-${section.color}-400 mt-0.5 shrink-0`} />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* IP & Termination */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="rounded-xl border border-white/10 bg-white/5 p-6">
          <h3 className="font-bold mb-3 flex items-center gap-2">
            <Scale className="w-5 h-5 text-purple-400" />
            Intellectual Property
          </h3>
          <ul className="space-y-3 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <ArrowRight className="w-4 h-4 text-purple-400 mt-0.5 shrink-0" />
              Upon approved delivery and payment release, <strong className="text-white">full rights transfer to the client</strong> unless otherwise agreed.
            </li>
            <li className="flex items-start gap-2">
              <ArrowRight className="w-4 h-4 text-purple-400 mt-0.5 shrink-0" />
              Musicians retain the right to showcase work in their portfolio unless client requests confidentiality.
            </li>
            <li className="flex items-start gap-2">
              <ArrowRight className="w-4 h-4 text-purple-400 mt-0.5 shrink-0" />
              All work must be original. Use of copyrighted samples must be disclosed in the bid.
            </li>
          </ul>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/5 p-6">
          <h3 className="font-bold mb-3 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-400" />
            Cancellation & Termination
          </h3>
          <ul className="space-y-3 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <ArrowRight className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
              <strong className="text-white">Before escrow:</strong> Free cancellation, no fees.
            </li>
            <li className="flex items-start gap-2">
              <ArrowRight className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
              <strong className="text-white">After escrow, before delivery:</strong> Full refund minus Stripe processing fees.
            </li>
            <li className="flex items-start gap-2">
              <ArrowRight className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
              <strong className="text-white">After delivery:</strong> Dispute process applies.
            </li>
            <li className="flex items-start gap-2">
              <ArrowRight className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
              BOOSTIFY reserves the right to terminate accounts violating terms.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   PAYMENT RULES TAB
   ═══════════════════════════════════════════ */

function PaymentRulesSection({ terms }: { terms: ContractTerms | null }) {
  return (
    <div className="space-y-8">
      {/* Escrow Flow Visualization */}
      <div className="rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-500/5 to-transparent p-8">
        <h2 className="text-2xl font-bold mb-2 flex items-center gap-3">
          <Lock className="w-7 h-7 text-amber-400" />
          How Escrow Works
        </h2>
        <p className="text-muted-foreground mb-8">
          Every marketplace payment is protected by our Stripe-powered escrow system. Your money is
          never at risk.
        </p>

        {/* Flow Steps */}
        <div className="space-y-0">
          {[
            {
              step: 1,
              title: "Client Posts a Request",
              desc: "Client creates a service request describing what they need (mixing, mastering, production, etc.).",
              icon: <FileText className="w-5 h-5" />,
              color: "blue",
            },
            {
              step: 2,
              title: "Musicians Submit Bids",
              desc: "Musicians apply with their price, timeline, and message. Each application costs credits (5% of budget).",
              icon: <Users className="w-5 h-5" />,
              color: "green",
            },
            {
              step: 3,
              title: "Client Accepts a Bid",
              desc: "Client reviews bids and accepts the best one. This triggers the escrow funding process.",
              icon: <CheckCircle className="w-5 h-5" />,
              color: "amber",
            },
            {
              step: 4,
              title: "Payment Goes to Escrow",
              desc: "The full amount is charged via Stripe and held securely in escrow. Neither party can touch it.",
              icon: <Lock className="w-5 h-5" />,
              color: "purple",
            },
            {
              step: 5,
              title: "Musician Delivers Work",
              desc: 'Files are uploaded to the platform. Client can STREAM (listen) but NOT download — files are protected.',
              icon: <Headphones className="w-5 h-5" />,
              color: "cyan",
            },
            {
              step: 6,
              title: "Client Reviews & Approves",
              desc: "Client listens to the deliverables. They can approve, request revision (up to 2x), or open a dispute.",
              icon: <Eye className="w-5 h-5" />,
              color: "pink",
            },
            {
              step: 7,
              title: "Payment Released",
              desc: "On approval, 80% goes to the musician and 20% is the platform fee. Files are unlocked for download.",
              icon: <DollarSign className="w-5 h-5" />,
              color: "emerald",
            },
          ].map((s, i, arr) => (
            <div key={s.step} className="flex gap-4">
              {/* Timeline line */}
              <div className="flex flex-col items-center">
                <div
                  className={`w-10 h-10 rounded-full bg-${s.color}-500/20 border-2 border-${s.color}-500 flex items-center justify-center text-${s.color}-400 font-bold text-sm`}
                >
                  {s.step}
                </div>
                {i < arr.length - 1 && (
                  <div className="w-0.5 h-12 bg-gradient-to-b from-white/20 to-transparent" />
                )}
              </div>
              <div className="pb-8">
                <h4 className={`font-bold text-${s.color}-400`}>{s.title}</h4>
                <p className="text-sm text-muted-foreground mt-1">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Credit System */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-6">
        <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
          <Coins className="w-5 h-5 text-amber-400" />
          Gig Credit System
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-semibold text-amber-400 mb-2">How Credits Work</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <ArrowRight className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                <strong className="text-white">1 credit = $1 USD</strong>
              </li>
              <li className="flex items-start gap-2">
                <ArrowRight className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                Minimum purchase: <strong className="text-white">$10 (10 credits)</strong>
              </li>
              <li className="flex items-start gap-2">
                <ArrowRight className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                Application cost: <strong className="text-white">5% of job budget</strong> (min 1, max 50)
              </li>
              <li className="flex items-start gap-2">
                <ArrowRight className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                Bigger packages include <strong className="text-white">bonus credits</strong>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-amber-400 mb-2">Credit Packages</h4>
            <div className="space-y-2">
              {[
                { name: "Starter", price: 10, credits: 10, bonus: 0 },
                { name: "Basic", price: 25, credits: 25, bonus: 2 },
                { name: "Pro", price: 50, credits: 50, bonus: 7, popular: true },
                { name: "Business", price: 100, credits: 100, bonus: 20 },
                { name: "Enterprise", price: 250, credits: 250, bonus: 75 },
              ].map((pkg) => (
                <div
                  key={pkg.name}
                  className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm ${
                    pkg.popular
                      ? "bg-amber-500/10 border border-amber-500/30"
                      : "bg-white/5"
                  }`}
                >
                  <span className="font-medium">
                    {pkg.name} {pkg.popular && <span className="text-amber-400 text-xs ml-1">★ POPULAR</span>}
                  </span>
                  <span className="text-muted-foreground">
                    ${pkg.price} → {pkg.credits + pkg.bonus} credits
                    {pkg.bonus > 0 && (
                      <span className="text-green-400 ml-1">(+{pkg.bonus} bonus)</span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Commission & Fees */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-5 text-center">
          <div className="text-3xl font-bold text-green-400 mb-1">80%</div>
          <div className="text-sm text-muted-foreground">Musician receives</div>
          <div className="text-xs text-green-400/60 mt-1">$400 on a $500 gig</div>
        </div>
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-5 text-center">
          <div className="text-3xl font-bold text-amber-400 mb-1">20%</div>
          <div className="text-sm text-muted-foreground">Platform fee</div>
          <div className="text-xs text-amber-400/60 mt-1">$100 on a $500 gig</div>
        </div>
        <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-5 text-center">
          <div className="text-3xl font-bold text-blue-400 mb-1">$0</div>
          <div className="text-sm text-muted-foreground">Hidden fees</div>
          <div className="text-xs text-blue-400/60 mt-1">No surprises, ever</div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   PROTECTIONS TAB
   ═══════════════════════════════════════════ */

function ProtectionsSection({ terms }: { terms: ContractTerms | null }) {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="rounded-2xl border border-green-500/20 bg-gradient-to-br from-green-500/5 to-transparent p-8 text-center">
        <Shield className="w-12 h-12 text-green-400 mx-auto mb-4" />
        <h2 className="text-2xl font-bold mb-2">Both Parties Are Protected</h2>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          BOOSTIFY acts as a neutral intermediary. Our escrow system, file protection, and dispute
          resolution ensure that both clients and musicians have a safe, fair experience.
        </p>
      </div>

      {/* Two-column: Client vs Musician */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Client Protections */}
        <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-6">
          <h3 className="text-xl font-bold text-blue-400 mb-4 flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            Client (Buyer) Protections
          </h3>
          <ul className="space-y-4">
            {[
              {
                icon: <Lock className="w-5 h-5 text-blue-400" />,
                title: "Escrow Protection",
                desc: "Your money is held in Stripe escrow and ONLY released when you approve the delivery. The musician never has access to your funds until you're satisfied.",
              },
              {
                icon: <Headphones className="w-5 h-5 text-blue-400" />,
                title: "Stream Before Approving",
                desc: "Listen to all delivered files before releasing payment. Preview/stream quality ensures you can evaluate the work without committing.",
              },
              {
                icon: <RefreshCw className="w-5 h-5 text-blue-400" />,
                title: "Free Revisions",
                desc: "Get up to 2 free revisions if the delivery doesn't match requirements. Specific revision notes are sent to the musician.",
              },
              {
                icon: <Scale className="w-5 h-5 text-blue-400" />,
                title: "Dispute Resolution",
                desc: "If you're unsatisfied after revisions, open a dispute. Our team reviews within 48 hours and can issue a full refund.",
              },
              {
                icon: <Clock className="w-5 h-5 text-blue-400" />,
                title: "Deadline Guarantee",
                desc: "If the musician misses the deadline + 48-hour grace period, you can request an automatic refund from escrow.",
              },
              {
                icon: <Download className="w-5 h-5 text-blue-400" />,
                title: "Full Quality on Approval",
                desc: "Once you approve, full-quality downloads are instantly unlocked. No additional charges, no restrictions.",
              },
            ].map((item, i) => (
              <li key={i} className="flex items-start gap-3">
                <div className="mt-0.5 shrink-0">{item.icon}</div>
                <div>
                  <h4 className="font-semibold text-white text-sm">{item.title}</h4>
                  <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Musician Protections */}
        <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-6">
          <h3 className="text-xl font-bold text-green-400 mb-4 flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Musician (Seller) Protections
          </h3>
          <ul className="space-y-4">
            {[
              {
                icon: <DollarSign className="w-5 h-5 text-green-400" />,
                title: "Guaranteed Payment",
                desc: "Money is already in escrow before you start working. Once you deliver and the client approves, payment is guaranteed — no chargebacks, no excuses.",
              },
              {
                icon: <Lock className="w-5 h-5 text-green-400" />,
                title: "File Protection",
                desc: "Your delivered files are stream-only until the client pays. They cannot download, copy, or distribute your work without releasing payment first.",
              },
              {
                icon: <Clock className="w-5 h-5 text-green-400" />,
                title: "72-Hour Auto-Approval",
                desc: "If the client doesn't review within 72 hours of delivery, they lose the right to request free revisions. Dispute remains available but payment leans in your favor.",
              },
              {
                icon: <Scale className="w-5 h-5 text-green-400" />,
                title: "Fair Dispute Process",
                desc: "Disputes are reviewed impartially by BOOSTIFY. If you delivered according to specifications, we protect your payment.",
              },
              {
                icon: <AlertTriangle className="w-5 h-5 text-green-400" />,
                title: "Anti-Fraud Protection",
                desc: "Clients must fund escrow before you start working. No more working for free or getting scammed by fake clients.",
              },
              {
                icon: <RefreshCw className="w-5 h-5 text-green-400" />,
                title: "Limited Revisions",
                desc: "Maximum 2 free revisions are included. The client cannot ask for unlimited changes. Additional revisions must be negotiated.",
              },
            ].map((item, i) => (
              <li key={i} className="flex items-start gap-3">
                <div className="mt-0.5 shrink-0">{item.icon}</div>
                <div>
                  <h4 className="font-semibold text-white text-sm">{item.title}</h4>
                  <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* File Delivery Protection */}
      <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-6">
        <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
          <Lock className="w-5 h-5 text-purple-400" />
          File Delivery Protection System
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-semibold text-red-400 mb-3 flex items-center gap-2">
              <Headphones className="w-4 h-4" />
              Before Payment Approval
            </h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-400 shrink-0" />
                ✅ Stream / listen to files
              </li>
              <li className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                ❌ Download files
              </li>
              <li className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                ❌ Access full quality
              </li>
              <li className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                ❌ Copy or distribute
              </li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-green-400 mb-3 flex items-center gap-2">
              <Download className="w-4 h-4" />
              After Payment Approval
            </h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-400 shrink-0" />
                ✅ Download full quality files
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-400 shrink-0" />
                ✅ Access WAV/FLAC originals
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-400 shrink-0" />
                ✅ Full usage rights
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-400 shrink-0" />
                ✅ Project files (if included)
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Dispute Process */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-6">
        <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
          <Scale className="w-5 h-5 text-amber-400" />
          Dispute Resolution Process
        </h3>
        <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
          {[
            { step: "1", label: "Party opens dispute", time: "" },
            { step: "2", label: "Both submit evidence", time: "24hrs" },
            { step: "3", label: "BOOSTIFY reviews", time: "48hrs" },
            { step: "4", label: "Resolution issued", time: "" },
          ].map((s, i, arr) => (
            <div key={s.step} className="flex items-center gap-3">
              <div className="flex flex-col items-center text-center">
                <div className="w-10 h-10 rounded-full bg-amber-500/20 border-2 border-amber-500 flex items-center justify-center text-amber-400 font-bold">
                  {s.step}
                </div>
                <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
                {s.time && <p className="text-xs text-amber-400">{s.time}</p>}
              </div>
              {i < arr.length - 1 && (
                <ArrowRight className="w-5 h-5 text-white/20 hidden md:block" />
              )}
            </div>
          ))}
        </div>
        <div className="mt-6 text-sm text-muted-foreground">
          <strong className="text-white">Possible Outcomes:</strong>
          <div className="flex flex-wrap gap-2 mt-2">
            {["Full refund to client", "Partial refund", "Payment released to musician", "Redelivery required"].map(
              (o) => (
                <span key={o} className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs">
                  {o}
                </span>
              ),
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   FAQ TAB
   ═══════════════════════════════════════════ */

function FAQSection({
  faq,
  expandedFaq,
  setExpandedFaq,
}: {
  faq: Array<{ q: string; a: string }>;
  expandedFaq: number | null;
  setExpandedFaq: (i: number | null) => void;
}) {
  const fallbackFaq = [
    { q: "How do I apply for a gig?", a: "Browse the Live Services Map, click on a gig that matches your skills, fill out the application form with your price and message, then submit. Each application costs credits (5% of the job budget)." },
    { q: "What are Gig Credits?", a: "Gig Credits are the currency for applying to gigs. 1 credit = $1. Purchase starting at $10, or earn free credits by completing your profile, referring musicians, and getting 5-star reviews." },
    { q: "How does escrow work?", a: "When a client accepts your bid, they pay into Stripe escrow. Money is held until you deliver and the client approves. Then 80% goes to you, 20% to the platform." },
    { q: "Can the client listen before paying?", a: "Yes! Clients can stream your delivered files, but cannot download full quality until they approve and payment is released." },
    { q: "What if the client doesn't approve?", a: "Client has 72 hours to review. They can request up to 2 revisions. If still unresolved, either party can open a dispute." },
    { q: "How long to get paid?", a: "Once approved, payment releases immediately. Funds process to your account within 3-5 business days via Stripe." },
    { q: "What if there's a dispute?", a: "BOOSTIFY reviews all disputes within 48 hours. We examine the request, delivery, and communication. Outcomes include refund, payment release, or redelivery." },
    { q: "Can I refund credits?", a: "Credits used on applications are non-refundable. Unused balance can be refunded within 30 days minus processing fees." },
    { q: "What file formats should I deliver?", a: "WAV/FLAC for audio, MP4/MOV for video, PDF for documents. Include project files if requested." },
    { q: "How many revisions are included?", a: "2 free revisions per service. Additional revisions negotiated between client and musician." },
    { q: "What is the platform fee?", a: "20% on completed services. On a $500 gig, musician gets $400, platform gets $100. No hidden fees." },
    { q: "Can I cancel after escrow?", a: "If musician hasn't started: full refund minus Stripe fees. After work begins: goes through dispute process." },
  ];

  const items = faq.length > 0 ? faq : fallbackFaq;

  return (
    <div className="space-y-3">
      <div className="text-center mb-8">
        <HelpCircle className="w-10 h-10 text-amber-400 mx-auto mb-3" />
        <h2 className="text-2xl font-bold">Frequently Asked Questions</h2>
        <p className="text-muted-foreground mt-2">
          Everything you need to know about the BOOSTIFY marketplace.
        </p>
      </div>

      {items.map((item, i) => (
        <div
          key={i}
          className="rounded-xl border border-white/10 bg-white/5 overflow-hidden transition-all"
        >
          <button
            className="w-full flex items-center justify-between p-4 text-left hover:bg-white/5 transition-colors"
            onClick={() => setExpandedFaq(expandedFaq === i ? null : i)}
          >
            <span className="font-medium text-sm pr-4">{item.q}</span>
            {expandedFaq === i ? (
              <ChevronUp className="w-5 h-5 text-amber-400 shrink-0" />
            ) : (
              <ChevronDown className="w-5 h-5 text-muted-foreground shrink-0" />
            )}
          </button>
          {expandedFaq === i && (
            <div className="px-4 pb-4 text-sm text-muted-foreground border-t border-white/5 pt-3">
              {item.a}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
