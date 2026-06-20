# Skill: Competitor Analysis
# Hermes Agent Skill for Boostify Artists
#
# Research 5 competitor artists in the same genre and produce
# an actionable gap analysis report.
#
# USAGE: /competitor_analysis [artist_id]

## Purpose
Identify what successful similar artists are doing and find
gaps/opportunities the Boostify artist can exploit.

## Steps

### Step 1: Know the Artist
Call `get_artist_profile` to get genre, location, career stage.
Call `get_artist_blueprint` and look at the "competition" module if it exists.

### Step 2: Find Competitors
Use web_search to find:
- "top emerging [genre] artists 2026"
- "[genre] artists from [location] 2026"
- "similar artists to [artist name]"
- "best new [genre] songs 2026 Spotify"

Identify 5 competitor/comparable artists.

### Step 3: Research Each Competitor
For each of the 5 artists, research:
- Their Instagram following and post frequency
- Their most recent release and its reception
- Their content style (Reels, posts, TikTok strategy)
- What makes their brand distinctive
- Any recent press or viral moments

Use web_search for each: "[artist name] Instagram followers 2026"

### Step 4: Identify Gaps
Compare each competitor to the Boostify artist and find:
- Content types the artist isn't doing that work for competitors
- Audience segments not currently targeted
- Platform gaps (e.g., competitor dominates TikTok, our artist doesn't)
- Collaboration opportunities (is there overlap in fan bases?)

### Step 5: Build Report

```
🔍 COMPETITOR ANALYSIS — [Artist Name]
Genre: [genre] | Location: [location]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TOP 5 COMPARABLE ARTISTS
━━━━━━━━━━━━━━━━━━━━━━━
1. [Name] — [X]K followers | [what's working for them]
2. [Name] — [X]K followers | [what's working]
3. [Name] — [X]K followers | [what's working]
4. [Name] — [X]K followers | [what's working]
5. [Name] — [X]K followers | [what's working]

KEY GAPS & OPPORTUNITIES
━━━━━━━━━━━━━━━━━━━━━━━
🎯 Gap 1: [specific gap + opportunity]
🎯 Gap 2: [specific gap + opportunity]
🎯 Gap 3: [specific gap + opportunity]

CONTENT STRATEGIES TO STEAL
━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ [Strategy 1 that competitors use successfully]
✅ [Strategy 2]
✅ [Strategy 3]

COLLAB TARGETS
━━━━━━━━━━━━━
🤝 [Artist A] — [why they'd be a good collab + how to reach]
🤝 [Artist B] — [why + how]

🔥 TOP RECOMMENDATION
[Single most impactful action based on this research]
```

### Step 6: Save Insights
Call `update_artist_notes` with discovered competitor names and key insights.

## Notes
- Focus on ACTIONABLE insights, not just data
- Competitors should be in the same career stage (emerging vs. established)
- Look for whitespace in the market — what no one is doing
- Identify at least one potential collaboration target
