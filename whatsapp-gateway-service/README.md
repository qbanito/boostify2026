# WhatsApp Artist Command Center

Premium module inside the Boostify **Artist Profile** that turns WhatsApp into the
artist's operational channel: connect a number, run AI commands, message fans, send
campaigns, sell tickets & merch, handle booking, process live gifts, notify the BTF
wallet, and track analytics — all from one dashboard.

> ⚠️ **Not the official Meta API.** This module is powered by [OpenWA](https://openwa.dev)
> ([open-wa/wa-automate](https://github.com/open-wa/wa-automate), reference repo
> [rmyndharis/OpenWA](https://github.com/rmyndharis/OpenWA)). Use it for **support,
> concierge and controlled automations only — never for unsolicited spam**. A migration
> path to the official **WhatsApp Business Cloud API** is described at the end.

---

## Architecture

```
Artist Profile (React)
  └─ WhatsAppCommandCenter.tsx ── useWhatsAppCenter() ──► /api/whatsapp/* (Express)
                                                              │
                                       openwa.adapter.ts (the ONLY seam)
                                                              │
                                                  whatsapp-gateway-service  ← OpenWA, separate container
                                                              │
                                                        WhatsApp (Web)
```

* **Frontend** — `client/src/components/artist/whatsapp-command-center/*` + hook
  `client/src/hooks/use-whatsapp-center.ts`. Dark glassmorphism, 10 tabs.
* **Backend** — `server/routes/whatsapp.ts` (mounted at `/api/whatsapp`). All OpenWA
  calls go through the backend; **tokens never reach the browser**.
* **Adapter** — `server/services/whatsapp-gateway/openwa.adapter.ts` implements the
  `WhatsAppGateway` interface. Swapping providers later = a new class, nothing else.
* **AI agent** — `server/services/whatsapp-gateway/whatsapp-ai-agent.ts` classifies
  natural-language commands and routes them to Boostify modules.
* **Schema** — `server/services/whatsapp-gateway/whatsapp.schema.ts`. Rules in
  `firestore.rules` (direct client access denied; backend Admin SDK only).

If `OPENWA_BASE_URL` is **not set**, the adapter runs in **simulation mode** — the QR
auto-connects and messages are logged but not sent, so the whole UI is usable in dev.

---

## Endpoints (`/api/whatsapp`)

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/session/create` | Create/refresh OpenWA session, return QR |
| GET  | `/session/:sessionId/status` | Live connection status |
| POST | `/session/:sessionId/disconnect` | Log out the session |
| POST | `/message/send` | Send a text message |
| POST | `/media/send` | Send media (image/doc) + caption |
| POST | `/campaign/send` | Broadcast to a segment (consent + paced) |
| GET  | `/campaigns/:artistId` | Campaign history |
| GET  | `/contacts/:artistId` | List contacts |
| POST | `/contacts/:artistId` | Import/add contacts |
| GET  | `/messages/:artistId` | Message history |
| POST | `/ai-command` | Classify + route a command |
| GET  | `/ai-commands/:artistId` | Command history |
| GET  | `/analytics/:artistId` | KPIs |
| GET  | `/sales/:artistId` | Sales records |
| POST | `/webhook` | **Inbound** messages from the gateway (no Boostify auth; shared-secret verified) |

### Gateway REST contract (what the adapter calls)

The `whatsapp-gateway-service` must expose:

```
POST   /api/sessions                          { sessionId }            → { status, qr }
GET    /api/sessions/:sessionId/status                                  → { status, qr, phoneNumber }
POST   /api/sessions/:sessionId/send-text     { to, content }          → { messageId }
POST   /api/sessions/:sessionId/send-media    { to, url, caption }     → { messageId }
POST   /api/sessions/:sessionId/logout
```

Auth: header `api_key: <OPENWA_API_KEY>` (also sent as `Authorization: Bearer`).
Inbound: the gateway POSTs each received message to
`${BOOSTIFY_API_URL}/api/whatsapp/webhook` with header `x-openwa-token: <OPENWA_API_KEY>`.
The adapter normalizes common OpenWA payload shapes (`message.from/body/type/...`).

If your OpenWA build exposes different routes (e.g. wa-automate easy-api’s `/sendText`),
map them in a thin proxy or adjust `OpenWaAdapter` — that class is the only thing to edit.

---

## Installation

1. **Env vars** (add to `.env`, see `.env.example`):

   ```bash
   OPENWA_BASE_URL=http://localhost:8002   # empty = simulation mode
   OPENWA_API_KEY=<a-strong-shared-secret>
   BOOSTIFY_API_URL=http://localhost:3000
   # Reused from existing config: OPENAI_API_KEY, GEMINI_API_KEY, FIREBASE_*,
   # BTF_TOKEN_CONTRACT, STRIPE_SECRET_KEY
   ```

2. **Run the gateway** (Docker):

   ```bash
   OPENWA_API_KEY=... BOOSTIFY_API_URL=http://localhost:3000 \
     docker compose -f whatsapp-gateway-service/docker-compose.yml up -d
   ```

   Or with Node (any OpenWA build that satisfies the contract above), e.g.:

   ```bash
   npx @open-wa/wa-automate --api-host 0.0.0.0 --api-port 8002 \
     --key "$OPENWA_API_KEY" \
     --webhook "$BOOSTIFY_API_URL/api/whatsapp/webhook" --webhook-secret "$OPENWA_API_KEY"
   ```

3. **Deploy Firestore rules**: `firebase deploy --only firestore:rules`.

4. **Start Boostify** (`npm run dev`). Open an artist profile you own → the
   **WhatsApp Command Center** card appears under the Artist Command Engine.

5. **Connect** → tab *Connect* → **Connect WhatsApp** → scan the QR. Status flips to
   🟢 *Conectado* and the other tabs unlock.

---

## Security

* All gateway calls go through the backend — **OpenWA tokens never reach the client**.
* Firestore rules **deny direct client access** to every `whatsapp*` subcollection;
  only the backend Admin SDK (which bypasses rules) reads/writes them.
* **Consent enforced**: campaigns skip `opted_out` contacts. Inbound `STOP / SALIR /
  CANCELAR` auto opts-out; `START` re-subscribes.
* **Rate limiting** per artist (≤ 60 msg/min) + 1.2s pacing between campaign sends to
  avoid bans.
* **Audit log** (`whatsappAuditLog`) records sessions, imports, campaigns and opt-outs.
* Webhook verifies the `x-openwa-token` shared secret.

---

## Migration plan → WhatsApp Business Cloud API (official)

OpenWA is great for launch/testing but the official Meta API is the long-term home.
Because everything is behind the `WhatsAppGateway` interface, migration is isolated:

1. **Meta setup** — create a Meta App + WhatsApp Business Account, verify the business,
   register a phone number, obtain a permanent System User token, and create approved
   **message templates** (the official API requires templates for business-initiated
   messages outside the 24h customer-service window).
2. **New adapter** — add `cloud-api.adapter.ts` implementing `WhatsAppGateway`:
   * `sendMessage` → `POST graph.facebook.com/v19.0/<phoneId>/messages` (type `text`,
     or `template` outside the 24h window).
   * `sendMedia` → `messages` with `type: image/document` + media link or uploaded id.
   * `createSession`/`getSessionStatus` → no QR; "session" becomes the verified number.
   * `receiveWebhook` → verify `X-Hub-Signature-256`, map Cloud API webhook payloads to
     `NormalizedInbound`.
3. **Resolver switch** — in `getGateway()`, choose the adapter by a `WHATSAPP_PROVIDER`
   env flag (`openwa` | `cloud`). No route, hook or UI changes required.
4. **Consent/opt-out** logic, analytics, Firestore schema and the AI agent stay
   exactly the same.
5. **Compliance** — adopt template categories (marketing/utility/auth), respect the
   24-hour window, and honor Meta quality ratings / messaging limits.

Keep OpenWA as a fallback/dev provider; flip production to the Cloud API once templates
are approved.
