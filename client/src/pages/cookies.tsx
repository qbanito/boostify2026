import { Header } from "../components/layout/header";
import { useCookieConsent } from "../components/privacy/cookie-consent";

export default function CookiesPage() {
  const { openPreferences, choices, hasSavedChoice } = useCookieConsent();

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-16 pt-24">
        <article className="mx-auto max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[.18em] text-violet-400">Privacy center</p>
          <h1 className="mt-2 text-4xl font-bold">Cookie Policy</h1>
          <p className="mt-4 leading-7 text-muted-foreground">This page explains how Boostify uses cookies and similar browser storage, and how to change your choices. We use essential storage to provide account, security, and core platform features. Optional categories remain off until you choose them.</p>

          <section className="mt-8 rounded-2xl border border-border bg-card p-5 sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold">Your current choices</h2>
                <p className="mt-1 text-sm text-muted-foreground">{hasSavedChoice ? "Your preference is saved in this browser." : "No optional category has been enabled."}</p>
              </div>
              <button onClick={openPreferences} className="rounded-xl bg-gradient-to-r from-violet-500 to-pink-500 px-4 py-2.5 text-sm font-semibold text-white hover:brightness-110">Manage preferences</button>
            </div>
            <ul className="mt-4 grid gap-2 text-sm text-muted-foreground sm:grid-cols-3">
              <li>Preferences: <strong className="text-foreground">{choices.preferences ? "On" : "Off"}</strong></li>
              <li>Analytics: <strong className="text-foreground">{choices.analytics ? "On" : "Off"}</strong></li>
              <li>Marketing: <strong className="text-foreground">{choices.marketing ? "On" : "Off"}</strong></li>
            </ul>
          </section>

          <div className="prose prose-invert mt-10 max-w-none">
            <h2>1. What we mean by cookies and similar storage</h2>
            <p>Cookies are small files stored by a website in your browser. Similar technologies include local storage, session storage, and scripts that read or write information on your device. This policy covers those technologies when used by Boostify.</p>

            <h2>2. Essential account and security storage</h2>
            <p>Essential storage supports sign-in, session continuity, security, and core platform functions. Boostify's server configures a <code>session</code> authentication cookie with a 24-hour maximum age, HttpOnly protection, and Secure in production. Our authentication provider may also use its own cookies to maintain your sign-in. First-party local or session storage may also keep feature state you request, such as cart contents, drafts, or editor settings; its duration depends on the feature. These functions are used to provide the service or feature you request.</p>

            <h2>3. Optional categories</h2>
            <ul>
              <li><strong>Optional personalization:</strong> permits optional personalization tools beyond the settings needed for a feature you use.</li>
              <li><strong>Analytics:</strong> permits analytics tools to measure use of the platform.</li>
              <li><strong>Marketing and attribution:</strong> permits campaign, advertising, or referral measurement tools.</li>
            </ul>
            <p>Optional categories are off by default. The tools that use them must be connected through the consent-aware loading interface before they are enabled. This policy does not claim that a particular analytics or advertising vendor is currently active.</p>

            <h2>4. How to change or withdraw your choice</h2>
            <p>Use the Manage preferences button above to update or withdraw optional choices at any time. Your selection is saved in this browser under <code>boostify-cookie-consent-v1</code>. You can also clear browser storage in your browser settings; doing so may reset your choice and show the banner again. Withdrawing consent prevents future consent-gated script loads. It may not remove cookies already set by a third-party provider, which you can also manage in your browser.</p>

            <h2>5. Global Privacy Control</h2>
            <p>When this browser sends a Global Privacy Control signal, Boostify keeps the marketing and attribution category turned off in that browser.</p>

            <h2>6. Third-party services</h2>
            <p>Some features may connect to service providers that process information under their own privacy terms. Before enabling a new analytics, advertising, or embedded-media provider, Boostify should document its purpose, storage, retention, and applicable consent category here and in the privacy notice.</p>

            <h2>7. Contact</h2>
            <p>For questions about this policy or personal information, see our <a href="/privacy">Privacy Policy</a>.</p>
            <p className="text-sm text-muted-foreground">Last updated: October 29, 2026</p>
          </div>
        </article>
      </main>
    </div>
  );
}
