import { Header } from "../components/layout/header";

const EFFECTIVE_DATE = "May 4, 2026";
const COMPANY = "Boostify Music, Inc.";
const EMAIL_LEGAL = "legal@boostify.music";
const EMAIL_SUPPORT = "support@boostify.music";

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

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <Header />
      <main className="container mx-auto px-4 py-16 pt-28 max-w-3xl">

        {/* Header */}
        <div className="mb-10">
          <h1 className="text-4xl font-bold text-white mb-2">Terms of Service</h1>
          <p className="text-slate-400 text-sm">Effective date: {EFFECTIVE_DATE} · {COMPANY}</p>
          <p className="text-slate-400 text-sm mt-1">
            Questions? <a href={`mailto:${EMAIL_LEGAL}`} className="text-orange-400 hover:underline">{EMAIL_LEGAL}</a>
          </p>
        </div>

        <Alert>
          <strong>Please read carefully.</strong> By creating an account or using any Boostify service, you confirm that you have read, understood, and agree to these Terms of Service. If you do not agree, do not use the platform.
        </Alert>

        {/* ───────────────────────────────── */}
        <Section id="s1" title="1. About Boostify Music">
          <p>
            {COMPANY} ("Boostify", "we", "us", "our") operates a music promotion and artist-services platform accessible at boostify.music and related subdomains. Our platform provides AI-powered tools for music production, social media promotion, content creation, merchandise fulfillment, and artist community features.
          </p>
          <p>
            These Terms of Service ("Terms") govern your access to and use of all Boostify products, services, applications, and websites (collectively, the "Services").
          </p>
        </Section>

        <Section id="s2" title="2. Eligibility & Account">
          <p>You must be at least 18 years of age to create an account. By registering, you represent that all information you provide is accurate and that you have the legal capacity to enter into this agreement.</p>
          <p>You are responsible for maintaining the confidentiality of your login credentials. Notify us immediately at <a href={`mailto:${EMAIL_SUPPORT}`} className="text-orange-400 hover:underline">{EMAIL_SUPPORT}</a> if you suspect unauthorized access.</p>
          <p>We reserve the right to suspend or terminate accounts that violate these Terms, fraudulently misrepresent identity, or engage in abusive behavior toward other users or our team.</p>
        </Section>

        <Section id="s3" title="3. Platform Services">
          <p>Boostify provides software-as-a-service tools including but not limited to:</p>
          <ul className="list-disc list-inside space-y-1 pl-2">
            <li>AI-generated music assets, artwork, and promotional content</li>
            <li>Social media scheduling and promotion automation</li>
            <li>On-demand merchandise fulfillment via third-party partners (Printful)</li>
            <li>Analytics dashboards and audience insights</li>
            <li>BTF utility token management and credit system (see Section 9)</li>
            <li>Affiliate and referral program participation</li>
          </ul>
          <p>We continually improve and update our Services. We may add, modify, or discontinue features at any time with reasonable notice.</p>
        </Section>

        <Section id="s4" title="4. Credits, Subscriptions & Payments">
          <p>Some features require a paid subscription plan or the use of Boostify Credits ("Credits"). Credits are consumed when you use AI-powered services. Credits are non-refundable and non-transferable unless otherwise stated in writing.</p>
          <p>Subscription fees are billed in advance on a monthly or annual basis in USD. You authorize us to charge your payment method on the applicable renewal date. You may cancel your subscription at any time; cancellation takes effect at the end of the current billing cycle.</p>
          <p>We partner with Stripe for payment processing. By providing your payment details, you agree to Stripe's terms of service. Boostify does not store full card numbers or CVV codes on its servers.</p>
        </Section>

        <Section id="s5" title="5. User Content & Intellectual Property">
          <p>You retain ownership of all original content you upload to Boostify ("User Content"). By uploading User Content, you grant Boostify a worldwide, non-exclusive, royalty-free license to use, reproduce, process, and display that content solely as necessary to provide the Services to you.</p>
          <p>You represent that you own or have sufficient rights to all User Content you upload, and that it does not infringe any third-party intellectual property, privacy, or contractual rights.</p>
          <p>All Boostify trademarks, service marks, logos, software, and platform content are the exclusive property of {COMPANY} or its licensors. You may not reproduce, distribute, or create derivative works from our proprietary content without express written permission.</p>
        </Section>

        <Section id="s6" title="6. Acceptable Use">
          <p>You agree not to use the Services to:</p>
          <ul className="list-disc list-inside space-y-1 pl-2">
            <li>Upload, distribute, or promote content that is illegal, defamatory, obscene, or that infringes intellectual property rights</li>
            <li>Engage in spam, phishing, or any form of fraudulent activity</li>
            <li>Circumvent, disable, or interfere with security-related features of the platform</li>
            <li>Scrape, crawl, or systematically extract data from the platform without authorization</li>
            <li>Manipulate or artificially inflate streaming counts, follower metrics, or engagement data</li>
            <li>Violate any applicable law, regulation, or these Terms</li>
          </ul>
          <p>Violations may result in immediate account suspension and, where applicable, reporting to relevant authorities.</p>
        </Section>

        <Section id="s7" title="7. Third-Party Services & Links">
          <p>Boostify integrates with third-party services such as Stripe (payments), Printful (merchandise), Firebase (authentication and storage), blockchain networks (Polygon), and social media platforms including TikTok, Instagram, YouTube, and Spotify. Your use of these services is also governed by their respective terms and privacy policies. Boostify is not responsible for the availability, accuracy, or conduct of third-party services.</p>
          <p>Links to external websites do not constitute an endorsement of their content or practices.</p>
        </Section>

        <Section id="s7b" title="7a. TikTok Integration">
          <p>Boostify's TikTok Boost module allows artists to connect their TikTok account to schedule content, manage ad campaigns, and access performance analytics. When you connect your TikTok account to Boostify:</p>
          <ul className="list-disc list-inside space-y-1 pl-2">
            <li>We request access to your TikTok account only for the specific features you activate (e.g., content scheduling, ads management, analytics).</li>
            <li>We use TikTok API data solely to provide the requested services on your behalf — we do not sell or share your TikTok data with third parties for advertising or profiling.</li>
            <li>We access only the TikTok permissions you explicitly authorize via TikTok's OAuth consent screen.</li>
            <li>You may revoke Boostify's access to your TikTok account at any time from your TikTok account settings under <em>Settings &gt; Security &gt; Connected Apps</em>, or by disconnecting within Boostify's account settings.</li>
            <li>Upon disconnection or account deletion, we delete your stored TikTok access tokens and cease making API calls on your behalf.</li>
          </ul>
          <p>Your use of TikTok services through Boostify is also subject to <a href="https://www.tiktok.com/legal/page/us/terms-of-service/en" target="_blank" rel="noopener noreferrer" className="text-orange-400 hover:underline">TikTok's Terms of Service</a> and <a href="https://www.tiktok.com/legal/page/us/privacy-policy/en" target="_blank" rel="noopener noreferrer" className="text-orange-400 hover:underline">TikTok's Privacy Policy</a>.</p>
        </Section>

        <Section id="s8" title="8. Blockchain & Wallet Features">
          <p>Certain features of Boostify require connecting a cryptocurrency wallet (e.g., MetaMask, WalletConnect). By connecting your wallet, you:</p>
          <ul className="list-disc list-inside space-y-1 pl-2">
            <li>Confirm that you are the authorized user of that wallet address</li>
            <li>Acknowledge that blockchain transactions are irreversible once confirmed on-chain</li>
            <li>Accept sole responsibility for safeguarding your private keys and seed phrases — Boostify never has access to these</li>
            <li>Understand that Boostify cannot reverse, refund, or recover lost blockchain transactions</li>
          </ul>
          <p>Gas fees and on-chain transaction costs are your responsibility and may vary with network conditions.</p>
        </Section>

        {/* ⚖️ THE KEY LEGAL CLAUSE */}
        <Section id="s9" title="9. BTF Utility Token — Not a Security">
          <Alert>
            <strong>⚠️ IMPORTANT LEGAL NOTICE — PLEASE READ IN FULL</strong>
          </Alert>

          <p><strong className="text-white">9.1 Nature of the BTF Token.</strong> The Boostify Token ("BTF") is a <em>utility token</em> deployed on the Polygon blockchain. BTF is designed exclusively to serve as an in-platform credit and access mechanism for Boostify's digital services. Purchasing or holding BTF does not create, represent, or imply any of the following:</p>
          <ul className="list-disc list-inside space-y-1 pl-2 mt-2">
            <li>An equity interest, ownership stake, or share in {COMPANY} or any affiliated entity</li>
            <li>A debt instrument, bond, note, or any obligation of repayment by Boostify</li>
            <li>A security as defined under the U.S. Securities Act of 1933, the Securities Exchange Act of 1934, or equivalent legislation in any jurisdiction</li>
            <li>A right to dividends, revenue sharing, profit participation, or any financial return</li>
            <li>A right to vote on corporate governance or management decisions</li>
            <li>A commodity, investment contract, or derivative financial instrument</li>
          </ul>

          <p className="mt-3"><strong className="text-white">9.2 No Investment Return.</strong> BTF tokens are acquired solely to access platform features. The primary use cases of BTF are: unlocking AI service credits, activating artist access packs, participating in the token lock-up program for service credit multipliers, and accessing exclusive platform features. There is no promise, representation, or expectation that BTF will increase in value or generate any financial return for the holder.</p>

          <p><strong className="text-white">9.3 Howey Test Analysis.</strong> BTF is not offered as an investment of money in a common enterprise with an expectation of profits derived primarily from the efforts of others. Any potential secondary-market liquidity of BTF arises incidentally from its utility and does not transform it into a security. The Boostify platform does not promote BTF as an investment opportunity.</p>

          <p><strong className="text-white">9.4 No SEC Registration.</strong> BTF tokens have not been registered with the U.S. Securities and Exchange Commission (SEC), the Financial Industry Regulatory Authority (FINRA), or any equivalent regulatory authority in any jurisdiction. The offering of BTF tokens does not constitute a public offering of securities. Nothing on the Boostify platform constitutes investment advice, financial advice, trading advice, or any other kind of advice.</p>

          <p><strong className="text-white">9.5 Regulatory Risk.</strong> The legal treatment of digital tokens and blockchain technology varies by jurisdiction and continues to evolve. You are solely responsible for determining whether your acquisition, holding, or use of BTF complies with applicable law in your jurisdiction. Boostify makes no representation that BTF is legal in all jurisdictions and expressly excludes residents of jurisdictions where such activity is prohibited.</p>

          <p><strong className="text-white">9.6 Artist Access Packs.</strong> "Artist Access Packs" and "Music Access Tokens" are digital utility items that grant access to specific artist content, community channels, or platform features. They are not financial instruments, do not represent ownership of any master recordings, publishing rights, or royalty streams, and are not traded on any securities exchange.</p>

          <p><strong className="text-white">9.7 Token Lock-Up Program.</strong> Participation in Boostify's token lock-up program provides service credit multipliers — that is, a higher rate of platform service credits per BTF locked. This is a platform feature discount mechanism, not a yield-generating investment product. Any credits generated are for use within the Boostify platform only and hold no monetary value outside the platform.</p>

          <Alert>
            By using any BTF-related feature on Boostify, you expressly acknowledge and agree that: (a) BTF is a utility token, not a security or investment product; (b) you are acquiring BTF for platform use, not for investment purposes; (c) you have not relied on any representation by Boostify regarding expected financial returns; and (d) Boostify is not liable for any loss arising from fluctuations in the secondary-market price of BTF.
          </Alert>
        </Section>

        <Section id="s10" title="10. Disclaimer of Warranties">
          <p>THE SERVICES ARE PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, OR NON-INFRINGEMENT.</p>
          <p>Boostify does not warrant that the Services will be uninterrupted, error-free, or free from viruses or other harmful components. AI-generated content is produced algorithmically and may contain inaccuracies; you are responsible for reviewing all AI outputs before use.</p>
        </Section>

        <Section id="s11" title="11. Limitation of Liability">
          <p>TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT SHALL BOOSTIFY, ITS OFFICERS, DIRECTORS, EMPLOYEES, OR AGENTS BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING WITHOUT LIMITATION LOSS OF PROFITS, DATA, GOODWILL, OR OTHER INTANGIBLE LOSSES, ARISING OUT OF OR IN CONNECTION WITH YOUR USE OF THE SERVICES, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.</p>
          <p>Boostify's total cumulative liability for any claims arising under these Terms shall not exceed the greater of (i) the amount you paid to Boostify in the twelve (12) months preceding the claim, or (ii) one hundred US dollars (USD $100).</p>
        </Section>

        <Section id="s12" title="12. Indemnification">
          <p>You agree to defend, indemnify, and hold harmless Boostify and its affiliates, officers, directors, employees, and agents from and against any and all claims, damages, obligations, losses, liabilities, costs, or debt arising from: (a) your use of the Services; (b) your User Content; (c) your violation of these Terms; or (d) your violation of any applicable law or third-party right.</p>
        </Section>

        <Section id="s13" title="13. Governing Law & Disputes">
          <p>These Terms are governed by and construed in accordance with the laws of the State of Delaware, United States, without regard to conflict of law principles.</p>
          <p>Any dispute arising under these Terms shall be submitted to binding arbitration under the American Arbitration Association (AAA) Consumer Arbitration Rules, conducted in English. You waive any right to participate in a class action lawsuit or class-wide arbitration.</p>
          <p>Notwithstanding the foregoing, either party may seek injunctive or other equitable relief in a court of competent jurisdiction to prevent irreparable harm.</p>
        </Section>

        <Section id="s14" title="14. Changes to These Terms">
          <p>We may update these Terms from time to time. We will notify you of material changes by posting the new Terms on this page and updating the effective date. Your continued use of the Services after any changes constitutes your acceptance of the revised Terms. If you disagree with the revised Terms, you must stop using the Services and may request account deletion.</p>
        </Section>

        <Section id="s15" title="15. Contact">
          <p>For legal inquiries: <a href={`mailto:${EMAIL_LEGAL}`} className="text-orange-400 hover:underline">{EMAIL_LEGAL}</a></p>
          <p>For general support: <a href={`mailto:${EMAIL_SUPPORT}`} className="text-orange-400 hover:underline">{EMAIL_SUPPORT}</a></p>
        </Section>

        <div className="text-center text-slate-500 text-xs mt-16 pb-8 border-t border-slate-800 pt-8">
          © {new Date().getFullYear()} {COMPANY} · <a href="/privacy" className="hover:text-orange-400">Privacy Policy</a>
        </div>
      </main>
    </div>
  );
}