# Boostify — k6 Load Tests

Load/stress tests for the scalability work (durable queue, seat-map holds with
`FOR UPDATE SKIP LOCKED` + sharded availability counters, aggregated stats).

## Install k6

```bash
# macOS
brew install k6
# Linux (Debian/Ubuntu)
sudo gpg -k && \
  sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg \
    --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69 && \
  echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" \
    | sudo tee /etc/apt/sources.list.d/k6.list && sudo apt update && sudo apt install k6
# Docker
docker run --rm -i grafana/k6 run - < load-tests/public-read.js
```

## Scale profiles

Pick the concurrency target with `SCALE` (virtual users): `100`, `1k`, `5k`, `10k`
(default `100`). Each profile ramps up, holds the peak, then ramps down — see
[options.js](options.js).

```bash
# Read path (safe anywhere — public endpoints + sharded availability counter)
k6 run -e SCALE=100 -e BASE_URL=http://localhost:3000 load-tests/public-read.js
k6 run -e SCALE=1k  -e BASE_URL=https://boostifymusic.com load-tests/public-read.js
k6 run -e SCALE=10k -e BASE_URL=https://boostifymusic.com -e EVENT_ID=123 load-tests/public-read.js
```

## Seat-map hold contention ("Ticketmaster moment")

Stresses the `SELECT … FOR UPDATE SKIP LOCKED` hold path and the sharded
availability counters with thousands of buyers fighting for the same seats.

> ⚠️ **Use a STAGING reserved-seating event.** The hold/release calls mutate seat
> state — never point this at a real on-sale. Holds auto-expire after 10 min and
> each VU releases its own hold, so inventory recycles during the run.

```bash
k6 run -e SCALE=1k -e EVENT_ID=123 -e BASE_URL=http://localhost:3000 load-tests/seat-map-holds.js
```

Healthy results: `holds_succeeded` grows, `holds_conflict_409` is non-zero
(anti double-sell correctly rejecting contested seats — **expected**, not a
failure), and `app_errors` (5xx) stays under the 2% threshold.

## Suggested ramp

Run the ladder and watch DB CPU / connection pool / p95 latency at each rung:

```bash
for S in 100 1k 5k 10k; do
  k6 run -e SCALE=$S -e BASE_URL=http://localhost:3000 load-tests/public-read.js
done
```

## Thresholds

Defined in [options.js](options.js): `http_req_failed < 2%`, `p95 < 800ms`,
`p99 < 2s`. k6 exits non-zero if a threshold is breached — wire it into CI to
catch regressions.
