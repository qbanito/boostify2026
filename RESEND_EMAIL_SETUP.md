# Resend Email Integration Guide

## Overview
Boostify Music uses [Resend](https://resend.com) for transactional email notifications.

## Configuration

### API Key & Webhook Secret
The Resend credentials have been added to your `.env` file:
```
RESEND_API_KEY=re_KBRrLf8o_6CnSiPVBXuCGJ2tvnyxt5W3i
RESEND_WEBHOOK_SECRET=whsec_feLR14pDRXJJmtn4Bew2zt7aWereAtgd
```

### Domain Setup
Before sending emails, you need to verify your domain in Resend:

1. Go to [Resend Dashboard](https://resend.com/domains)
2. Click "Add Domain"
3. Enter: `boostifymusic.com`
4. Add the DNS records provided by Resend:
   - **SPF Record** (TXT)
   - **DKIM Record** (TXT)
   - **DMARC Record** (TXT)

## Webhook URL

Configure this webhook URL in Resend to receive email event notifications:

```
https://boostifymusic.com/api/webhooks/resend
```

### How to Set Up the Webhook in Resend:
1. Go to [Resend Webhooks](https://resend.com/webhooks)
2. Click "Add Webhook"
3. Enter the URL: `https://boostifymusic.com/api/webhooks/resend`
4. Select the events you want to receive:
   - ✅ `email.sent` - Email was sent
   - ✅ `email.delivered` - Email was delivered
   - ✅ `email.opened` - Email was opened
   - ✅ `email.clicked` - Link in email was clicked
   - ✅ `email.bounced` - Email bounced
   - ✅ `email.complained` - Email marked as spam
5. Click "Save"

## Email Templates

### 1. Artist Generated Email
Sent when a user generates a new AI artist.
- **Subject**: 🎵 Your AI Artist "{artistName}" is Ready!
- **Trigger**: After successful artist generation via `/api/artist/generate-artist/secure`

### 2. Welcome Email
Sent to new users upon registration.
- **Subject**: 🎵 Welcome to Boostify Music, {userName}!
- **Trigger**: User signup (integrate with Clerk webhooks)

### 3. Token Purchase Email
Sent when a user purchases artist tokens on BoostiSwap.
- **Subject**: 🪙 Token Purchase Confirmed - {amount} {symbol}
- **Trigger**: Successful blockchain transaction

### 4. Song Tokenized Email
Sent when a song is minted on-chain.
- **Subject**: 🎵 Song Tokenized: "{songTitle}" is now on-chain!
- **Trigger**: Song NFT minting

## Service Location

Email service: `server/services/resend-email-service.ts`
Webhook handler: `server/routes/resend-webhooks.ts`

## Usage Example

```typescript
import { sendArtistGeneratedEmail } from '../services/resend-email-service';

// Send artist generation notification
await sendArtistGeneratedEmail({
  userEmail: 'user@example.com',
  userName: 'John',
  artistName: 'Nova Star',
  artistSlug: 'nova-star',
  profileImageUrl: 'https://...',
  genres: ['Pop', 'Electronic'],
  songsCount: 10,
  tokenSymbol: 'BTF-NOV'
});
```

## Events Tracked via Webhook

| Event | Description |
|-------|-------------|
| `email.sent` | Email was successfully sent |
| `email.delivered` | Email reached recipient's inbox |
| `email.opened` | Recipient opened the email |
| `email.clicked` | Recipient clicked a link |
| `email.bounced` | Email bounced (invalid address) |
| `email.complained` | Email marked as spam |
| `email.delivery_delayed` | Delivery is delayed |

## Testing

To test the webhook locally, use ngrok:
```bash
ngrok http 3000
# Use the generated URL: https://xxxxx.ngrok.io/api/webhooks/resend
```

## Sender Configuration

All emails are sent from:
- **From**: `Boostify Music <noreply@boostifymusic.com>`
- **Support**: `support@boostifymusic.com`
