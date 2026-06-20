# Shotstack Video Rendering Setup

## Overview
This application uses **Shotstack** to render final music videos by combining multiple clips with audio into a single, high-quality MP4 file.

## Getting Your Shotstack API Key

### 1. Create a Shotstack Account
1. Visit [https://shotstack.io](https://shotstack.io)
2. Click **Sign Up** (or **Get Started**)
3. Complete the registration form
4. Verify your email address

### 2. Get Your API Key
1. Log in to your Shotstack dashboard
2. Navigate to **API Keys** in the left sidebar
3. You'll see two API keys:
   - **Stage** (Development/Testing) - Free sandbox environment
   - **Production** - Live rendering (requires credits)

### 3. Add API Key to Your Project
1. Copy your **Stage** API key (for development)
2. Open the `.env` file in your project root
3. Replace `your_shotstack_api_key_here` with your actual API key:

```env
SHOTSTACK_API_KEY=your_actual_api_key_here
```

## Pricing & Credits

### Sandbox (Stage) Environment
- **FREE** for testing and development
- Videos include a **Shotstack watermark**
- Perfect for testing the integration

### Production Environment
- **Pay-as-you-go**: $0.40 per rendered minute
- **Subscription plans** available (starting at $0.20/min)
- No watermarks on videos
- Higher priority rendering

### How to Switch Environments
In `server/services/video-rendering/shotstack-service.ts`, change the `SHOTSTACK_STAGE` environment variable:

```typescript
// Development (free with watermark)
SHOTSTACK_STAGE=stage

// Production (paid, no watermark)
SHOTSTACK_STAGE=v1
```

## How It Works

### 1. User Initiates Rendering
- User clicks **"Render Final Video"** in the Project Manager
- VideoRenderingModal opens with configuration options

### 2. Request Sent to Backend
- Timeline clips are converted to Shotstack format
- Audio track is added (if available)
- Request sent to Shotstack API

### 3. Cloud Rendering
- Shotstack processes the video in the cloud
- Status updates every 5 seconds via polling
- Progress bar shows real-time status

### 4. Video Delivery
- Once complete, video URL is returned
- User can preview and download the final MP4
- Project is automatically updated with the final video URL

## Features

### Resolution Options
- **720p** (HD) - Fast rendering
- **1080p** (Full HD) - Recommended
- **4K** (Ultra HD) - Best quality, slower rendering

### Quality Settings
- **Low** - Faster rendering, smaller file size
- **Medium** - Balanced
- **High** - Best quality (recommended)

### Automatic Features
- Fade transitions between clips
- Audio synchronization
- Clip length auto-detection
- Project status updates

## API Endpoints

### Start Rendering
```
POST /api/video-rendering/start
```

**Request Body:**
```json
{
  "projectId": 123,
  "clips": [
    {
      "id": "clip1",
      "videoUrl": "https://...",
      "start": 0,
      "duration": 5,
      "transition": "fade"
    }
  ],
  "audioUrl": "https://...",
  "audioDuration": 180,
  "resolution": "1080p",
  "quality": "high"
}
```

**Response:**
```json
{
  "success": true,
  "renderId": "abc123",
  "status": "queued",
  "progress": 10
}
```

### Check Status
```
GET /api/video-rendering/status/:renderId
```

**Response:**
```json
{
  "success": true,
  "renderId": "abc123",
  "status": "done",
  "url": "https://cdn.shotstack.io/...",
  "progress": 100
}
```

### Update Project
```
POST /api/video-rendering/update-project
```

**Request Body:**
```json
{
  "projectId": 123,
  "videoUrl": "https://cdn.shotstack.io/..."
}
```

## Troubleshooting

### "SHOTSTACK_API_KEY is not configured"
- Make sure you've added your API key to the `.env` file
- Restart your development server after adding the key

### "Error initiating rendering"
- Check that your API key is valid
- Verify you have available credits (for production)
- Check that clip URLs are publicly accessible

### "Rendering failed"
- Review the error message in the modal
- Check Shotstack dashboard for detailed error logs
- Verify all media URLs are valid and accessible

### Videos Have Watermark
- This is normal for the Stage (sandbox) environment
- Switch to Production environment to remove watermarks
- Production requires purchasing credits

## Support

- **Shotstack Documentation**: [https://shotstack.io/docs](https://shotstack.io/docs)
- **API Reference**: [https://shotstack.io/docs/api](https://shotstack.io/docs/api)
- **Support**: [https://shotstack.io/support](https://shotstack.io/support)

## Next Steps

1. Get your Shotstack API key (see above)
2. Add it to your `.env` file
3. Restart your server
4. Create a music video project with clips
5. Click **"Render Final Video"**
6. Enjoy your rendered music video!
