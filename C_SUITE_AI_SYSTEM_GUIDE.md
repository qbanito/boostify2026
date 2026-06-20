# 🧠 C-Suite AI System — Complete Operating Manual

> **Boostify Music Platform · Phase 1 + Phase 2**
> 10 specialized AI executive agents that diagnose, plan, decide and (optionally) execute platform-wide operations under human oversight.

---

## 1. What is the C-Suite?

A self-organizing team of 10 LLM-powered agents — one per executive role — that:
openai/gpt-image-2
1. **Read** the platform state (DB, metrics, artists, songs, merch, treasury, social).
2. **Reason** with persona-specific prompts and a tool-calling loop (OpenAI-style).
3. **Decide** actions (recorded with risk score, signature, rationale).
4. **Execute** — only if (a) `dryRun=false`, (b) within their autonomy level, and (c) approved when risk is high.
5. **Remember** — write lessons / decisions / facts back into a per-agent memory table.
6. **Self-improve** — the CTO + CEO run a periodic loop that detects bugs, slow agents, off-track goals and proposes fixes.

Everything is gated by a global **kill switch** + a global **dry-run** flag.

---

## 2. The 10 Agents
| ID | Role | Persona focus | Default autonomy |
|----|------|---------------|------------------|
| `ceo`  | Chief Executive  | Cross-functional priorities, virality, NPS, escalation hub | 3 (read) |
| `cmo`  | Chief Marketing  | Signups, social reach, playlists, campaigns                | 3 |
| `cro`  | Chief Revenue    | Merch sales, sell-through, conversion                       | 3 |
| `cpo`  | Chief Product    | Feature adoption, UX, roadmap                               | 3 |
| `cfo`  | Chief Financial  | MRR, margins, treasury, artist earnings                     | 3 |
| `coo`  | Chief Operating  | Retention, delivery SLAs, scheduling                        | 3 |
| `cto`  | Chief Technology | Uptime, AI cost, self-maintenance loop                      | 3 |
| `clo`  | Chief Legal      | Royalties, copyrights, ToS, compliance                      | 2 (HITL) |
| `cdo`  | Chief Data       | Artist analytics, trends, top/at-risk artists               | 3 |
| `ciso` | Chief InfoSec    | Security checks, abuse detection                            | 2 (HITL) |

**Autonomy scale**
- `1` = Human-in-the-loop only (proposes, never acts).
- `2` = Guarded — can act on low-risk, requires approval otherwise.
- `3` = Autonomous read + propose; execution still gated by `dryRun` and `riskLevel`.

---

## 3. Architecture overview

```
┌──────────────────────────┐      ┌──────────────────────────┐
│   CSuitePanel (React)    │ SSE  │  /api/admin/c-suite/*    │
│   - Command Center       │◀────▶│  Express router           │
│   - Goals + Presets      │      │  - requireAdmin            │
│   - Approvals            │      │  - kill-switch / dryRun    │
│   - Self-improvement     │      │  - budget guard            │
│   - Threads / Memory     │      └──────────────┬───────────┘
└──────────────────────────┘                     │
                                                  ▼
                                  ┌──────────────────────────────┐
                                  │ runtime.ts · runAgentTurn()  │
                                  │  ┌────────────────────────┐  │
                                  │  │ OpenAI tool-loop       │  │
                                  │  │ (max 8 calls / 5 min)  │  │
                                  │  └─────────┬──────────────┘  │
                                  └────────────┼─────────────────┘
                                               ▼
                       ┌──────────────────────────────────────────┐
                       │  Tool registry (tools.ts + artist-tools) │
                       │  ~30 read tools + ~10 write tools         │
                       └──────────────┬───────────────────────────┘
                                      ▼
                        ┌──────────────────────────────┐
                        │  Postgres (Neon)             │
                        │  11 c_suite_* tables         │
                        │  + platform tables (read)    │
                        └──────────────────────────────┘
```

### Database tables (all `c_suite_*`)

| Table | Purpose |
|-------|---------|
| `c_suite_agents`            | Agent config: model, persona, autonomy, tools, budget |
| `c_suite_threads`           | Conversation containers (one per turn or sub-task) |
| `c_suite_messages`          | Each message in a thread (role, tool calls, cost) |
| `c_suite_decisions`         | Action proposals (action, target jsonb, risk, status) |
| `c_suite_approvals`         | Human gates for high-risk decisions |
| `c_suite_memory`            | Per-agent lessons / facts / decisions / feedback |
| `c_suite_schedule`          | Cron-style recurring tasks per agent |
| `c_suite_goals`             | OKRs / KRs (scope, owner, metric, target, status) |
| `c_suite_goal_checkins`     | Periodic measurements per goal |
| `c_suite_self_improvement`  | Detected issues + applied fixes |
| `c_suite_settings`          | Global flags: killSwitch, globalDryRun, budgets |

> Migration script: [create-c-suite-tables.mjs](create-c-suite-tables.mjs). Run with `node create-c-suite-tables.mjs` if any table is missing.

---

## 4. The runtime (one agent turn)

`runAgentTurn({ agentId, userMessage, parentThreadId?, triggeredBy?, adminEmail? })`

1. **Pre-flight**
   - Reject if global `killSwitch === true`.
   - Reject if agent is `active === false`.
2. **Budget guard** — sums `cost_usd` from this agent's last 24h messages; throws if `>= budgetUsdDaily`.
3. **Thread creation** — inserts a `c_suite_threads` row with `status='active'`.
4. **Loop** (max 8 tool calls or 5-minute deadline):
   - Build OpenAI request with persona + tool schemas filtered by `TOOL_SETS[agentId]`.
   - On `tool_calls`: lookup tool in registry, execute, append result.
   - On final assistant text: persist message, exit loop.
5. **Streaming** — every step emits an event on `runtimeEvents` → broadcast via `/api/admin/c-suite/stream` (SSE).
6. **Memory** — agent may explicitly call the `remember` tool to persist a lesson.

---

## 5. Tools

Tools live in [server/services/c-suite/tools.ts](server/services/c-suite/tools.ts) and [server/services/c-suite/artist-tools.ts](server/services/c-suite/artist-tools.ts).

### Read tools (safe, no side effects)
- `queryUsers`, `querySongs`, `queryMerch`, `queryRevenue`, `queryThreads`, `queryDecisions`
- `queryArtistOverview`, `queryArtistSongStats`, `queryArtistMerchPerformance`, `queryArtistFanMetrics`, `queryArtistTreasury`, `queryArtistMonetizationFunnel`, `queryTopArtistsByRevenue`, `queryAtRiskArtists`
- `runSelfDiagnostics`, `recallMemory`

### Write / proposal tools (gated by `dryRun` and risk)
- `pauseUser`, `enableFeatureFlag`, `recommendArtistStrategy`, `listArtistRecommendations`, `reportSelfImprovement`, `handoffTo`, `remember`

`TOOL_SETS` is defined per agent — e.g. CFO does **not** see `pauseUser`, CISO does.

---

## 6. Goals & Goal Presets

### Manual goal
`POST /api/admin/c-suite/goals` with `{ ownerAgent, scope, title, metric, targetValue, baseline?, periodEnd? }`.

### Preset goal (one-click)
`POST /api/admin/c-suite/goals/from-preset` with `{ presetKey, customTarget?, periodEnd?, autoExecute?: boolean }` (default `autoExecute=true`).

When `autoExecute=true` (the default for the UI), the server:
1. Inserts the goal row.
2. **Fire-and-forgets** `runAgentTurn(ownerAgent, kickoffPrompt)` — the owner agent immediately:
   - Queries the current value of the goal's `metric` using its read tools.
   - Identifies the top 3 levers to move it.
   - Proposes a 14-day action plan.
   - Saves the plan as a `c_suite_memory` row tagged `goal:<id>`.
   - Lists peer agents it would coordinate with (no actual handoff).
3. The thread, messages, costs and decisions are all visible in the **Threads** tab and via the **SSE Command Center** stream.

### Re-execute existing goal
`POST /api/admin/c-suite/goals/:id/execute` runs the same kickoff prompt again on demand. The UI exposes a **▶ Execute** button on every goal card.

### Available presets (15)

| Key | Owner | Metric → Target |
|-----|-------|-----------------|
| `mrr_10k`                  | cfo | mrr_usd → 10 000 |
| `gross_margin_65`          | cfo | gross_margin_pct → 65 |
| `artist_avg_earnings_500`  | cfo | artist_avg_earnings_monthly_usd → 500 |
| `signups_500_month`        | cmo | monthly_signups → 500 |
| `social_reach_5m`          | cmo | aggregate_followers → 5 000 000 |
| `playlist_placements_200`  | cmo | playlist_placements_monthly → 200 |
| `merch_orders_50_daily`    | cro | merch_orders_daily → 50 |
| `sell_through_45`          | cro | merch_sell_through_pct → 45 |
| `retention_30d_80`         | coo | artist_retention_30d_pct → 80 |
| `feature_adoption_75`      | cpo | feature_adoption_pct → 75 |
| `uptime_99_8`              | cto | system_uptime_pct → 99.8 |
| `cost_under_2k`            | cto | ai_cost_monthly_usd → 2 000 |
| `virality_1_3`             | ceo | virality_coefficient → 1.3 |
| `nps_50`                   | ceo | artist_nps → 50 |

Defined in [server/services/c-suite/goal-presets.ts](server/services/c-suite/goal-presets.ts).

---

## 7. Approvals (HITL gate)

When a decision has `riskLevel >= autoApproveBelowRisk` (configurable in settings), the agent inserts a row in `c_suite_approvals` with `status='pending'`.

Admin actions:
- `GET /api/admin/c-suite/approvals` → list pending.
- `POST /api/admin/c-suite/approvals/:id/decide` body `{ decision: 'approve' | 'reject', notes? }`.

On approve, the server:
1. Looks up the linked `c_suite_decisions` row.
2. Finds the tool by `decision.action`.
3. Executes the tool with `decision.target` (jsonb), `dryRun: false`, `autonomy: 3`.
4. Writes a `c_suite_memory` entry of kind `decision`.
5. Updates decision status to `executed` (or `failed`).

---

## 8. Self-improvement loop

Triggered automatically (every N minutes by CTO) or manually via `POST /api/admin/c-suite/self-improvement/run`.

The CTO uses `runSelfDiagnostics` to detect:
- 5xx spikes / slow endpoints
- Failing tools
- Off-track goals
- Cost anomalies
- Inactive agents

Each finding becomes a `c_suite_self_improvement` row (`detected → analyzing → proposed → applied → verified`). High-impact fixes file an approval first.

---

## 9. UI map (`CSuitePanel.tsx`)

| Tab | What you do |
|-----|-------------|
| **Command Center** | Send freeform message to any agent, watch tool calls live (SSE) |
| **Agents**         | Toggle active / dryRun, edit autonomy, budget |
| **Goals**          | One-click presets, manual create, **▶ Execute** any goal |
| **Approvals**      | Approve / reject high-risk decisions |
| **Self-Improve**   | Browse detected issues, run a cycle |
| **Threads**        | Browse historical agent conversations + costs |
| **Memory**         | Per-agent memory browser |
| **Settings**       | Kill switch, global dry-run, daily budget, auto-approve threshold |

---

## 10. Step-by-step usage

### First-time setup
1. Ensure DB migration has run: `node create-c-suite-tables.mjs`.
2. Open the admin C-Suite panel → click **Bootstrap** (or `POST /api/admin/c-suite/bootstrap`). This seeds the 10 agents.
3. In **Settings**, leave `globalDryRun=true` until you trust the system.
4. In **Agents**, toggle the agents you want active (CEO, CMO, CFO recommended first).

### Running a goal end-to-end
1. Go to **Goals** tab.
2. Click any **Quick Preset** (e.g. *"Hit $10K MRR"*).
   - Goal appears in the grid.
   - Toast says *"Preset applied — agent dispatched"*.
   - Owner agent (CFO) automatically starts a thread.
3. Switch to **Command Center** or **Threads** tab to watch the CFO:
   - Call `queryRevenue` / `queryArtistTreasury`.
   - Propose a plan.
   - Call `remember` to save it.
4. If the agent proposed a high-risk action, an entry appears in **Approvals**. Approve to execute, reject to discard.
5. To re-run planning later (e.g. weekly), open the goal card and click **▶ Execute**.

### Pausing everything
- Toggle `killSwitch=true` in **Settings**. All `runAgentTurn` calls throw immediately.
- Or set `globalDryRun=true` to keep agents thinking but block all writes.

---

## 11. API quick reference

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/admin/c-suite/bootstrap`               | Seed/refresh 10 agents |
| `GET`  | `/api/admin/c-suite/agents`                  | List agents |
| `PATCH`| `/api/admin/c-suite/agents/:id`              | Update agent (active, dryRun, autonomy, budget) |
| `POST` | `/api/admin/c-suite/command`                 | Send a message to an agent (sync) |
| `GET`  | `/api/admin/c-suite/stream`                  | SSE event stream |
| `GET`  | `/api/admin/c-suite/threads`                 | Recent threads |
| `GET`  | `/api/admin/c-suite/goals`                   | List goals |
| `POST` | `/api/admin/c-suite/goals`                   | Create custom goal |
| `GET`  | `/api/admin/c-suite/goals/presets`           | List 15 presets |
| `POST` | `/api/admin/c-suite/goals/from-preset`       | Apply preset (auto-executes by default) |
| `POST` | `/api/admin/c-suite/goals/:id/execute`       | Re-run owner agent on existing goal |
| `GET`  | `/api/admin/c-suite/approvals`               | Pending approvals |
| `POST` | `/api/admin/c-suite/approvals/:id/decide`    | Approve/reject |
| `GET`  | `/api/admin/c-suite/self-improvement`        | Issues log |
| `POST` | `/api/admin/c-suite/self-improvement/run`    | Trigger CTO cycle |
| `POST` | `/api/admin/c-suite/briefing/run`            | Generate daily briefing |
| `GET`  | `/api/admin/c-suite/memory/:agentId`         | Browse agent memory |
| `GET`  | `/api/admin/c-suite/stats`                   | Dashboard counters |
| `GET`  | `/api/admin/c-suite/settings`                | Global settings |
| `PATCH`| `/api/admin/c-suite/settings`                | Update kill-switch / dry-run / budget |

All endpoints require admin via Clerk session. In dev, set `ALLOW_DEV_ADMIN_HEADER=1` and send `x-admin-email: <admin>`.

---

## 12. Cost & safety controls

- **Per-agent daily budget** (`c_suite_agents.budget_usd_daily`, default `$5`). Hard-stops further turns once exceeded.
- **Global daily budget** (`c_suite_settings.daily_token_budget_usd`, default `$15`). Enforced at the runtime layer.
- **5-minute turn deadline** prevents runaway loops.
- **8-tool-call cap** per turn.
- **dryRun** flag (per-agent + global) makes write tools no-op.
- **Auto-approve threshold** — decisions with `riskLevel <= autoApproveBelowRisk` skip HITL. Default `0` = always require approval.
- **Kill switch** — single boolean that pauses every agent everywhere.

---

## 13. Common operations cheatsheet

```bash
# Re-create missing tables
node create-c-suite-tables.mjs

# Seed agents in dev
curl -X POST http://localhost:3000/api/admin/c-suite/bootstrap \
  -H "x-admin-email: convoycubano@gmail.com"

# Apply a preset (auto-dispatches agent)
curl -X POST http://localhost:3000/api/admin/c-suite/goals/from-preset \
  -H "Content-Type: application/json" \
  -H "x-admin-email: convoycubano@gmail.com" \
  -d '{"presetKey":"mrr_10k"}'

# Re-execute an existing goal
curl -X POST http://localhost:3000/api/admin/c-suite/goals/42/execute \
  -H "x-admin-email: convoycubano@gmail.com"

# Pause everything
curl -X PATCH http://localhost:3000/api/admin/c-suite/settings \
  -H "Content-Type: application/json" \
  -H "x-admin-email: convoycubano@gmail.com" \
  -d '{"killSwitch":true}'
```

---

## 14. Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `relation "c_suite_agents" does not exist` | Tables never created | `node create-c-suite-tables.mjs` |
| All endpoints return 401 in dev | Clerk session missing | Add `ALLOW_DEV_ADMIN_HEADER=1` + admin header |
| Endpoints return 500 right after save | tsx --watch is restarting Express | Wait 5s, retry |
| Preset clicks but nothing happens in Threads | Owner agent inactive or kill-switch on | Activate agent + check Settings |
| Agent throws "budget exceeded" | Daily cost cap reached | Wait 24h or raise `budgetUsdDaily` |
| Tools missing for an agent | `TOOL_SETS[agentId]` doesn't include them | Edit `tools.ts` and restart |

---

## 15. File map

- [server/routes/admin-c-suite.ts](server/routes/admin-c-suite.ts) — REST API
- [server/services/c-suite/runtime.ts](server/services/c-suite/runtime.ts) — agent loop
- [server/services/c-suite/tools.ts](server/services/c-suite/tools.ts) — tool registry
- [server/services/c-suite/artist-tools.ts](server/services/c-suite/artist-tools.ts) — artist-scoped tools
- [server/services/c-suite/goal-presets.ts](server/services/c-suite/goal-presets.ts) — 15 presets
- [server/services/c-suite/self-maintenance.ts](server/services/c-suite/self-maintenance.ts) — CTO loop
- [client/src/components/admin/c-suite/CSuitePanel.tsx](client/src/components/admin/c-suite/CSuitePanel.tsx) — UI
- [create-c-suite-tables.mjs](create-c-suite-tables.mjs) — DB migration

---

*Last updated: Phase 2 (April 2026) · 10 agents · 15 goal presets · auto-execute on preset apply · per-goal **▶ Execute** action.*
