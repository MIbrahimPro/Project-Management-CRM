# DevRolin CRM

A full-stack project management and CRM for software agencies. Built on Next.js 14 (App Router), TypeScript, PostgreSQL via Prisma, Redis, and Socket.io.

## Features

- **Projects & Milestones** — AI-generated milestones and questions, client approval flows
- **Tasks & Kanban** — Drag-and-drop task management with per-task chat rooms
- **Real-time Chat** — Socket.io rooms for teams, clients, DMs, with voice notes and file sharing
- **Collaborative Docs** — BlockNote editors with Yjs/Hocuspocus real-time collaboration
- **HR Module** — Hiring pipeline with candidates, AI scoring, public job pages with hCaptcha
- **Attendance** — Check-in/out with late detection, away pings, auto-checkout
- **Finance/Accounting** — Multi-currency entries, void support, receipt uploads
- **AI Sidebar** — Groq-powered assistant with role-filtered context
- **Jitsi Meetings** — One-click meeting starts with JWT-authenticated rooms
- **Push Notifications** — Web Push via VAPID, Socket.io real-time delivery
- **Admin Panel** — User management, session control, password resets
- **Super Admin Panel** — System config, audit logs, blacklist monitoring

## Tech Stack

Next.js 14 · TypeScript · Prisma · PostgreSQL · Redis · Socket.io · Supabase Storage · BlockNote · Yjs · Hocuspocus · Groq · Resend · hCaptcha · Web Push

## Setup

See [SETUP.md](./SETUP.md) for full instructions including environment variables, external services, and local development.

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Set up environment variables (copy .env.example or create .env.local)
cp .env .env.local
# Edit .env.local with your credentials

# 3. Run database migrations
npm run prisma:migrate

# 4. Start dev server
npm run dev
```

**Requires three running processes:**
1. `npm run dev` — Next.js + Express + Socket.io (port 3000)
2. `npm run hocuspocus:dev` — Collaborative editing server (port 3001)
3. `redis-server` — Redis (run in WSL on Windows)

## Scripts

```bash
npm run dev              # Dev server (ts-node server.ts + Next.js)
npm run build            # Production build
npm run lint            # ESLint
npm run prisma:migrate   # Run Prisma migrations
npm run prisma:generate # Regenerate Prisma client
npm run prisma:studio   # Open Prisma Studio GUI
npm run bootstrap:users # Upsert test accounts (SUPER_ADMIN + ADMIN)
```

## Role Hierarchy

`SUPER_ADMIN` → `ADMIN` → `PROJECT_MANAGER` → `DEVELOPER` → `DESIGNER` → `HR` → `ACCOUNTANT` → `SALES` → `CLIENT`

## License

Private — all rights reserved.