"""OpenMontage sidecar — FastAPI wrapper de tools deterministas.

LICENCIA: este archivo importa OpenMontage (AGPL-3.0) → este servicio es
AGPL-3.0. Ver README.md. Se despliega como proceso/imagen independiente;
Boostify solo lo consume por HTTP.

Solo expone tools deterministas de la whitelist — nada de pipelines agentic
(OpenMontage no tiene orquestador headless; el agente es el orquestador).
"""
from __future__ import annotations

import os
import subprocess
import sys
import threading
import uuid
from typing import Any, Dict

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel

OM_ROOT = os.environ.get("OM_ROOT", "/srv/openmontage")
SERVICE_TOKEN = os.environ.get("OM_SERVICE_TOKEN", "")
sys.path.insert(0, OM_ROOT)

app = FastAPI(title="OpenMontage Sidecar", version="0.1.0")

# jobId -> {status, result?, error?}
JOBS: Dict[str, Dict[str, Any]] = {}
JOBS_LOCK = threading.Lock()

ALLOWED_TOOLS = {"slideshow_risk", "video_probe", "scene_detect"}


class JobRequest(BaseModel):
    tool: str
    params: Dict[str, Any] = {}


def _check_token(token: str | None) -> None:
    if SERVICE_TOKEN and token != SERVICE_TOKEN:
        raise HTTPException(status_code=401, detail="invalid token")


def _run_slideshow_risk(params: Dict[str, Any]) -> Dict[str, Any]:
    """Scoring de riesgo slideshow usando lib/slideshow_risk.py de OpenMontage."""
    from lib import slideshow_risk  # type: ignore

    edit_decisions = params.get("edit_decisions")
    if not isinstance(edit_decisions, dict):
        raise ValueError("params.edit_decisions (objeto JSON) requerido")
    # La lib expone score sobre el artefacto edit_decisions
    fn = getattr(slideshow_risk, "score_edit_decisions", None) or getattr(
        slideshow_risk, "score", None
    )
    if fn is None:
        raise RuntimeError("slideshow_risk API no encontrada en esta versión de OpenMontage")
    return {"risk": fn(edit_decisions)}


def _run_video_probe(params: Dict[str, Any]) -> Dict[str, Any]:
    """ffprobe estructurado (no requiere OpenMontage, pero vive aquí por cercanía)."""
    url = str(params.get("url", ""))
    if not url.startswith(("http://", "https://")):
        raise ValueError("params.url http(s) requerido")
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-print_format", "json", "-show_format", "-show_streams", url],
        capture_output=True,
        timeout=60,
        text=True,
        check=True,
    )
    import json

    return {"probe": json.loads(out.stdout or "{}")}


def _run_scene_detect(params: Dict[str, Any]) -> Dict[str, Any]:
    """Detección de escenas vía tool de OpenMontage (tools/analysis)."""
    from tools.tool_registry import registry  # type: ignore

    registry.discover()
    tool = registry.get("scene_detect") if hasattr(registry, "get") else None
    if tool is None:
        raise RuntimeError("scene_detect tool no disponible en esta versión de OpenMontage")
    return {"scenes": tool.run(**params)}


RUNNERS = {
    "slideshow_risk": _run_slideshow_risk,
    "video_probe": _run_video_probe,
    "scene_detect": _run_scene_detect,
}


def _execute(job_id: str, tool: str, params: Dict[str, Any]) -> None:
    try:
        result = RUNNERS[tool](params)
        with JOBS_LOCK:
            JOBS[job_id] = {"status": "ready", "result": result}
    except Exception as exc:  # noqa: BLE001 — degradar a error de job
        with JOBS_LOCK:
            JOBS[job_id] = {"status": "failed", "error": str(exc)}


@app.get("/health")
def health() -> Dict[str, Any]:
    return {"status": "ok", "tools": sorted(ALLOWED_TOOLS), "omRoot": os.path.isdir(OM_ROOT)}


@app.post("/jobs")
def submit_job(body: JobRequest, x_om_token: str | None = Header(default=None)) -> Dict[str, Any]:
    _check_token(x_om_token)
    if body.tool not in ALLOWED_TOOLS:
        raise HTTPException(status_code=400, detail=f"tool no permitida: {body.tool}")
    job_id = uuid.uuid4().hex[:16]
    with JOBS_LOCK:
        JOBS[job_id] = {"status": "pending"}
    threading.Thread(target=_execute, args=(job_id, body.tool, body.params), daemon=True).start()
    return {"jobId": job_id, "status": "pending"}


@app.get("/jobs/{job_id}")
def get_job(job_id: str, x_om_token: str | None = Header(default=None)) -> Dict[str, Any]:
    _check_token(x_om_token)
    with JOBS_LOCK:
        job = JOBS.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="job no encontrado")
    return {"jobId": job_id, **job}
