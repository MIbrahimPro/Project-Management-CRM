# LiveKit Setup Guide for DevRolin CRM

This guide covers setting up LiveKit for your DevRolin CRM using the **Free Tier** (LiveKit Cloud).

---

## Prerequisites

- Node.js 18+
- Access to LiveKit Cloud at https://cloud.livekit.io

---

## Step 1: Create LiveKit Cloud Account

1. Go to https://cloud.livekit.io
2. Sign up with your email
3. Verify your email address

**Note:** The free tier includes:
- 1,000 agent session minutes/month
- 100 WebRTC minutes
- 50 inbound minutes
- Telephony (1 free US local number)
- No credit card required

---

## Step 2: Create a New Project in LiveKit Cloud

1. After logging in, click **"Create Project"**
2. Choose a name (e.g., "devrolin-crm")
3. Select a region closest to your users:
   - US East (N. Virginia) - `us-east-1`
   - US West (Oregon) - `us-west-2`
   - EU Central (Frankfurt) - `eu-central-1`
   - AP South (Mumbai) - `ap-south-1`
4. Click **"Create Project"**

---

## Step 3: Get Your LiveKit Credentials

1. In your project dashboard, scroll to **"API Keys"**
2. Click **"Create API Key"**
3. Note down the credentials:

```
LIVEKIT_URL=https://<your-project>.livekit.cloud
LIVEKIT_API_KEY=<your-api-key>
LIVEKIT_API_SECRET=<your-api-secret>
```

**Important:** Keep these credentials secure and never commit them to version control.

---

## Step 4: Configure Environment Variables

Add these to your `.env` file:

```env
# LiveKit Configuration
LIVEKIT_URL=https://your-project.livekit.cloud
LIVEKIT_API_KEY=your_api_key_from_cloud
LIVEKIT_API_SECRET=your_api_secret_from_cloud

# Optional: Set the region for your LiveKit cluster
# LIVEKIT_REGION=us-east-1
```

**Note:** You can keep the old Jitsi variables for now - we'll remove them after migration.

---

## Step 5: Generate API Key and Secret (Alternative Method)

If you prefer using the LiveKit CLI:

1. Install the CLI:
   ```bash
   npm install -g @livekit/cli
   ```

2. Login to LiveKit:
   ```bash
   lk login
   ```

3. Create a new API key:
   ```bash
   lk api key create --name devrolin-crm --project <your-project-id>
   ```

4. Copy the generated key and secret to your `.env`

---

## Step 6: Configure IAM Permissions (Optional)

For enhanced security, you can configure custom API key permissions:

1. Go to your project in LiveKit Cloud
2. Navigate to **API Keys**
3. Edit your key's permissions:
   - **Connect**: Allow
   - **Admin**: Allow (if you need to manage rooms)
   - **Record**: Allow (if using recording features)

**Note:** For basic video meetings, default permissions are sufficient.

---

## Step 7: Test Your Connection

Create a test file `test-livekit.ts`:

```typescript
import { RoomServiceClient } from 'livekit-server-sdk';

async function testConnection() {
  const client = new RoomServiceClient('https://your-project.livekit.cloud', 'your_api_key', 'your_api_secret');
  
  try {
    const rooms = await client.listRooms();
    console.log('Connected successfully! Rooms:', rooms);
  } catch (error) {
    console.error('Connection failed:', error);
  }
}

testConnection();
```

Run with:
```bash
tsx test-livekit.ts
```

---

## Step 8: Configure CORS (If Needed)

If your CRM is on a custom domain, you may need to configure CORS in LiveKit Cloud:

1. Go to your project settings
2. Navigate to **CORS** settings
3. Add your CRM domain (e.g., `http://localhost:3000` for development)

---

## Step 9: Enable Server-Side Recording (Egress)
> [!IMPORTANT]
> LiveKit Cloud recording (Egress) requires a paid plan (billing enabled) and external storage configuration.

To enable automatic server-side recording that "just works" without user clicks:

1. **Configure Storage**: 
   - Go to **LiveKit Cloud Dashboard** -> **Settings** -> **Egress**.
   - Choose **S3** as the destination.
   - Enter your **Supabase S3-compatible credentials**:
     - **Endpoint**: `https://<project-id>.supabase.co/storage/v1/s3`
     - **Access Key**: Your Supabase project access key.
     - **Secret Key**: Your Supabase project secret key.
     - **Bucket**: `meetings` (ensure this bucket exists in Supabase Storage and is public or has correct RLS).

2. **Triggering via API**:
   - I have provided `startServerRecording(roomName, meetingId)` in `src/lib/livekit.ts`.
   - You can call this in `src/app/api/meetings/start/route.ts` when a meeting is created to start recording automatically.

3. **Costs**:
   - LiveKit Cloud charges ~$0.04/min for Composite Egress (recording the whole room).
   - Ensure your billing is set up or you have sufficient credits.

---

## Step 10: Manual Upload (Fallback)
If you prefer to avoid LiveKit Cloud recording costs, I have implemented a **Manual Upload** button on the Past Meetings page. This allows you to upload high-quality local recordings (from OBS, etc.) which are then sorted and stored in the CRM.

For some API calls, you'll need the Project ID:

1. In LiveKit Cloud, go to your project
2. Navigate to **Project Settings**
3. Copy the **Project ID**

Add to `.env`:
```env
LIVEKIT_PROJECT_ID=your-project-id-here
```

---

## Free Tier Limitations

Be aware of these free tier limits:

| Feature | Limit |
|---------|-------|
| Monthly session minutes | 1,000 |
| Monthly inbound minutes | 50 |
| Monthly WebRTC minutes | 100 |
| Telephony (US local) | 1 number |
| Support | Community only |

**Tips to stay within limits:**
- Recordings count toward usage
- Long meetings add up quickly
- Test with short meetings first

---

## Troubleshooting

### Connection Issues

If you see connection errors:

1. Verify environment variables are set:
   ```bash
   echo $LIVEKIT_URL
   echo $LIVEKIT_API_KEY
   ```

2. Check network connectivity:
   ```bash
   ping your-project.livekit.cloud
   ```

3. Verify API key hasn't expired in LiveKit Cloud

### Authentication Errors

1. Ensure your API key and secret match exactly
2. Check for extra whitespace in environment variables
3. Regenerate credentials in LiveKit Cloud if needed

### Meeting Join Issues

1. Verify the room name format: `devrolin-{meetingId}`
2. Check token expiration (default: 1 hour)
3. Ensure user has correct permissions in LiveKit Cloud

---

## Next Steps

After setup:

1. Run the migration script to replace Jitsi with LiveKit
2. Test with a simple 1:1 meeting
3. Gradually migrate all meeting types
4. Monitor usage in LiveKit Cloud dashboard

---

## Support Resources

- [LiveKit Documentation](https://docs.livekit.io)
- [LiveKit React SDK](https://docs.livekit.io/client-sdk-kotlin/)
- [LiveKit API Reference](https://docs.livekit.io/server-sdk-typescript/)
- [Community Discord](https://discord.gg/livekit)

---

## Cost Estimation

If you exceed free tier limits:

| Plan | Price | Includes |
|------|-------|----------|
| Free | $0 | 1,000 agent min, 100 WebRTC min |
| Startup | $79/mo | 50,000 WebRTC min |
| Growth | $299/mo | 200,000 WebRTC min |
| Scale | Custom | Unlimited |

---

*This guide is for DevRolin CRM LiveKit integration.*
