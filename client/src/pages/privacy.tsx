import { Header } from "../components/layout/header";

const EFFECTIVE_DATE = "May 4, 2026";
const COMPANY = "Boostify Music, Inc.";
const EMAIL_PRIVACY = "privacy@boostify.music";
const EMAIL_LEGAL = "legal@boostify.music";

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mb-10">
      <h2 className="text-xl font-bold text-white mb-3 border-l-4 border-orange-500 pl-3">{title}</h2>
      <div className="text-slate-300 space-y-3 text-sm leading-relaxed">{children}</div>
    </section>
  );
}

function Alert({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-orange-500/10 border border-orange-500/40 rounded-lg p-4 text-orange-200 text-sm leading-relaxed my-4">
      {children}
    </div>
  );
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <Header />
      <main className="container mx-auto px-4 py-16 pt-28 max-w-3xl">

        {/* Header */}
        <div className="mb-10">
          <h1 className="text-4xl font-bold text-white mb-2">Privacy Policy</h1>
          <p className="text-slate-400 text-sm">Effective date: {EFFECTIVE_DATE} · {COMPANY}</p>
          <p className="text-slate-400 text-sm mt-1">
            Privacy inquiries: <a href={`mailto:${EMAIL_PRIVACY}`} className="text-orange-400 hover:underline">{EMAIL_PRIVACY}</a>
          </p>
        </div>

        <Alert>
          This Privacy Policy explains how {COMPANY} collects, uses, and protects your personal information when you use Boostify Music and its related services. By using our platform, you consent to the practices described here.
        </Alert>

        <Section id="s1" title="1. Information We Collect">
          <p><strong className="text-white">1.1 Account Information.</strong> When you register, we collect your name, email address, username, and password (stored as a secure hash). If you register via a third-party identity provider (Google, Apple, Clerk), we receive the profile information permitted by that provider.</p>

          <p><strong className="text-white">1.2 Profile & Artist Data.</strong> If you create an artist profile, we store your artist name, biography, genre, social media handles, uploaded images, and other content you provide.</p>

          <p><strong className="text-white">1.3 Content & Usage Data.</strong> We collect content you upload (images, audio files, promotional copy), prompts submitted to AI tools, and logs of how you use platform features (pages visited, features used, time spent).</p>

          <p><strong className="text-white">1.4 Payment Information.</strong> Payments are processed by Stripe. We receive a tokenized reference and billing metadata (last 4 card digits, billing country). We do not store full card numbers, expiration dates, or CVV codes on our servers.</p>

          <p><strong className="text-white">1.5 Wallet & Blockchain Data.</strong> If you connect a cryptocurrency wallet, we collect your public wallet address. We do not have access to your private keys, seed phrases, or any on-chain funds. On-chain transactions (e.g., BTF token purchases, token locks) are publicly visible on the Polygon blockchain by design; Boostify does not control or restrict this visibility.</p>

          <p><strong className="text-white">1.6 Device & Technical Data.</strong> We automatically collect IP address, browser type, operating system, referring URLs, and device identifiers to operate, secure, and improve the platform.</p>

          <p><strong className="text-white">1.7 Communications.</strong> If you contact us by email or support ticket, we retain those communications to handle your request and improve our services.</p>
        </Section>

        <Section id="s2" title="2. How We Use Your Information">
          <ul className="list-disc list-inside space-y-1 pl-2">
            <li>To create and manage your account and authenticate your identity</li>
            <li>To provide, operate, and maintain all platform Services</li>
            <li>To process payments and manage subscriptions and credit balances</li>
            <li>To generate AI-powered content, artwork, and promotional materials you request</li>
            <li>To power blockchain and wallet features, including BTF token management</li>
            <li>To send transactional emails (receipts, password resets, security alerts)</li>
            <li>To send platform updates, newsletters, and promotional communications (you can opt out at any time)</li>
            <li>To detect fraud, abuse, and security threats</li>
            <li>To comply with legal obligations and enforce our Terms of Service</li>
            <li>To analyze aggregate usage patterns and improve the platform (using anonymized or aggregated data)</li>
          </ul>
          <p>We do not sell your personal information to third parties. We do not use your data for automated decision-making that produces legal or similarly significant effects without your consent.</p>
        </Section>

        <Section id="s3" title="3. Legal Bases for Processing (GDPR)">
          <p>If you are located in the European Economic Area (EEA), United Kingdom, or Switzerland, we process your personal data under the following legal bases:</p>
          <ul className="list-disc list-inside space-y-1 pl-2">
            <li><strong className="text-white">Contract performance</strong> — processing necessary to provide the Services you signed up for</li>
            <li><strong className="text-white">Legitimate interests</strong> — fraud prevention, security, and platform improvement</li>
            <li><strong className="text-white">Legal obligation</strong> — compliance with applicable laws and regulations</li>
            <li><strong className="text-white">Consent</strong> — marketing communications and optional analytics (you may withdraw consent at any time)</li>
          </ul>
        </Section>

        <Section id="s4" title="4. Information Sharing">
          <p>We share your information only as described below:</p>
          <p><strong className="text-white">4.1 Service Providers.</strong> We engage trusted third-party vendors to help operate our platform, including:</p>
          <ul className="list-disc list-inside space-y-1 pl-2">
            <li><strong>Stripe</strong> — payment processing</li>
            <li><strong>Firebase / Google Cloud</strong> — authentication, file storage, and database services</li>
            <li><strong>Printful</strong> — merchandise fulfillment (order details shared as necessary)</li>
            <li><strong>OpenAI / Google Gemini / Kling / other AI providers</strong> — AI content generation (prompts and content may be transmitted; see each provider's policy)</li>
            <li><strong>Clerk</strong> — identity and authentication management</li>
            <li><strong>TikTok</strong> — social media promotion and ads (when you connect your TikTok account; see Section 4b below)</li>
            <li><strong>Instagram / Meta</strong> — social media promotion (when you authorize Instagram access)</li>
            <li><strong>Spotify / YouTube</strong> — streaming analytics and promotion (when you authorize access)</li>
          </ul>
          <p>All service providers are contractually required to protect your data and may only use it to perform services on our behalf.</p>

          <p><strong className="text-white">4.2 Legal Requirements.</strong> We may disclose your information if required by law, subpoena, court order, or governmental authority, or if we believe disclosure is necessary to protect our rights, prevent fraud, or ensure user safety.</p>

          <p><strong className="text-white">4.3 Business Transfers.</strong> In the event of a merger, acquisition, or sale of assets, your information may be transferred as part of that transaction. We will notify you via email or a platform notice if this occurs.</p>

          <p><strong className="text-white">4.4 Public Blockchain Data.</strong> Wallet addresses and on-chain transaction data associated with BTF tokens are publicly visible on the Polygon blockchain. This is an inherent property of public blockchains and is not under Boostify's control.</p>
        </Section>

        <Section id="s4b" title="4b. TikTok Data — How We Collect, Use & Protect It">
          <Alert>
            This section specifically addresses how Boostify handles data obtained through the TikTok API, as required by TikTok's developer platform policies.
          </Alert>

          <p><strong className="text-white">Data Collected via TikTok API.</strong> When you connect your TikTok account, we may receive and store the following data, depending on the permissions you authorize:</p>
          <ul className="list-disc list-inside space-y-1 pl-2">
            <li>TikTok user ID, display name, and profile picture</li>
            <li>TikTok access token and refresh token (stored encrypted, used only to make API calls on your behalf)</li>
            <li>Performance metrics for content you request us to analyze (views, likes, shares, comments)</li>
            <li>Ad account IDs and campaign performance data (if you use our TikTok Ads features)</li>
          </ul>

          <p><strong className="text-white">How We Use TikTok Data.</strong> TikTok data is used exclusively to:</p>
          <ul className="list-disc list-inside space-y-1 pl-2">
            <li>Schedule and publish content to your TikTok account at your direction</li>
            <li>Display analytics and performance dashboards within Boostify</li>
            <li>Manage TikTok ad campaigns you create within Boostify</li>
            <li>Provide AI-powered recommendations based on your TikTok performance data</li>
          </ul>
          <p>We do <strong className="text-white">not</strong> use TikTok data to build advertising profiles, sell to data brokers, or for any purpose beyond the features you activate.</p>

          <p><strong className="text-white">Data Sharing.</strong> Your TikTok data is never sold, rented, or shared with third parties except: (a) with TikTok itself, as required to make authorized API calls; (b) with our infrastructure providers (e.g., database hosting) under strict confidentiality obligations; or (c) when required by law.</p>

          <p><strong className="text-white">Data Retention.</strong> TikTok access tokens are deleted when you disconnect your TikTok account or delete your Boostify account. Cached analytics data is deleted within 30 days of disconnection. Ad campaign data you created is retained for 90 days post-disconnection to allow you to export it, then deleted.</p>

          <p><strong className="text-white">Revoking Access.</strong> You can revoke Boostify's access to your TikTok account at any time:</p>
          <ul className="list-disc list-inside space-y-1 pl-2">
            <li>From within Boostify: go to <em>Settings &gt; Connected Accounts &gt; TikTok &gt; Disconnect</em></li>
            <li>From TikTok: go to <em>Profile &gt; Settings &gt; Security &gt; Authorized Apps</em> and remove Boostify</li>
          </ul>

          <p>For questions about TikTok data handling, contact <a href={`mailto:${EMAIL_PRIVACY}`} className="text-orange-400 hover:underline">{EMAIL_PRIVACY}</a>.</p>
        </Section>

        {/* KEY PRIVACY CLAUSE FOR TOKENS */}
        <Section id="s5" title="5. BTF Token Data & Non-Security Statement">
          <Alert>
            <strong>Data collected in connection with the BTF utility token is used exclusively to operate the platform's credit and access system. It is not used to track investment activity, financial returns, or portfolio performance.</strong>
          </Alert>

          <p><strong className="text-white">5.1 Wallet Address Use.</strong> Your connected wallet address is stored solely to: (a) associate your account with on-chain BTF credit balances; (b) process token lock-up registrations; (c) enable wallet-based authentication. We do not use wallet addresses to build financial profiles or share them with financial data aggregators.</p>

          <p><strong className="text-white">5.2 Terms Acknowledgement Records.</strong> When you acknowledge the BTF utility disclaimer (required before certain token features), we record your userId, wallet address (if connected), acknowledgement timestamp, and your IP address. This record is maintained for regulatory compliance purposes to demonstrate informed consent.</p>

          <p><strong className="text-white">5.3 No Financial Data Sale.</strong> We do not sell, rent, or share your wallet address or token activity data with any third party for financial profiling, trading analytics, or marketing purposes. BTF is a utility token (see our <a href="/terms#s9" className="text-orange-400 hover:underline">Terms of Service, Section 9</a>); we do not treat associated data as financial instrument data.</p>
        </Section>

        <Section id="s6" title="6. Cookies & Tracking Technologies">
          <p>We use cookies and similar technologies (local storage, session tokens, analytics pixels) to:</p>
          <ul className="list-disc list-inside space-y-1 pl-2">
            <li>Keep you logged in across sessions</li>
            <li>Remember your preferences and settings</li>
            <li>Analyze platform usage via anonymized analytics</li>
            <li>Prevent cross-site request forgery (CSRF)</li>
          </ul>
          <p>You can control cookie settings through your browser. Disabling certain cookies may affect platform functionality (e.g., staying logged in).</p>
          <p>We do not use third-party advertising cookies or cross-site behavioral tracking cookies.</p>
        </Section>

        <Section id="s7" title="7. Data Retention">
          <p>We retain your personal data for as long as your account is active or as needed to provide Services. Specifically:</p>
          <ul className="list-disc list-inside space-y-1 pl-2">
            <li>Account data is retained until account deletion is requested</li>
            <li>Payment records are retained for 7 years for tax and accounting compliance</li>
            <li>BTF acknowledgement records are retained for 5 years for regulatory compliance</li>
            <li>Server logs and technical data are retained for up to 90 days</li>
            <li>AI generation prompts and outputs are retained until you delete them or request erasure</li>
          </ul>
          <p>After account deletion, anonymized aggregate data may be retained indefinitely for statistical purposes.</p>
        </Section>

        <Section id="s8" title="8. Your Rights">
          <p>Depending on your location, you may have the following rights regarding your personal data:</p>
          <ul className="list-disc list-inside space-y-1 pl-2">
            <li><strong className="text-white">Access</strong> — request a copy of the personal data we hold about you</li>
            <li><strong className="text-white">Correction</strong> — request correction of inaccurate or incomplete data</li>
            <li><strong className="text-white">Erasure</strong> ("right to be forgotten") — request deletion of your personal data, subject to legal retention obligations</li>
            <li><strong className="text-white">Portability</strong> — receive your data in a structured, machine-readable format</li>
            <li><strong className="text-white">Restriction</strong> — request that we restrict processing of your data in certain circumstances</li>
            <li><strong className="text-white">Objection</strong> — object to processing based on legitimate interests or for direct marketing</li>
            <li><strong className="text-white">Withdraw consent</strong> — for any processing based on consent, you may withdraw at any time</li>
          </ul>
          <p>To exercise any of these rights, contact us at <a href={`mailto:${EMAIL_PRIVACY}`} className="text-orange-400 hover:underline">{EMAIL_PRIVACY}</a>. We will respond within 30 days (or as required by applicable law).</p>
          <p>EEA/UK users may lodge a complaint with your local data protection authority (e.g., the ICO in the UK, the CNIL in France).</p>
        </Section>

        <Section id="s9" title="9. California Privacy Rights (CCPA / CPRA)">
          <p>If you are a California resident, you have additional rights under the California Consumer Privacy Act (CCPA) as amended by the California Privacy Rights Act (CPRA):</p>
          <ul className="list-disc list-inside space-y-1 pl-2">
            <li>The right to know what personal information is collected, used, shared, or sold</li>
            <li>The right to delete personal information (with certain exceptions)</li>
            <li>The right to opt out of the sale or sharing of personal information — <strong className="text-white">we do not sell or share personal information for cross-context behavioral advertising</strong></li>
            <li>The right to non-discrimination for exercising your privacy rights</li>
            <li>The right to correct inaccurate personal information</li>
            <li>The right to limit use of sensitive personal information</li>
          </ul>
          <p>To submit a CCPA request, contact <a href={`mailto:${EMAIL_PRIVACY}`} className="text-orange-400 hover:underline">{EMAIL_PRIVACY}</a> with the subject "CCPA Request".</p>
        </Section>

        <Section id="s10" title="10. Data Security">
          <p>We implement industry-standard technical and organizational measures to protect your personal data, including:</p>
          <ul className="list-disc list-inside space-y-1 pl-2">
            <li>Encryption in transit (TLS/HTTPS) for all data transmitted between your browser and our servers</li>
            <li>Encryption at rest for sensitive database fields</li>
            <li>Access controls limiting data access to authorized personnel only</li>
            <li>Regular security reviews and vulnerability assessments</li>
          </ul>
          <p>No system is completely secure. In the event of a data breach that poses risk to your rights, we will notify you as required by applicable law.</p>
        </Section>

        <Section id="s11" title="11. International Data Transfers">
          <p>Boostify operates primarily from the United States. If you access our Services from outside the US, your data may be transferred to and processed in the US, where data protection laws may differ from those in your country.</p>
          <p>For transfers from the EEA or UK to the US, we rely on Standard Contractual Clauses (SCCs) as approved by the European Commission, or other appropriate transfer mechanisms as required by applicable law.</p>
        </Section>

        <Section id="s12" title="12. Children's Privacy">
          <p>Our Services are not directed to individuals under the age of 18. We do not knowingly collect personal information from anyone under 18. If we learn that we have collected such information, we will delete it promptly. If you believe we have inadvertently collected data from a minor, contact us at <a href={`mailto:${EMAIL_PRIVACY}`} className="text-orange-400 hover:underline">{EMAIL_PRIVACY}</a>.</p>
        </Section>

        <Section id="s13" title="13. Changes to This Policy">
          <p>We may update this Privacy Policy periodically. When we do, we will revise the effective date at the top of the page and, for material changes, notify you by email or platform notification. Your continued use of the Services after changes are posted constitutes acceptance of the updated policy.</p>
        </Section>

        <Section id="s14" title="14. Contact">
          <p>For privacy inquiries, data requests, or questions about this policy:</p>
          <p>Email: <a href={`mailto:${EMAIL_PRIVACY}`} className="text-orange-400 hover:underline">{EMAIL_PRIVACY}</a></p>
          <p>Legal matters: <a href={`mailto:${EMAIL_LEGAL}`} className="text-orange-400 hover:underline">{EMAIL_LEGAL}</a></p>
          <p>{COMPANY}</p>
        </Section>

        <div className="text-center text-slate-500 text-xs mt-16 pb-8 border-t border-slate-800 pt-8">
          © {new Date().getFullYear()} {COMPANY} · <a href="/terms" className="hover:text-orange-400">Terms of Service</a>
        </div>
      </main>
    </div>
  );
}