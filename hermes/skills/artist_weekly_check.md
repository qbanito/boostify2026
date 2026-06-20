# Skill: Artist Weekly Health Check
# Hermes Agent Skill for Boostify Artists
#
# This skill runs every Monday and delivers a comprehensive
# artist performance report via Telegram/Discord/WhatsApp.
#
# CRON: 0 9 * * 1  (Mondays at 9:00 AM)
# USAGE: /artist_weekly_check [artist_id]

## Purpose
Run a complete weekly health check for a Boostify artist and send
a concise, actionable report to the artist or their manager.

## Steps

### Step 1: Load Artist Context
Call `get_artist_memory` to recall who this artist is, their goals, and recent history.
Call `get_artist_goals` to know their current 90-day priorities.

### Step 2: Check Music Presence
Call `get_artist_songs` to see their catalog.
Note: count of songs, most recent release date, genres.

### Step 3: Web Research
Use web_search to find:
- Any mentions of the artist in Google News this week
- New songs from competitors in their genre (to flag trends)
- Any trending sounds/challenges relevant to their genre on TikTok

Search queries to use:
- "[artist name] music 2026"
- "[genre] trending songs this week"  
- "new [genre] artist viral 2026"

### Step 4: Blueprint Check
Call `get_artist_blueprint` and check:
- Are they on track with their 90-day priority?
- What content frequency does their strategy recommend?
- What's their next recommended release action?

### Step 5: Build the Report
Format the report as follows:

```
🎵 WEEKLY ARTIST REPORT — [Artist Name]
📅 Week of [DATE]

PERFORMANCE SNAPSHOT
━━━━━━━━━━━━━━━━━
🎧 Songs in catalog: [X]
📅 Last release: [date or "No recent release"]
🌍 Platforms active: [list]

CONTENT STATUS
━━━━━━━━━━━━━
✅ / ⚠️ Content this week: [posted/not posted]
🎯 This week's content goal: [from blueprint]

TRENDING IN YOUR GENRE
━━━━━━━━━━━━━━━━━━━━
[Top 2-3 findings from web research]

NEWS MENTIONS
━━━━━━━━━━━━
[Any mentions found, or "No press mentions this week"]

🔥 THIS WEEK'S TOP ACTION
━━━━━━━━━━━━━━━━━━━━━━━
[Single most impactful action from blueprint + current context]

💡 OPPORTUNITY
[One specific opportunity spotted in research]
```

### Step 6: Save to Memory
Call `update_artist_notes` with:
```
- Last weekly check: [DATE]
- Weekly action suggested: [the top action]
- Notable trend spotted: [trend]
```

### Step 7: Deliver
Send the report to the artist via the current messaging platform.

## Notes
- Keep the report punchy and actionable — max 300 words
- If artist has no blueprint yet, top action = "Generate your Superstar Blueprint at boostifymusic.com"  
- Always end with ONE clear action item, not a list of 10 things
- Use the artist's native language if detected (Spanish/English)
