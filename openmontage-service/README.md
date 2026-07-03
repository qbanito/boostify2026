# OpenMontage Sidecar Service (Fase 2)

Microservicio **opcional** que envuelve las herramientas deterministas de
[OpenMontage](https://github.com/calesthio/OpenMontage) (AGPL-3.0) para que
Boostify pueda usarlas **sin ejecutar código AGPL en su propio proceso**.

## Arquitectura

```
Boostify (Express)  ──HTTP──▶  este sidecar (FastAPI)  ──import──▶  OpenMontage tools/
   server/routes/openmontage.ts     app.py (proceso separado)         (clonado en build)
```

- Boostify solo habla HTTP con este servicio (`OPENMONTAGE_SERVICE_URL`).
- Este servicio SÍ es un trabajo derivado de OpenMontage → **licencia AGPL-3.0**
  (ver nota de licencia abajo). Por eso vive en su propia carpeta/imagen y
  nunca se importa desde el código de Boostify.
- OpenMontage NO trae orquestador headless (el agente de código es el
  orquestador), así que este sidecar expone solo las **tools deterministas**
  que sí son invocables programáticamente: análisis de riesgo slideshow,
  probe de video, detección de escenas.

## Deploy (Render)

1. Crear un nuevo repo (o subcarpeta con root-dir) con el contenido de esta carpeta.
2. Render → New Web Service → Docker. Root Directory: esta carpeta.
3. Env vars:
   - `OM_SERVICE_TOKEN` — token compartido (el mismo que `OPENMONTAGE_SERVICE_TOKEN` en Boostify).
4. En Boostify (Render env):
   - `OPENMONTAGE_SERVICE_URL=https://<servicio>.onrender.com`
   - `OPENMONTAGE_SERVICE_TOKEN=<mismo token>`

## Endpoints

- `GET /health` → `{status:'ok', tools:[...]}`
- `POST /jobs` `{tool, params}` → `{jobId, status}` (síncrono corto o encolado)
- `GET /jobs/{jobId}` → `{status:'pending'|'ready'|'failed', result?, error?}`

Tools whitelist inicial (`ALLOWED_TOOLS` en app.py):
- `slideshow_risk` — score de riesgo slideshow sobre un edit_decisions JSON.
- `video_probe` — ffprobe estructurado de una URL de video.
- `scene_detect` — detección de límites de escena de un video.

## Nota de licencia (IMPORTANTE)

OpenMontage es **AGPL-3.0**. Este sidecar lo importa → el sidecar completo es
AGPL-3.0 y su código fuente debe estar disponible para quien use el servicio
por red (sección 13 AGPL). Mantenerlo en un repositorio público (o entregar el
fuente bajo petición) y NO mezclar nunca este código con el repo comercial de
Boostify más allá de esta carpeta de scaffold/documentación.

Boostify (el cliente HTTP) NO se ve afectado: interactúa a distancia de brazo
("arms-length") por protocolo de red estándar.
