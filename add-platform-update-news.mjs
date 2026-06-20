/**
 * Insert latest Boostify platform-update news articles directly into Neon DB.
 * Idempotent: skips articles whose slug already exists.
 *
 * Run: node add-platform-update-news.mjs
 */
import pg from 'pg';
import { config } from 'dotenv';
config();

const { Client } = pg;

const articles = [
  {
    slug: 'c-suite-ai-executive-suite-launch-2026',
    title: 'Boostify Launches the C-Suite: 10 AI Executives Now Run the Platform',
    subtitle: 'CEO, CMO, CFO, CRO, CPO, COO, CTO, CLO, CDO and CISO — autonomous, accountable, and online 24/7.',
    summary:
      'Boostify just shipped the C-Suite AI Executive Suite: ten specialized agents (one per chief role) that plan, decide, escalate and execute against measurable goals. Each chief has its own persona, model, daily token budget, autonomy level (1-3) and tool whitelist. Together they form the first fully-autonomous executive layer running on top of an artist-economy platform.',
    htmlContent: `
<p>Today we are flipping the switch on the most ambitious feature in Boostify's history: the <strong>C-Suite AI Executive Suite</strong>. Ten specialized agents — one for every classic chief role — now operate the platform alongside our human team, with full memory, escalation rules and live observability.</p>

<h2>Who is on the bench</h2>
<ul>
  <li>👑 <strong>CEO</strong> — Neiver Alvarez-AI · vision, prioritization, escalation root</li>
  <li>📣 <strong>CMO</strong> — campaigns, brand, social reach</li>
  <li>💰 <strong>CFO</strong> — MRR, gross margin, cost guards</li>
  <li>💼 <strong>CRO</strong> — revenue ops, pricing, monetization</li>
  <li>🎯 <strong>CPO</strong> — product roadmap, feature adoption</li>
  <li>⚙️ <strong>COO</strong> — operations, retention, sell-through</li>
  <li>🛠️ <strong>CTO</strong> — uptime, infra, performance</li>
  <li>⚖️ <strong>CLO</strong> — compliance, IP, contracts</li>
  <li>📊 <strong>CDO</strong> — analytics, experiments, NPS</li>
  <li>🛡️ <strong>CISO</strong> — security, abuse prevention</li>
</ul>

<h2>How it actually works</h2>
<p>Every chief is a Drizzle row in <code>c_suite_agents</code> with persona, model (gpt-4o by default), tool whitelist and a daily USD budget. When invoked, the runtime opens a thread, runs an OpenAI tool-calling loop, persists every message and decision, and emits live SSE events that you can watch from the new <strong>Command Center</strong> tab in the admin panel. High-risk actions don't just execute — they create entries in the Approvals queue and pause until a human signs off.</p>

<h2>Goals, Quick Presets and auto-execution</h2>
<p>Goals are first-class citizens. We curated 15 production presets across revenue, growth, retention, platform reliability and artist success (<em>"MRR &gt; $10K/mo"</em>, <em>"Gross margin ≥ 65%"</em>, <em>"Average artist earnings &gt; $500/mo"</em>, …). Click a preset and the system: (1) inserts the goal, (2) immediately dispatches the owner agent to query current metrics, propose a 14-day plan and write it to long-term memory tagged with the goal id. There is also a manual <code>▶ Execute</code> button on every goal card to re-kick the owner chief at any time.</p>

<h2>Safety rails baked in</h2>
<ul>
  <li><strong>Kill switch</strong> — global pause for all chiefs in one click.</li>
  <li><strong>Dry-run per agent</strong> — let a chief plan without executing while you build trust.</li>
  <li><strong>Daily budget caps</strong> — every agent has a USD ceiling enforced by the runtime.</li>
  <li><strong>Approvals queue</strong> — risky tool calls (spend, public messaging, schema changes) require human sign-off.</li>
  <li><strong>Self-improvement loop</strong> — chiefs review their own outputs and propose policy diffs that you approve before they apply.</li>
</ul>

<p>This is not a chatbot. It is an executive layer with memory, budget, autonomy levels, and a queue of decisions you can replay. We will publish the full operating manual and a deep-dive post next week.</p>
    `.trim(),
    coverImageUrl:
      'https://placehold.co/1536x1024/0f172a/f97316?text=BOOSTIFY+C-SUITE+AI',
    imageProvider: 'fallback',
    tags: ['c-suite', 'ai-agents', 'autonomous', 'platform', 'launch'],
    readTimeMinutes: 5,
  },
  {
    slug: 'goal-driven-strategy-quick-presets-launch',
    title: 'Quick Presets: One Click → Strategic Goal + Auto-Dispatched Plan',
    subtitle: '15 production goal templates that immediately put a C-Suite agent to work.',
    summary:
      'Quick Presets turn strategic intents into running plans in a single click. Pick "MRR > $10K", "Gross margin ≥ 65%", "Average artist earnings > $500/mo" or any of 15 presets and the system not only creates the goal — it dispatches the owner chief to query current metrics, identify three levers, build a 14-day plan and persist it as long-term memory.',
    htmlContent: `
<p>Building a company is mostly about choosing what to optimize next. We just made that part dramatically faster.</p>

<h2>What ships today</h2>
<p>The Goals dashboard now exposes a <strong>Quick Presets</strong> panel with fifteen templates curated across five categories:</p>
<ul>
  <li><strong>Revenue</strong> — MRR &gt; $10K, Gross margin ≥ 65%, Average artist earnings &gt; $500/mo</li>
  <li><strong>Growth</strong> — 500 sign-ups/month, Social reach 5M impressions/mo, 200 playlist placements/mo</li>
  <li><strong>Retention</strong> — 30-day retention ≥ 80%, NPS ≥ 50, Feature adoption ≥ 75%</li>
  <li><strong>Platform</strong> — Uptime ≥ 99.8%, Infra cost &lt; $2K/mo</li>
  <li><strong>Artist success</strong> — Daily merch orders ≥ 50, Sell-through ≥ 45%, Virality coefficient ≥ 1.3</li>
</ul>

<h2>The dispatch loop</h2>
<p>Every preset declares an <em>owner agent</em> (CFO owns margins, CMO owns reach, CTO owns uptime, etc.). Clicking the preset:</p>
<ol>
  <li>Inserts a row into <code>c_suite_goals</code> with metric, target, baseline and period.</li>
  <li>Builds a structured kickoff prompt asking the owner to <em>(a)</em> query the current metric, <em>(b)</em> identify three levers, <em>(c)</em> propose a 14-day plan, <em>(d)</em> save it to <code>c_suite_memory</code> tagged <code>goal:&lt;id&gt;</code>, and <em>(e)</em> list peer agents needed for execution.</li>
  <li>Fires the agent in the background and emits live events you can watch in the Command Center.</li>
</ol>

<h2>You stay in control</h2>
<p>Each goal card now has a <strong>▶ Execute</strong> button to re-dispatch the owner at any time and a <strong>Delete</strong> button for goals you added by mistake (because of course it happens). Cascading FK deletes keep checkins consistent automatically.</p>

<p>This is the smallest unit of "strategic intent → autonomous execution" we could ship and it already changes how we run the company day-to-day.</p>
    `.trim(),
    coverImageUrl:
      'https://placehold.co/1536x1024/0f172a/22d3ee?text=Goals+%E2%86%92+Auto-Dispatch',
    imageProvider: 'fallback',
    tags: ['goals', 'presets', 'autonomous', 'strategy', 'platform-updates'],
    readTimeMinutes: 4,
  },
  {
    slug: 'command-center-live-agent-stream',
    title: 'Command Center: Talk to Your AI Executives in Real Time',
    subtitle: 'A unified chat surface streaming live tool calls and decisions from every chief.',
    summary:
      'The new Command Center in the admin panel lets operators directly address the CEO — or any specific chief via dropdown — and watch the agent\'s tool calls, intermediate reasoning and final answer stream in live via Server-Sent Events. It is the cockpit for an autonomous executive team.',
    htmlContent: `
<p>An autonomous executive team is only useful if you can actually talk to it. That is what the <strong>Command Center</strong> is for.</p>

<h2>What you can do</h2>
<ul>
  <li>Send a directive to any chief from a single chat box. Default routes to the CEO; the dropdown picks a specific role (CFO, CMO, CTO, …).</li>
  <li>Watch the agent's <strong>tool calls</strong> appear in real time (DB queries, analytics, memory writes, webhooks, …) — no more black boxes.</li>
  <li>See assistant turns and the final answer stream into the transcript with role-coloured rendering.</li>
  <li>Press <strong>Enter</strong> to send (Shift+Enter for newline). Every directive is persisted as a thread you can revisit later.</li>
</ul>

<h2>How the stream works</h2>
<p>Behind the scenes, <code>POST /api/admin/c-suite/command</code> kicks off a sync agent turn while a long-lived <code>GET /api/admin/c-suite/stream</code> SSE channel pushes <code>tool_call</code> and <code>assistant_message</code> events as they happen. The connection auto-reconnects with exponential backoff and the server sends heartbeats every 25s so corporate proxies don't kill it.</p>

<h2>Why it matters</h2>
<p>Operators get a single pane of glass to interrogate, redirect or override any chief. Combined with the Approvals queue and the Threads tab, you have full audit trail + live control of the autonomous layer running Boostify.</p>
    `.trim(),
    coverImageUrl:
      'https://placehold.co/1536x1024/0f172a/a78bfa?text=Command+Center',
    imageProvider: 'fallback',
    tags: ['command-center', 'sse', 'real-time', 'admin', 'platform-updates'],
    readTimeMinutes: 3,
  },
  {
    slug: 'self-improvement-loop-and-approvals-queue',
    title: 'Approvals Queue + Self-Improvement Loop: How Boostify Keeps Autonomy Safe',
    subtitle: 'Risky decisions wait for a human. Boring decisions ship. The agents review themselves.',
    summary:
      'Two production-grade safety features just shipped alongside the C-Suite: a global Approvals queue that gates risky tool calls behind human sign-off, and a Self-Improvement loop where chiefs critique their own recent outputs and propose policy diffs you can approve, reject or edit.',
    htmlContent: `
<p>Autonomy without guardrails is a liability. The C-Suite ships with two layers that turn it into a competitive advantage instead.</p>

<h2>Approvals queue</h2>
<p>Every chief has a tool whitelist and an autonomy level (1 to 3). Tools flagged as high-risk — anything that spends real money, posts publicly, alters schema, or impacts a large number of users — automatically create an entry in <code>c_suite_approvals</code> instead of executing. Operators see a unified queue with the action, the requesting agent, the rationale and the projected impact. One click approves or rejects; the agent resumes from exactly where it paused. Auto-approval thresholds for low-risk actions are configurable per agent.</p>

<h2>Self-improvement loop</h2>
<p>Once per cycle, each active chief reviews its own recent threads and decisions and produces a policy diff: prompt tweaks, tool whitelist changes, autonomy adjustments, budget revisions. Those diffs land in <code>c_suite_self_improvement</code> with a status of <em>proposed</em>. You inspect, approve, edit or reject. Approved diffs apply to the agent config; rejected ones stay logged for analysis. The whole loop is observable from the Self-Improvement tab.</p>

<h2>Daily briefing</h2>
<p>On top of those two, the system runs a daily briefing job that summarizes everything the C-Suite did in the last 24 hours: goals progressed, decisions made, approvals pending, money spent, anomalies detected. It lands in your inbox so you start the day with one source of truth.</p>

<p>Together, these three primitives — approvals, self-improvement, daily briefing — are how Boostify turns "AI that does things autonomously" into something a serious operator can actually trust in production.</p>
    `.trim(),
    coverImageUrl:
      'https://placehold.co/1536x1024/0f172a/10b981?text=Safety+%2B+Self-Improvement',
    imageProvider: 'fallback',
    tags: ['approvals', 'self-improvement', 'safety', 'governance', 'platform-updates'],
    readTimeMinutes: 4,
  },
];

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  console.log('[news] connected to DB');

  let inserted = 0;
  let skipped = 0;

  for (const a of articles) {
    const existing = await client.query('SELECT id FROM news_articles WHERE slug = $1', [a.slug]);
    if (existing.rowCount > 0) {
      console.log(`[news] ⏭  skip "${a.slug}" — already exists (id=${existing.rows[0].id})`);
      skipped++;
      continue;
    }
    const r = await client.query(
      `INSERT INTO news_articles
        (slug, title, subtitle, summary, html_content, cover_image_url, image_provider,
         category, tags, read_time_minutes, status, published_at, generated_by, ai_model)
       VALUES
        ($1,$2,$3,$4,$5,$6,$7,'platform-updates',$8,$9,'published',NOW(),'platform-team','manual-curated')
       RETURNING id`,
      [
        a.slug,
        a.title,
        a.subtitle,
        a.summary,
        a.htmlContent,
        a.coverImageUrl,
        a.imageProvider,
        a.tags,
        a.readTimeMinutes,
      ],
    );
    console.log(`[news] ✅ inserted "${a.slug}" → id=${r.rows[0].id}`);
    inserted++;
  }

  console.log(`\n[news] done. inserted=${inserted}, skipped=${skipped}, total=${articles.length}`);
  await client.end();
}

main().catch((e) => {
  console.error('[news] fatal:', e);
  process.exit(1);
});
