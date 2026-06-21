# Telegram Gateway Service (optional, self-hosted Bot API)

Boostify's **Telegram Artist Command Center** talks to the official Telegram Bot
API at `https://api.telegram.org` by default — **no extra service is required**.
Each artist connects their own bot token (from [@BotFather](https://t.me/BotFather)),
which Boostify encrypts (AES-256-GCM) and uses to send messages, build campaigns,
mint invite links and receive webhook updates.

You only need this self-hosted gateway if you want:

- **Large media uploads** (the public Bot API caps files at 50 MB; a self-hosted
  server raises this to 2 GB).
- **Higher throughput / lower latency** for high-volume artists.
- **Local webhooks** without exposing every bot to the public internet.

## Run a self-hosted Telegram Bot API server

```bash
# 1. Get api_id + api_hash from https://my.telegram.org -> API development tools
# 2. Start the server (aiogram's image wraps the official tdlib server)
docker compose up -d
```

`docker-compose.yml`:

```yaml
services:
  telegram-bot-api:
    image: aiogram/telegram-bot-api:latest
    restart: unless-stopped
    environment:
      TELEGRAM_API_ID: "${TELEGRAM_API_ID}"
      TELEGRAM_API_HASH: "${TELEGRAM_API_HASH}"
      TELEGRAM_LOCAL: "true"     # enables /var/lib/telegram-bot-api local file mode
    ports:
      - "8081:8081"
    volumes:
      - telegram-bot-api-data:/var/lib/telegram-bot-api

volumes:
  telegram-bot-api-data:
```

Then point Boostify at it:

```bash
# .env
TELEGRAM_BOT_API_BASE_URL=http://localhost:8081
```

The adapter (`server/services/telegram-gateway/telegram.adapter.ts`) reads
`TELEGRAM_BOT_API_BASE_URL` (default `https://api.telegram.org`) and prefixes every
request with `/bot<token>`, so switching is a single env var — no code change.

## Boostify environment variables

| Variable | Purpose |
| --- | --- |
| `TELEGRAM_BOT_API_BASE_URL` | Base URL of the Bot API server (default public). |
| `TELEGRAM_WEBHOOK_SECRET` | Shared secret verified against the `x-telegram-bot-api-secret-token` header on `POST /api/telegram/webhook/:artistId`. |
| `TELEGRAM_TOKEN_ENC_KEY` | Key used to derive the AES-256-GCM key that encrypts each artist's bot token at rest (falls back to `OPENWA_API_KEY`). |

## Simulation mode

For local demos without a real bot, connect with the token `demo` (or `sim` /
`simulation` / `test`). The adapter returns a fake connected status and never calls
Telegram — useful for UI walkthroughs.
