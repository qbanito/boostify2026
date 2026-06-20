import { Header } from "../components/layout/header";

export default function PrivacyPolicyExtension() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white/80">
      <Header />
      <div className="container mx-auto px-4 py-16 max-w-3xl">
        <h1 className="text-3xl font-bold text-white mb-2">Privacy Policy — Boostify YouTube Sync Extension</h1>
        <p className="text-white/40 mb-10 text-sm">Last updated: February 14, 2026</p>

        <div className="space-y-8 text-white/60 leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">1. What Data We Collect</h2>
            <p>The Boostify YouTube Sync extension collects the following data only when you are actively using Boostify tools on YouTube:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li><strong className="text-white/80">YouTube channel metadata</strong> — channel name, subscriber count, video titles, view counts, and other publicly available metrics visible on your channel page.</li>
              <li><strong className="text-white/80">Authentication token</strong> — a random token you generate in your Boostify dashboard to link the extension to your account. This token does not contain personal information.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">2. What We Do NOT Collect</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>We do <strong className="text-white/80">not</strong> collect your Google account credentials or passwords.</li>
              <li>We do <strong className="text-white/80">not</strong> access your YouTube login session or cookies.</li>
              <li>We do <strong className="text-white/80">not</strong> read or store your browsing history beyond YouTube and YouTube Studio pages.</li>
              <li>We do <strong className="text-white/80">not</strong> sell, share, or transfer your data to third parties.</li>
              <li>We do <strong className="text-white/80">not</strong> inject ads or affiliate links.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">3. How We Use Your Data</h2>
            <p>Collected channel metadata is used exclusively to:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Display your channel analytics in the Boostify dashboard.</li>
              <li>Provide AI-powered SEO suggestions for your videos.</li>
              <li>Generate trend alerts and optimization recommendations.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">4. Data Storage & Security</h2>
            <p>Your connection token is stored locally in Chrome's storage API. Channel data synced to Boostify is stored securely on our servers and protected with encryption in transit (TLS) and at rest.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">5. Data Deletion</h2>
            <p>You can disconnect the extension at any time from the Boostify dashboard. Upon disconnection, your synced data is deleted from our servers. Uninstalling the extension removes all locally stored data.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">6. Permissions Justification</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong className="text-white/80">activeTab / tabs</strong> — To detect when you are on YouTube or YouTube Studio and inject Boostify tools.</li>
              <li><strong className="text-white/80">storage</strong> — To save your connection token and extension settings locally.</li>
              <li><strong className="text-white/80">alarms</strong> — To schedule periodic sync of channel data.</li>
              <li><strong className="text-white/80">notifications</strong> — To alert you about trend changes or sync status.</li>
              <li><strong className="text-white/80">sidePanel</strong> — To display the Boostify side panel within Chrome.</li>
              <li><strong className="text-white/80">Host permissions (youtube.com, studio.youtube.com)</strong> — To read publicly visible channel data on YouTube pages.</li>
              <li><strong className="text-white/80">Host permission (boostifymusic.com)</strong> — To communicate with the Boostify API server.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">7. Contact</h2>
            <p>If you have questions about this privacy policy, contact us at <a href="mailto:support@boostifymusic.com" className="text-emerald-400 hover:underline">support@boostifymusic.com</a>.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
