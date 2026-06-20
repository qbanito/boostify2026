"""
==============================================================
  BOOSTIFY CUSTOM TOOLS FOR HERMES AGENT
==============================================================

Place this file at: ~/.hermes/skills/boostify-tools/boostify_tools.py
OR load it as a custom toolset via hermes config.

These tools give Hermes Agent full access to the Boostify
platform API, allowing it to:
  - Read and update artist profiles
  - Access song catalogs and performance data
  - View strategic blueprints
  - Create content posts
  - Track artist goals
  - Monitor analytics

Usage in Hermes:
  After placing this file, run:
    hermes tools  # Should show Boostify tools listed
  
  Or load manually:
    /tools enable boostify

Configuration:
  Set these env vars in your Hermes config or ~/.hermes/.env:
    BOOSTIFY_API_URL=http://localhost:3000
    HERMES_API_SECRET=your-secret-here (must match .env on server)
    BOOSTIFY_ARTIST_ID=1391  (default artist ID to work with)
"""

import os
import json
import requests
from typing import Optional

# ─── Config ───────────────────────────────────────────────────────────────────

BOOSTIFY_API_URL = os.environ.get("BOOSTIFY_API_URL", "http://localhost:3000")
HERMES_API_SECRET = os.environ.get("HERMES_API_SECRET", "")
DEFAULT_ARTIST_ID = os.environ.get("BOOSTIFY_ARTIST_ID", "")

def _headers() -> dict:
    """Build auth headers for Boostify API calls."""
    h = {"Content-Type": "application/json"}
    if HERMES_API_SECRET:
        h["x-hermes-secret"] = HERMES_API_SECRET
    return h

def _api(path: str, method: str = "GET", data: Optional[dict] = None) -> dict:
    """Base API caller with error handling."""
    url = f"{BOOSTIFY_API_URL}/api/hermes{path}"
    try:
        if method == "GET":
            resp = requests.get(url, headers=_headers(), timeout=30)
        elif method == "POST":
            resp = requests.post(url, headers=_headers(), json=data or {}, timeout=30)
        elif method == "PATCH":
            resp = requests.patch(url, headers=_headers(), json=data or {}, timeout=30)
        else:
            return {"error": f"Unsupported method: {method}"}

        if resp.status_code == 200:
            return resp.json()
        else:
            return {"error": f"HTTP {resp.status_code}: {resp.text[:500]}"}
    except requests.exceptions.ConnectionError:
        return {"error": f"Cannot connect to Boostify at {BOOSTIFY_API_URL}. Is the server running?"}
    except Exception as e:
        return {"error": str(e)}


# ─── Tools ────────────────────────────────────────────────────────────────────

def get_artist_profile(artist_id: Optional[str] = None) -> str:
    """
    Get the full profile of a Boostify artist including bio, genre, location,
    social platforms, song count, and blueprint summary.
    
    Args:
        artist_id: Boostify artist ID (integer). If omitted, uses BOOSTIFY_ARTIST_ID env var.
    
    Returns:
        JSON string with artist data.
    """
    aid = artist_id or DEFAULT_ARTIST_ID
    if not aid:
        return json.dumps({"error": "artist_id is required. Set BOOSTIFY_ARTIST_ID env var or pass it directly."})
    
    result = _api(f"/artist/{aid}")
    return json.dumps(result, indent=2)


def get_artist_memory(artist_id: Optional[str] = None) -> str:
    """
    Get the artist's MEMORY.md file — their persistent memory profile
    including identity, bio, songs, platforms, brand essence, and notes.
    
    Args:
        artist_id: Boostify artist ID.
    
    Returns:
        Markdown text of the artist's memory file.
    """
    aid = artist_id or DEFAULT_ARTIST_ID
    if not aid:
        return "Error: artist_id required."
    
    result = _api(f"/artist/{aid}/memory")
    if "error" in result:
        return f"Error: {result['error']}"
    return result.get("content", "No memory content found.")


def get_artist_soul(artist_id: Optional[str] = None) -> str:
    """
    Get the artist's SOUL.md — personality, voice, communication style,
    and brand guidelines used when creating content AS or FOR the artist.
    
    Args:
        artist_id: Boostify artist ID.
    
    Returns:
        Markdown text of the artist's soul file.
    """
    aid = artist_id or DEFAULT_ARTIST_ID
    if not aid:
        return "Error: artist_id required."
    
    result = _api(f"/artist/{aid}/soul")
    if "error" in result:
        return f"Error: {result['error']}"
    return result.get("content", "No soul content found.")


def get_artist_blueprint(artist_id: Optional[str] = None) -> str:
    """
    Get the artist's full 13-module Superstar Blueprint — the comprehensive
    strategic plan including DNA, identity, sound, distribution, monetization,
    content strategy, PR, collaborations, and more.
    
    Args:
        artist_id: Boostify artist ID.
    
    Returns:
        JSON string with the complete blueprint.
    """
    aid = artist_id or DEFAULT_ARTIST_ID
    if not aid:
        return json.dumps({"error": "artist_id required."})
    
    result = _api(f"/artist/{aid}/blueprint")
    return json.dumps(result, indent=2)


def get_artist_goals(artist_id: Optional[str] = None) -> str:
    """
    Get the artist's current active goals derived from their blueprint.
    Includes 90-day priorities, content goals, release cadence, and monetization targets.
    
    Args:
        artist_id: Boostify artist ID.
    
    Returns:
        JSON string with goals list.
    """
    aid = artist_id or DEFAULT_ARTIST_ID
    if not aid:
        return json.dumps({"error": "artist_id required."})
    
    result = _api(f"/artist/{aid}/goals")
    return json.dumps(result, indent=2)


def get_artist_songs(artist_id: Optional[str] = None) -> str:
    """
    Get the artist's full song catalog with titles, genres, release dates,
    stream counts, and audio/cover URLs.
    
    Args:
        artist_id: Boostify artist ID.
    
    Returns:
        JSON string with songs array.
    """
    aid = artist_id or DEFAULT_ARTIST_ID
    if not aid:
        return json.dumps({"error": "artist_id required."})
    
    result = _api(f"/artist/{aid}/songs")
    return json.dumps(result, indent=2)


def update_artist_notes(
    notes: str,
    artist_id: Optional[str] = None
) -> str:
    """
    Send memory updates back to Boostify to sync new facts about the artist
    into the database. Use markdown key: value format.
    
    Example notes format:
        - Biography: Electronic music artist from Miami, known for dark synth sounds
        - Location: Miami, FL
        - Genre: electronic
        - Instagram: @artisthandle
    
    Args:
        notes: Markdown-formatted key: value pairs to store.
        artist_id: Boostify artist ID.
    
    Returns:
        JSON string with sync result.
    """
    aid = artist_id or DEFAULT_ARTIST_ID
    if not aid:
        return json.dumps({"error": "artist_id required."})
    
    result = _api(f"/artist/{aid}/sync", method="POST", data={"memorySection": notes})
    return json.dumps(result, indent=2)


def create_social_post(
    content: str,
    platform: str = "instagram",
    content_type: str = "post",
    scheduled_for: Optional[str] = None,
    artist_id: Optional[str] = None
) -> str:
    """
    Save a social media content idea or post to the Boostify platform.
    The content will be queued for the artist's content calendar.
    
    Args:
        content: The post text/caption content.
        platform: Target platform (instagram, tiktok, twitter, facebook, youtube).
        content_type: Type of content (post, reel, story, thread, video_caption).
        scheduled_for: ISO datetime string for when to post (optional).
        artist_id: Boostify artist ID.
    
    Returns:
        JSON string with creation result.
    """
    aid = artist_id or DEFAULT_ARTIST_ID
    if not aid:
        return json.dumps({"error": "artist_id required."})
    
    result = _api(
        f"/artist/{aid}/content",
        method="POST",
        data={
            "platform": platform,
            "content": content,
            "contentType": content_type,
            "scheduledFor": scheduled_for,
        }
    )
    return json.dumps(result, indent=2)


def boostify_status() -> str:
    """
    Check if the Boostify API is running and accessible.
    
    Returns:
        JSON string with status info.
    """
    result = _api("/status")
    return json.dumps(result, indent=2)


# ─── Tool registry (Hermes format) ───────────────────────────────────────────
# Hermes Agent reads this to register tools from Python files.

TOOLS = [
    {
        "name": "get_artist_profile",
        "description": "Get full Boostify artist profile — bio, genre, location, social platforms, song count",
        "function": get_artist_profile,
        "parameters": {
            "artist_id": {"type": "string", "description": "Boostify artist ID", "required": False}
        }
    },
    {
        "name": "get_artist_memory",
        "description": "Get artist MEMORY.md — full persistent memory profile in markdown",
        "function": get_artist_memory,
        "parameters": {
            "artist_id": {"type": "string", "description": "Boostify artist ID", "required": False}
        }
    },
    {
        "name": "get_artist_soul",
        "description": "Get artist SOUL.md — personality, voice, and brand guidelines for content creation",
        "function": get_artist_soul,
        "parameters": {
            "artist_id": {"type": "string", "description": "Boostify artist ID", "required": False}
        }
    },
    {
        "name": "get_artist_blueprint",
        "description": "Get artist 13-module Superstar Blueprint — full strategic career plan",
        "function": get_artist_blueprint,
        "parameters": {
            "artist_id": {"type": "string", "description": "Boostify artist ID", "required": False}
        }
    },
    {
        "name": "get_artist_goals",
        "description": "Get artist current goals — 90-day priorities, content targets, release cadence",
        "function": get_artist_goals,
        "parameters": {
            "artist_id": {"type": "string", "description": "Boostify artist ID", "required": False}
        }
    },
    {
        "name": "get_artist_songs",
        "description": "Get artist full song catalog with titles, streams, genres, release dates",
        "function": get_artist_songs,
        "parameters": {
            "artist_id": {"type": "string", "description": "Boostify artist ID", "required": False}
        }
    },
    {
        "name": "update_artist_notes",
        "description": "Save new facts about the artist back to Boostify DB — use after learning new info",
        "function": update_artist_notes,
        "parameters": {
            "notes": {"type": "string", "description": "Markdown key: value facts to store", "required": True},
            "artist_id": {"type": "string", "description": "Boostify artist ID", "required": False}
        }
    },
    {
        "name": "create_social_post",
        "description": "Save a social media post/content idea to the Boostify content calendar",
        "function": create_social_post,
        "parameters": {
            "content": {"type": "string", "description": "Post content/caption", "required": True},
            "platform": {"type": "string", "description": "instagram|tiktok|twitter|facebook|youtube", "required": False},
            "content_type": {"type": "string", "description": "post|reel|story|thread|video_caption", "required": False},
            "scheduled_for": {"type": "string", "description": "ISO datetime to schedule (optional)", "required": False},
            "artist_id": {"type": "string", "description": "Boostify artist ID", "required": False}
        }
    },
    {
        "name": "boostify_status",
        "description": "Check if Boostify API is running and accessible",
        "function": boostify_status,
        "parameters": {}
    },
]


if __name__ == "__main__":
    # Quick test when run directly
    print("🎵 Boostify Tools — Testing connection...")
    status = boostify_status()
    print(status)
    
    if DEFAULT_ARTIST_ID:
        print(f"\n📋 Testing artist {DEFAULT_ARTIST_ID}...")
        profile = get_artist_profile()
        data = json.loads(profile)
        if data.get("success"):
            print(f"✅ Artist: {data['data']['artistName']} ({data['data']['genre']})")
        else:
            print(f"❌ Error: {data.get('error')}")
    else:
        print("ℹ️  Set BOOSTIFY_ARTIST_ID env var to test artist data tools")
