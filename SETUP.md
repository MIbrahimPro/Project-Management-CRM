# DevRolin CRM — Complete Setup Guide

## Table of Contents
1. [Prerequisites & Tools](#1-prerequisites--tools)
2. [External Services Setup](#2-external-services-setup)
3. [Environment Variables](#3-environment-variables)
4. [Local Development](#4-local-development)
5. [VPS Production Deployment](#5-vps-production-deployment)
6. [App Navigation Guide](#6-app-navigation-guide)
7. [Testing Guide](#7-testing-guide)

---

## 1. Prerequisites & Tools

### Install These First

| Tool | Version | Install |
|------|---------|---------|
| Node.js | 18+ (LTS) | https://nodejs.org |
| npm | 9+ | Included with Node |
| Git | any | https://git-scm.com |
| Redis | 7+ | See below |

**Redis (local dev):**
- **Windows**: Use [Memurai](https://www.memurai.com/) or WSL2 + `sudo apt install redis-server`
- **macOS**: `brew install redis && brew services start redis`
- **Linux**: `sudo apt install redis-server && sudo systemctl enable redis`

Verify: `redis-cli ping` → should return `PONG`

---

## 2. External Services Setup

You need accounts on these services. Most have generous free tiers.

### 2.1 Supabase (Database + File Storage)
1. Go to https://supabase.com → Create account → New project
2. **Database URL**: Settings → Database → Connection string → URI mode
   - Copy the URI (starts with `postgresql://`)
   - Replace `[YOUR-PASSWORD]` with your project password
3. **API Keys**: Settings → API
   - Copy `Project URL` → `SUPABASE_URL`
   - Copy `service_role` key (secret) → `SUPABASE_SERVICE_ROLE_KEY`
   - Copy `anon` key → `SUPABASE_ANON_KEY`
4. **Storage bucket**: Storage → New bucket → Name: `devrolin-files` → Private (NOT public) → Create

### 2.2 Resend (Email)
1. Go to https://resend.com → Create account
2. API Keys → Create API Key → Copy → `RESEND_API_KEY`
3. Domains → Add your domain (or use `onboarding@resend.dev` for testing on free plan)
4. Set `RESEND_FROM_EMAIL` to a verified sender (e.g. `noreply@yourdomain.com`)

### 2.3 OpenRouter (AI)
1. Go to https://openrouter.ai → Create account
2. API Keys → Create key → Copy → `OPENROUTER_API_KEY`
3. Free models available (project uses `qwen/qwen3-235b-a22b:free` by default)
4. `AI_MODEL` env var is optional — defaults to the free Qwen model

### 2.4 VAPID Keys (Web Push Notifications)
Run this once to generate your keys:
```bash
npx web-push generate-vapid-keys
```
Copy the output:
- Public Key → `VAPID_PUBLIC_KEY` and `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
- Private Key → `VAPID_PRIVATE_KEY`
- Set `VAPID_EMAIL` to `mailto:your@email.com`

### 2.5 Google OAuth (optional)
1. Go to https://console.cloud.google.com
2. New project → APIs & Services → OAuth 2.0 Client IDs
3. Application type: Web application
4. Authorized redirect URIs: `http://localhost:3000/api/auth/google/callback` (dev)
   and `https://yourdomain.com/api/auth/google/callback` (prod)
5. Copy Client ID → `GOOGLE_CLIENT_ID` + `NEXT_PUBLIC_GOOGLE_CLIENT_ID`
6. Copy Client Secret → `GOOGLE_CLIENT_SECRET`

### 2.6 hCaptcha (Public Job Applications)
1. Go to https://hcaptcha.com → Create account → New site
2. Site key → `NEXT_PUBLIC_HCAPTCHA_SITE_KEY`
3. Settings → Secret Key → `HCAPTCHA_SECRET_KEY`

### 2.7 Jitsi Meet (Video Meetings — optional)
- Use a public Jitsi server for testing: `JITSI_DOMAIN=meet.jit.si`
- For production: self-host Jitsi or use 8x8 Jitsi-as-a-Service
- `JITSI_APP_ID` and `JITSI_APP_SECRET` are from your Jitsi deployment

---

## 3. Environment Variables

Create a `.env` file in the project root:

```env
# ── Database ─────────────────────────────────────────────────
DATABASE_URL="postgresql://postgres:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres"

# ── Redis ────────────────────────────────────────────────────
REDIS_URL="redis://localhost:6379"

# ── JWT Secrets (generate random strings, min 32 chars) ──────
ACCESS_TOKEN_SECRET="your-random-access-secret-at-least-32-chars"
REFRESH_TOKEN_SECRET="your-random-refresh-secret-at-least-32-chars"

# Generate secrets: node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"

# ── Supabase ─────────────────────────────────────────────────
SUPABASE_URL="https://[PROJECT].supabase.co"
SUPABASE_ANON_KEY="eyJ..."
SUPABASE_SERVICE_ROLE_KEY="eyJ..."

# ── Email (Resend) ────────────────────────────────────────────
RESEND_API_KEY="re_..."
RESEND_FROM_EMAIL="noreply@yourdomain.com"

# ── AI (OpenRouter) ───────────────────────────────────────────
OPENROUTER_API_KEY="sk-or-..."
AI_MODEL="qwen/qwen3-235b-a22b:free"

# ── Web Push (VAPID) ──────────────────────────────────────────
VAPID_PUBLIC_KEY="BG..."
VAPID_PRIVATE_KEY="..."
NEXT_PUBLIC_VAPID_PUBLIC_KEY="BG..."
VAPID_EMAIL="mailto:your@email.com"

# ── Google OAuth (optional) ───────────────────────────────────
GOOGLE_CLIENT_ID="....apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="GOCSPX-..."
NEXT_PUBLIC_GOOGLE_CLIENT_ID="....apps.googleusercontent.com"

# ── hCaptcha ─────────────────────────────────────────────────
HCAPTCHA_SECRET_KEY="..."
NEXT_PUBLIC_HCAPTCHA_SITE_KEY="..."

# ── Jitsi Meet ────────────────────────────────────────────────
JITSI_DOMAIN="meet.jit.si"
JITSI_APP_ID="your-app-id"
JITSI_APP_SECRET="your-jitsi-secret"

# ── App ───────────────────────────────────────────────────────
NEXT_PUBLIC_APP_URL="http://localhost:3000"
PORT=3000

# ── Hocuspocus (Collaborative Docs) ──────────────────────────
NEXT_PUBLIC_HOCUSPOCUS_WS="ws://localhost:3001"

# ── Bootstrap Accounts (first run only) ──────────────────────
SUPER_ADMIN_EMAIL="superadmin@yourdomain.com"
SUPER_ADMIN_PASSWORD="SuperSecure123!"
SUPER_ADMIN_NAME="Super Admin"
ADMIN_EMAIL="admin@yourdomain.com"
ADMIN_PASSWORD="AdminSecure123!"
ADMIN_NAME="Admin User"
```

---

## 4. Local Development

### 4.1 Install dependencies
```bash
npm install
```

### 4.2 Set up database
```bash
# Push schema to Supabase (use db push, not migrate)
npm run prisma:generate
npm run prisma:migrate

# Seed SystemConfig defaults
npx ts-node prisma/seed.ts
```

### 4.3 Create initial admin accounts
```bash
npm run bootstrap:users
```
This creates the SUPER_ADMIN and ADMIN accounts using your env vars.

### 4.4 Start all services

**Terminal 1 — Main app:**
```bash
npm run dev
```

**Terminal 2 — Hocuspocus (collaborative docs):**
```bash
npx ts-node hocuspocus-server.ts
```

**Terminal 3 — Redis (if not running as service):**
```bash
redis-server
```

App runs at: http://localhost:3000

### 4.5 Prisma Studio (DB browser)
```bash
npm run prisma:studio
```
Opens at: http://localhost:5555

---

## 5. VPS Production Deployment

### 5.1 Server requirements
- Ubuntu 22.04 LTS (recommended)
- 2+ CPU cores, 4GB+ RAM
- 20GB+ storage
- Open ports: 80, 443, 3000 (or behind nginx)

### 5.2 Install server tools
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Redis
sudo apt install -y redis-server
sudo systemctl enable redis-server
sudo systemctl start redis-server

# PM2 (process manager)
sudo npm install -g pm2

# Nginx
sudo apt install -y nginx

# Certbot (SSL)
sudo apt install -y certbot python3-certbot-nginx
```

### 5.3 Clone and configure
```bash
git clone https://github.com/your-org/devrolin-crm.git /var/www/devrolin
cd /var/www/devrolin

# Create .env (copy from your local, update URLs)
nano .env
# Change NEXT_PUBLIC_APP_URL to https://yourdomain.com
# Change REDIS_URL to redis://127.0.0.1:6379
# Change NEXT_PUBLIC_HOCUSPOCUS_WS to wss://yourdomain.com/collab
```

### 5.4 Build and seed
```bash
npm install
npm run prisma:generate
npm run prisma:migrate
npx ts-node prisma/seed.ts
npm run bootstrap:users
npm run build
```

### 5.5 PM2 process configuration
Create `/var/www/devrolin/ecosystem.config.js`:
```javascript
module.exports = {
  apps: [
    {
      name: "devrolin-crm",
      script: "server.ts",
      interpreter: "npx",
      interpreter_args: "ts-node",
      env: { NODE_ENV: "production", PORT: 3000 },
      max_memory_restart: "1G",
      instances: 1,
    },
    {
      name: "devrolin-hocuspocus",
      script: "hocuspocus-server.ts",
      interpreter: "npx",
      interpreter_args: "ts-node",
      env: { NODE_ENV: "production" },
    },
  ],
};
```

```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
# Run the command it outputs
```

### 5.6 Nginx configuration
```nginx
# /etc/nginx/sites-available/devrolin
server {
    server_name yourdomain.com www.yourdomain.com;

    # Main app
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 86400;
    }

    # Hocuspocus WebSocket (collaborative docs)
    location /collab {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }

    listen 80;
}
```

```bash
sudo ln -s /etc/nginx/sites-available/devrolin /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# SSL
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

### 5.7 Updates
```bash
cd /var/www/devrolin
git pull
npm install
npm run prisma:generate
npm run prisma:migrate
npm run build
pm2 restart all
```

---

## 6. App Navigation Guide

### Login
- URL: `/login`
- Use the SUPER_ADMIN or ADMIN credentials from your `.env`
- Google OAuth available if configured

### Role-Based Navigation

| Role | Available Pages |
|------|----------------|
| SUPER_ADMIN | Everything + `/control` (super admin panel) |
| ADMIN | Dashboard, Projects, Chat, Tasks, Workspaces, HR, Finance, Attendance, Admin Panel |
| PROJECT_MANAGER | Dashboard, Projects, Chat, Tasks, Workspaces, HR, Attendance |
| DEVELOPER/DESIGNER | Dashboard, Projects, Chat, Tasks, Workspaces, Attendance |
| HR | Dashboard, Projects, Chat, Tasks, HR, Attendance |
| ACCOUNTANT | Dashboard, Chat, Tasks, Finance, Attendance |
| SALES | Dashboard, Projects, Chat, Tasks, Attendance |
| CLIENT | Dashboard, Projects (own), Chat (client channel only) |

### Key Features by Page

**Dashboard** (`/dashboard`)
- Overview stats, recent activity, check-in button (top navbar)
- Widgets vary by role

**Projects** (`/projects`)
- Grid of projects (role-filtered)
- Create button → 4-step wizard (managers/admins only)
- Clients see "Submit Request" button
- Click project → sub-sidebar appears with: Dashboard, Chat, Documents, Questions

**Chat** (`/chat`)
- All Hands (general group) pinned first
- DM list below, sorted by last message
- New DM button → search users
- In-project chat: role-filtered room list sidebar

**Tasks** (`/tasks`)
- List/Board toggle (top right)
- Board = Kanban (drag cards between columns)
- Click task → detail page with embedded chat

**Workspaces** (`/workspaces`)
- Content/social media boards
- Each workspace has IDEA/IN_PROGRESS/IN_REVIEW/APPROVED/PUBLISHED/ARCHIVED columns

**HR** (`/hr`) — HR roles only
- Pipeline summary cards
- Hiring requests list
- Attendance alerts sidebar
- Create hiring request → fill details → HR/Manager approve → Admin approves → Publish → Get public link

**Finance** (`/accountant`) — ADMIN/ACCOUNTANT only
- Summary cards (income/expense/profit)
- Currency switcher
- Add income/expense entries
- Receipt file upload
- Void entries

**Attendance** (`/attendance`)
- Check in/out buttons
- Duration timer while checked in
- History table

**Admin Panel** (`/admin`) — ADMIN/SUPER_ADMIN only
- Users table with search
- Click user → detail panel (sessions, edit, deactivate, password reset)
- Hiring Approvals tab

**Super Admin** (`/control`) — SUPER_ADMIN only
- Never linked in UI — navigate directly
- System Config, Audit Logs, Sessions, Blacklist, Push Test, DB Stats

**AI Assistant**
- Floating sparkle button (bottom-right, all pages except CLIENT)
- Slide-in chat panel, not persisted

**Settings** (`/settings`)
- Appearance, notifications, work hours, Google OAuth, currency preference

---

## 7. Testing Guide

### 7.1 Install test dependencies
```bash
npm install --save-dev jest @types/jest ts-jest supertest @types/supertest
```

Create `jest.config.js`:
```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
  testMatch: ['**/__tests__/**/*.test.ts'],
  setupFilesAfterFramework: ['<rootDir>/src/__tests__/setup.ts'],
};
```

### 7.2 Critical flows to test manually

#### Auth Flow
1. **Login**: Go to `/login` → enter ADMIN credentials → should redirect to `/dashboard`
2. **Token refresh**: Open DevTools → Application → Cookies → wait 30 min or manually expire `access_token` cookie → make any API call → should auto-refresh (no redirect to login)
3. **Logout**: Click profile avatar → Logout → should redirect to `/login` and clear cookies

#### Check-in System
1. Login as DEVELOPER
2. Go to `/attendance` → click "Check In" → badge shows PRESENT/LATE
3. Wait a few seconds → click "Check Out"
4. History table should show today's record

#### Project Creation (ADMIN/PROJECT_MANAGER)
1. Go to `/projects` → "New Project"
2. Step 1: Title, select client (optional)
3. Step 2: Add milestones or use AI Generate
4. Step 3: Select team members
5. Step 4: Review → Create
6. Should appear in project list

#### Chat Real-time
1. Open two browser tabs with different user accounts
2. Go to the same chat room
3. Type in one tab → message appears in other tab in real-time
4. Try reactions, file uploads, voice notes

#### Kanban Drag and Drop
1. Go to `/tasks` → switch to Board view
2. Drag a task card to a different column
3. Refresh → card should stay in new column (persisted via API)

#### AI Assistant
1. Click sparkle button (bottom-right)
2. Type: "Write a project proposal for a mobile app"
3. Should get a response within a few seconds

#### Hiring Pipeline (HR role)
1. Login as HR → `/hr` → "New Request"
2. Fill title, role, description, deadline
3. Add questions for applicants
4. Submit → status: DRAFT
5. HR approves, Manager approves
6. Admin goes to `/admin/hiring` → approves
7. Back to HR → request → Publish → get public link
8. Open the public link in incognito → fill application form + hCaptcha → Submit
9. Return to HR page → see candidate in pipeline

### 7.3 API endpoint tests

Create `src/__tests__/setup.ts`:
```typescript
import { prisma } from '@/lib/prisma';
afterAll(async () => { await prisma.$disconnect(); });
```

Create `src/__tests__/auth.test.ts`:
```typescript
import { describe, it, expect } from '@jest/globals';

const BASE = 'http://localhost:3000';

describe('Auth endpoints', () => {
  it('POST /api/auth/login rejects bad credentials', async () => {
    const res = await fetch(`${BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'fake@test.com', password: 'wrong' }),
    });
    expect(res.status).toBe(401);
  });

  it('GET /api/auth/me returns 401 without cookie', async () => {
    const res = await fetch(`${BASE}/api/auth/me`);
    expect(res.status).toBe(401);
  });

  it('GET /api/dashboard requires auth', async () => {
    const res = await fetch(`${BASE}/api/dashboard`);
    expect(res.status).toBe(401);
  });
});
```

Create `src/__tests__/public.test.ts`:
```typescript
describe('Public endpoints', () => {
  it('GET /api/public/careers/nonexistent returns 404', async () => {
    const res = await fetch('http://localhost:3000/api/public/careers/nonexistent-slug');
    expect(res.status).toBe(404);
  });
});
```

Run tests (app must be running):
```bash
npx jest --testPathPattern=auth
npx jest --testPathPattern=public
# Run all:
npx jest
```

### 7.4 What to look for

| Scenario | Expected |
|----------|----------|
| Login with wrong password | 401, "Invalid credentials" toast |
| Access `/control` as non-SUPER_ADMIN | 404 page |
| Access `/admin` as DEVELOPER | Redirected or empty |
| Check in twice same day | 409 "Already checked in" toast |
| Create project with same title | Should succeed (no unique constraint on title) |
| Upload file >20MB in chat | Should be rejected by size limit |
| Void an already-voided entry | 409 "Already voided" |
| DM yourself | Should be prevented by `/api/chat/rooms/dm` logic |
| Send push to user without subscription | Should silently succeed (no subscription = no-op) |

### 7.5 Debugging

**Logs:**
```bash
# PM2 (production)
pm2 logs devrolin-crm
pm2 logs devrolin-hocuspocus

# Development
# Logs appear in the terminal running npm run dev
```

**Prisma Studio** — browse live data:
```bash
npm run prisma:studio
```

**Redis CLI** — inspect cache:
```bash
redis-cli
KEYS *              # all keys
GET presence:userId # check user presence
KEYS session:*      # active sessions
```

**Audit Log** — see all admin actions:
```bash
# In Prisma Studio: AuditLog table
# Or in Super Admin panel: /control → Audit Logs tab
```

**TypeScript check:**
```bash
npx tsc --noEmit
```

**Lint:**
```bash
npm run lint
```
