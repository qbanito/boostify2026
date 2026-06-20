# 🎵 Boostify Music - Investor Outreach Automation Setup

## Overview

This document explains how to set up the automated investor outreach system that runs daily via GitHub Actions.

## How It Works

```
┌─────────────────────────────────────────────────────────────┐
│                   GITHUB ACTIONS (Daily)                     │
├─────────────────────────────────────────────────────────────┤
│  1. Check Lead Count                                         │
│     ↓                                                        │
│  2. If leads < 100, scrape new from Apify                   │
│     ↓                                                        │
│  3. Send personalized emails (max 50/day)                   │
│     ↓                                                        │
│  4. Send follow-ups to 3-day-old leads                      │
│     ↓                                                        │
│  5. Generate report                                          │
└─────────────────────────────────────────────────────────────┘
```

## GitHub Secrets Configuration

Go to your GitHub repository → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

Add these secrets:

### Required Secrets

| Secret Name | Value | Where to Find |
|-------------|-------|---------------|
| `FIREBASE_PROJECT_ID` | `artist-boost` | Your Firebase project ID |
| `FIREBASE_CLIENT_EMAIL` | `firebase-adminsdk-fbsvc@artist-boost.iam.gserviceaccount.com` | From Firebase service account |
| `FIREBASE_PRIVATE_KEY` | `-----BEGIN PRIVATE KEY-----\n...` | Full private key with `\n` |
| `APIFY_API_KEY` | `apify_api_nrudThRO...` | From Apify Console |
| `RESEND_API_KEY` | `re_KBRrLf8o...` | From Resend Dashboard |

### How to Get Each Secret

#### Firebase Keys
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select project "artist-boost"
3. Settings → Service Accounts → Generate new private key
4. Copy values from the JSON file

#### Apify API Key
1. Go to [Apify Console](https://console.apify.com/)
2. Settings → Integrations → API Token
3. Copy the token: `apify_api_nrudThRO1hQ9XCTFzUZkRI0VKCcSkv2h3mYq`

#### Resend API Key
1. Go to [Resend Dashboard](https://resend.com/)
2. API Keys → Create API Key
3. Copy the key: `re_KBRrLf8o_6CnSiPVBXuCGJ2tvnyxt5W3i`

## Schedule

The automation runs automatically:

- **When**: Monday to Friday at 9:00 AM EST (14:00 UTC)
- **What**: Sends up to 50 personalized emails per day
- **Follow-ups**: Automatically sent to leads contacted 3+ days ago

## Manual Execution

You can run the workflow manually:

1. Go to **Actions** tab in GitHub
2. Select "🎵 Investor Outreach Automation"
3. Click **Run workflow**
4. Options:
   - `max_emails`: Number of emails to send (default: 50)
   - `dry_run`: Set to true for preview without sending

## Local Testing

```bash
# Test locally with dry run
npx tsx scripts/automated-outreach.ts --dry-run

# Send 10 emails
npx tsx scripts/automated-outreach.ts --max 10

# Full run (50 emails)
npx tsx scripts/automated-outreach.ts
```

## Available Commands

```bash
# View statistics
npx tsx scripts/investor-outreach.ts stats

# Quick outreach (50 emails)
npx tsx scripts/investor-outreach.ts quick --force

# Send follow-ups
npx tsx scripts/investor-outreach.ts followup --force

# Import from Apify dataset
npx tsx scripts/import-apify-leads.ts

# Full automated outreach with intelligence
npx tsx scripts/automated-outreach.ts
```

## Email Templates

The system uses 5 different email templates with A/B variations:

1. **VC Fund Email** - For venture capital partners
2. **Record Label Email** - For music industry executives
3. **Generic Investor Email** - For angel investors and others
4. **Follow-up Email** - For leads not responding
5. **Second Follow-up Email** - Final attempt

## Monitoring

### View Reports
After each run, a JSON report is generated and saved as an artifact in GitHub Actions.

### Check Logs
1. Go to **Actions** tab
2. Click on a workflow run
3. View logs for detailed execution info

## Rate Limits

- **Daily email limit**: 50 emails (configurable)
- **Apify scraping**: 300 seconds timeout per search
- **Follow-up delay**: 3 days after initial contact

## Troubleshooting

### "Firebase not initialized"
- Check that all Firebase secrets are correctly set
- Ensure `FIREBASE_PRIVATE_KEY` includes `\n` characters

### "Apify actor failed"
- Verify `APIFY_API_KEY` is valid
- Check Apify account has credits

### "No leads found"
- Run `npx tsx scripts/import-apify-leads.ts` to import from dataset
- Check Firestore database for lead records

## Support

For issues, check the GitHub Actions logs or run locally with `--dry-run` to debug.
