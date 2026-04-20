# DevRolin CRM — Setup Guide

This guide details how to set up the DevRolin CRM, including the database, real-time services, and the LiveKit meeting integration.

## 1. Prerequisites
- **Node.js**: >= 18.x
- **PostgreSQL**: A running instance (local or hosted like Supabase/Neon)
- **Redis**: Required for sessions, presence, and rate-limiting
- **LiveKit Cloud**: A free account at [livekit.io](https://livekit.io/)

## 2. Environment Variables
Create a `.env` file in the root directory and populate it with the following:

```env
# Database
DATABASE_URL="postgresql://user:password@host:port/dbname?sslmode=require"

# Redis
REDIS_URL="redis://localhost:6379"

# Auth Secrets
ACCESS_TOKEN_SECRET="your_access_secret"
REFRESH_TOKEN_SECRET="your_refresh_secret"

# Google OAuth (Optional)
GOOGLE_CLIENT_ID="your_google_id"
GOOGLE_CLIENT_SECRET="your_google_secret"
NEXT_PUBLIC_GOOGLE_CLIENT_ID="your_google_id"

# Supabase Storage
SUPABASE_URL="your_supabase_url"
SUPABASE_ANON_KEY="your_anon_key"
SUPABASE_SERVICE_ROLE_KEY="your_service_role_key"

# LiveKit (Meetings)
LIVEKIT_URL="wss://your-project.livekit.cloud"
LIVEKIT_API_KEY="your_api_key"
LIVEKIT_API_SECRET="your_api_secret"

# Resend (Email)
RESEND_API_KEY="re_..."
RESEND_FROM_EMAIL="onboarding@resend.dev"

# hCaptcha (Public Careers)
HCAPTCHA_SECRET_KEY="0x..."
NEXT_PUBLIC_HCAPTCHA_SITE_KEY="your_site_key"

# AI (OpenRouter/Groq)
GROQ_API_KEY="gsk_..."
GROQ_MODEL_FAST="llama3-8b-8192"
GROQ_MODEL_COMPLEX="llama3-70b-8192"
GROQ_MODEL_JSON="llama3-70b-8192"

# App URL
NEXT_PUBLIC_APP_URL="http://localhost:3000"
NEXT_PUBLIC_HOCUSPOCUS_WS="ws://localhost:3001"
```

## 3. Installation

1.  **Install dependencies**:
    ```bash
    npm install
    ```
2.  **Generate Prisma Client**:
    ```bash
    npx prisma generate
    ```
3.  **Run Migrations**:
    ```bash
    npm run prisma:migrate
    ```
4.  **Bootstrap Admin Users**:
    ```bash
    npm run bootstrap:users
    ```

## 4. Development

You need to run two processes for full functionality:

1.  **Main Application**:
    ```bash
    npm run dev
    ```
2.  **Collaborative Docs (Hocuspocus)**:
    ```bash
    npm run hocuspocus:dev
    ```

## 5. LiveKit Setup
For detailed LiveKit configuration, including Egress (Recordings) and Webhooks, see the [LiveKit Setup Guide](./livekit-setup-guide.md).

## 6. Deployment
The application is built to be deployed on a Linux VPS using PM2 or Docker.
- Build: `npm run build`
- Start: `npm run start`

---

## Change Log
- 2026-04-21: Migrated from Jitsi to LiveKit Cloud. Updated all meeting components and API routes.
- 2026-04-18: Added Hocuspocus collaborative editing.
- 2026-04-15: Initial project setup.
