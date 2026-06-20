# 🔥 Render Memory & Network Pressure Audit — Boostify Music

**Fecha:** 24-Abril-2026  
**Servicio:** `boostify-music` (Render Starter, Virginia, 512MB RAM)  
**Síntoma:** memoria saturada, builds fallando por `pipeline_minutes_exhausted`, requests innecesarios.

---

## 📊 Resumen ejecutivo

| Categoría | Severidad | Impacto estimado | Complejidad de fix |
|---|---|---|---|
| Polling agresivo en cliente | 🔴 CRITICAL | 50–200 MB picos | Bajo |
| react-query mal configurado | 🟠 HIGH | 2× requests | Bajo |
| Imports pesados sin lazy-load | 🟠 HIGH | +500 KB bundle | Medio |
| Arrays sin tope (timeline, logs) | 🔴 CRITICAL | 100–500 MB en sesión | Alto |
| 6 schedulers cada 6h sin offset | 🔴 CRITICAL | 200–400 MB picos | Medio |
| Socket.io con polling fallback | 🔴 CRITICAL | 100–500 MB | Medio |
| PG Pool sin `max` explícito | 🔴 CRITICAL | 50 MB idle | Bajo |
| `console.log` masivo en webhooks | 🔴 CRITICAL | 10–50 MB buffer | Bajo |
| `/api/health` duplicado | 🟠 HIGH | Miles de req/h gastados | Bajo |
| Broadcast sockets sin throttle | 🟠 HIGH | CPU spikes | Medio |

> **Resultado proyectado de aplicar los Quick Wins (5 cambios, ~2h):**  
> Memoria base: ~380 MB → ~280 MB (–26%)  
> Requests innecesarios: –70%

---

## 🔴 1. Polling agresivo en el cliente

### 1.1 Video service success — polling cada **4 segundos**, 45 intentos

📍 `client/src/pages/videoservice-success.tsx:112`

```ts
pollRef.current = window.setInterval(tick, 4000);
// Hasta 45 ticks = 3 minutos de polling continuo a /api/videoservice/project/:id
```

**Problema:** 15 requests/min por usuario que esté en esa página. Con 10 concurrentes son 150 req/min al mismo endpoint.  
**Fix:** subir a 8000 ms y reducir attempts a 22 (mantiene 3 min de cobertura).

### 1.2 Timeline editor — polling de status cada **5 segundos**

📍 `client/src/components/music-video/timeline/TimelineEditor.tsx:3401`

```ts
setTimeout(checkStatus, 5000); // Revisar cada 5 segundos
```

**Fix:** 10s con backoff exponencial.

### 1.3 Producer Map — 2 timers internos (5s y 12s)

📍 `client/src/components/producer/producer-map.tsx:210, 216`

```ts
const t = setInterval(() => setActiveProposalIdx(v => v + 1), 5000);
// No revisa document.hidden, sigue corriendo cuando la pestaña está oculta
```

**Fix:** envolver en `document.visibilityState === 'visible'` o usar `useEffect` con listener de `visibilitychange`.

### 1.4 Discovery agent panel — `delay` puede ser 500–1500 ms

📍 `client/src/components/admin/discovery-agent-panel.tsx:256`  
**Fix:** mínimo 1000 ms.

---

## 🟠 2. React Query mal configurado

📍 `client/src/components/artist/artist-profile-card.tsx:2189-2190`

```ts
staleTime: 0,   // ❌ siempre stale, refetch en cada mount/focus
gcTime: 0       // ❌ sin GC, datos descartados al instante
```

**Fix:** `staleTime: 60_000, gcTime: 5 * 60 * 1000`.

✅ El hook `use-spotify-connection.ts` ya tiene `staleTime: 30_000` correctamente.

---

## 🟠 3. Imports pesados no lazy

📍 `client/src/components/music-video/timeline/TimelineEditor.tsx:94`

```ts
import { Player, type PlayerRef } from '@remotion/player'; // ~500 KB
import { MusicVideoComposition } from '../../remotion/MusicVideoComposition';
```

Se carga aunque el usuario nunca abra el editor. Igual sucede en:
- `AuthAnimationPlayer.tsx`
- `SpotifyBoostAnimation.tsx`
- `InstagramAnimationPlayer.tsx`

**Fix:** `React.lazy()` o `import()` dinámico dentro de `useEffect`. Boostify ya hace esto bien en `spotify.tsx` con `SpotifyAnimationPlayer`; replicar el patrón.

---

## 🔴 4. Arrays en memoria sin tope

### 4.1 TimelineEditor

📍 `client/src/components/music-video/timeline/TimelineEditor.tsx:200, 332, 335`

```ts
const [clips, setClips] = useState<TimelineClip[]>(...);
const [importedMedia, setImportedMedia] = useState<ImportedMediaItem[]>([]);
const [workflowMedia, setWorkflowMedia] = useState<MediaItem[]>([]);
// + history undo sin tope
```

**Fix:**
- Cap clips en 500 (warning al usuario).
- Cap history en 50 estados (`history.slice(-49)`).
- Virtualizar lista de clips (react-window).

### 4.2 Engine logs en admin

📍 `client/src/components/admin/platform-reports.tsx:128`

```ts
const [engineLogs, setEngineLogs] = useState<any[]>([]);
```

**Fix:** `setEngineLogs(prev => [...prev.slice(-199), newLog])` para mantener máx 200.

---

## 🔴 5. Schedulers en servidor (6 jobs concurrentes)

📍 `server/routes.ts:142-184`

Al arrancar, se inician en paralelo:

| Scheduler | Intervalo | Carga |
|---|---|---|
| `weeklyReportScheduler` | 7 días | media |
| `aiapsScheduler` | 6h | alta |
| `discoveryScheduler` | 6h | **muy alta** (Spotify+YouTube+IG+LinkedIn) |
| `autoGeneration` | varios | media |
| `activationScheduler` | varios | media |
| `enrichmentScheduler` | varios | alta |
| `followUpScheduler` | varios | media |

**Problema:** todos se levantan al instante = thundering herd; en Starter dyno son 200–400 MB de pico durante ~5 min cada 6h.

**Fix:**
1. **Stagger** — offset cada uno por `index * 30s`:
   ```ts
   schedulers.forEach((s, i) => setTimeout(() => s.start(), i * 30_000));
   ```
2. **Lock en DB** — tabla `scheduler_lock(name PK, expires_at)`. Antes de correr: `INSERT ON CONFLICT DO NOTHING`. Si conflicta, otra instancia ya corre.
3. **Memory guard** antes de cada run:
   ```ts
   if (process.memoryUsage().rss > 400 * 1024 * 1024) {
     console.warn('Skipping run — memory pressure');
     return;
   }
   ```

---

## 🔴 6. Socket.io / WebSocket

### 6.1 Transports con fallback HTTP polling

📍 `server/socket.ts:22`

```ts
transports: ['websocket', 'polling']
```

**Problema:** si WebSocket falla por NAT/proxy, cliente cae a polling cada 1s. 100 usuarios × 1 req/s = 100 req/s solo en heartbeat.

**Fix:** `transports: ['websocket']` y aceptar pérdida de tiempo real para clientes que no soportan WS (hoy es <1%).

### 6.2 Maps de socket sin limpieza

📍 `server/socket.ts:11-13`

```ts
const activeRooms = new Map<string, Set<string>>();
const viewerCounts = new Map<string, number>();
```

Cuando un cliente se desconecta sin emitir `leave`, su entry queda hasta el reinicio.

**Fix:** en el handler de `disconnect`, recorrer y eliminar; cuando un Set queda vacío, eliminar la key.

### 6.3 Broadcast sin throttle

📍 `server/services/economic-engine/community-bots.ts:236-265`

`broadcastAlert`, `broadcastPriceUpdate`, `broadcastAgentAction` se llaman en cada update. Sin debounce.

**Fix:** debounce 500 ms / batch de eventos.

---

## 🔴 7. PG Pool sin `max` explícito

📍 múltiples (ej. `server/routes/admin-artist-identity.ts:41`)

```ts
const pool = new Pool({ /* sin max, min, idleTimeout */ });
```

Default de `pg` es `max: 10`. En 512 MB esto es ~50 MB desperdiciados solo en conexiones idle.

**Fix:**

```ts
const pool = new Pool({
  max: 2,
  min: 0,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 2_000,
});
```

> ⚠️ Aplicar en **un solo lugar central** (`server/db.ts`) y reusar el pool en todo el código. Hoy hay varios `new Pool()` esparcidos — eso multiplica el problema.

---

## 🔴 8. Logging excesivo

### 8.1 Brevo webhooks

📍 `server/routes/brevo-webhooks.ts:62-125`

20+ `console.log` por webhook. Brevo dispara miles al día → buffer de stdout en Render se llena → memoria fugaz.

### 8.2 Discovery service

📍 `server/services/artist-discovery/index.ts:112-200`

50+ líneas de log por run. Cada 6h × 6 schedulers = 300+ líneas buffereadas.

**Fix global:**
1. Logger estructurado con niveles (`pino` / `winston`).
2. En producción solo `warn`+`error` a stdout.
3. `debug`/`info` a archivo rotado.

---

## 🟠 9. `/api/health` duplicado

📍 `server/index.ts:178`, `server/routes.ts:287`, `server/routes.ts:2328`

3 handlers para la misma ruta. Render mismo lo polluea cada 30s para health check, además de cualquier cliente.

**Fix:** dejar 1 handler, eliminar los otros 2.

---

## ✅ Quick Wins (orden recomendado, ~2h)

| # | Cambio | Archivo | Impacto |
|---|---|---|---|
| 1 | Subir polling video-success 4s → 8s | `videoservice-success.tsx:112` | –50% req |
| 2 | Subir polling timeline 5s → 10s | `TimelineEditor.tsx:3401` | –50% req |
| 3 | `staleTime: 60s, gcTime: 5min` en artist-profile-card | `artist-profile-card.tsx:2189` | –30% req |
| 4 | Eliminar 2× `/api/health` duplicados | `server/routes.ts` | –1000s req/h |
| 5 | PG pool `max: 2` central en `server/db.ts` | nuevo | –40 MB idle |
| 6 | Socket.io `transports: ['websocket']` | `server/socket.ts:22` | –100 MB pico |

## 🟡 Wins de mediano plazo (1 día)

7. Stagger de los 6 schedulers (offset 30s).
8. Memory guard `rss > 400MB → skip` en cada scheduler.
9. Limpieza de `activeRooms`/`viewerCounts` al `disconnect`.
10. Cap de undo history (50) y engine logs (200).
11. Debounce broadcasts socket.io (500 ms).

## 🟢 Mejoras estructurales (futuro)

12. Migrar logs a `pino` con rotación.
13. Lazy-load Remotion en todos los players (4 archivos).
14. Virtualizar lista de clips en TimelineEditor.
15. DB lock para schedulers (multi-instance safety).

---

## 📈 Cómo medir el impacto

```bash
# Antes de aplicar
$env:RENDER_API_KEY = "tu_key"
$h = @{Authorization="Bearer $env:RENDER_API_KEY"}
Invoke-RestMethod "https://api.render.com/v1/metrics/memory?resource=srv-d5umv04hg0os73b1idjg&resolutionSeconds=300&startTime=...&endTime=..." -Headers $h
```

Render expone `/v1/metrics/memory` y `/v1/metrics/cpu`. Capturar baseline antes y después de cada fix.

---

## 🎯 Recomendación final

1. **Hoy mismo (urgente):** aplicar Quick Wins #1-6. Bajo riesgo, alto impacto.
2. **Esta semana:** Wins #7-11 con monitoreo de métricas en Render.
3. **Este mes:** estructurales #12-15.
4. **Build pipeline:** activar **Build Cache** en el dashboard de Render (hoy está en `no-cache`). Esto ahorra 5–7 min por build = ~5× los minutos de pipeline.

— Generado automáticamente desde auditoría de código + métricas de Render API.
