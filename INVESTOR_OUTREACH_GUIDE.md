# 🎯 Investor Outreach Automation System

## Overview

Automated system for acquiring music industry investors through intelligent lead extraction and personalized email outreach. Sends **100 personalized emails daily** via GitHub Actions.

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    INVESTOR OUTREACH SYSTEM                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐       │
│  │   APIFY      │───▶│   LEAD       │───▶│   EMAIL      │       │
│  │   Scraper    │    │   Database   │    │   Sender     │       │
│  └──────────────┘    └──────────────┘    └──────────────┘       │
│         │                   │                   │                │
│         ▼                   ▼                   ▼                │
│  ┌──────────────────────────────────────────────────────┐       │
│  │              OUTREACH ORCHESTRATOR                    │       │
│  │  • Daily job scheduling                               │       │
│  │  • Lead collection + enrichment                       │       │
│  │  • Template selection + personalization               │       │
│  │  • Follow-up management                               │       │
│  └──────────────────────────────────────────────────────┘       │
│                            │                                     │
│                            ▼                                     │
│  ┌──────────────────────────────────────────────────────┐       │
│  │              GITHUB ACTIONS                           │       │
│  │  • Runs 9 AM EST Mon-Fri                             │       │
│  │  • 100 emails/day limit                              │       │
│  │  • Weekly lead collection on Sundays                 │       │
│  └──────────────────────────────────────────────────────┘       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## 📁 File Structure

```
server/services/investor-outreach/
├── index.ts                    # Central export
├── types.ts                    # TypeScript interfaces
├── apify-lead-scraper.ts       # Lead extraction from LinkedIn/Crunchbase
├── email-templates.ts          # Personalized email generation
├── email-sender.ts             # Resend integration
├── lead-database.ts            # Firebase lead storage
└── outreach-orchestrator.ts    # Main coordination service

scripts/
└── investor-outreach.ts        # CLI runner

.github/workflows/
└── investor-outreach.yml       # GitHub Actions automation
```

## 🚀 Quick Start

### 1. Set Up Environment Variables

Add to your `.env` file:

```env
# Required
RESEND_API_KEY=re_xxxxxxxxxxxxxx
APIFY_API_KEY=apify_api_xxxxxxxxxxxxxx
FIREBASE_SERVICE_ACCOUNT={"type":"service_account",...}

# Optional
HUNTER_API_KEY=xxxxxxxxxxxxxx  # For email verification
DATABASE_URL=postgresql://...    # Neon Postgres
```

### 2. Configure GitHub Secrets

In your repository settings, add:
- `RESEND_API_KEY`
- `APIFY_API_KEY`
- `FIREBASE_SERVICE_ACCOUNT` (JSON string)
- `HUNTER_API_KEY` (optional)
- `DATABASE_URL` (optional)

### 3. Run Locally

```bash
# Full daily outreach (100 emails)
npm run outreach:daily

# Quick batch (25 emails)
npm run outreach:quick

# Collect leads only
npm run outreach:collect

# View statistics
npm run outreach:stats
```

## 📧 Email Templates

### Template Types

| Template ID | Use Case | Target |
|-------------|----------|--------|
| `cold_outreach_direct` | Direct pitch | General investors |
| `cold_outreach_problem` | Problem-focused | VCs |
| `warm_vc_intro` | Warm introduction | VCs with music focus |
| `record_label_exec` | Industry-specific | Label executives |
| `follow_up_3d` | 3-day follow-up | Non-responders |
| `follow_up_7d` | 7-day follow-up | Non-responders |

### Personalization Variables

- `{{firstName}}` - Lead's first name
- `{{company}}` - Company name
- `{{personalHook}}` - AI-generated personalization
- `{{investorUrl}}` - Link to /investors page
- `{{wefunderUrl}}` - Wefunder investment page
- `{{calendarUrl}}` - Scheduling link

## 🎯 Lead Sources

### Apify Search Configurations

1. **Music Industry VCs**
   - Keywords: "music industry venture capital", "entertainment fund"
   - Targets: Series A/B investors in music tech

2. **Record Label Executives**
   - Keywords: "record label A&R", "music business development"
   - Targets: Label execs looking for new tools

3. **Angel Investors**
   - Keywords: "music tech angel investor", "entertainment angel"
   - Targets: Individual investors

4. **Music Tech Investors**
   - Keywords: "music technology investment", "audio tech VC"
   - Targets: Specialized music tech funds

5. **Industry Consultants**
   - Keywords: "music industry consultant", "entertainment advisor"
   - Targets: Potential strategic advisors

## 📊 Lead Lifecycle

```
NEW → CONTACTED → RESPONDED → CONVERTED
                      ↓
                  FOLLOW_UP
                      ↓
               BOUNCED / UNSUBSCRIBED
```

## ⚙️ Configuration

### Default Settings

```typescript
const DEFAULT_CONFIG = {
  dailyEmailLimit: 100,        // Max emails per day
  sendingHoursStart: 9,        // 9 AM UTC
  sendingHoursEnd: 17,         // 5 PM UTC
  delayBetweenEmails: 30,      // 30 seconds
  maxRetriesPerLead: 3,        // Max emails per lead
  followUpDays: [3, 7],        // Follow-up schedule
};
```

### Customization

Modify `server/services/investor-outreach/outreach-orchestrator.ts`:

```typescript
const CUSTOM_CONFIG = {
  dailyEmailLimit: 50,          // Reduce for testing
  followUpDays: [3, 7, 14],     // Add 14-day follow-up
};
```

## 🔒 Compliance

### CAN-SPAM Compliance
- ✅ Clear identification of sender
- ✅ Honest subject lines
- ✅ Physical address included
- ✅ Opt-out mechanism provided
- ✅ Opt-out honored within 10 days

### GDPR Considerations
- Leads collected from public business profiles
- Legitimate interest basis for B2B outreach
- Data deleted after 90 days if no engagement

## 📈 Metrics & Reporting

### Daily Report Output

```
📊 DAILY OUTREACH REPORT
═══════════════════════════════
📋 Total Leads in Database: 1,247
📧 Total Emails Sent (All Time): 3,891

Lead Status Breakdown:
  🆕 new          324
  📧 contacted    847
  💬 responded     52
  💰 converted     12
  🔴 bounced       8
  🚫 unsubscribed  4

📈 Response Rate: 6.14%
💰 Conversion Rate: 1.42%
═══════════════════════════════
```

## 🛠️ Manual Operations

### Import Leads from CSV

```typescript
import { importLeadsFromCSV } from './server/services/investor-outreach';

const leads = [
  { fullName: 'John Smith', email: 'john@vc.com', company: 'ABC Fund' },
  // ...
];

await importLeadsFromCSV(leads);
```

### Run Targeted Campaign

```typescript
import { runTargetedCampaign } from './server/services/investor-outreach';

await runTargetedCampaign(
  'Nashville Labels Q1 2025',
  'record_label',
  200
);
```

## ❓ Troubleshooting

### Common Issues

**Emails not sending:**
- Check Resend API key validity
- Verify sender domain is authenticated
- Check daily sending limits

**No leads collected:**
- Verify Apify API key
- Check Apify actor credits
- Review search query configurations

**Firebase errors:**
- Ensure service account has Firestore access
- Check collection permissions
- Verify index creation for queries

### Logs

Check GitHub Actions logs at:
`https://github.com/YOUR_REPO/actions/workflows/investor-outreach.yml`

## 📞 Support

For issues with this system:
1. Check logs in GitHub Actions
2. Review Firebase Console for data issues
3. Monitor Resend dashboard for delivery stats
4. Check Apify console for scraping issues
