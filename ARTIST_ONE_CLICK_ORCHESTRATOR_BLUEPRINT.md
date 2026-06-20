# Boostify Artist One-Click Orchestrator Blueprint

## Objective
Enable a true one-click flow where each generated AI artist becomes a complete digital asset with synchronized operations across music, video, social, press, crowdfunding, exclusive content, merchandise, token promotion, and industry outreach.

## Current Baseline
- Artist creation pipeline exists and generates core assets.
- Several modules are operational independently (distribution, crowdfunding, explicit, news, render queue, social generation).
- Missing layer: a single launch orchestrator with deterministic scheduling, dependency tracking, retries, and observability.

## Target Operating Model
- Every artist creation triggers one `Launch Plan` with strict stages.
- Every stage emits deterministic tasks with dependency metadata.
- Calendar is generated once and becomes source of truth for all publications.
- Publishing connectors consume scheduled events and report execution state.

## Stage Architecture

### Stage 0: Artist Core
- Generate artist profile and visual identity.
- Persist artist in PostgreSQL + Firestore.
- Register blockchain profile when available.

### Stage 1: Music Pack
- Generate 3 songs.
- Auto-assign release cadence: D0, D+10, D+20.
- Persist release dates in song records and launch calendar.

### Stage 2: Launch Calendar
- Create publication events per song:
  - D-7 teaser
  - D-3 preview snippet
  - D0 release post
  - D+2 press article
  - D+5 outreach push
- Add calendar entries to manager timeline and launch plan.

### Stage 3: Promo Assets
- Generate social content packs.
- Generate 5 artist news articles.
- Generate complete EPK with press photos.

### Stage 4: Video
- Create profile loop video.
- Create full music video pipeline jobs in render queue.
- Track video lifecycle statuses.

### Stage 5: Monetization Bootstrap
- Create crowdfunding campaign draft.
- Initialize explicit content settings.
- Generate merchandise starter catalog.
- Prepare token promotion events.

### Stage 6: Distribution and Industry
- Build release objects in distribution module.
- Queue partner outreach package.
- Queue newsletter + industry contact sends.

### Stage 7: QA and Publish
- Validate required assets before publishing each wave.
- Execute scheduled publish tasks through channel connectors.
- Mark event outcomes and retries.

## Data Contracts

### Launch Plan (Firestore)
- version
- status
- cadenceDays
- songs[]
  - songId
  - title
  - tokenId
  - mood
  - releaseDate
  - isPublished
- modules
  - music
  - tokenization
  - crowdfunding
  - explicit
  - merch
  - video
  - outreach
- nextReleaseAt

### Execution Status (recommended next)
- taskId
- artistId
- stage
- taskType
- status
- attempts
- maxAttempts
- blockedReason
- startedAt
- finishedAt
- errorCode
- errorMessage

## SLA Targets
- Artist bootstrap ready (core + 3 songs + launch plan): <= 8 min
- Full promo pack ready: <= 20 min
- First release wave execution success: >= 98%
- Task retry recovery success: >= 90%

## Observability
- KPIs:
  - launch_time_to_ready
  - stage_success_rate
  - publish_success_rate
  - retry_rate
  - blocked_task_count
- Dashboards:
  - per-artist launch timeline
  - per-module failure heatmap
  - release calendar queue health

## Security and Idempotency
- Use deterministic idempotency key per artist launch request.
- Guard each stage to avoid duplicate inserts.
- Mark immutable milestones once completed.

## Delivery Roadmap

### Sprint 1 (done)
- Release scheduling every 10 days at artist generation.
- Launch plan persistence in Firestore.
- Crowdfunding + explicit bootstrap at creation.

### Sprint 2 (done)
- Per-task state machine in Firestore (`launchTasks`) with status lifecycle: pending → running → completed/failed/skipped.
- Replaced 60s setTimeout completion with real Promise.allSettled gate.
- Retry policy: 3 attempts per task with exponential backoff (5s base).
- Launch status API endpoint: `GET /api/artist-generator/launch-status/:firestoreId`.
- Release publisher worker (`server/services/release-publisher.ts`):
  - Runs every 15 min, auto-publishes songs whose releaseDate has arrived.
  - Creates per-release news article.
  - Updates Firestore launch plan and release calendar.
- Worker wired into server startup via `routes.ts`.

### Sprint 3
- Social/press/outreach event connectors driven by release calendar.
- Channel health checks and fallback routing.

### Sprint 4
- Full mission-control UI for artist launch operations.
- Alerting and SLA dashboards.

## Acceptance Criteria for One-Click
- Artist is generated with 3 songs and deterministic release calendar.
- Social + press + outreach events are scheduled and traceable.
- Crowdfunding, explicit, merch, and token promotion are initialized.
- Video pipeline is queued and visible in launch state.
- Every task has status and retry history.
- No silent failures.
