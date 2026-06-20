# Skill: Content Calendar Generator
# Hermes Agent Skill for Boostify Artists
#
# Generates a 30-day content calendar based on the artist's
# blueprint strategy, current trends, and upcoming releases.
#
# USAGE: /content_calendar [artist_id] [month]

## Purpose
Create a detailed 30-day social media content calendar tailored to
the artist's genre, voice, audience, and strategic goals.

## Steps

### Step 1: Load Artist DNA
Call `get_artist_soul` to understand their voice and content style.
Call `get_artist_goals` to know their priorities this month.
Call `get_artist_songs` to identify songs to promote.

### Step 2: Research Trends
Use web_search to find:
- "[genre] content trends [current month] 2026"
- "viral [genre] TikTok challenges [current month]"
- "[genre] Instagram trends 2026"

### Step 3: Build Calendar Structure
Plan 4 weeks with 3-4 posts each:

**Week 1 — ESTABLISH** (brand/identity focused)
**Week 2 — ENGAGE** (interaction/community focused)  
**Week 3 — PROMOTE** (song/product focused)
**Week 4 — CONNECT** (personal/behind-the-scenes)

### Step 4: Generate Each Post
For each day, write:
- Platform (Instagram/TikTok/Twitter)
- Content type (Reel, Carousel, Story, Tweet, etc.)
- Caption (in artist's voice)
- Hashtags (genre-specific)
- Call-to-action
- Best time to post

### Step 5: Save Posts
Call `create_social_post` for each post in the calendar.
Use scheduled_for parameter to set the target date.

### Step 6: Deliver Summary
Send a compact calendar overview:
```
📅 30-DAY CONTENT CALENDAR — [Artist Name]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

WEEK 1 — ESTABLISH YOUR BRAND
  Mon: Instagram Reel — [topic]
  Wed: TikTok — [topic]
  Fri: Instagram Post — [topic]
  
WEEK 2 — ENGAGE YOUR AUDIENCE
  [etc.]
  
✅ [N] posts queued in Boostify content calendar
🎯 Strategy: [one sentence on the overall theme]
```

## Notes
- Adapt language to match artist's style (casual/professional/slang)
- Mix promotional and non-promotional content (70/30 ratio)
- Always include at least 2 song promotion posts per month
- Flag major holidays/events in the genre community
